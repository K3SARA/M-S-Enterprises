import React, { useState } from 'react';
import {
  Lock,
  User as UserIcon,
  AlertCircle,
  Eye,
  EyeOff,
  Server,
  Settings,
  CheckCircle2,
  RefreshCw,
  Wifi,
  WifiOff
} from 'lucide-react';
import {
  AuthService,
  getCalculatedApiBaseUrl,
  getCustomServerUrl,
  setCustomServerUrl,
  testServerUrl,
  DEFAULT_MOBILE_SERVER_URL
} from '../services/api';
import { User } from '../types';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

const DEFAULT_OFFLINE_ACCOUNTS: Record<string, { password: string; user: User }> = {
  navin: {
    password: 'navin123',
    user: {
      id: 'rep-navin-offline',
      username: 'navin',
      fullName: 'Navin (Sales Rep)',
      role: 'REP',
      phone: '0773669913',
      lorryId: 'lorry-1',
      lorry: {
        id: 'lorry-1',
        vehicleNumber: 'WP ND-4589',
        driverName: 'Saman Kumara',
        routeId: 'route-1',
        routeName: 'Route 1 - Kandy & Central Highway',
        routeCode: 'RT-01'
      }
    }
  },
  admin: {
    password: 'admin123',
    user: {
      id: 'admin-offline',
      username: 'admin',
      fullName: 'Managing Director',
      role: 'ADMIN',
      phone: '0707077551'
    }
  },
  supplier: {
    password: 'supplier123',
    user: {
      id: 'supplier-offline',
      username: 'supplier',
      fullName: 'Ceylon Agro Suppliers',
      role: 'SUPPLIER',
      supplierId: 'sup-1',
      supplier: {
        id: 'sup-1',
        code: 'SUP-01',
        name: 'Ceylon Agro Suppliers',
        phone: '0112345678',
        email: 'info@ceylonagro.lk',
        outstandingBalance: 125000
      }
    }
  }
};

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showQuickFill, setShowQuickFill] = useState(false);

  // Server Settings Modal State
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverInputUrl, setServerInputUrl] = useState(() => {
    return getCustomServerUrl() || DEFAULT_MOBILE_SERVER_URL;
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Cached user for offline login
  const cachedUser: User | null = (() => {
    try {
      const raw = localStorage.getItem('distributor_auth_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionTestResult(null);
    try {
      const res = await testServerUrl(serverInputUrl);
      setConnectionTestResult(res);
    } catch (e: any) {
      setConnectionTestResult({ success: false, message: e.message || 'Connection failed' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveServerUrl = () => {
    setCustomServerUrl(serverInputUrl);
    setShowServerModal(false);
    setErrorMessage(null);
  };

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
      const isNetError = !err.response || err.code === 'ERR_NETWORK' || err.message?.toLowerCase().includes('network');
      if (isNetError) {
        const cleanUser = username.trim().toLowerCase();
        const cleanPass = password.trim();

        // 1. Check if matches locally cached user credentials
        if (cachedUser && cachedUser.username.toLowerCase() === cleanUser) {
          onLoginSuccess(cachedUser);
          return;
        }

        // 2. Check if matches preconfigured offline accounts
        const matchedAccount = DEFAULT_OFFLINE_ACCOUNTS[cleanUser];
        if (matchedAccount && matchedAccount.password === cleanPass) {
          localStorage.setItem('distributor_auth_user', JSON.stringify(matchedAccount.user));
          onLoginSuccess(matchedAccount.user);
          return;
        }

        setErrorMessage(
          `Server offline. You can tap "⚡ Work in Offline Mode" below to bill without internet, or check Wi-Fi/Server Settings.`
        );
      } else {
        setErrorMessage(
          err.response?.data?.error || 'Invalid credentials. Please verify username and password.'
        );
      }
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

          {/* Universal Offline Entry Button (No Internet Needed) */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                const targetUser = cachedUser || DEFAULT_OFFLINE_ACCOUNTS.navin.user;
                localStorage.setItem('distributor_auth_user', JSON.stringify(targetUser));
                onLoginSuccess(targetUser);
              }}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-50 via-amber-100/70 to-amber-50 hover:from-amber-100 hover:to-amber-200 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-98"
              title="Work completely offline without any internet connection"
            >
              <WifiOff className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>
                {cachedUser
                  ? `⚡ Enter Offline Mode (${cachedUser.fullName || cachedUser.username})`
                  : '⚡ Work in Offline Mode (No Internet Needed)'}
              </span>
            </button>
          </div>

          {/* Server Connection Bar */}
          <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100">
            <span className="flex items-center gap-1 truncate mr-1">
              <Server className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="font-mono text-slate-700 font-bold truncate">
                {getCustomServerUrl() || DEFAULT_MOBILE_SERVER_URL}
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                setServerInputUrl(getCustomServerUrl() || DEFAULT_MOBILE_SERVER_URL);
                setConnectionTestResult(null);
                setShowServerModal(true);
              }}
              className="text-blue-600 hover:text-blue-800 font-bold underline shrink-0 cursor-pointer"
            >
              Change
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

      {/* Server Settings Modal */}
      {showServerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">Backend Server Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowServerModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Enter the backend server address (e.g. local Wi-Fi IP or Railway URL) that this mobile app connects to:
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Server Base URL
              </label>
              <input
                type="text"
                value={serverInputUrl}
                onChange={(e) => setServerInputUrl(e.target.value)}
                placeholder="http://192.168.201.15:4812"
                className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            {/* Quick preset buttons */}
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Presets:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setServerInputUrl('http://192.168.201.15:4812')}
                  className="text-[11px] px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded font-mono text-slate-700 cursor-pointer"
                >
                  Office PC (192.168.201.15)
                </button>
                <button
                  type="button"
                  onClick={() => setServerInputUrl('http://10.0.2.2:4812')}
                  className="text-[11px] px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded font-mono text-slate-700 cursor-pointer"
                >
                  Android Emulator
                </button>
              </div>
            </div>

            {/* Test result message */}
            {connectionTestResult && (
              <div
                className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                  connectionTestResult.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {connectionTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span className="leading-tight">{connectionTestResult.message}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                <span>{testingConnection ? 'Testing...' : 'Test Connection'}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveServerUrl}
                className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Save &amp; Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
