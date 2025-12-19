from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import House, HouseMember

@receiver(post_save, sender=User)
def create_house_for_new_user(sender, instance, created, **kwargs):
    """
    Sempre que um usuário é criado, gera uma Casa Padrão e o vincula como Admin.
    """
    if created:
        if not HouseMember.objects.filter(user=instance).exists():
            house_name = f"Casa de {instance.username}"
            house = House.objects.create(name=house_name)
            
            HouseMember.objects.create(
                user=instance,
                house=house,
                role='ADMIN'
            )

# ATENÇÃO: As funções update_balance_on_save e update_balance_on_delete FORAM REMOVIDAS.