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
    """
    Envia e-mail automático quando um convite é criado.
    """
    if created and not instance.accepted:
        print(f"📩 Preparando envio de convite para {instance.email}...")
        
        subject = f"Convite: Junte-se à casa {instance.house.name} no Domo"
        
        # Link para o Frontend aceitar o convite
        # Ajuste o domínio se estiver em produção (ex: https://meudomo.com/accept/...)
        invite_link = f"http://localhost:5173/accept-invite/{instance.id}"
        
        message = f"""
        Olá!
        
        {instance.inviter.first_name} convidou você para participar da gestão financeira da casa "{instance.house.name}".
        
        Para aceitar e começar a usar, clique no link abaixo:
        {invite_link}
        
        Se você não possui conta no Domo, será necessário criar uma antes de aceitar.
        """
        
        try:
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [instance.email],
                fail_silently=False,
            )
            print(f"✅ E-mail enviado com sucesso para {instance.email}")
        except Exception as e:
            print(f"❌ Erro ao enviar e-mail: {e}")