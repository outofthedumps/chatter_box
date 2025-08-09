//src/NotFound.jsx
import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-100 flex items-center justify-center px-4">
      <div className="max-w-lg text-center">
        <h1 className="text-7xl font-black tracking-tight">
          <span className="bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent drop-shadow-[0_0_16px_rgba(56,189,248,0.6)]">
            404
          </span>
        </h1>
        <p className="mt-4 text-slate-400">You have reached the edge of the universe.</p>
        <button
          onClick={() => navigate("/")}
          className="mt-6 px-5 py-2 rounded-md border border-emerald-400/60 text-emerald-200 hover:text-emerald-100 hover:shadow-[0_0_14px_rgba(16,185,129,0.8)] hover:border-emerald-400 transition animate-pulse"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}
