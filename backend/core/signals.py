from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import House, HouseMember, Transaction, Account

@receiver(post_save, sender=User)
def create_house_for_new_user(sender, instance, created, **kwargs):
    """
    Sempre que um usuário é criado, gera uma Casa Padrão e o vincula como Admin.
    Se for um convite, a View 'join_house' fará a limpeza posterior.
    """
    if created:
        # Verifica se já existe para evitar duplicatas em edge cases
        if not HouseMember.objects.filter(user=instance).exists():
            house_name = f"Casa de {instance.username}"
            house = House.objects.create(name=house_name)
            
            HouseMember.objects.create(
                user=instance,
                house=house,
                role='ADMIN'
            )   