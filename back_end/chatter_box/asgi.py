#asgi.py
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from channels.security.websocket import AllowedHostsOriginValidator, OriginValidator

import chatter_box.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chatter_box.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AllowedHostsOriginValidator(
        OriginValidator(
            AuthMiddlewareStack(
                URLRouter(
                    chatter_box.routing.websocket_urlpatterns
                )
            ),
            # restrict to your frontend origin(s):
            ["http://localhost:5173" ]
        )
    ),
})