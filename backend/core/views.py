from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Q
from dateutil.relativedelta import relativedelta
import datetime
from decimal import Decimal

from .models import (
    House, HouseMember, Account, CreditCard, Invoice, 
    Transaction, Product, InventoryItem, ShoppingList, 
    RecurringBill, Category
)
from .serializers import (
    HouseSerializer, HouseMemberSerializer, AccountSerializer, 
    CreditCardSerializer, InvoiceSerializer, TransactionSerializer, 
    ProductSerializer, InventoryItemSerializer, ShoppingListSerializer, 
    RecurringBillSerializer, CategorySerializer
)

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

# --- USUÁRIOS E CASA ---

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

# --- FINANCEIRO ---

class CategoryViewSet(BaseHouseViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

class AccountViewSet(BaseHouseViewSet):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'house_member'):
            return Account.objects.none()
        house = user.house_member.house
        return Account.objects.filter(house=house).filter(
            Q(owner=user) | Q(is_shared=True)
        )

class CreditCardViewSet(BaseHouseViewSet):
    queryset = CreditCard.objects.all()
    serializer_class = CreditCardSerializer

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'house_member'):
            return CreditCard.objects.none()
        house = user.house_member.house
        return CreditCard.objects.filter(house=house).filter(
            Q(owner=user) | Q(is_shared=True)
        )

class InvoiceViewSet(BaseHouseViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'house_member'):
            return Invoice.objects.none()
        return Invoice.objects.filter(card__house=user.house_member.house)

    @action(detail=True, methods=['post'])
    def pay(self, request, pk=None):
        invoice = self.get_object()
        account_id = request.data.get('account_id')
        payment_value = Decimal(str(request.data.get('value')))
        date_payment = request.data.get('date', datetime.date.today())

        if not account_id:
            return Response({'error': 'Conta de origem necessária'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            account = Account.objects.get(id=account_id, house=invoice.card.house)
            
            # 1. Cria Transação de Pagamento
            Transaction.objects.create(
                house=invoice.card.house,
                description=f"Pagamento Fatura {invoice.card.name}",
                value=payment_value,
                type='EXPENSE',
                account=account,
                date=date_payment,
                category=None 
            )

            # 2. Atualiza Fatura
            invoice.amount_paid += payment_value
            if invoice.amount_paid >= invoice.value:
                invoice.status = 'PAID'
            invoice.save()

            # 3. Restaura Limite (Com trava de segurança)
            current_available = invoice.card.limit_available
            max_limit = invoice.card.limit_total
            new_available = current_available + payment_value
            
            if new_available > max_limit:
                new_available = max_limit
            
            invoice.card.limit_available = new_available
            invoice.card.save()

            return Response({'message': 'Pagamento realizado com sucesso'}, status=status.HTTP_200_OK)

        except Account.DoesNotExist:
            return Response({'error': 'Conta não encontrada'}, status=status.HTTP_404_NOT_FOUND)
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
        # Garante que installments seja pelo menos 1
        installments = int(request.data.get('installments', 1))
        if installments < 1: installments = 1
        
        transaction_type = request.data.get('type')

        # LÓGICA DE CARTÃO DE CRÉDITO
        if transaction_type == 'EXPENSE' and payment_method == 'CREDIT_CARD' and card_id:
            try:
                card = CreditCard.objects.get(id=card_id)
                house = request.user.house_member.house
                
                total_value = Decimal(str(request.data.get('value')))
                purchase_date_str = request.data.get('date')
                purchase_date = datetime.datetime.strptime(purchase_date_str, '%Y-%m-%d').date()
                description_base = request.data.get('description')
                
                category_id = request.data.get('category')
                if category_id == '': category_id = None
                
                # Cálculo das parcelas
                installment_value = round(total_value / installments, 2)
                first_installment_value = total_value - (installment_value * (installments - 1))

                for i in range(installments):
                    current_value = first_installment_value if i == 0 else installment_value
                    
                    # Data base para a parcela
                    target_date = purchase_date + relativedelta(months=i)
                    
                    # REGRA DE OURO DO FECHAMENTO:
                    # Se o dia da compra for >= dia do fechamento, a fatura é do mês seguinte
                    if target_date.day >= card.closing_day:
                        target_date = target_date + relativedelta(months=1)
                    
                    # Normaliza para o primeiro dia do mês da fatura
                    reference_date = target_date.replace(day=1)

                    # Busca ou Cria a Fatura
                    invoice, created = Invoice.objects.get_or_create(
                        card=card,
                        reference_date=reference_date,
                        defaults={'value': 0, 'amount_paid': 0, 'status': 'OPEN'}
                    )

                    # Atualiza o valor da fatura
                    # Importante: Garantir que invoice.value seja Decimal
                    invoice.value = Decimal(str(invoice.value)) + current_value
                    invoice.save()

                    # Texto da Transação
                    desc_text = f"{description_base}"
                    if installments > 1:
                        desc_text += f" ({i+1}/{installments})"
                    
                    Transaction.objects.create(
                        house=house,
                        description=desc_text,
                        value=current_value,
                        date=purchase_date,
                        type='EXPENSE',
                        category_id=category_id,
                        invoice=invoice,
                        # account=None (Cartão não tem conta imediata)
                    )

                # Debita do Limite Disponível
                card.limit_available -= total_value
                card.save()

                return Response({'message': 'Compra no cartão registrada com sucesso'}, status=status.HTTP_201_CREATED)

            except CreditCard.DoesNotExist:
                return Response({'error': 'Cartão não encontrado'}, status=status.HTTP_404_NOT_FOUND)
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Fluxo Normal (Conta Corrente ou Receita)
        return super().create(request, *args, **kwargs)

# --- ESTOQUE E COMPRAS ---

class ProductViewSet(BaseHouseViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    
    def get_queryset(self):
        # Filtra produtos apenas da casa do usuário
        user = self.request.user
        if not hasattr(user, 'house_member'):
            return Product.objects.none()
        return Product.objects.filter(house=user.house_member.house)

class InventoryViewSet(BaseHouseViewSet):
    queryset = InventoryItem.objects.all()
    serializer_class = InventoryItemSerializer

class ShoppingListViewSet(BaseHouseViewSet):
    queryset = ShoppingList.objects.all()
    serializer_class = ShoppingListSerializer