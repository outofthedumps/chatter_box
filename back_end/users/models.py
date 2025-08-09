from django.db import models

# Create your models here.
#back_end/users/models.py
from django.db import models
from django.conf import settings

class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile'
    )
    # Use TextField for potentially large data URLs
    avatar_url = models.TextField(blank=True)

    def __str__(self):
        email = getattr(self.user, "email", None) or getattr(self.user, "username", "user")
        return f"Profile({email})"


class UserFlag(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='flags'
    )
    count = models.PositiveIntegerField(default=0)

    def __str__(self):
        email = getattr(self.user, "email", None) or getattr(self.user, "username", "user")
        return f"Flags({email}={self.count})"


class BannedAccount(models.Model):
    email = models.EmailField(unique=True)

    def __str__(self):
        return f"Banned({self.email})"


class Language(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='language_pref'
    )
    code = models.CharField(max_length=10, default='en')  # e.g., 'en', 'es', 'fr', 'de', 'ja', 'zh-cn'

    def __str__(self):
        email = getattr(self.user, "email", None) or getattr(self.user, "username", "user")
        return f"Language({email}={self.code})"
