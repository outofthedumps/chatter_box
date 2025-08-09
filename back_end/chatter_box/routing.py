#back_end/chatter_box/routing.py
from django.urls import re_path 
from . import consumers 

websocket_urlpatterns = [
    re_path(r'^ws/socket-server/$', consumers.MyWebSocketConsumer.as_asgi()),
]