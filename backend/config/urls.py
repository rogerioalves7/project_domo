from django.contrib import admin
from django.urls import path, include
from rest_framework import routers
from rest_framework.authtoken.views import obtain_auth_token
from core.views import CustomAuthToken

from core.views import (
    RegisterView, InvitationViewSet, # ... e todos os outros ViewSets
    HouseViewSet, HouseMemberViewSet, AccountViewSet, 
    CreditCardViewSet, InvoiceViewSet, RecurringBillViewSet, 
    TransactionViewSet, CategoryViewSet, HistoryViewSet,
    ProductViewSet, InventoryViewSet, ShoppingListViewSet
)

router = routers.DefaultRouter()
router.register(r'houses', HouseViewSet)
router.register(r'members', HouseMemberViewSet)
router.register(r'accounts', AccountViewSet)
router.register(r'credit-cards', CreditCardViewSet)
router.register(r'invoices', InvoiceViewSet)
router.register(r'recurring-bills', RecurringBillViewSet)
router.register(r'transactions', TransactionViewSet)
router.register(r'categories', CategoryViewSet)
router.register(r'history', HistoryViewSet, basename='history')
router.register(r'products', ProductViewSet)
router.register(r'inventory', InventoryViewSet)
router.register(r'shopping-list', ShoppingListViewSet)

# Invitation fora do router para controle manual (opcional, mas seguro)
# router.register(r'invitations', InvitationViewSet, basename='invitations') 

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api-token-auth/', CustomAuthToken.as_view()),
    path('register/', RegisterView.as_view()),
    
    # ROTAS DE CONVITE
    path('invitations/join/', InvitationViewSet.as_view({'post': 'join_house'})), # <--- AQUI A MÁGICA
    path('invitations/', InvitationViewSet.as_view({'post': 'create', 'get': 'list'})),
    path('invitations/<str:pk>/', InvitationViewSet.as_view({'delete': 'destroy'})),

    path('', include(router.urls)),
]