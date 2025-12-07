from rest_framework import serializers
from django.contrib.auth.models import User
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
    user_name = serializers.CharField(source='user.username', read_only=True)
    class Meta:
        model = HouseMember
        fields = '__all__'

# --- FINANCEIRO ---

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'
        read_only_fields = ['house']

class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = '__all__'
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
        invoice = obj.invoices.exclude(status='PAID').order_by('reference_date').first()
        if invoice:
            remaining = invoice.value - invoice.amount_paid
            if remaining < 0: remaining = 0
            return {
                'id': invoice.id,
                'value': remaining,
                'total_value': invoice.value,
                'status': invoice.get_status_display(),
                'due_date': invoice.reference_date
            }
        return {'id': None, 'value': 0, 'status': 'Sem fatura', 'due_date': None}

class RecurringBillSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    class Meta:
        model = RecurringBill
        fields = '__all__'
        read_only_fields = ['house']

# ... outros serializers

class TransactionItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    class Meta:
        model = TransactionItem
        fields = ['id', 'product_name', 'quantity', 'unit_price', 'total_price']

class TransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)
    
    # ADICIONE ISTO:
    items = TransactionItemSerializer(many=True, read_only=True)
    
    class Meta:
        model = Transaction
        fields = '__all__'
        read_only_fields = ['house']

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