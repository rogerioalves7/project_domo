from django.contrib import admin
from django.urls import path, include
from rest_framework import routers
from rest_framework.authtoken.views import obtain_auth_token

# Importando TODAS as views
from core.views import (
    HouseViewSet, HouseMemberViewSet, AccountViewSet, 
    CreditCardViewSet, InvoiceViewSet, RecurringBillViewSet, 
    TransactionViewSet, CategoryViewSet, ProductViewSet, 
    InventoryViewSet, ShoppingListViewSet, HistoryViewSet,
    InvitationViewSet, RegisterView
)

# Configurando o Roteador
router = routers.DefaultRouter()
router.register(r'houses', HouseViewSet)
router.register(r'members', HouseMemberViewSet)
router.register(r'accounts', AccountViewSet)
router.register(r'credit-cards', CreditCardViewSet)
router.register(r'invoices', InvoiceViewSet)
router.register(r'recurring-bills', RecurringBillViewSet)
router.register(r'transactions', TransactionViewSet)
router.register(r'categories', CategoryViewSet)
router.register(r'products', ProductViewSet)
router.register(r'inventory', InventoryViewSet)
router.register(r'shopping-list', ShoppingListViewSet)
router.register(r'history', HistoryViewSet, basename='history')

# --- ROTA DE CONVITES ---
# O basename é crucial quando a ViewSet não tem queryset definido
router.register(r'invitations', InvitationViewSet, basename='invitations')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api-token-auth/', obtain_auth_token), # Login
    
    # Inclui todas as rotas acima na raiz da API
    path('', include(router.urls)),
]