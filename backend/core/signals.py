from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import House, HouseMember, HouseInvitation

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
                role='MASTER'
            )

@receiver(post_save, sender=HouseInvitation)
def send_invitation_email(sender, instance, created, **kwargs):
    if created and not instance.accepted:
        subject = f"Convite: Junte-se à casa {instance.house.name} no Domo"
        
        # --- CORREÇÃO AQUI ---
        # Removemos o localhost fixo e usamos a variável do settings
        # O .rstrip('/') garante que não fique com duas barras //
        base_url = settings.FRONTEND_URL.rstrip('/')
        invite_link = f"{base_url}/accept-invite/{instance.id}"
        # ---------------------
        
        message = f"""
        Olá!
        
        {instance.inviter.first_name} convidou você para participar da gestão financeira da casa "{instance.house.name}".
        
        Para aceitar, clique no link abaixo:
        {invite_link}
        """