from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Q, F
from django.db import models 
from dateutil.relativedelta import relativedelta
import datetime
from decimal import Decimal
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth.models import User
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from django.core.mail import send_mail
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.core.exceptions import ObjectDoesNotExist # Importante para exceções

# Importação completa dos Models e Serializers
from .models import (
    House, HouseMember, Account, CreditCard, Invoice, 
    Transaction, Product, InventoryItem, ShoppingList, 
    RecurringBill, Category, TransactionItem, HouseInvitation
)
from .serializers import (
    HouseSerializer, HouseMemberSerializer, AccountSerializer, 
    CreditCardSerializer, InvoiceSerializer, TransactionSerializer, 
    ProductSerializer, InventoryItemSerializer, ShoppingListSerializer, 
    RecurringBillSerializer, CategorySerializer, TransactionItemSerializer, 
    HouseInvitationSerializer
)

# ======================================================================
# VIEWSETS BASE
# ======================================================================

class BaseHouseViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'house_member'):
            return self.queryset.model.objects.none()
        return self.queryset.model.objects.filter(house=user.house_member.house)

    def perform_create(self, serializer):
        user = self.request.user
        if hasattr(user, 'house_member'):
            house = user.house_member.house
            if hasattr(serializer.Meta.model, 'owner'):
                serializer.save(house=house, owner=user)
            else:
                serializer.save(house=house)

# ======================================================================
# CONFIGURAÇÃO E REGISTRO
# ======================================================================

class HouseViewSet(viewsets.ModelViewSet):
    queryset = House.objects.all()
    serializer_class = HouseSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'house_member'):
            return House.objects.filter(id=user.house_member.house.id)
        return House.objects.none()

class HouseMemberViewSet(BaseHouseViewSet):
    queryset = HouseMember.objects.all()
    serializer_class = HouseMemberSerializer

    def destroy(self, request, *args, **kwargs):
        # 1. Quem está tentando deletar?
        requester = request.user
        
        # 2. Verifica se o solicitante tem vínculo com a casa
        if not hasattr(requester, 'house_member'):
            return Response({'error': 'Você não é membro desta casa.'}, status=status.HTTP_403_FORBIDDEN)
            
        # 3. VERIFICAÇÃO DE SEGURANÇA: O solicitante é ADMIN?
        if requester.house_member.role != 'ADMIN':
            return Response({'error': 'Apenas administradores podem remover membros.'}, status=status.HTTP_403_FORBIDDEN)

        # 4. Impede que o usuário delete a si mesmo por esta rota (opcional, mas bom para UX)
        instance = self.get_object()
        if instance.user == requester:
             return Response({'error': 'Você não pode se remover/banir. Use a opção "Sair da Casa".'}, status=status.HTTP_400_BAD_REQUEST)

        return super().destroy(request, *args, **kwargs)

class CategoryViewSet(BaseHouseViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

# ======================================================================
# HISTÓRICO E ANÁLISE
# ======================================================================

class HistoryViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        from django.db.models.functions import TruncMonth
        from django.db.models import Sum

        user = self.request.user
        if not hasattr(user, 'house_member'):
            return Response([])
        
        house = user.house_member.house
        today = datetime.date.today()
        
        start_date = today - relativedelta(months=11)
        start_date = start_date.replace(day=1)

        transactions = Transaction.objects.filter(
            house=house, 
            date__gte=start_date
        ).annotate(month=TruncMonth('date')).values(
            'month', 'type', 'value', 'category__name', 'description', 'date', 'id'
        ).order_by('-month')

        estimated_fixed = RecurringBill.objects.filter(
            house=house, is_active=True
        ).aggregate(total=Sum('base_value'))['total'] or 0

        history = {}
        
        for t in transactions:
            month_str = t['month'].strftime('%Y-%m')
            
            if month_str not in history:
                history[month_str] = {
                    'month_label': t['month'],
                    'income': 0,
                    'expense': 0,
                    'estimated_expense': estimated_fixed,
                    'categories': {},
                    'transactions': []
                }
            
            val = float(t['value'])
            
            history[month_str]['transactions'].append({
                'id': t['id'],
                'description': t['description'],
                'value': val,
                'type': t['type'],
                'date': t['date'],
                'category': t['category__name'] or 'Outros'
            })

            if t['type'] == 'INCOME':
                history[month_str]['income'] += val
            else:
                history[month_str]['expense'] += val
                cat_name = t['category__name'] or 'Geral'
                history[month_str]['categories'][cat_name] = history[month_str]['categories'].get(cat_name, 0) + val

        result = []
        for key, data in history.items():
            chart_data = [{'name': k, 'value': v} for k, v in data['categories'].items()]
            chart_data.sort(key=lambda x: x['value'], reverse=True)

            result.append({
                'id': key,
                'date': data['month_label'],
                'income': data['income'],
                'expense': data['expense'],
                'estimated': float(data['estimated_expense']),
                'balance': data['income'] - data['expense'],
                'chart_data': chart_data,
                'transactions': data['transactions']
            })

        return Response(result)

# ======================================================================
# FINANCEIRO
# ======================================================================

class AccountViewSet(BaseHouseViewSet):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer
    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'house_member'): return Account.objects.none()
        house = user.house_member.house
        return Account.objects.filter(house=house).filter(Q(owner=user) | Q(is_shared=True))

