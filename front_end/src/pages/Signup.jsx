// src/pages/Signup.jsx
import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // file upload instead of URL
  const [avatarFile, setAvatarFile] = useState(null);
  // language choice
  const [language, setLanguage] = useState("en");
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();

    try {
      const form = new FormData();
      form.append("email", email);
      form.append("password", password);
      form.append("language", language);
      if (avatarFile) {
        form.append("avatar", avatarFile);
      }

      // keep PUT to avoid changing your route shape
      const res = await axios.put(`${import.meta.env.VITE_API_BASE}/signup/`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.status === 201) {
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("client", res.data.client);
        alert("Signup successful!");
        navigate("/chat");
      }
    } catch (err) {
      console.error("Signup error:", err);
      const message = err.response?.data?.detail || "Signup failed. Try again.";
      alert(message);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#0f1320]/80 border border-slate-800/80 rounded-2xl shadow-[0_0_40px_rgba(0,255,170,0.05)] p-6">
        <h2 className="text-2xl font-semibold text-center mb-6">
          <span className="bg-gradient-to-r from-emerald-400 to-sky-400 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]">
            Create Account
          </span>
        </h2>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="text-sm text-slate-300">Email:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full px-3 py-2 rounded-md bg-[#0f1320] border border-slate-800/80 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300">Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full px-3 py-2 rounded-md bg-[#0f1320] border border-slate-800/80 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300">Preferred Language:</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-md bg-[#0f1320] border border-slate-800/80 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
            >
              <option value="en">English</option>
              <option value="es">Spanish (es)</option>
              <option value="fr">French (fr)</option>
              <option value="de">German (de)</option>
              <option value="ja">Japanese (ja)</option>
              <option value="zh-cn">Chinese (zh-cn)</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-slate-300">Avatar (optional):</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
              className="block w-full text-sm file:mr-4 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-emerald-100 file:bg-emerald-500/20 hover:file:bg-emerald-500/30 file:ring-1 file:ring-emerald-400/60 file:cursor-pointer"
            />
          </div>

          <button
            type="submit"
            className="w-full mt-2 px-4 py-2 rounded-md border border-emerald-400/60 text-emerald-200 hover:text-emerald-100 hover:shadow-[0_0_12px_rgba(16,185,129,0.7)] hover:border-emerald-400 transition animate-pulse"
          >
            Sign Up
          </button>
        </form>

        <button
          className="w-full mt-4 px-4 py-2 rounded-md border border-sky-400/60 text-sky-200 hover:text-sky-100 hover:shadow-[0_0_12px_rgba(56,189,248,0.7)] hover:border-sky-400 transition"
          onClick={() => navigate("/")}
        >
          Already have an account? Log in
        </button>
      </div>
    </div>
  );
}

export default Signup;