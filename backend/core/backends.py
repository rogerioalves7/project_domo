from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.db.models import Q

class EmailOrUsernameModelBackend(ModelBackend):
    """
    Permite login com e-mail OU username.
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        UserModel = get_user_model()
        
        # O campo 'username' aqui é na verdade o que o usuário digitou (e-mail ou username)
        
        if username is None:
            username = kwargs.get(UserModel.USERNAME_FIELD)
        
        try:
            # Tenta encontrar o usuário por e-mail (case-insensitive) OU username
            user = UserModel.objects.get(
                Q(username__iexact=username) | Q(email__iexact=username)
            )
        except UserModel.DoesNotExist:
            # Sem usuário correspondente
            UserModel().set_password(password)
            return None
        except UserModel.MultipleObjectsReturned:
            # Caso raro: se houver usernames e emails duplicados
            user = UserModel.objects.filter(email__iexact=username).order_by('id').first()

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        
        return None