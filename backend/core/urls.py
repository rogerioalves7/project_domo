from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AccountViewSet, CreditCardViewSet, TransactionViewSet, InventoryViewSet, ShoppingListViewSet, ProductViewSet, RecurringBillViewSet, CategoryViewSet, InvoiceViewSet

router = DefaultRouter()
router.register(r'accounts', AccountViewSet, basename='account')
router.register(r'credit-cards', CreditCardViewSet, basename='credit-card')
router.register(r'transactions', TransactionViewSet, basename='transaction')
router.register(r'products', ProductViewSet)
router.register(r'inventory', InventoryViewSet, basename='inventory')
router.register(r'shopping-list', ShoppingListViewSet, basename='shopping-list')
router.register(r'recurring-bills', RecurringBillViewSet, basename='recurring-bill')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'invoices', InvoiceViewSet, basename='invoice')

urlpatterns = [
    path('', include(router.urls)),
]