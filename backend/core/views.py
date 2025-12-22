import sys
import re
from django.shortcuts import get_object_or_404
from django.db import models, transaction as db_transaction, IntegrityError
from django.db.models import Q, F, Sum
from django.db.models.functions import TruncMonth
from django.conf import settings
from django.core.mail import send_mail
from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.contrib.auth.password_validation import validate_password
from decimal import Decimal, InvalidOperation
import datetime
from dateutil.relativedelta import relativedelta

from rest_framework import viewsets, permissions, status, generics
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token

# Importação dos Models e Serializers locais
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
    HouseInvitationSerializer, PasswordResetRequestSerializer, PasswordResetConfirmSerializer,
    ChangePasswordSerializer, ChangeEmailSerializer, UserSerializer
)

User = get_user_model()

# --- SOLUÇÃO CRÍTICA: GERADOR DE TOKEN QUE IGNORA LAST_LOGIN ---
class CustomTokenGenerator(PasswordResetTokenGenerator):
    """
    Remove a dependência do 'last_login' para gerar o hash.
    Isso corrige o erro onde o token fica inválido se o usuário for salvo
    ou logado entre o pedido e a confirmação.
    """
    def _make_hash_value(self, user, timestamp):
        # Apenas ID, Senha e Timestamp. Removemos last_login.
        return str(user.pk) + user.password + str(timestamp)

custom_token_generator = CustomTokenGenerator()

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
# CASA E MEMBROS
# ======================================================================

class HouseViewSet(viewsets.ModelViewSet):
    queryset = House.objects.all()
    serializer_class = HouseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_anonymous:
            return House.objects.none()
        return House.objects.filter(members__user=self.request.user)

    def perform_create(self, serializer):
        # 1. Salva a casa
        house = serializer.save()
        
        # 2. Garante que o criador seja MASTER
        HouseMember.objects.update_or_create(
            user=self.request.user,
            house=house,
            defaults={'role': 'MASTER'}
        )

    # --- LÓGICA DE EXCLUSÃO TOTAL (CASA + USUÁRIO) ---
    def destroy(self, request, *args, **kwargs):
        house = self.get_object()
        user = request.user
        
        try:
            member = HouseMember.objects.get(user=user, house=house)
            if member.role != 'MASTER':
                return Response({'error': 'Apenas o Master pode excluir a casa permanentemente.'}, status=status.HTTP_403_FORBIDDEN)
        except HouseMember.DoesNotExist:
            return Response({'error': 'Membro não encontrado.'}, status=status.HTTP_403_FORBIDDEN)

        house.delete() # Cascade deleta tudo da casa
        user.delete()  # Deleta o usuário Master

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        house = self.get_object()
        user = request.user
        
        try:
            member = HouseMember.objects.get(user=user, house=house)
        except HouseMember.DoesNotExist:
            return Response({'error': 'Você não é membro desta casa.'}, status=400)

        if member.role == 'MASTER':
            return Response({'error': 'O Master não pode sair. Você deve excluir a casa.'}, status=400)

        # Preservar transações (Anônimas)
        user_accounts = Account.objects.filter(owner=user, house=house)
        user_cards = CreditCard.objects.filter(owner=user, house=house)
        Transaction.objects.filter(account__in=user_accounts).update(account=None)
        
        user_invoices = Invoice.objects.filter(card__in=user_cards)
        Transaction.objects.filter(invoice__in=user_invoices).update(invoice=None)

        user_accounts.delete()
        user_cards.delete()
        member.delete()

        return Response({'status': 'Você saiu da casa com sucesso.'})


