#back_end/users/views.py
from rest_framework.response import Response 
from rest_framework.views import APIView
from django.contrib.auth import authenticate, get_user_model
from rest_framework import status 
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.authtoken.models import Token 
from django.db import connection 
from django.core.management.color import no_style 
from rest_framework.parsers import MultiPartParser, FormParser  # ⬅️ for file uploads
from .models import UserProfile, UserFlag, BannedAccount, Language

import base64

User = get_user_model()

def _default_avatar(user):
    # stable robohash based on user id
    return f"https://robohash.org/{user.pk}.png?size=80x80&set=set1"

def _file_to_data_url(django_file):
    """
    Convert an uploaded file to a data URL so we don't need MEDIA settings.
    """
    if not django_file:
        return None
    content = django_file.read()
    # fallback if content_type missing
    content_type = getattr(django_file, "content_type", None) or "image/png"
    b64 = base64.b64encode(content).decode("ascii")
    return f"data:{content_type};base64,{b64}"


class Log_in(APIView): 
    permission_classes = [AllowAny]

    def post(self, request): 
        email = request.data.get('email')
        password = request.data.get('password')
        user = authenticate(username=email, password=password)

        if not user: 
            return Response(
                {'detail': 'Invalid credentials'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        token, _ = Token.objects.get_or_create(user=user)
        # ensure profile exists
        profile, _ = UserProfile.objects.get_or_create(user=user, defaults={'avatar_url': _default_avatar(user)})
        # ensure language exists
        Language.objects.get_or_create(user=user, defaults={'code': 'en'})

        return Response(
            {'client': user.email, 'token': token.key}
        )


class Log_out(APIView): 
    permission_classes = [IsAuthenticated]

    def post(self, request): 
        request.user.auth_token.delete()
        return Response(
            {"message": "User Successfully Logged Out."},
            status=status.HTTP_204_NO_CONTENT
        )


class Sign_up(APIView): 
    permission_classes = [AllowAny]
    parser_classes = (MultiPartParser, FormParser)  # accept multipart for avatar upload

    def post(self, request): 
        email = request.data.get('email')
        password = request.data.get('password')
        language_code = (request.data.get('language') or 'en').lower()

        #Get ip address
        ip = request.META.get('REMOTE_ADDR')
        print(f'User with ip:{ip} has sign up')

        # block banned emails
        if BannedAccount.objects.filter(email__iexact=email).exists():
            return Response({'detail': 'This email is banned.'}, status=status.HTTP_403_FORBIDDEN)

        user = User.objects.create_user(username=email, email=email, password=password)
        
        # create token
        token = Token.objects.create(user=user)

        # avatar: file upload first, else optional URL, else default robohash
        uploaded = request.FILES.get('avatar')
        avatar_url = _file_to_data_url(uploaded)
        if not avatar_url:
            maybe_url = request.data.get('avatar_url')
            avatar_url = maybe_url if maybe_url else _default_avatar(user)

        UserProfile.objects.create(user=user, avatar_url=avatar_url)
        Language.objects.create(user=user, code=language_code)
        UserFlag.objects.get_or_create(user=user, defaults={'count': 0})

        return Response(
            {'client': user.email, 'token': token.key}, 
            status=status.HTTP_201_CREATED
        )

    # keep your frontend's PUT flow working
    def put(self, request):
        return self.post(request)


class Me(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(
            user=request.user,
            defaults={'avatar_url': _default_avatar(request.user)}
        )
        lang, _ = Language.objects.get_or_create(user=request.user, defaults={'code': 'en'})
        return Response({
            'client': request.user.email,
            'avatar_url': profile.avatar_url,
            'language': lang.code,
        })

    def put(self, request):
        """
        Update avatar via multipart upload (field name: 'avatar').
        """
        profile, _ = UserProfile.objects.get_or_create(
            user=request.user,
            defaults={'avatar_url': _default_avatar(request.user)}
        )
        uploaded = request.FILES.get('avatar')
        if not uploaded:
            return Response({'detail': 'No file uploaded under field "avatar".'}, status=status.HTTP_400_BAD_REQUEST)

        data_url = _file_to_data_url(uploaded)
        if not data_url:
            return Response({'detail': 'Unable to read uploaded file.'}, status=status.HTTP_400_BAD_REQUEST)

        profile.avatar_url = data_url
        profile.save()
        return Response({'avatar_url': profile.avatar_url})