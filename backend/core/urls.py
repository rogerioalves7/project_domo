from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    # ViewSets do Router
    HouseViewSet, HouseMemberViewSet, CategoryViewSet, 
    TransactionViewSet, AccountViewSet, RecurringBillViewSet, 
    CreditCardViewSet, InvoiceViewSet, InvitationViewSet,
    AuthViewSet, HistoryViewSet, ProductViewSet, InventoryViewSet, 
    ShoppingListViewSet, CurrentUserView,
    
    # Views soltas (Login/Registro)
    CustomAuthToken, RegisterView
)

# 1. Configuração do Router (Rotas Automáticas)
router = DefaultRouter()
router.register(r'houses', HouseViewSet)
router.register(r'members', HouseMemberViewSet)
router.register(r'categories', CategoryViewSet)
router.register(r'transactions', TransactionViewSet)
router.register(r'accounts', AccountViewSet)
router.register(r'recurring-bills', RecurringBillViewSet)
router.register(r'credit-cards', CreditCardViewSet)
router.register(r'invoices', InvoiceViewSet)
# router.register(r'invitations', InvitationViewSet) # Removido pois usamos rotas manuais abaixo
router.register(r'history', HistoryViewSet, basename='history')
router.register(r'products', ProductViewSet)
router.register(r'inventory', InventoryViewSet)
router.register(r'shopping-list', ShoppingListViewSet)

# --- AQUI ESTÁ O QUE FALTAVA ---
router.register(r'auth', AuthViewSet, basename='auth')
# -------------------------------

urlpatterns = [
    # 2. Rotas Manuais (Login, Registro e Convites Específicos)
    path('api-token-auth/', CustomAuthToken.as_view()),
    path('register/', RegisterView.as_view()),
    
    # Rotas manuais de convite
    path('invitations/join/', InvitationViewSet.as_view({'post': 'join_house'})),
    path('invitations/', InvitationViewSet.as_view({'post': 'create', 'get': 'list'})),
    path('invitations/<str:pk>/', InvitationViewSet.as_view({'delete': 'destroy'})),

    # 3. Inclui as rotas do Router
    path('', include(router.urls)),
    path('me/', CurrentUserView.as_view(), name='current-user'),
]