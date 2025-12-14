from rest_framework import serializers
from django.contrib.auth.models import User
from django.utils import timezone
from .models import (
    House, HouseMember, Account, CreditCard, Invoice, 
    Transaction, Product, InventoryItem, ShoppingList, 
    RecurringBill, Category, TransactionItem, HouseInvitation
)

# --- USUÁRIOS E CASA ---

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']

class HouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = House
        fields = '__all__'

class HouseMemberSerializer(serializers.ModelSerializer):
    # Campos extras para facilitar o frontend
    user_name = serializers.ReadOnlyField(source='user.username')
    user_email = serializers.ReadOnlyField(source='user.email')

    class Meta:
        model = HouseMember
        fields = ['id', 'user', 'user_name', 'user_email', 'house', 'role']

# --- FINANCEIRO ---

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'
        read_only_fields = ['house']

class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        # Adicione 'limit' na lista ou use '__all__'
        fields = ['id', 'name', 'balance', 'limit', 'is_shared', 'house', 'owner'] 
        read_only_fields = ['house', 'owner']

class InvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = '__all__'

class CreditCardSerializer(serializers.ModelSerializer):
    invoice_info = serializers.SerializerMethodField()

    class Meta:
        model = CreditCard
        fields = '__all__'
        read_only_fields = ['house', 'owner']

    def get_invoice_info(self, obj):
        # Pega a primeira fatura ABERTA ou FECHADA (mas não PAGA)
        # Ordena pela data mais antiga para mostrar a próxima a vencer
        invoice = obj.invoices.exclude(status='PAID').order_by('reference_date').first()
        
        if invoice:
            # Garante que o valor exibido desconte o que já foi pago parcialmente
            remaining = invoice.value - invoice.amount_paid
            if remaining < 0: remaining = 0
            
            return {
                'id': invoice.id,
                'value': remaining, # Aqui vai o valor atualizado pela View
                'total_value': invoice.value,
                'status': invoice.get_status_display(), # Aberta/Fechada
                'due_date': invoice.reference_date # Data aproximada
            }
        
        # Se não tiver nenhuma fatura pendente
        return {
            'id': None, 
            'value': 0, 
            'status': 'Sem Fatura', 
            'due_date': None
        }
    
class RecurringBillSerializer(serializers.ModelSerializer):
    # Campo extra para informar se está pago
    is_paid_this_month = serializers.SerializerMethodField()
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = RecurringBill
        fields = ['id', 'name', 'base_value', 'due_day', 'category', 'category_name', 'is_paid_this_month']
        read_only_fields = ['house']

    def get_is_paid_this_month(self, obj):
        now = timezone.now()
        # Procura uma transação nesta casa, vinculada a esta conta fixa, no mês e ano atuais
        return Transaction.objects.filter(
            house=obj.house,
            recurring_bill=obj,
            date__month=now.month,
            date__year=now.year
        ).exists()

class TransactionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionItem
        fields = ['id', 'description', 'value', 'quantity']

class TransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)
    
    # Campo calculado para identificar o cartão (usado no filtro do histórico)
    card_id = serializers.IntegerField(source='invoice.card.id', read_only=True, allow_null=True)

    class Meta:
        model = Transaction
        fields = [
            'id', 'description', 'value', 'type', 'date', 
            'category', 'category_name', 
            'account', 'account_name', 
            'card_id', 
            'invoice', 'items', 'recurring_bill' 
            # REMOVIDO: 'installments'
        ]

# --- ESTOQUE E COMPRAS ---

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'
        read_only_fields = ['house']

class InventoryItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_unit = serializers.CharField(source='product.measure_unit', read_only=True)
    class Meta:
        model = InventoryItem
        fields = '__all__'
        read_only_fields = ['house']

class ShoppingListSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_unit = serializers.CharField(source='product.measure_unit', read_only=True)
    
    # --- AQUI ESTAVA O PROBLEMA: Precisamos expor o preço estimado do produto ---
    estimated_price = serializers.DecimalField(source='product.estimated_price', max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = ShoppingList
        fields = '__all__'
        read_only_fields = ['house']

class HouseInvitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = HouseInvitation
        fields = '__all__'

class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

class PasswordResetConfirmSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, min_length=6)
    uid = serializers.CharField()
    token = serializers.CharField()

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=6)

class ChangeEmailSerializer(serializers.Serializer):
    password = serializers.CharField(required=True)
    new_email = serializers.EmailField(required=True)