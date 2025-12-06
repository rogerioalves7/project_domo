from django.contrib import admin
from django.urls import path, include
from rest_framework.authtoken import views # <--- IMPORTANTE: Você importou isso?

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
    
    # Esta é a linha que cria o endereço do login:
    path('api-token-auth/', views.obtain_auth_token), # <--- Verifique se está aqui
]