class HouseMemberViewSet(BaseHouseViewSet):
    queryset = HouseMember.objects.all()
    serializer_class = HouseMemberSerializer

    def destroy(self, request, *args, **kwargs):
        requester = request.user
        
        if not hasattr(requester, 'house_member'):
            return Response({'error': 'Você não é membro desta casa.'}, status=status.HTTP_403_FORBIDDEN)
            
        if requester.house_member.role != 'MASTER':
            return Response({'error': 'Apenas o Master pode remover membros.'}, status=status.HTTP_403_FORBIDDEN)

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
        user = self.request.user
        if not hasattr(user, 'house_member'):
            return Response([])
        
        house = user.house_member.house
        today = datetime.date.today()
        start_date = (today - relativedelta(months=11)).replace(day=1)

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
                    'income': 0, 'expense': 0,
                    'estimated_expense': estimated_fixed,
                    'categories': {}, 'transactions': []
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
# FINANCEIRO (Contas, Cartões, Faturas, Recorrências)
# ======================================================================

class AccountViewSet(BaseHouseViewSet):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer
    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'house_member') and user.house_member.house:
            house = user.house_member.house
            return Account.objects.filter(house=house).filter(
                Q(is_shared=True) | Q(owner=user)
            )
        return Account.objects.none()

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        data = request.data.copy()

        # Sanitização Robusta (Remove R$, espaços e ajusta pontuação)
        for field in ['balance', 'limit']:
            if field in data and isinstance(data[field], str):
                # Remove tudo que não for dígito, vírgula, ponto ou sinal de menos
                clean_val = re.sub(r'[^\d,.-]', '', data[field])
                if ',' in clean_val:
                    clean_val = clean_val.replace('.', '').replace(',', '.')
                data[field] = clean_val

        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

