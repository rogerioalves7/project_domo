from rest_framework import serializers
from django.contrib.auth.models import User
from django.utils import timezone
from .models import (
    House, HouseMember, Account, CreditCard, Invoice, 
    Transaction, Product, InventoryItem, ShoppingList, 
    RecurringBill, Category
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

# --- GERENCIAMENTO FINANCEIRO ---

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

class CreditCardSerializer(serializers.ModelSerializer):
    invoice_info = serializers.SerializerMethodField()

    class Meta:
        model = CreditCard
        fields = '__all__'
        read_only_fields = ['house', 'owner']

    def get_invoice_info(self, obj):
        # Pega a primeira fatura aberta OU Fechada (mas não paga)
        invoice = obj.invoices.exclude(status='PAID').order_by('reference_date').first()
        
        if invoice:
            # Calcula quanto falta pagar
            remaining = invoice.value - invoice.amount_paid
            
            # Se por algum motivo pagou tudo mas o status não virou, retorna 0
            if remaining < 0: remaining = 0

            return {
                'id': invoice.id,
                'value': remaining, # <--- MANDA O VALOR RESTANTE PARA O FRONT
                'total_value': invoice.value, # Valor original (opcional, para referência)
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

class TransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)
    recurring_bill_name = serializers.CharField(source='recurring_bill.name', read_only=True)

    class Meta:
        model = Transaction
        fields = '__all__'
        read_only_fields = ['house']

class InvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = '__all__'

# --- ESTOQUE E COMPRAS ---

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'
        read_only_fields = ['house'] # <--- Adicione esta linha

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
    class Meta:
        model = ShoppingList
        fields = '__all__'
        read_only_fields = ['house']