from rest_framework import serializers
from django.contrib.auth.models import User
from django.utils import timezone
import datetime
from .models import (
    House, HouseMember, Account, CreditCard, Invoice, 
    Transaction, Product, InventoryItem, ShoppingList, 
    RecurringBill, Category, TransactionItem, HouseInvitation
)

# --- USUÁRIOS E CASA ---

class UserSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(required=True) # Nome Real

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
    
    # Campos calculados
    owner_name = serializers.SerializerMethodField()
    source_name = serializers.SerializerMethodField()

    # Campo de escrita auxiliar (não vai pro banco Transaction)
    card = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Transaction
        fields = [
            'id', 'description', 'value', 'type', 'date', 
            'category', 'category_name', 
            'is_shared',
            'owner_name', 
            'source_name',
            'account', 'invoice', 
            'card', 
            'items', 'recurring_bill'
        ]
        read_only_fields = ['is_shared']

    def get_owner_name(self, obj):
        # Cenário 1: Conta Bancária
        if obj.account: 
            return obj.account.owner.first_name
            
        # Cenário 2: Cartão de Crédito (Via Fatura)
        if obj.invoice and obj.invoice.card: 
            # CORREÇÃO AQUI: Trocamos .user por .owner
            # Se o seu modelo de cartão usar outro nome, ajuste aqui.
            return obj.invoice.card.owner.first_name 
            
        return "Desconhecido"

    def get_source_name(self, obj):
        if obj.account: 
            return obj.account.name
        if obj.invoice and obj.invoice.card: 
            return f"Cartão {obj.invoice.card.name}"
        return "Outros"

    # --- LÓGICA DE ROTEAMENTO DE FATURA ---
    def _get_correct_invoice(self, card, transaction_date):
        day = transaction_date.day
        month = transaction_date.month
        year = transaction_date.year

        if day >= card.closing_day:
            if month == 12:
                ref_month = 1
                ref_year = year + 1
            else:
                ref_month = month + 1
                ref_year = year
        else:
            ref_month = month
            ref_year = year

        invoice, created = Invoice.objects.get_or_create(
            card=card,
            reference_month=ref_month,
            reference_year=ref_year,
            defaults={
                'status': 'OPEN' if (datetime.date.today().month == ref_month) else 'CLOSED',
                'value': 0
            }
        )
        return invoice

    def create(self, validated_data):
        card_id = validated_data.pop('card', None)
        account = validated_data.get('account')
        initial_invoice = validated_data.get('invoice')
        
        card = None
        
        if card_id:
            try:
                card = CreditCard.objects.get(id=card_id)
            except CreditCard.DoesNotExist:
                pass
        elif initial_invoice:
            card = initial_invoice.card

        # 1. LÓGICA DE CARTÃO (Fatura Inteligente)
        if card and not account:
            transaction_date = validated_data.get('date')
            correct_invoice = self._get_correct_invoice(card, transaction_date)
            
            validated_data['invoice'] = correct_invoice
            correct_invoice.value += validated_data['value'] # Atualiza Fatura
            correct_invoice.save()
            
            validated_data['is_shared'] = card.is_shared

        # 2. LÓGICA DE CONTA
        elif account:
            # if validated_data['type'] == 'EXPENSE':
            #    account.balance -= validated_data['value']
            # else:
            #    account.balance += validated_data['value']
            # account.save()
            
            validated_data['is_shared'] = account.is_shared
    
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