#back_end/chatter_box/urls.py
from django.contrib import admin
from django.urls import path, include



urlpatterns = [
    path('admin/', admin.site.urls),
    path('chatterbox/v1/', include('users.urls'))
]
