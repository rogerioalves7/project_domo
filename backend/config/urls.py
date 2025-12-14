from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Redireciona tudo que começar com 'api/' para o core/urls.py
    path('api/', include('core.urls')),
]