class CreditCardViewSet(BaseHouseViewSet):
    queryset = CreditCard.objects.all()
    serializer_class = CreditCardSerializer
    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'house_member'): return CreditCard.objects.none()
        house = user.house_member.house
        return CreditCard.objects.filter(house=house).filter(Q(owner=user) | Q(is_shared=True))

class InvoiceViewSet(BaseHouseViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'house_member'): return Invoice.objects.none()
        return Invoice.objects.filter(card__house=user.house_member.house)

    @action(detail=True, methods=['post'])
    def pay(self, request, pk=None):
        try:
            invoice = self.get_object()
            account_id = request.data.get('account_id')
            payment_value = Decimal(str(request.data.get('value')))
            date_payment = request.data.get('date', datetime.date.today())

            account = Account.objects.get(id=account_id, house=invoice.card.house)
            
            Transaction.objects.create(
                house=invoice.card.house,
                description=f"Pagamento Fatura {invoice.card.name}",
                value=payment_value,
                type='EXPENSE',
                account=account,
                date=date_payment,
                category=None 
            )

            invoice.amount_paid += payment_value
            if invoice.amount_paid >= invoice.value:
                invoice.status = 'PAID'
            invoice.save()

            current_available = invoice.card.limit_available
            max_limit = invoice.card.limit_total
            new_available = current_available + payment_value
            if new_available > max_limit: new_available = max_limit
            
            invoice.card.limit_available = new_available
            invoice.card.save()

            return Response({'message': 'Fatura paga com sucesso'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class RecurringBillViewSet(BaseHouseViewSet):
    queryset = RecurringBill.objects.all()
    serializer_class = RecurringBillSerializer
    def get_queryset(self):
        return super().get_queryset().filter(is_active=True).order_by('due_day')

class TransactionViewSet(BaseHouseViewSet):
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer
    def get_queryset(self):
        return super().get_queryset().order_by('-date', '-id')

    def create(self, request, *args, **kwargs):
        payment_method = request.data.get('payment_method')
        card_id = request.data.get('card_id')
        installments = int(request.data.get('installments', 1))
        if installments < 1: installments = 1
        
        if request.data.get('type') == 'EXPENSE' and payment_method == 'CREDIT_CARD' and card_id:
            try:
                card = CreditCard.objects.get(id=card_id)
                house = request.user.house_member.house
                total_value = Decimal(str(request.data.get('value')))
                purchase_date = datetime.datetime.strptime(request.data.get('date'), '%Y-%m-%d').date()
                description_base = request.data.get('description')
                category_id = request.data.get('category') or None
                
                installment_value = round(total_value / installments, 2)
                first_installment_value = total_value - (installment_value * (installments - 1))

                for i in range(installments):
                    val = first_installment_value if i == 0 else installment_value
                    target_date = purchase_date + relativedelta(months=i)
                    if target_date.day >= card.closing_day:
                        target_date = target_date + relativedelta(months=1)
                    reference_date = target_date.replace(day=1)

                    invoice, _ = Invoice.objects.get_or_create(
                        card=card, reference_date=reference_date,
                        defaults={'value': 0, 'amount_paid': 0, 'status': 'OPEN'}
                    )
                    invoice.value = Decimal(str(invoice.value)) + val
                    invoice.save()

                    desc = f"{description_base}" + (f" ({i+1}/{installments})" if installments > 1 else "")
                    Transaction.objects.create(
                        house=house, description=desc, value=val, date=purchase_date,
                        type='EXPENSE', category_id=category_id, invoice=invoice
                    )

                card.limit_available -= total_value
                card.save()
                return Response({'message': 'Transação parcelada criada'}, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return super().create(request, *args, **kwargs)

# ======================================================================
# ESTOQUE E PRODUTOS
# ======================================================================

class ProductViewSet(BaseHouseViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

class InventoryViewSet(BaseHouseViewSet):
    queryset = InventoryItem.objects.all()
    serializer_class = InventoryItemSerializer
    
    def perform_create(self, serializer):
        user = self.request.user
        product_id = self.request.data.get('product')
        product = Product.objects.get(id=product_id)
        min_qty = self.request.data.get('min_quantity')
        if not min_qty: min_qty = product.min_quantity
        serializer.save(house=user.house_member.house, min_quantity=min_qty)

# ======================================================================
# SHOPPING LIST
# ======================================================================

class ShoppingListViewSet(BaseHouseViewSet):
    queryset = ShoppingList.objects.all()
    serializer_class = ShoppingListSerializer

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'house_member'):
            return ShoppingList.objects.none()
        
        house = user.house_member.house
        
        low_stock_items = InventoryItem.objects.filter(
            house=house,
            quantity__lte=models.F('min_quantity')
        )

        for item in low_stock_items:
            ShoppingList.objects.get_or_create(
                house=house,
                product=item.product,
                defaults={
                    'quantity_to_buy': item.min_quantity, 
                    'real_unit_price': item.product.estimated_price,
                    'discount_unit_price': item.product.estimated_price
                }
            )

        healthy_stock_product_ids = InventoryItem.objects.filter(
            house=house,
            quantity__gt=models.F('min_quantity')
        ).values_list('product_id', flat=True)

        ShoppingList.objects.filter(
            house=house,
            product_id__in=healthy_stock_product_ids,
            is_purchased=False
        ).delete()

        return ShoppingList.objects.filter(house=house).order_by('is_purchased', 'product__name')

    @action(detail=False, methods=['post'])
    def finish(self, request):
        user = self.request.user
        house = user.house_member.house
        
        payment_method = request.data.get('payment_method') 
        source_id = request.data.get('source_id')
        total_paid = Decimal(str(request.data.get('total_value', 0)))
        purchase_date = request.data.get('date', datetime.date.today())

        if not payment_method or not source_id:
            return Response({'error': 'Selecione uma forma de pagamento.'}, status=status.HTTP_400_BAD_REQUEST)

        purchased_items = ShoppingList.objects.filter(house=house, is_purchased=True)
        if not purchased_items.exists():
            return Response({'error': 'Carrinho vazio. Marque os itens comprados.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            account = None
            invoice = None
            description = "Compra de Mercado"

            category, _ = Category.objects.get_or_create(
                house=house,
                name="Compras",
                defaults={'type': 'EXPENSE'}
            )

            if payment_method == 'ACCOUNT':
                account = Account.objects.get(id=source_id, house=house)
                
            elif payment_method == 'CREDIT_CARD':
                card = CreditCard.objects.get(id=source_id, house=house)
                if total_paid > card.limit_available:
                    return Response({'error': 'Limite insuficiente no cartão.'}, status=status.HTTP_400_BAD_REQUEST)
                
                today = datetime.date.today()
                if today.day >= card.closing_day:
                    today = today + relativedelta(months=1)
                ref_date = today.replace(day=1)
                
                invoice, _ = Invoice.objects.get_or_create(
                    card=card, reference_date=ref_date,
                    defaults={'value': 0, 'status': 'OPEN'}
                )
                invoice.value += total_paid
                invoice.save()
                
                card.limit_available -= total_paid
                card.save()
                description = f"Mercado ({card.name})"

            transaction = Transaction.objects.create(
                house=house,
                description=description,
                value=total_paid,
                type='EXPENSE',
                account=account,
                invoice=invoice,
                category=category, 
                date=purchase_date
            )

            count = 0
            for shop_item in purchased_items:
                qty = shop_item.quantity_to_buy
                
                price = shop_item.real_unit_price if shop_item.real_unit_price > 0 else shop_item.product.estimated_price
                if shop_item.discount_unit_price > 0:
                    price = shop_item.discount_unit_price

                TransactionItem.objects.create(
                    transaction=transaction,
                    product=shop_item.product,
                    quantity=qty,
                    unit_price=price,
                    total_price=price * qty
                )

                inv_item, _ = InventoryItem.objects.get_or_create(
                    house=house, product=shop_item.product, 
                    defaults={'min_quantity': 1}
                )
                inv_item.quantity += qty
                inv_item.save()

                if price > 0 and price != shop_item.product.estimated_price:
                    shop_item.product.estimated_price = price
                    shop_item.product.save()

                shop_item.delete()
                count += 1

            return Response({'message': f'Compra finalizada! {count} itens processados.'}, status=status.HTTP_200_OK)

        except Account.DoesNotExist:
            return Response({'error': 'Conta não encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        except CreditCard.DoesNotExist:
            return Response({'error': 'Cartão não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"ERRO FINISH: {str(e)}") 
            return Response({'error': f"Erro interno: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

# ======================================================================
# GESTÃO DE USUÁRIO E CONVITES
# ======================================================================

class InvitationViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    # LISTAR CONVITES PENDENTES (GET /invitations/)
    def list(self, request):
        user = request.user
        if not hasattr(user, 'house_member'):
            return Response([])
        
        house = user.house_member.house
        invites = HouseInvitation.objects.filter(house=house, accepted=False).order_by('-created_at')
        serializer = HouseInvitationSerializer(invites, many=True)
        return Response(serializer.data)

    # ENVIAR CONVITE (POST /invitations/)
    def create(self, request):
        from django.core.mail import send_mail
        from django.conf import settings

        email = request.data.get('email')
        user = request.user
        
        if not hasattr(user, 'house_member'):
            return Response({'error': 'Você não pertence a uma casa.'}, status=400)
            
        house = user.house_member.house
        
        if HouseInvitation.objects.filter(house=house, email=email, accepted=False).exists():
            return Response({'error': 'Já existe um convite pendente para este e-mail.'}, status=400)

        if HouseMember.objects.filter(house=house, user__email=email).exists():
             return Response({'error': 'Este usuário já faz parte da casa.'}, status=400)

        invitation = HouseInvitation.objects.create(house=house, inviter=user, email=email)

        invite_link = f"http://localhost:5173/accept-invite/{invitation.id}"
        
        try:
            send_mail(
                f"Convite: Junte-se à casa {house.name}",
                f"Olá! {user.username} convidou você.\nLink: {invite_link}",
                settings.EMAIL_HOST_USER,
                [email],
                fail_silently=False,
            )
            return Response({'message': 'Convite enviado por e-mail!'})
        except:
            print(f"Link do convite: {invite_link}")
            return Response({'message': 'Convite criado (Link no terminal).'})

    # EXCLUIR CONVITE (DELETE /invitations/{pk}/)
    def destroy(self, request, pk=None):
        user = request.user
        house = user.house_member.house
        
        try:
            invite = HouseInvitation.objects.get(id=pk, house=house)
            invite.delete()
            return Response({'message': 'Convite cancelado.'}, status=status.HTTP_200_OK)
        except HouseInvitation.DoesNotExist:
            return Response({'error': 'Convite não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    # ACEITAR CONVITE (POST /invitations/accept/)
    @action(detail=False, methods=['post'])
    def accept(self, request):
        token = request.data.get('token')
        user = request.user

        if not token:
            return Response({'error': 'Token de convite não fornecido.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # OBTENÇÃO E VALIDAÇÃO ROBUSTA
        try:
            invitation = HouseInvitation.objects.get(id=token, accepted=False)
            
            # Validação 1: O usuário logado é o convidado?
            if invitation.email != user.email:
                # O usuário está logado, mas com o email errado.
                return Response({'error': 'Este convite não é para o seu e-mail. Por favor, faça login com a conta correta.'}, status=status.HTTP_403_FORBIDDEN)
            
            # Validação 2: O usuário já está nessa casa?
            if HouseMember.objects.filter(user=user, house=invitation.house).exists():
                invitation.delete() # Limpa o convite usado
                return Response({'error': 'Você já é membro desta casa.'}, status=status.HTTP_400_BAD_REQUEST)

            # Ação: Criar o vínculo HouseMember
            HouseMember.objects.create(user=user, house=invitation.house, role='MEMBER')
            invitation.accepted = True
            invitation.save()
            # Alternativa: invitation.delete()

            return Response({'message': f'Bem-vindo à casa {invitation.house.name}!'})
        
        except HouseInvitation.DoesNotExist:
            return Response({'error': 'Convite inválido, expirado ou já utilizado.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            # Captura erros gerais (como problemas no HouseMember.create, etc.)
            print(f"ERRO CRÍTICO AO ACEITAR CONVITE: {str(e)}")
            return Response({'error': 'Erro interno ao processar o convite.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError, ObjectDoesNotExist
from django.db import IntegrityError
# ... (mantenha os outros imports como APIView, AllowAny, Response, etc.)

class RegisterView(APIView):
    permission_classes = [AllowAny] 

    def post(self, request):
        username = request.data.get('username')
        email = request.data.get('email')
        password = request.data.get('password')
        invitation_token = request.data.get('invitation_token') 

        # 1. VALIDAÇÃO BÁSICA DE CAMPOS
        if not username or not password or not email:
            return Response({'error': 'Por favor, preencha todos os campos (Usuário, E-mail e Senha).'}, status=status.HTTP_400_BAD_REQUEST)

        # 2. VALIDAÇÃO DE UNICIDADE (Amigável)
        if User.objects.filter(username=username).exists():
            return Response({'error': f'O usuário "{username}" já está em uso. Escolha outro.'}, status=status.HTTP_400_BAD_REQUEST)
        
        if User.objects.filter(email=email).exists():
            return Response({'error': f'O e-mail "{email}" já possui cadastro. Tente fazer login.'}, status=status.HTTP_400_BAD_REQUEST)

        # 3. VALIDAÇÃO DE FORÇA DA SENHA (Django Native)
        try:
            validate_password(password)
        except ValidationError as e:
            # Retorna a mensagem exata do Django (ex: "A senha deve ter pelo menos 8 caracteres")
            return Response({'error': ' '.join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

        # 4. VALIDAÇÃO DO CONVITE (Lógica do Porteiro)
        if invitation_token:
            try:
                invite = HouseInvitation.objects.get(id=invitation_token, accepted=False)
                
                # Validação de Segurança: E-mail deve bater
                if invite.email != email:
                    return Response({
                        'error': f'Convite inválido para este e-mail. O convite foi enviado para "{invite.email}", mas você está cadastrando "{email}".'
                    }, status=status.HTTP_400_BAD_REQUEST)
                    
            except (ObjectDoesNotExist, ValueError):
                return Response({'error': 'O link de convite é inválido, expirou ou já foi utilizado.'}, status=status.HTTP_400_BAD_REQUEST)

        # 5. CRIAÇÃO DA CONTA (Atomicidade)
        try:
            # Cria o usuário
            user = User.objects.create_user(username=username, email=email, password=password)
            
            # Garante a criação da Casa Padrão (Se o signal falhou ou não existe)
            if not HouseMember.objects.filter(user=user).exists():
                house_name = f"Casa de {username}"
                house = House.objects.create(name=house_name)
                HouseMember.objects.create(user=user, house=house, role='ADMIN')

            # Gera Token
            token, _ = Token.objects.get_or_create(user=user)

            return Response({
                'token': token.key,
                'user_id': user.pk,
                'username': user.username,
                'email': user.email
            }, status=status.HTTP_201_CREATED)
            
        except IntegrityError:
            return Response({'error': 'Erro de integridade: Este usuário ou e-mail já foi registrado simultaneamente.'}, status=status.HTTP_400_BAD_REQUEST)
        
        except Exception as e:
            # Erro genérico final (para bugs de código)
            print(f"ERRO CRÍTICO NO REGISTRO: {str(e)}")
            return Response({'error': 'Ocorreu um erro interno ao criar sua conta. Por favor, tente novamente.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    permission_classes = [AllowAny] 

    def post(self, request):
        username = request.data.get('username')
        email = request.data.get('email')
        password = request.data.get('password')
        # Captura o token apenas para validação (opcional no payload)
        invitation_token = request.data.get('invitation_token') 

        if not username or not password or not email:
            return Response({'error': 'Preencha todos os campos.'}, status=status.HTTP_400_BAD_REQUEST)

        # --- NOVA VALIDAÇÃO PRÉ-CRIAÇÃO (O Porteiro) ---
        if invitation_token:
            try:
                # Busca o convite
                invite = HouseInvitation.objects.get(id=invitation_token, accepted=False)
                
                # VERIFICAÇÃO CRÍTICA: O e-mail bate?
                if invite.email != email:
                    return Response({
                        'error': f'Este convite foi enviado para {invite.email}, não para {email}. Corrija o e-mail ou use outro convite.'
                    }, status=status.HTTP_400_BAD_REQUEST)
                    
            except (HouseInvitation.DoesNotExist, ValueError):
                # Se o token for lixo ou não existir, avisamos antes de criar a conta
                return Response({'error': 'O convite fornecido é inválido ou expirou.'}, status=status.HTTP_400_BAD_REQUEST)
        # ------------------------------------------------

        if User.objects.filter(username=username).exists():
            return Response({'error': 'Nome de usuário já existe.'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email=email).exists():
            return Response({'error': 'E-mail já cadastrado.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # 1. Cria o usuário (Agora seguro, pois passamos pelas validações)
            user = User.objects.create_user(username=username, email=email, password=password)
            
            # 2. Cria a Casa Padrão (Fallback manual para garantir Admin)
            if not HouseMember.objects.filter(user=user).exists():
                house_name = f"Casa de {username}"
                house = House.objects.create(name=house_name)
                HouseMember.objects.create(user=user, house=house, role='ADMIN')

            # 3. Retorna Token
            token, _ = Token.objects.get_or_create(user=user)

            return Response({
                'token': token.key,
                'user_id': user.pk,
                'username': user.username,
                'email': user.email
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
class InvitationViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    # --- NOVO MÉTODO: SWAP DE CASA (TROCA) ---
    @action(detail=False, methods=['post'], url_path='join')
    def join_house(self, request):
        token = request.data.get('token')
        user = request.user

        if not token:
            return Response({'error': 'Token não fornecido.'}, status=400)

        try:
            invite = HouseInvitation.objects.get(id=token, accepted=False)
            
            # 1. Limpeza: Encontra e deleta a casa padrão criada pelo signal
            # (Geralmente é a única casa onde ele é ADMIN e está sozinho)
            try:
                default_member = HouseMember.objects.get(user=user, role='ADMIN')
                default_house = default_member.house
                
                # Só deleta se a casa tiver apenas 1 membro (o próprio usuário)
                if HouseMember.objects.filter(house=default_house).count() == 1:
                    default_member.delete()
                    default_house.delete()
                else:
                    # Se ele já tem dados ou outros membros, apenas remove o vínculo
                    default_member.delete()

            except ObjectDoesNotExist:
                pass # Se não tiver casa padrão, segue o jogo

            # 2. Cria o vínculo correto
            HouseMember.objects.create(
                user=user,
                house=invite.house,
                role='MEMBER'
            )

            # 3. Finaliza convite
            invite.accepted = True
            invite.delete()

            return Response({'message': f'Bem-vindo à casa {invite.house.name}!'}, status=200)

        except HouseInvitation.DoesNotExist:
            return Response({'error': 'Convite inválido ou expirado.'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    # ... (Métodos list, create, destroy mantidos iguais) ...
    def list(self, request):
        user = request.user
        if not hasattr(user, 'house_member'): return Response([])
        house = user.house_member.house
        invites = HouseInvitation.objects.filter(house=house, accepted=False).order_by('-created_at')
        serializer = HouseInvitationSerializer(invites, many=True)
        return Response(serializer.data)

    def create(self, request):
        email = request.data.get('email')
        user = request.user
        if not hasattr(user, 'house_member'): return Response({'error': 'Sem casa vinculada.'}, status=400)
        house = user.house_member.house
        
        # Validar duplicidade
        if HouseInvitation.objects.filter(house=house, email=email, accepted=False).exists():
            return Response({'error': 'Convite já pendente.'}, status=400)
        if HouseMember.objects.filter(house=house, user__email=email).exists():
             return Response({'error': 'Usuário já na casa.'}, status=400)

        invitation = HouseInvitation.objects.create(house=house, inviter=user, email=email)
        # Atenção ao IP/Porta do Frontend aqui
        invite_link = f"http://localhost:5173/accept-invite/{invitation.id}" 
        
        try:
            send_mail(
                f"Convite: {house.name}",
                f"Entre na casa: {invite_link}",
                settings.EMAIL_HOST_USER,
                [email],
                fail_silently=False,
            )
            return Response({'message': 'E-mail enviado!'})
        except:
            print(f"LINK CONVITE: {invite_link}")
            return Response({'message': 'Convite criado (Link no terminal).'})

    def destroy(self, request, pk=None):
        user = request.user
        house = user.house_member.house
        try:
            invite = HouseInvitation.objects.get(id=pk, house=house)
            invite.delete()
            return Response({'message': 'Cancelado.'})
        except:
            return Response({'error': 'Não encontrado.'}, status=404)
        
class CustomAuthToken(ObtainAuthToken):
    """
    View de Login personalizada que retorna Token + Dados do Usuário.
    Isso garante que o frontend receba o 'username' correto mesmo logando com e-mail.
    """
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, created = Token.objects.get_or_create(user=user)
        
        return Response({
            'token': token.key,
            'user_id': user.pk,
            'username': user.username, # <--- O DADO IMPORTANTE
            'email': user.email
        })