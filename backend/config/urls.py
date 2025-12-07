from django.contrib import admin
from django.urls import path, include
from rest_framework import routers
from rest_framework.authtoken.views import obtain_auth_token

# Importando todas as Views do sistema
from core.views import (
    # Core & Auth
    HouseViewSet, 
    HouseMemberViewSet, 
    InvitationViewSet,
    
    # Financeiro
    AccountViewSet, 
    CreditCardViewSet, 
    InvoiceViewSet, 
    RecurringBillViewSet, 
    TransactionViewSet, 
    CategoryViewSet, 
    HistoryViewSet,
    
    # Estoque & Compras
    ProductViewSet, 
    InventoryViewSet, 
    ShoppingListViewSet,

    # Registro (Importação adicionada aqui)
    RegisterView
)

# --- 1. CONFIGURAÇÃO DO ROTEADOR AUTOMÁTICO (CRUD Padrão) ---
router = routers.DefaultRouter()

# Core
router.register(r'houses', HouseViewSet)
router.register(r'members', HouseMemberViewSet)

# Financeiro
router.register(r'accounts', AccountViewSet)
router.register(r'credit-cards', CreditCardViewSet)
router.register(r'invoices', InvoiceViewSet)
router.register(r'recurring-bills', RecurringBillViewSet)
router.register(r'transactions', TransactionViewSet)
router.register(r'categories', CategoryViewSet)

# Analytics (ViewSet sem Model direto precisa de basename)
router.register(r'history', HistoryViewSet, basename='history')

# Estoque
router.register(r'products', ProductViewSet)
router.register(r'inventory', InventoryViewSet)
router.register(r'shopping-list', ShoppingListViewSet)

# Convites (O basename é necessário pois não tem um queryset padrão)
router.register(r'invitations', InvitationViewSet, basename='invitation')


# --- 2. LISTA DE URLS (Rotas Manuais + Roteador) ---
urlpatterns = [
    # Admin do Django
    path('admin/', admin.site.urls),
    
    # Login (Gera o Token)
    path('api-token-auth/', obtain_auth_token),

    # Rota de Registro (Adicionada aqui)
    path('register/', RegisterView.as_view(), name='register'),
    
    # --- INCLUI TODAS AS ROTAS AUTOMÁTICAS ---
    path('', include(router.urls)),
]