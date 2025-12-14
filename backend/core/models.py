from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import date
from django.db.models.signals import post_save
from django.dispatch import receiver
import uuid

# --- GESTÃO DA CASA (MULTI-TENANCY) ---

class House(models.Model):
    name = models.CharField(max_length=100, verbose_name="Nome da Casa")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class HouseMember(models.Model):
    ROLES = [('MASTER', 'Master'), ('MEMBER', 'Membro')]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='house_member')
    house = models.ForeignKey(House, on_delete=models.CASCADE, related_name='members')
    role = models.CharField(max_length=10, choices=ROLES, default='MEMBER')

    def __str__(self):
        return f"{self.user.username} - {self.house.name}"

# --- CATEGORIAS ---

class Category(models.Model):
    TYPES = [('INCOME', 'Receita'), ('EXPENSE', 'Despesa')]
    
    house = models.ForeignKey(House, on_delete=models.CASCADE, related_name='categories')
    name = models.CharField(max_length=50)
    type = models.CharField(max_length=10, choices=TYPES, default='EXPENSE')
    
    class Meta:
        verbose_name = "Categoria"
        verbose_name_plural = "Categorias"

    def __str__(self):
        return f"{self.name} ({self.get_type_display()})"

# --- MÓDULO FINANCEIRO ---

class Account(models.Model):
    """Conta Corrente ou Carteira"""
    house = models.ForeignKey(House, on_delete=models.CASCADE, related_name='accounts')
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_accounts')
    name = models.CharField(max_length=50)
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    limit = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_shared = models.BooleanField(default=True, verbose_name="Compartilhado com a casa?")

    def __str__(self):
        return f"{self.name} - R$ {self.balance}"

class CreditCard(models.Model):
    house = models.ForeignKey(House, on_delete=models.CASCADE, related_name='credit_cards')
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_cards')
    name = models.CharField(max_length=50)
    limit_total = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Limite Total")
    limit_available = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Limite Disponível", default=0)
    closing_day = models.IntegerField(verbose_name="Dia Fechamento")
    due_day = models.IntegerField(verbose_name="Dia Vencimento")
    is_shared = models.BooleanField(default=True)

    def __str__(self):
        return self.name

class Invoice(models.Model):
    STATUS_CHOICES = [('OPEN', 'Aberta'), ('CLOSED', 'Fechada'), ('PAID', 'Paga')]

    card = models.ForeignKey(CreditCard, on_delete=models.CASCADE, related_name='invoices')
    reference_date = models.DateField(help_text="Data de referência")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='OPEN')
    value = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    # NOVO CAMPO: Para controlar pagamentos parciais
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    def __str__(self):
        return f"{self.card.name} - {self.status}"

class RecurringBill(models.Model):
    house = models.ForeignKey(House, on_delete=models.CASCADE, related_name='recurring_bills')
    name = models.CharField(max_length=100)
    base_value = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Valor Base")
    due_day = models.IntegerField(verbose_name="Dia de Vencimento")
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

from django.db import models
from django.utils import timezone
# Certifique-se de importar suas outras models (House, Category, Account, etc)

