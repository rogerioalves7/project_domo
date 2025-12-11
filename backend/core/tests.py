from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth.models import User
from .models import (
    House, HouseMember, HouseInvitation, Account, Transaction, 
    Product, InventoryItem, ShoppingList
)

# ============================================================================
# 1. TESTES DE FLUXO DE CONVITE (INVITE -> REGISTER -> JOIN)
# ============================================================================
class InvitationFlowTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # 1. Cria o Admin e sua Casa (Setup Explícito)
        self.admin_user = User.objects.create_user(username='admin', email='admin@domo.com', password='123')
        self.admin_house = House.objects.create(name=f"Casa de {self.admin_user.username}")
        HouseMember.objects.create(user=self.admin_user, house=self.admin_house, role='ADMIN')
        
        # Loga como Admin
        self.client.force_authenticate(user=self.admin_user)

    def test_invite_and_join_flow(self):
        # A. ENVIAR CONVITE
        invite_data = {'email': 'novo@domo.com'}
        response = self.client.post('/invitations/', invite_data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        invite = HouseInvitation.objects.get(email='novo@domo.com')
        self.assertFalse(invite.accepted)

        # B. CRIAR NOVO USUÁRIO (Simula registro)
        self.client.logout()
        new_user = User.objects.create_user(username='novo_user', email='novo@domo.com', password='123')
        
        # Simula o cenário onde o usuário tem uma "Casa Padrão" indesejada (criada pelo RegisterView/Signal)
        if not HouseMember.objects.filter(user=new_user).exists():
            default_house = House.objects.create(name="Casa Padrão Indesejada")
            HouseMember.objects.create(user=new_user, house=default_house, role='ADMIN')
        
        # Captura ID para verificar deleção
        default_member = HouseMember.objects.get(user=new_user)
        default_house_id = default_member.house.id

        # C. ACEITAR O CONVITE (JOIN - Troca de Casa)
        self.client.force_authenticate(user=new_user)
        join_data = {'token': str(invite.id)}
        response = self.client.post('/invitations/join/', join_data)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # D. VERIFICAÇÕES FINAIS
        # O convite deve ter sumido
        self.assertFalse(HouseInvitation.objects.filter(id=invite.id).exists())
        
        # O usuário deve estar na casa do Admin
        current_member = HouseMember.objects.get(user=new_user)
        self.assertEqual(current_member.house.id, self.admin_house.id)
        self.assertEqual(current_member.role, 'MEMBER')
        
        # A casa padrão antiga deve ter sido deletada
        self.assertFalse(House.objects.filter(id=default_house_id).exists())


# ============================================================================
# 2. TESTES DE PERMISSÕES (ADMIN vs MEMBER)
# ============================================================================
class PermissionsTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Admin e Casa
        self.admin = User.objects.create_user(username='admin_perm', password='123')
        self.house = House.objects.create(name="Casa Admin")
        self.admin_record = HouseMember.objects.create(user=self.admin, house=self.house, role='ADMIN')
        
        # Membro Comum na mesma casa
        self.member = User.objects.create_user(username='member_perm', password='123')
        self.member_record = HouseMember.objects.create(user=self.member, house=self.house, role='MEMBER')

    def test_member_cannot_delete_admin(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.delete(f'/members/{self.admin_record.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_delete_member(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(f'/members/{self.member_record.id}/')
        self.assertTrue(status.is_success(response.status_code)) # 200 ou 204
        self.assertFalse(HouseMember.objects.filter(id=self.member_record.id).exists())


# ============================================================================
# 3. TESTES DE FLUXO FINANCEIRO
# ============================================================================
class FinanceFlowTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='fin_user', password='123')
        
        self.house = House.objects.create(name="Casa Finanças")
        HouseMember.objects.create(user=self.user, house=self.house, role='ADMIN')
        
        # Cria uma conta com saldo inicial (e define owner)
        self.account = Account.objects.create(house=self.house, name="Nubank", balance=1000.00, owner=self.user)
        
        self.client.force_authenticate(user=self.user)

    def test_create_expense_transaction(self):
        data = {
            'description': 'Mercado',
            'value': 100.00,
            'type': 'EXPENSE',
            'account': self.account.id,
            'date': '2025-12-10',
            'payment_method': 'ACCOUNT'
        }
        
        response = self.client.post('/transactions/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Transaction.objects.filter(description='Mercado').exists())


# ============================================================================
# 4. TESTES DE ISOLAMENTO DE DADOS (SEGURANÇA ENTRE CASAS)
# ============================================================================
class DataIsolationTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # CASA A
        self.user_a = User.objects.create_user(username='spy', password='123')
        self.house_a = House.objects.create(name="Casa A")
        HouseMember.objects.create(user=self.user_a, house=self.house_a, role='ADMIN')
        
        # CASA B (A Vítima)
        self.user_b = User.objects.create_user(username='victim', password='123')
        self.house_b = House.objects.create(name="Casa B")
        HouseMember.objects.create(user=self.user_b, house=self.house_b, role='ADMIN')
        
        # Dados da Vítima
        self.account_b = Account.objects.create(
            house=self.house_b, 
            name="Conta Secreta", 
            balance=1000000,
            owner=self.user_b # Importante definir o dono
        )

    def test_user_a_cannot_see_user_b_data(self):
        # Loga como Usuário A
        self.client.force_authenticate(user=self.user_a)
        
        # Tenta listar contas
        response = self.client.get('/accounts/')
        
        # Deve retornar 200 OK (lista vazia), mas NÃO deve conter a conta B
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_user_a_cannot_access_user_b_detail(self):
        # Loga como Usuário A
        self.client.force_authenticate(user=self.user_a)
        
        # Tenta acessar diretamente o ID da conta B
        response = self.client.get(f'/accounts/{self.account_b.id}/')
        
        # Deve retornar 404 (Não encontrado para este usuário)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ============================================================================
# 5. TESTES DE ESTOQUE E AUTOMAÇÃO DE COMPRAS
# ============================================================================
class InventoryFlowTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        self.user = User.objects.create_user(username='stock_master', password='123')
        self.house = House.objects.create(name="Casa Estoque")
        HouseMember.objects.create(user=self.user, house=self.house, role='ADMIN')
        
        self.account = Account.objects.create(house=self.house, name="Carteira", balance=500.00, owner=self.user)
        
        self.client.force_authenticate(user=self.user)
        
        # Produto e Estoque Inicial (Saudável: 10 > 5)
        self.product = Product.objects.create(house=self.house, name="Leite", min_quantity=5, estimated_price=10.00)
        self.item = InventoryItem.objects.create(house=self.house, product=self.product, quantity=10, min_quantity=5)

    def test_low_stock_automation_and_purchase(self):
        # 1. CONSUMO: Baixa estoque para 2 (Abaixo do min 5)
        self.client.patch(f'/inventory/{self.item.id}/', {'quantity': 2})
        
        # 2. GATILHO: Acessa lista de compras (backend deve gerar item)
        response = self.client.get('/shopping-list/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(float(response.data[0]['quantity_to_buy']), 5.00) # Deve sugerir comprar o mínimo

        # 3. FINALIZAR COMPRA
        list_item_id = response.data[0]['id']
        
        # Marca como comprado
        self.client.patch(f'/shopping-list/{list_item_id}/', {'is_purchased': True})
        
        # Finaliza
        finish_data = {
            'payment_method': 'ACCOUNT',
            'source_id': self.account.id,
            'total_value': 50.00,
            'date': '2025-12-10'
        }
        response_finish = self.client.post('/shopping-list/finish/', finish_data)
        self.assertEqual(response_finish.status_code, status.HTTP_200_OK)

        # 4. VERIFICAÇÃO FINAL
        # Estoque deve ter subido (2 + 5 = 7)
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, 7)
        
        # Lista de compras deve estar vazia
        self.assertFalse(ShoppingList.objects.filter(house=self.house).exists())

# ============================================================================
# 6. TESTE DE CADASTRO PADRÃO (SEM CONVITE) - O 8º TESTE
# ============================================================================
class RegistrationTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_without_invite_creates_house_and_admin(self):
        """ 
        Garante que um cadastro comum cria automaticamente:
        1. O Usuário
        2. Uma Casa Padrão
        3. O Vínculo de ADMIN
        """
        data = {
            'username': 'new_admin',
            'email': 'admin@new.com',
            'password': 'strongpassword123'
        }
        
        response = self.client.post('/register/', data)
        
        # 1. Verifica sucesso na criação
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('token', response.data)
        
        # 2. Verifica banco de dados
        user = User.objects.get(email='admin@new.com')
        
        # O usuário deve ter um HouseMember
        self.assertTrue(HouseMember.objects.filter(user=user).exists())
        
        member = HouseMember.objects.get(user=user)
        
        # A casa deve ter o nome correto
        self.assertEqual(member.house.name, "Casa de new_admin")
        
        # O papel DEVE ser ADMIN (Correção crítica que fizemos na View)
        self.assertEqual(member.role, 'ADMIN')