class CreditCardViewSet(BaseHouseViewSet):
    queryset = CreditCard.objects.all()
    serializer_class = CreditCardSerializer
    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'house_member') and user.house_member.house:
            house = user.house_member.house
            return CreditCard.objects.filter(house=house).filter(
                Q(is_shared=True) | Q(owner=user)
            )
        return CreditCard.objects.none()

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        data = request.data.copy()

        # Sanitização para Cartões (limit_total e limit_available)
        for field in ['limit_total', 'limit_available']:
            if field in data and isinstance(data[field], str):
                clean_val = re.sub(r'[^\d,.-]', '', data[field])
                if ',' in clean_val:
                    clean_val = clean_val.replace('.', '').replace(',', '.')
                data[field] = clean_val

        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

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
                value=payment_value, type='EXPENSE',
                account=account, date=date_payment, category=None 
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

    def create(self, request, *args, **kwargs):
        house = request.user.house_member.house
        name = request.data.get('name')
        if RecurringBill.objects.filter(house=house, name__iexact=name).exists():
            return Response({'error': 'Já existe uma conta fixa com este nome.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        house = request.user.house_member.house
        name = request.data.get('name')
        instance = self.get_object()
        if RecurringBill.objects.filter(house=house, name__iexact=name).exclude(id=instance.id).exists():
            return Response({'error': 'Já existe uma conta fixa com este nome.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)

# ======================================================================
# TRANSAÇÕES (O Coração Financeiro)
# ======================================================================

class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        
        # 1. Descubro quais casas EU participo
        my_house_ids = HouseMember.objects.filter(user=user).values_list('house_id', flat=True)

        # 2. Crio uma lista de "Pessoas Permitidas" (Meus vizinhos de casa)
        # Se eu moro na casa X, posso ver transações COMPARTILHADAS de quem também mora na casa X.
        allowed_users_ids = HouseMember.objects.filter(
            house_id__in=my_house_ids
        ).values_list('user_id', flat=True)

        # 3. O Filtro Definitivo
        return Transaction.objects.filter(
            # SITUAÇÃO A: A transação é MINHA
            # Se eu sou o dono, vejo tudo (privado, público, secreto...)
            Q(account__owner=user) | 
            
            # SITUAÇÃO B: A transação é DE OUTRO MEMBRO
            # Aqui aplicamos a sua regra estrita:
            Q(
                is_shared=True,  # <--- O CADEADO: Só passa se foi marcada como pública na hora da compra
                account__owner__id__in=allowed_users_ids # <--- E o dono da conta mora comigo
            )
        ).distinct().order_by('-date', '-created_at')

    def create(self, request, *args, **kwargs):
        data = request.data
        user = request.user
        house = user.house_member.house
        
        payment_method = data.get('payment_method')
        transaction_type = data.get('type')
        account_id = data.get('account') or data.get('account_id')
        card_id = data.get('card') or data.get('card_id')
        items_data = data.get('items', []) 

        if payment_method == 'CREDIT_CARD' and not card_id and account_id:
            card_id = account_id
            account_id = None

        raw_value = data.get('value')
        try:
            if isinstance(raw_value, str):
                raw_value = raw_value.replace(',', '.')
            total_value = Decimal(str(raw_value))
        except (InvalidOperation, TypeError):
            return Response({'error': 'Valor inválido.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with db_transaction.atomic():
                account = None
                card = None
                invoice = None
                
                # --- Lógica: DESPESA (CONTA CORRENTE) ---
                if transaction_type == 'EXPENSE' and payment_method == 'ACCOUNT':
                    if not account_id: return Response({'error': 'Selecione uma conta.'}, status=status.HTTP_400_BAD_REQUEST)
                    account = Account.objects.get(id=account_id, house=house)
                    
                    if total_value > (account.balance + account.limit):
                        return Response({'error': f'Saldo insuficiente (incluindo limite) na conta: {account.name}'}, status=status.HTTP_400_BAD_REQUEST)
                    
                    account.balance -= total_value
                    account.save()

                # --- Lógica: DESPESA (CARTÃO DE CRÉDITO) ---
                elif transaction_type == 'EXPENSE' and payment_method == 'CREDIT_CARD':
                    if not card_id: return Response({'error': 'Selecione um cartão.'}, status=status.HTTP_400_BAD_REQUEST)
                    card = CreditCard.objects.get(id=card_id, house=house)
                    
                    if total_value > card.limit_available:
                        return Response({'error': 'Limite indisponível.'}, status=status.HTTP_400_BAD_REQUEST)
                    
                    card.limit_available -= total_value
                    card.save()

                    today = datetime.date.today()
                    tx_date_str = data.get('date')
                    tx_date = datetime.datetime.strptime(tx_date_str, "%Y-%m-%d").date() if tx_date_str else today

                    ref_date = (tx_date + relativedelta(months=1)).replace(day=1) if tx_date.day >= card.closing_day else tx_date.replace(day=1)

                    invoice, _ = Invoice.objects.get_or_create(
                        card=card, reference_date=ref_date,
                        defaults={'value': 0, 'status': 'OPEN'}
                    )
                    
                    installments = int(data.get('installments', 1))
                    first_installment_value = total_value / installments
                    invoice.value += first_installment_value
                    invoice.save()

                # --- Lógica: RECEITA (INCOME) ---
                elif transaction_type == 'INCOME':
                    if not account_id: return Response({'error': 'Selecione uma conta para receber.'}, status=status.HTTP_400_BAD_REQUEST)
                    account = Account.objects.get(id=account_id, house=house)
                    account.balance += total_value 
                    account.save()

                # 3. Salva a Transação Principal
                installments = int(data.get('installments', 1))
                final_desc = data.get('description')
                final_val = total_value

                if installments > 1:
                    final_desc = f"{data.get('description')} (1/{installments})"
                    final_val = total_value / installments

                transaction_instance = Transaction.objects.create(
                    house=house,
                    description=final_desc,
                    value=final_val,
                    type=transaction_type,
                    date=data.get('date', datetime.date.today()),
                    category_id=data.get('category'),
                    account=account,
                    invoice=invoice,
                    recurring_bill_id=data.get('recurring_bill')
                )

                # 4. Salva os Itens
                if items_data and isinstance(items_data, list):
                    items_objects = []
                    for item in items_data:
                        items_objects.append(TransactionItem(
                            transaction=transaction_instance,
                            description=item.get('description', 'Item'),
                            value=Decimal(str(item.get('value', 0))),
                            quantity=float(item.get('quantity', 1))
                        ))
                    TransactionItem.objects.bulk_create(items_objects)
                
                # 5. Gera Parcelas Futuras (Cartão)
                if installments > 1 and card and transaction_type == 'EXPENSE':
                    installment_val = total_value / installments
                    new_transactions = []
                    base_date = transaction_instance.date
                    if isinstance(base_date, str):
                        base_date = datetime.datetime.strptime(base_date, "%Y-%m-%d").date()
                    
                    for i in range(1, installments):
                        future_date = base_date + relativedelta(months=i)
                        fut_ref = (future_date + relativedelta(months=1)).replace(day=1) if future_date.day >= card.closing_day else future_date.replace(day=1)

                        fut_invoice, _ = Invoice.objects.get_or_create(
                            card=card, reference_date=fut_ref,
                            defaults={'value': 0, 'status': 'OPEN'}
                        )
                        fut_invoice.value += installment_val
                        fut_invoice.save()

                        new_transactions.append(Transaction(
                            house=house,
                            description=f"{data.get('description')} ({i+1}/{installments})",
                            value=installment_val, type='EXPENSE',
                            invoice=fut_invoice, date=future_date,
                            category_id=data.get('category')
                        ))
                    
                    Transaction.objects.bulk_create(new_transactions)

                serializer = self.get_serializer(transaction_instance)
                headers = self.get_success_headers(serializer.data)
                return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

        except Account.DoesNotExist:
             return Response({'error': 'Conta não encontrada.'}, status=status.HTTP_400_BAD_REQUEST)
        except CreditCard.DoesNotExist:
             return Response({'error': 'Cartão não encontrado.'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f"Erro interno: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

# ======================================================================
# ESTOQUE E COMPRAS
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

class ShoppingListViewSet(BaseHouseViewSet):
    queryset = ShoppingList.objects.all()
    serializer_class = ShoppingListSerializer

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'house_member'): return ShoppingList.objects.none()
        
        house = user.house_member.house
        
        # 1. Identifica e Atualiza itens com estoque baixo
        low_stock_items = InventoryItem.objects.filter(house=house, quantity__lt=models.F('min_quantity'))
        low_stock_product_ids = []

        for item in low_stock_items:
            low_stock_product_ids.append(item.product.id)
            needed = item.min_quantity - item.quantity
            if needed <= 0: needed = Decimal('1.00')

            obj, created = ShoppingList.objects.get_or_create(
                house=house, product=item.product,
                defaults={
                    'quantity_to_buy': needed, 
                    'real_unit_price': item.product.estimated_price,
                    'discount_unit_price': item.product.estimated_price,
                    'is_purchased': False
                }
            )
            # Se já existe e não está no carrinho, atualiza a quantidade necessária
            if not created and not obj.is_purchased:
                if obj.quantity_to_buy != needed:
                    obj.quantity_to_buy = needed
                    obj.save()

        # 2. Limpeza Robusta: Remove itens não comprados que NÃO estão com estoque baixo
        ShoppingList.objects.filter(house=house, is_purchased=False).exclude(product_id__in=low_stock_product_ids).delete()

        return ShoppingList.objects.filter(house=house).order_by('is_purchased', 'product__name')

    @action(detail=False, methods=['post'])
    def finish(self, request):
        user = self.request.user
        house = user.house_member.house
        data = request.data
        
        payment_method = data.get('payment_method') 
        source_id = data.get('source_id')
        total_paid = Decimal(str(data.get('total_value', 0)).replace(',', '.'))
        purchase_date = data.get('date', datetime.date.today())

        if not payment_method or not source_id:
            return Response({'error': 'Selecione uma forma de pagamento.'}, status=status.HTTP_400_BAD_REQUEST)

        purchased_items = ShoppingList.objects.filter(house=house, is_purchased=True)
        if not purchased_items.exists():
            return Response({'error': 'Carrinho vazio. Marque os itens comprados.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with db_transaction.atomic():
                account = None
                invoice = None
                description = "Compra de Mercado"
                category, _ = Category.objects.get_or_create(house=house, name="Compras", defaults={'type': 'EXPENSE'})

                if payment_method == 'ACCOUNT':
                    account = Account.objects.get(id=source_id, house=house)
                    if total_paid > account.balance:
                         return Response({'error': f'Saldo insuficiente na conta {account.name}.'}, status=status.HTTP_400_BAD_REQUEST)
                    description = f"Mercado ({account.name})"
                
                elif payment_method == 'CREDIT_CARD':
                    card = CreditCard.objects.get(id=source_id, house=house)
                    if total_paid > card.limit_available:
                        return Response({'error': 'Limite insuficiente no cartão.'}, status=status.HTTP_400_BAD_REQUEST)
                    
                    today = datetime.date.today()
                    if today.day >= card.closing_day: today = today + relativedelta(months=1)
                    ref_date = today.replace(day=1)
                    
                    invoice, _ = Invoice.objects.get_or_create(card=card, reference_date=ref_date, defaults={'value': 0, 'status': 'OPEN'})
                    invoice.value += total_paid
                    invoice.save()
                    card.limit_available -= total_paid
                    card.save()
                    description = f"Mercado ({card.name})"

                transaction = Transaction.objects.create(
                    house=house, description=description, value=total_paid,
                    type='EXPENSE', account=account, invoice=invoice,
                    category=category, date=purchase_date
                )

                transaction_items = []
                count = 0
                for shop_item in purchased_items:
                    qty = shop_item.quantity_to_buy
                    unit_price = shop_item.real_unit_price
                    if unit_price <= 0:
                         unit_price = shop_item.discount_unit_price if shop_item.discount_unit_price > 0 else shop_item.product.estimated_price

                    transaction_items.append(TransactionItem(
                        transaction=transaction, description=shop_item.product.name, 
                        quantity=qty, value=unit_price * qty 
                    ))

                    inv_item, _ = InventoryItem.objects.get_or_create(
                        house=house, product=shop_item.product, 
                        defaults={'min_quantity': 1, 'quantity': 0}
                    )
                    inv_item.quantity += qty
                    inv_item.save()

                    if unit_price > 0 and unit_price != shop_item.product.estimated_price:
                        shop_item.product.estimated_price = unit_price
                        shop_item.product.save()

                    count += 1

                TransactionItem.objects.bulk_create(transaction_items)
                purchased_items.delete()

                return Response({'message': f'Compra finalizada! {count} itens processados.'}, status=status.HTTP_200_OK)

        except (Account.DoesNotExist, CreditCard.DoesNotExist):
            return Response({'error': 'Meio de pagamento não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': f"Erro interno: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

# ======================================================================
# GESTÃO DE USUÁRIO E CONVITES
# ======================================================================

class InvitationViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

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
        
        if not hasattr(user, 'house_member'): return Response({'error': 'Você não pertence a uma casa.'}, status=400)
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
                settings.EMAIL_HOST_USER, [email], fail_silently=False,
            )
            return Response({'message': 'Convite enviado por e-mail!'})
        except:
            print(f"Link do convite: {invite_link}")
            return Response({'message': 'Convite criado (Link no terminal).'})

    def destroy(self, request, pk=None):
        user = request.user
        house = user.house_member.house
        try:
            invite = HouseInvitation.objects.get(id=pk, house=house)
            invite.delete()
            return Response({'message': 'Convite cancelado.'}, status=status.HTTP_200_OK)
        except HouseInvitation.DoesNotExist:
            return Response({'error': 'Convite não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    # --- SWAP DE CASA (TROCA) ---
    @action(detail=False, methods=['post'], url_path='join')
    def join_house(self, request):
        token = request.data.get('token')
        user = request.user

        if not token: return Response({'error': 'Token não fornecido.'}, status=400)

        try:
            invite = HouseInvitation.objects.get(id=token, accepted=False)
            
            # Limpeza: Encontra e deleta a casa padrão criada pelo signal
            try:
                default_member = HouseMember.objects.get(user=user, role='ADMIN')
                default_house = default_member.house
                # Só deleta se a casa tiver apenas 1 membro (o próprio usuário)
                if HouseMember.objects.filter(house=default_house).count() == 1:
                    default_member.delete()
                    default_house.delete()
                else:
                    default_member.delete()
            except ObjectDoesNotExist:
                pass 

            HouseMember.objects.create(user=user, house=invite.house, role='MEMBER')
            invite.accepted = True
            invite.delete()
            return Response({'message': f'Bem-vindo à casa {invite.house.name}!'}, status=200)

        except HouseInvitation.DoesNotExist:
            return Response({'error': 'Convite inválido ou expirado.'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    # ACEITAR CONVITE (Lógica para não logados ou switch manual)
    @action(detail=False, methods=['post'])
    def accept(self, request):
        token = request.data.get('token')
        user = request.user
        if not token: return Response({'error': 'Token de convite não fornecido.'}, status=400)
        
        try:
            invitation = HouseInvitation.objects.get(id=token, accepted=False)
            if invitation.email != user.email:
                return Response({'error': 'Este convite não é para o seu e-mail.'}, status=status.HTTP_403_FORBIDDEN)
            if HouseMember.objects.filter(user=user, house=invitation.house).exists():
                invitation.delete()
                return Response({'error': 'Você já é membro desta casa.'}, status=400)

            HouseMember.objects.create(user=user, house=invitation.house, role='MEMBER')
            invitation.accepted = True
            invitation.save()
            return Response({'message': f'Bem-vindo à casa {invitation.house.name}!'})
        except HouseInvitation.DoesNotExist:
            return Response({'error': 'Convite inválido.'}, status=404)

class RegisterView(generics.CreateAPIView):
    serializer_class = UserSerializer
    permission_classes = [AllowAny]
    authentication_classes = []  # <--- ADICIONE ISSO: Ignora validação de token

    @db_transaction.atomic
    def post(self, request, *args, **kwargs):
        # ... (o restante do código permanece igual)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = serializer.save()
        
        email = user.email
        pending_invite = HouseInvitation.objects.filter(email=email).first()

        if pending_invite:
            default_member_record = HouseMember.objects.filter(user=user).first()
            if default_member_record:
                orphaned_house = default_member_record.house
                if orphaned_house.members.count() <= 1: 
                    orphaned_house.delete()

            HouseMember.objects.update_or_create(
                user=user,
                defaults={
                    'house': pending_invite.house,
                    'role': 'MEMBER'
                }
            )
            pending_invite.delete()

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

class CustomAuthToken(ObtainAuthToken):
    # --- ADICIONE ESTAS DUAS LINHAS ---
    permission_classes = [AllowAny]  # Permite acesso público (qualquer um pode tentar logar)
    authentication_classes = []      # Ignora tokens inválidos/antigos que o navegador possa enviar
    # ----------------------------------

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key, 'user_id': user.pk,
            'username': user.username, 'email': user.email
        })
    
class AuthViewSet(viewsets.ViewSet):
    """
    ViewSet para gerenciar ações de conta (Senha e Email)
    """

    # 1. SOLICITAR REDEFINIÇÃO
    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny])
    def request_password_reset(self, request):
        # Usa o serializer apenas para validar formato do email
        serializer = PasswordResetRequestSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                # Segurança: não avisar se não existe
                return Response({'status': 'Se o e-mail existir, um link foi enviado.'})

            # USA O NOSSO GERADOR CUSTOMIZADO
            token = custom_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            
            # Ajuste a porta se seu frontend não for 5173
            reset_link = f"http://localhost:5173/reset-password/{uid}/{token}"

            # Debug no terminal (MANTENHA ISSO)
            print(f"\n📧 [DEBUG] LINK GERADO PARA {email}:", file=sys.stderr)
            print(f"{reset_link}\n", file=sys.stderr)

            # --- CORREÇÃO DE FORMATAÇÃO DO E-MAIL ---
            send_mail(
                subject='Redefinição de Senha - Domo',
                message=f"""Olá {user.username},

                        Recebemos uma solicitação para redefinir sua senha.
                        Clique no link abaixo (ou copie e cole no navegador):

                        <{reset_link}>

                        Se não foi você, apenas ignore este e-mail.
                        """,
                from_email='noreply@domo.app',
                recipient_list=[email],
                fail_silently=False,
            )
            return Response({'status': 'Link enviado.'})
        return Response(serializer.errors, status=400)

    # 2. CONFIRMAR REDEFINIÇÃO (Versão "Nuclear" de Debug)
    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny])
    def confirm_password_reset(self, request):
        print("\n--- [DEBUG] INICIANDO CONFIRM PASSWORD ---", file=sys.stderr, flush=True)
        
        # Ignoramos a validação automática do serializer para evitar erros ocultos
        data = request.data
        raw_uid = data.get('uid', '')
        raw_token = data.get('token', '')
        new_password = data.get('new_password', '')

        print(f"📥 [DEBUG] Token Recebido (Bruto): '{raw_token}'", file=sys.stderr, flush=True)

        # 1. Limpeza
        uid = raw_uid.strip()
        token = raw_token.strip().replace('/', '') # Remove barra final se existir
        
        # 2. Decodificação do UID
        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
            print(f"✅ [DEBUG] Usuário encontrado: {user.username} (ID: {user_id})", file=sys.stderr, flush=True)
        except (TypeError, ValueError, OverflowError):
            print("❌ [DEBUG] Erro: UID inválido/corrompido.", file=sys.stderr, flush=True)
            return Response({'error': 'Link inválido (UID).'}, status=400)
        except User.DoesNotExist:
            print("❌ [DEBUG] Erro: Usuário não existe.", file=sys.stderr, flush=True)
            return Response({'error': 'Usuário não encontrado.'}, status=400)

        # 3. Verificação do Token (USANDO O MESMO GERADOR CUSTOMIZADO)
        is_valid = custom_token_generator.check_token(user, token)
        
        print(f"🛡️ [DEBUG] Check Token Resultado: {is_valid}", file=sys.stderr, flush=True)

        if is_valid:
            try:
                validate_password(new_password, user)
            except ValidationError as e:
                return Response({'error': ' '.join(e.messages)}, status=400)

            user.set_password(new_password)
            user.save()
            print("🚀 [DEBUG] Sucesso! Senha alterada.", file=sys.stderr, flush=True)
            return Response({'status': 'Senha redefinida com sucesso!'})
        
        # Diagnóstico final no terminal
        print(f"❌ [DEBUG] TOKEN INVÁLIDO. Hash esperado (parcial): {custom_token_generator._make_hash_value(user, int(datetime.datetime.now().timestamp()))}", file=sys.stderr, flush=True)
        return Response({'error': 'Token inválido ou expirado.'}, status=400)
    
    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def change_password(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            if not user.check_password(serializer.validated_data['old_password']):
                return Response({'error': 'Senha atual incorreta.'}, status=400)
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            return Response({'status': 'Senha alterada.'})
        return Response(serializer.errors, status=400)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def change_email(self, request):
        serializer = ChangeEmailSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            if not user.check_password(serializer.validated_data['password']):
                return Response({'error': 'Senha incorreta.'}, status=400)
            new_email = serializer.validated_data['new_email']
            if User.objects.filter(email=new_email).exclude(pk=user.pk).exists():
                return Response({'error': 'Este e-mail já está em uso.'}, status=400)
            user.email = new_email
            user.save()
            return Response({'status': 'E-mail atualizado.'})
        return Response(serializer.errors, status=400)
    
class CurrentUserView(APIView):
    """
    Retorna os dados do usuário logado diretamente do banco de dados.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'email': user.email,
            'full_name': user.get_full_name()
        })