class Transaction(models.Model):
    TYPES = [('INCOME', 'Receita'), ('EXPENSE', 'Despesa')]

    house = models.ForeignKey(House, on_delete=models.CASCADE, related_name='transactions')
    description = models.CharField(max_length=100)
    value = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField(default=timezone.now)
    type = models.CharField(max_length=10, choices=TYPES)
    
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    is_shared = models.BooleanField(default=False)
    
    # --- NOVOS CAMPOS DE AUDITORIA ---
    # Resolve o erro de order_by('-created_at')
    created_at = models.DateTimeField(auto_now_add=True) 
    updated_at = models.DateTimeField(auto_now=True)
    
    # Relacionamentos opcionais
    account = models.ForeignKey(Account, on_delete=models.CASCADE, null=True, blank=True, related_name='transactions')
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, null=True, blank=True, related_name='transactions')
    recurring_bill = models.ForeignKey(RecurringBill, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')

    def save(self, *args, **kwargs):
        # 1. Verifica se é uma criação nova (não tem ID ainda)
        is_new = self.pk is None
        
        # 2. SE FOR NOVO: Define a privacidade automaticamente antes de salvar
        if is_new:
            # Prioridade 1: Herdar da Conta Bancária
            if self.account:
                self.is_shared = self.account.is_shared
            
            # Prioridade 2: Herdar do Cartão de Crédito (via Fatura)
            elif self.invoice and self.invoice.card:
                self.is_shared = self.invoice.card.is_shared
        
        # 3. Salva a transação no banco
        super().save(*args, **kwargs)

        # 4. Lógica de Atualização de Saldo (Opcional, se você estiver usando)
        if is_new and self.account:
            if self.type == 'EXPENSE':
                self.account.balance -= self.value
            elif self.type == 'INCOME':
                self.account.balance += self.value
            self.account.save()

# --- MÓDULO ESTOQUE ---

class Product(models.Model):
    house = models.ForeignKey(House, on_delete=models.CASCADE, related_name='products', null=True)
    name = models.CharField(max_length=100, verbose_name="Nome do Produto")
    measure_unit = models.CharField(max_length=10, default='un')
    estimated_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    # NOVO CAMPO: Define o padrão para este produto
    min_quantity = models.DecimalField(max_digits=8, decimal_places=2, default=1, verbose_name="Qtd Mínima Padrão")

    def __str__(self):
        return self.name

class InventoryItem(models.Model):
    house = models.ForeignKey(House, on_delete=models.CASCADE, related_name='inventory')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    min_quantity = models.DecimalField(max_digits=8, decimal_places=2, default=1, verbose_name="Qtd Mínima")

    class Meta:
        unique_together = ('house', 'product') 

    def __str__(self):
        return f"{self.product.name}: {self.quantity}"

class ShoppingList(models.Model):
    house = models.ForeignKey(House, on_delete=models.CASCADE, related_name='shopping_list')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity_to_buy = models.DecimalField(max_digits=8, decimal_places=2, default=1)
    
    # NOVOS CAMPOS FINANCEIROS
    real_unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name="Preço Real (Un)")
    discount_unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name="Preço c/ Desc (Un)")
    
    is_purchased = models.BooleanField(default=False) # "No Carrinho"

    def __str__(self):
        return f"Comprar: {self.product.name}"
    
class TransactionItem(models.Model):
    """Itens detalhados de uma transação (compra de mercado)"""
    # Mantemos related_name='items' para o serializer achar fácil
    transaction = models.ForeignKey(Transaction, on_delete=models.CASCADE, related_name='items')
    
    # Mudança: Em vez de Product (ID), usamos Description (Texto)
    description = models.CharField(max_length=255) 
    
    # Simplificando valores para alinhar com o frontend
    value = models.DecimalField(max_digits=10, decimal_places=2) # Valor total do item
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)

    def __str__(self):
        return f"{self.description} ({self.quantity})"
    
class HouseInvitation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    house = models.ForeignKey(House, on_delete=models.CASCADE)
    inviter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_invitations')
    email = models.EmailField(verbose_name="E-mail do Convidado")
    created_at = models.DateTimeField(auto_now_add=True)
    accepted = models.BooleanField(default=False)

    def __str__(self):
        return f"Convite para {self.email} ({self.house.name})"
    
@receiver(post_save, sender=HouseMember)
def enforce_master_role_for_creator(sender, instance, created, **kwargs):
    """
    Garante que o PRIMEIRO membro de qualquer casa seja sempre MASTER.
    Funciona tanto para cadastro quanto para criação manual.
    """
    if created:
        # Conta quantos membros essa casa tem
        members_count = HouseMember.objects.filter(house=instance.house).count()
        
        # Se só tem 1 (que é este que acabou de ser criado), ele TEM que ser Master
        if members_count == 1:
            # Precisamos usar update() para evitar recursão infinita do signal
            HouseMember.objects.filter(id=instance.id).update(role='MASTER')
            print(f"👑 Usuário {instance.user.username} definido como MASTER da casa {instance.house.name} (Primeiro Membro).")