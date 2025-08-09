#back_end/users/urls.py
from django.urls import path
from .views import Log_in, Log_out , Sign_up, Me  # ⬅️ added Me

urlpatterns = [
    path('login/', Log_in.as_view()), 
    path('logout/', Log_out.as_view()), 
    path('signup/', Sign_up.as_view()),
    path('me/', Me.as_view()),  
]