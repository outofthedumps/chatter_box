// src/pages/Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_BASE}/login/`, {
        email,
        password,
      });

      // Save token + client locally
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("client", response.data.client);
      console.log(`This is the token: ${response.data.token}`);
      alert(`Login successful! User ${response.data.client} added`);

      // go straight to chat
      navigate("/chat");
    } catch (err) {
      console.error("Login error:", err);
      const message =
        err.response?.data?.detail || "Login failed. Please try again.";
      alert(message);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#0f1320]/80 border border-slate-800/80 rounded-2xl shadow-[0_0_40px_rgba(0,255,170,0.05)] p-6">
        <h2 className="text-2xl font-semibold text-center mb-6">
          <span className="bg-gradient-to-r from-emerald-400 to-sky-400 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]">
            Login
          </span>
        </h2>
        <form onSubmit={handleLogin} className="space-y-4">
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
          <button
            type="submit"
            className="w-full mt-2 px-4 py-2 rounded-md border border-emerald-400/60 text-emerald-200 hover:text-emerald-100 hover:shadow-[0_0_12px_rgba(16,185,129,0.7)] hover:border-emerald-400 transition animate-pulse"
          >
            Log In
          </button>
        </form>
        <button
          className="w-full mt-4 px-4 py-2 rounded-md border border-sky-400/60 text-sky-200 hover:text-sky-100 hover:shadow-[0_0_12px_rgba(56,189,248,0.7)] hover:border-sky-400 transition"
          onClick={() => navigate("/signup")}
        >
          Create Account
        </button>
      </div>
    </div>
  );
}

export default Login;


