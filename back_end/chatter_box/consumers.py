# back_end/chatter_box/consumers.py
from channels.generic.websocket import AsyncWebsocketConsumer
from urllib.parse import parse_qs
from asgiref.sync import sync_to_async
from collections import deque
import json
import os
import requests
from dotenv import load_dotenv
from googletrans import Translator
import inspect  # ⬅️ NEW

load_dotenv()

# Simple in-process matchmaking (single-worker friendly)
waiting_queue = deque()  # items: {'channel': str, 'user_id': int, 'email': str, 'avatar': str, 'language': str}
partners = {}            # channel_name -> partner_channel_name
user_info = {}           # channel_name -> {'user_id', 'email', 'avatar', 'language'}

translator = Translator(service_urls=['translate.googleapis.com'])
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


class MyWebSocketConsumer(AsyncWebsocketConsumer):
    group_name = "public_chat"

    async def connect(self):
        from rest_framework.authtoken.models import Token
        from django.contrib.auth import get_user_model
        from users.models import UserProfile, Language, UserFlag, BannedAccount

        User = get_user_model()

        # parse token
        query_string = self.scope["query_string"].decode()
        params = parse_qs(query_string)
        token_key = params.get("token", [None])[0]

        self.user = None
        self.avatar_url = None
        self.language = "en"
        self.partner_channel = None

        if token_key:
            try:
                token = await sync_to_async(Token.objects.select_related("user").get)(key=token_key)
                print("This is the token: ", token)
                self.user = token.user

                # Ensure profile & language
                def _load_profile_and_lang(u):
                    profile, _ = UserProfile.objects.get_or_create(
                        user=u, defaults={'avatar_url': f"https://robohash.org/{u.pk}.png?size=80x80&set=set1"}
                    )
                    lang, _ = Language.objects.get_or_create(user=u, defaults={'code': 'en'})
                    UserFlag.objects.get_or_create(user=u, defaults={'count': 0})
                    return profile.avatar_url, lang.code

                self.avatar_url, self.language = await sync_to_async(_load_profile_and_lang)(self.user)

            except Token.DoesNotExist:
                await self.close()
                return

        await self.accept()

        # Register local info
        email = self.user.email if self.user else "Unknown"
        user_info[self.channel_name] = {
            'user_id': getattr(self.user, 'pk', None),
            'email': email,
            'avatar': self.avatar_url,
            'language': self.language,
        }

        # Attempt to pair
        await self._attempt_pair_or_wait()

        # Log to server console
        if self.user:
            print(f"{self.user.email} has connected")
        else:
            print("Unknown user has connected")

        # Welcome system message
        await self.send(text_data=json.dumps({
            'message': 'WebSocket connection established!'
        }))

    async def disconnect(self, close_code):
        # If paired, notify partner and requeue them
        partner = partners.get(self.channel_name)
        if partner:
            # notify partner
            partner_email = user_info.get(self.channel_name, {}).get('email', 'A user')
            await self.channel_layer.send(partner, {
                'type': 'direct.system',
                'message': f"{partner_email} has left the chat."
            })
            # remove pairing both ways
            partners.pop(partner, None)
            partners.pop(self.channel_name, None)
            # put partner back to waiting and set status
            if partner in user_info:
                waiting_queue.append({
                    'channel': partner,
                    'user_id': user_info[partner]['user_id'],
                    'email': user_info[partner]['email'],
                    'avatar': user_info[partner]['avatar'],
                    'language': user_info[partner]['language'],
                })
                await self.channel_layer.send(partner, {
                    'type': 'direct.status',
                    'status': 'waiting',
                    'message': 'Searching for a chat partner...'
                })

        # if I was in the waiting queue, remove me
        self._remove_from_waiting(self.channel_name)

        # cleanup
        user_info.pop(self.channel_name, None)
        partners.pop(self.channel_name, None)

        if self.user:
            print(f"{self.user.email} has disconnected")
        else:
            print("Unknown user has disconnected")

    async def receive(self, text_data):
        from users.models import UserFlag, BannedAccount
        data = json.loads(text_data)
        message = data.get('message', '')

        # If no partner yet, ignore messages (still waiting)
        partner = partners.get(self.channel_name)
        if not partner:
            return

        # 1) Moderation gate
        flagged = await sync_to_async(self._moderate_text)(message)
        if flagged:
            # increment flags and potentially ban
            def _flag_and_maybe_ban(u):
                flags, _ = UserFlag.objects.get_or_create(user=u, defaults={'count': 0})
                flags.count += 1
                flags.save()
                banned_now = flags.count >= 3
                if banned_now:
                    # ban by email, delete user
                    BannedAccount.objects.get_or_create(email=u.email)
                    u.delete()
                return flags.count, banned_now

            flags_count, banned_now = await sync_to_async(_flag_and_maybe_ban)(self.user)

            # warn only the flagged user
            await self.send(text_data=json.dumps({
                'author': 'System',
                'message': 'The text you have submitted has been flagged as inappropriate. Your account has been flagged for innaproprate behavior. Incurring three flags will result in an account ban.'
            }))

            if banned_now:
                await self.send(text_data=json.dumps({
                    'author': 'System',
                    'message': 'Your account has been banned.'
                }))
                await self.close()
            return

        # 2) Translation: send each user the message in *their* preferred language
        sender_email = user_info[self.channel_name]['email']
        sender_avatar = user_info[self.channel_name]['avatar']
        sender_lang = user_info[self.channel_name]['language']
        partner_lang = user_info[partner]['language']

        # 🔧 translate for sender & partner (async-aware helper; no sync_to_async wrapper)
        to_sender = await self._translate(message, sender_lang)
        to_partner = await self._translate(message, partner_lang)

        # deliver to sender (left)
        await self.send(text_data=json.dumps({
            "author": sender_email,
            "message": to_sender,
            "avatar": sender_avatar
        }))

        # deliver to partner (right)
        await self.channel_layer.send(partner, {
            "type": "direct.message",
            "author": sender_email,
            "message": to_partner,
            "avatar": sender_avatar
        })

    # === Direct handlers (no groups) ===
    async def direct_message(self, event):
        await self.send(text_data=json.dumps({
            "author": event["author"],
            "message": event["message"],
            "avatar": event.get("avatar"),
        }))

    async def direct_system(self, event):
        await self.send(text_data=json.dumps({
            "author": "System",
            "message": event["message"]
        }))

    async def direct_status(self, event):
        payload = {"status": event.get("status")}
        if "message" in event:
            payload["message"] = event["message"]
        await self.send(text_data=json.dumps(payload))

    # === Helpers ===
    def _remove_from_waiting(self, channel_name):
        if not waiting_queue:
            return
        keep = deque()
        while waiting_queue:
            itm = waiting_queue.popleft()
            if itm['channel'] != channel_name:
                keep.append(itm)
        waiting_queue.extend(keep)

    async def _attempt_pair_or_wait(self):
        # try to find a partner not myself
        partner_item = None
        for _ in range(len(waiting_queue)):
            cand = waiting_queue.popleft()
            if cand['channel'] != self.channel_name:
                partner_item = cand
                break
            waiting_queue.append(cand)

        if partner_item:
            # pair them
            partners[self.channel_name] = partner_item['channel']
            partners[partner_item['channel']] = self.channel_name
            self.partner_channel = partner_item['channel']

            # update statuses
            await self.send(text_data=json.dumps({"status": "paired"}))
            await self.channel_layer.send(partner_item['channel'], {"type": "direct.status", "status": "paired"})

            # notify both sides
            my_email = user_info[self.channel_name]['email']
            their_email = user_info[partner_item['channel']]['email']

            # partner sees I entered
            await self.channel_layer.send(partner_item['channel'], {
                'type': 'direct.system',
                'message': f"{my_email} has entered the chat."
            })
            # I see who I’m chatting with
            await self.send(text_data=json.dumps({
                'author': 'System',
                'message': f"You are now chatting with {their_email}."
            }))
        else:
            # no partner → wait
            waiting_queue.append({
                'channel': self.channel_name,
                'user_id': user_info[self.channel_name]['user_id'],
                'email': user_info[self.channel_name]['email'],
                'avatar': user_info[self.channel_name]['avatar'],
                'language': user_info[self.channel_name]['language'],
            })
            await self.send(text_data=json.dumps({
                'status': 'waiting',
                'message': 'Searching for a chat partner...'
            }))

    def _moderate_text(self, text: str) -> bool:
        """
        Returns True if text is flagged. If no API key configured, treat as not flagged.
        """
        print("moderation triggered")
        if not OPENAI_API_KEY:
            print("THE KEY WAS NOT READ CORRECLTY ")
            return False
        try:
            resp = requests.post(
                "https://api.openai.com/v1/moderations",
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
                json={"model": "omni-moderation-latest", "input": text},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            return bool(data.get("results", [{}])[0].get("flagged", False))
        except Exception:
            print("openai api request failed!")
            # fail-open: don't block messages on API hiccups
            return False

    async def _translate(self, msg: str, dest: str) -> str:
        """
        Works with both sync and async googletrans implementations.
        """
        try:
            if not dest:
                return msg
            supported = {'en', 'es', 'fr', 'de', 'ja', 'zh-cn', 'zh-tw', 'it', 'pt'}
            if dest not in supported:
                return msg
            maybe = translator.translate(msg, dest=dest)
            # If googletrans returns a coroutine in this environment, await it.
            res = await maybe if inspect.isawaitable(maybe) else maybe
            return getattr(res, "text", msg)
        except Exception as e:
            print(f"googletrans failed: {e!r}")
            return msg
