// src/pages/ChatRoom.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function ChatRoom() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [myAvatar, setMyAvatar] = useState(null);
  const [waiting, setWaiting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newAvatarFile, setNewAvatarFile] = useState(null);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  console.log("This is the token: ",token)
  const myEmail = localStorage.getItem("client");

  // gate access: if not logged in, bounce to login
  useEffect(() => {
    if (!token) navigate("/", { replace: true });
  }, [token, navigate]);

  // fetch my avatar on entry
  useEffect(() => {
    const fetchMe = async () => {
      if (!token) return;
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_BASE}/me/`, {
          headers: { Authorization: `Token ${token}` },
        });
        if (res.data?.avatar_url) setMyAvatar(res.data.avatar_url);
      } catch (e) {
        console.error("Failed to fetch profile:", e);
      }
    };
    fetchMe();
  }, [token]);

  useEffect(() => {
    if (!token) return; // don't open a socket without a token

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const WS_BASE = import.meta.env.VITE_WS_BASE;
    const wsUrl = WS_BASE.startsWith("ws")
      ? `${WS_BASE}/socket-server/?token=${token}`
      : `${protocol}://${window.location.host}${WS_BASE}/socket-server/?token=${token}`;

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => console.log("WebSocket connected");

    socket.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.status) {
          // waiting/paired status
          setWaiting(data.status === "waiting");
          if (data.message) {
            setMessages((prev) => [...prev, { author: "System", text: data.message }]);
          }
          return;
        }

        // broadcast payload from server
        if (data.author && data.message) {
          setMessages((prev) => [
            ...prev,
            { author: data.author, text: data.message, avatar: data.avatar || null },
          ]);
          return;
        }

        // system message (welcome, etc.)
        if (data.message && !data.author) {
          setMessages((prev) => [...prev, { author: "System", text: data.message }]);
        }
      } catch (err) {
        console.error("Bad WS payload:", err);
      }
    };

    socket.onclose = () => console.log("WebSocket closed");

    return () => socket.close();
  }, [token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (waiting) return; // cannot send until paired

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      // do NOT locally echo; server broadcast will render exactly once (translated per user)
      socketRef.current.send(JSON.stringify({ message: input }));
    } else {
      console.error("WebSocket not open");
    }

    setInput("");
  };

  const handleLogout = async () => {
    const authToken = localStorage.getItem("token");
    try {
      if (authToken) {
        await axios.post(
          `${import.meta.env.VITE_API_BASE}/logout/`,
          {},
          { headers: { Authorization: `Token ${authToken}` } }
        );
      }
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("client");
      socketRef.current?.close();
      navigate("/", { replace: true });
    }
  };

  const handleChangeIcon = async () => {
    if (!newAvatarFile) return;
    try {
      const form = new FormData();
      form.append("avatar", newAvatarFile);
      const res = await axios.put(`${import.meta.env.VITE_API_BASE}/me/`, form, {
        headers: { Authorization: `Token ${token}`, "Content-Type": "multipart/form-data" },
      });
      if (res.data?.avatar_url) {
        setMyAvatar(res.data.avatar_url);
      }
      setShowModal(false);
      setNewAvatarFile(null);
    } catch (e) {
      console.error("Avatar update failed:", e);
      alert("Failed to update icon. Please try again.");
    }
  };

  // helper: fallback robohash if server didn't send avatar
  const fallbackAvatar = (email) =>
    email ? `https://robohash.org/${encodeURIComponent(email)}.png?size=80x80&set=set1` : null;

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-100 flex flex-col items-center px-4 py-8">
      {/* header */}
      <div className="w-full max-w-2xl flex justify-between items-center">
        <h2 className="text-xl font-semibold tracking-tight">
          <span className="bg-gradient-to-r from-emerald-400 to-sky-400 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]">
            Chat Room
          </span>
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="px-3 py-2 rounded-md border border-emerald-400/60 text-emerald-300 hover:text-emerald-200 hover:shadow-[0_0_12px_rgba(16,185,129,0.7)] hover:border-emerald-400 transition animate-pulse"
          >
            Change user icon
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-md border border-pink-400/60 text-pink-300 hover:text-pink-200 hover:shadow-[0_0_12px_rgba(244,114,182,0.7)] hover:border-pink-400 transition"
          >
            Log Out
          </button>
        </div>
      </div>

      {/* chat area */}
      <div className="w-full max-w-2xl border border-slate-800/80 rounded-xl bg-gradient-to-b from-[#0b0e14] to-[#0f1320] shadow-[0_0_40px_rgba(0,255,170,0.05)] h-[420px] overflow-y-auto p-4 mt-4 relative">
        {/* Waiting overlay */}
        {waiting && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
            <div className="h-10 w-10 border-4 border-emerald-400/60 border-t-transparent rounded-full animate-spin" />
            <div className="text-slate-300">We are searching for a chat partner…</div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isMine = myEmail && msg.author === myEmail;
          const avatarSrc =
            (isMine ? myAvatar : msg.avatar) || msg.avatar || fallbackAvatar(msg.author);

        return (
          <div key={i} className={`flex flex-col ${isMine ? "items-start" : "items-end"} my-3`}>
            {msg.author !== "System" ? (
              <>
                {isMine ? (
                  <div className="flex items-center gap-2">
                    <div className="text-[12px] text-slate-300">{msg.author}</div>
                    {avatarSrc && (
                      <img
                        src={avatarSrc}
                        alt=""
                        width={24}
                        height={24}
                        className="rounded-full object-cover ring-2 ring-emerald-400/70"
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {avatarSrc && (
                      <img
                        src={avatarSrc}
                        alt=""
                        width={24}
                        height={24}
                        className="rounded-full object-cover ring-2 ring-sky-400/70"
                      />
                    )}
                    <div className="text-[12px] text-slate-300">{msg.author}</div>
                  </div>
                )}

                <span
                  className={`inline-block mt-1 px-3 py-2 rounded-2xl border backdrop-blur ${
                    isMine
                      ? "bg-emerald-400/10 border-emerald-400/60 text-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.6)]"
                      : "bg-sky-400/10 border-sky-400/60 text-sky-200 shadow-[0_0_16px_rgba(56,189,248,0.6)]"
                  }`}
                >
                  {msg.text}
                </span>
              </>
            ) : (
              <div className="opacity-80 text-[12px] text-slate-400">{msg.text}</div>
            )}
          </div>
        );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* input */}
      <form onSubmit={sendMessage} className="w-full max-w-2xl flex mt-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={waiting ? "Waiting for partner…" : "Type a message…"}
          disabled={waiting}
          className={`flex-1 px-3 py-2 rounded-l-md bg-[#0f1320] border border-slate-800/80 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 ${
            waiting ? "opacity-60" : ""
          }`}
        />
        <button
          type="submit"
          disabled={waiting}
          className={`px-4 py-2 rounded-r-md border transition ${
            waiting
              ? "cursor-not-allowed border-emerald-400/30 bg-emerald-500/10 text-emerald-300/70"
              : "cursor-pointer border-emerald-400/60 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 hover:shadow-[0_0_12px_rgba(16,185,129,0.7)]"
          }`}
        >
          Send
        </button>
      </form>

      {/* Change icon modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-[#0f1320] text-slate-100 border border-slate-800/80 rounded-xl w-[320px] p-4 shadow-[0_0_30px_rgba(0,255,170,0.06)]">
            <h3 className="text-lg font-semibold mb-3">Change user icon</h3>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setNewAvatarFile(e.target.files?.[0] || null)}
              className="block w-full text-sm file:mr-4 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-emerald-100 file:bg-emerald-500/20 hover:file:bg-emerald-500/30 file:ring-1 file:ring-emerald-400/60 file:cursor-pointer"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setShowModal(false); setNewAvatarFile(null); }}
                className="px-3 py-2 rounded-md border border-slate-700 text-slate-300 hover:text-slate-200 hover:border-slate-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleChangeIcon}
                className="px-3 py-2 rounded-md border border-emerald-400/60 text-emerald-200 hover:text-emerald-100 hover:shadow-[0_0_12px_rgba(16,185,129,0.7)] hover:border-emerald-400 transition"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

