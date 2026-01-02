from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db.models import Sum
from .models import (
    House, HouseMember, Account, CreditCard, Invoice, 
    Transaction, Product, InventoryItem, ShoppingList, 
    RecurringBill, Category, TransactionItem, HouseInvitation
)
import datetime

User = get_user_model()

# ======================================================================
# USUÁRIOS E CASA
# ======================================================================

class UserSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(required=True) 

    class Meta:
        model = User
        fields = ('id', 'username', 'first_name', 'email', 'password')
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data['first_name']
        )
        return user

class HouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = House
        fields = '__all__'

class HouseMemberSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    
    class Meta:
        model = HouseMember
        fields = ['id', 'user', 'house', 'role', 'user_name', 'user_email']
        read_only_fields = ['user', 'house']

# ======================================================================
# FINANCEIRO
# ======================================================================

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'
        read_only_fields = ['house']

class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ['id', 'name', 'balance', 'limit', 'is_shared', 'owner']
        read_only_fields = ['owner', 'house']

class CreditCardSerializer(serializers.ModelSerializer):
    invoice_info = serializers.SerializerMethodField()

    class Meta:
        model = CreditCard
        fields = ['id', 'name', 'limit_total', 'limit_available', 'closing_day', 'due_day', 'is_shared', 'invoice_info', 'owner']
        read_only_fields = ['owner', 'house']

    def get_invoice_info(self, obj):
        target_invoice = Invoice.objects.filter(card=obj).exclude(status='PAID').order_by('reference_date').first()
        if not target_invoice:
            target_invoice = Invoice.objects.filter(card=obj).order_by('-reference_date').first()

        if target_invoice:
            real_total = Transaction.objects.filter(invoice=target_invoice).aggregate(total=Sum('value'))['total'] or 0
            if real_total != target_invoice.value:
                target_invoice.value = real_total
                target_invoice.save()

            return {
                'id': target_invoice.id,
                'value': real_total,
                'status': target_invoice.status,
                'reference_date': target_invoice.reference_date,
                'amount_paid': target_invoice.amount_paid
            }
        return None

class InvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = '__all__'
        read_only_fields = ['house']

class RecurringBillSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    is_paid_this_month = serializers.SerializerMethodField()

    class Meta:
        model = RecurringBill
        fields = ['id', 'name', 'base_value', 'due_day', 'category', 'category_name', 'is_paid_this_month', 'is_active']
        read_only_fields = ['house']

    def get_is_paid_this_month(self, obj):
        today = datetime.date.today()
        start_date = today.replace(day=1)
        return Transaction.objects.filter(
            recurring_bill=obj,
            date__gte=start_date,
            date__year=today.year,
            date__month=today.month
        ).exists()

class TransactionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionItem
        fields = ['id', 'description', 'value', 'quantity']

class TransactionSerializer(serializers.ModelSerializer):
    items = TransactionItemSerializer(many=True, required=False)
    category_name = serializers.CharField(source='category.name', read_only=True)
    source_name = serializers.SerializerMethodField()
    owner_name = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            'id', 'description', 'value', 'type', 'date', 'created_at',
            'category', 'category_name', 'account', 'invoice', 
            'recurring_bill', 'is_shared', 'items', 'source_name', 'owner_name'
        ]
        read_only_fields = ['house']

    def get_source_name(self, obj):
        if obj.account: return obj.account.name
        if obj.invoice and obj.invoice.card: return f"Cartão {obj.invoice.card.name}"
        return "N/A"

    def get_owner_name(self, obj):
        if obj.account and obj.account.owner: return obj.account.owner.first_name or obj.account.owner.username
        if obj.invoice and obj.invoice.card and obj.invoice.card.owner: return obj.invoice.card.owner.first_name or obj.invoice.card.owner.username
        return "Casa"

# ======================================================================
# ESTOQUE E COMPRAS (ATUALIZADO PARA OFFLINE)
# ======================================================================

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'
        read_only_fields = ['house']

class InventoryItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    class Meta:
        model = InventoryItem
        fields = ['id', 'product', 'product_name', 'quantity', 'min_quantity']
        read_only_fields = ['house']

class ShoppingListSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    estimated_price = serializers.DecimalField(source='product.estimated_price', max_digits=10, decimal_places=2, read_only=True)

    # --- SUPORTE OFFLINE / LAZY CREATION ---
    # Aceita nome para criar produto automaticamente se o ID não existir
    create_product_name = serializers.CharField(write_only=True, required=False)
    
    # ID torna-se opcional na entrada, pois podemos usar o nome
    product = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), 
        required=False, 
        allow_null=True
    )

    class Meta:
        model = ShoppingList
        fields = [
            'id', 'product', 'product_name', 'quantity_to_buy', 
            'estimated_price', 'real_unit_price', 'discount_unit_price', 
            'is_purchased', 'create_product_name'
        ]
        read_only_fields = ['house']

class HouseInvitationSerializer(serializers.ModelSerializer):
    inviter_name = serializers.CharField(source='inviter.username', read_only=True)
    house_name = serializers.CharField(source='house.name', read_only=True)

    class Meta:
        model = HouseInvitation
        fields = ['id', 'email', 'house', 'house_name', 'inviter_name', 'created_at', 'accepted']

# ======================================================================
# AUTH
# ======================================================================

class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8)

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)

class ChangeEmailSerializer(serializers.Serializer):
    new_email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True)