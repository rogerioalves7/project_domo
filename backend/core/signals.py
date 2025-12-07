from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import House, HouseMember

@receiver(post_save, sender=User)
# Adicione **kwargs para receber a flag 'invite_registration'
def create_house_for_new_user(sender, instance, created, **kwargs):
    """
    Cria a casa padrão SOMENTE se o usuário for criado e não estiver
    vindo de um processo de convite.
    """
    
    # NOVO: Se a flag for True, o signal é ignorado e a View cuida da criação.
    if kwargs.get('invite_registration', False):
        return
        
    if created:
        # Se NÃO for um registro de convite, continua o fluxo padrão
        if not HouseMember.objects.filter(user=instance).exists(): 
            
            # 1. Cria a Casa Padrão
            house_name = f"Casa de {instance.username}"
            house = House.objects.create(name=house_name)
            
            # 2. Vincula o Usuário à Casa como Admin
            HouseMember.objects.create(
                user=instance,
                house=house,
                role='ADMIN'
            )