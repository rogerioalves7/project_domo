from django.db.models.signals import post_save
from django.conf import settings
from django.core.mail import send_mail
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

import threading
from django.conf import settings
from django.core.mail import send_mail
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import HouseInvitation

@receiver(post_save, sender=HouseInvitation)
def send_invitation_email(sender, instance, created, **kwargs):
    """
    Envia e-mail automático quando um convite é criado.
    Usa Threading para não travar a requisição do usuário (evita Timeout).
    """
    if created and not instance.accepted:
        # Prepara os dados ANTES de entrar na thread para garantir acesso
        base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')
        invite_link = f"{base_url}/accept-invite/{instance.id}"
        
        subject = f"Convite: Junte-se à casa {instance.house.name} no Domo"
        
        message = f"""
        Olá!
        
        {instance.inviter.first_name} convidou você para participar da gestão financeira da casa "{instance.house.name}".
        
        Para aceitar, clique no link abaixo:
        {invite_link}
        """
        
        recipient_list = [instance.email]
        from_email = settings.DEFAULT_FROM_EMAIL

        # --- A MÁGICA DO THREADING ---
        def send_async_email():
            try:
                print(f"🔄 Tentando enviar e-mail para {recipient_list[0]} em background...")
                send_mail(
                    subject,
                    message,
                    from_email,
                    recipient_list,
                    fail_silently=False,
                )
                print(f"✅ E-mail enviado com sucesso para {recipient_list[0]}")
            except Exception as e:
                print(f"❌ Erro ao enviar e-mail (Background): {e}")

        # Dispara a thread e deixa o código seguir sua vida
        email_thread = threading.Thread(target=send_async_email)
        email_thread.start()