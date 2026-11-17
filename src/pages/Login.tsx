import React, { useState } from 'react';
import {
  Lock,
  User as UserIcon,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { AuthService } from '../services/api';
import { User } from '../types';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showQuickFill, setShowQuickFill] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await AuthService.login({
        username: username.trim(),
        password: password.trim()
      });

      const user = response.user;
      localStorage.setItem('distributor_auth_user', JSON.stringify(user));
      onLoginSuccess(user);
    } catch (err: any) {
      console.error('Login failure:', err);
      setErrorMessage(
        err.response?.data?.error || 'Invalid credentials. Please verify username and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-screen flex flex-col justify-center items-center relative overflow-hidden select-none bg-cover bg-center bg-no-repeat p-4"
      style={{
        backgroundImage: `linear-gradient(rgba(7, 27, 72, 0.85), rgba(4, 18, 48, 0.9)), url('/login-bg.jpg')`,
        backgroundColor: '#0C3B9B'
      }}
    >
      {/* Top Left Brand Badge */}
      <div className="absolute top-6 left-6 sm:top-8 sm:left-10 z-20 flex items-center gap-3 bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/15">
        <img
          src="/ms-logo.png"
          alt="M&S Enterprises"
          className="h-8 sm:h-9 w-auto object-contain rounded-lg drop-shadow-xs select-none"
        />
        <div className="hidden sm:block">
          <span className="text-white font-bold text-xs tracking-tight block">M&S Enterprises</span>
          <span className="text-amber-300 text-[10px] font-medium block">Himbutana, Angoda</span>
        </div>
      </div>

      {/* Hyper-Minimal Container (Blue & Gold Accents) */}
      <div className="w-full max-w-[390px] sm:max-w-[420px] bg-white rounded-2xl shadow-2xl p-7 sm:p-10 relative z-10 border-t-4 border-[#C59B27]">
        {/* M&S Enterprises Circular Emblem */}
        <div className="flex justify-center mb-3">
          <div className="p-2 rounded-2xl bg-white shadow-md border border-amber-200/60">
            <img
              src="/ms-logo.png"
              alt="M&S Enterprises"
              className="w-20 h-20 sm:w-24 sm:h-24 object-contain select-none transition-transform hover:scale-105 duration-300"
            />
          </div>
        </div>

        <h1 className="text-2xl sm:text-[26px] font-black tracking-tight text-slate-900 text-center mb-1">
          M&amp;S Enterprises
        </h1>
        <p className="text-[11.5px] text-amber-700 font-semibold text-center mb-5 tracking-wide">
          Wholesale Distribution &bull; Himbutana, Angoda
        </p>

        {/* Portal Quick Selector Tabs */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl mb-5 text-[11px] font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => {
              setUsername('supplier');
              setPassword('supplier123');
            }}
            className={`py-1.5 px-1 rounded text-center transition cursor-pointer ${
              username === 'supplier' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            🏢 Supplier
          </button>
          <button
            type="button"
            onClick={() => {
              setUsername('admin');
              setPassword('admin123');
            }}
            className={`py-1.5 px-1 rounded text-center transition cursor-pointer ${
              username === 'admin' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            🏭 Agency ERP
          </button>
          <button
            type="button"
            onClick={() => {
              setUsername('navin');
              setPassword('navin123');
            }}
            className={`py-1.5 px-1 rounded text-center transition cursor-pointer ${
              username === 'navin' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            🚚 Sales Rep
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-5 p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          {/* Username */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-700">
              <UserIcon className="w-4 h-4 stroke-[2]" />
            </div>
            <input
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              required
              className="w-full bg-white border border-[#cfd4dc] rounded-xs pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:italic placeholder-slate-400 focus:outline-none focus:border-slate-800 transition"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-700">
              <Lock className="w-4 h-4 stroke-[2]" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full bg-white border border-[#cfd4dc] rounded-xs pl-10 pr-10 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:italic placeholder-slate-400 focus:outline-none focus:border-slate-800 transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Remember Me & Help */}
          <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-400 pt-0.5">
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-600 select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded-xs border-slate-300 text-black focus:ring-0 cursor-pointer"
              />
              <span>Remember Me</span>
            </label>
            <button
              type="button"
              onClick={() => setShowQuickFill(!showQuickFill)}
              className="hover:text-slate-700 transition cursor-pointer italic"
            >
              Quick Demo Fill
            </button>
          </div>

          {/* Log in Button */}
          <div className="pt-3 text-center">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0C3B9B] hover:bg-[#082C78] text-white font-bold text-xs tracking-wide py-2.5 px-8 rounded-xl transition disabled:opacity-50 cursor-pointer shadow-md shadow-[#0C3B9B]/25 border border-[#C59B27]/40 hover:border-[#C59B27] active:scale-[0.98]"
            >
              {loading ? 'Authenticating...' : 'Log in to M&S Console'}
            </button>
          </div>

          {/* Subtext */}
          <div className="text-center pt-1">
            <span className="text-[11px] text-slate-400 hover:text-slate-600 transition cursor-default">
              M&amp;S Enterprises Management Console
            </span>
          </div>

          {/* Quick Demo Credentials Drawer */}
          {showQuickFill && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5 justify-center">
              <button
                type="button"
                onClick={() => {
                  setUsername('supplier');
                  setPassword('supplier123');
                }}
                className="px-2.5 py-1 text-[11px] rounded bg-blue-50 hover:bg-blue-100 text-[#0C3B9B] font-bold transition cursor-pointer"
              >
                Supplier (supplier / supplier123)
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername('admin');
                  setPassword('admin123');
                }}
                className="px-2.5 py-1 text-[11px] rounded bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold transition cursor-pointer"
              >
                Admin (admin / admin123)
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername('navin');
                  setPassword('navin123');
                }}
                className="px-2.5 py-1 text-[11px] rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
              >
                Rep (navin / navin123)
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Business Details in bottom bar */}
      <div className="absolute bottom-4 text-center text-[11px] text-slate-300 font-mono z-10 px-4">
        M&amp;S Enterprises &bull; 115/1A1, Udumulla Road, Himbutana, Angoda &bull; Tel: 0773669913 / 0707077551
      </div>
    </div>
  );
};
