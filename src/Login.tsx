import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle, AudioLines, Flame } from 'lucide-react';
import { motion } from 'motion/react';
import { 
  signInWithEmailAndPassword
} from 'firebase/auth';
import { auth } from './firebase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err: any) {
      console.error("Login Error:", err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError("Account not found or invalid password. Please ask your admin for an invite, or register a new company.");
      } else if (err.code === 'auth/too-many-requests') {
        setError("Too many login attempts. Please try again later.");
      } else {
        setError("Failed to login: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white font-sans selection:bg-indigo-500 selection:text-white">
      {/* Left Area - Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-12 lg:flex-none lg:w-[45%] xl:w-[40%] bg-white border-r border-slate-100 z-10 shadow-[20px_0_40px_-20px_rgba(0,0,0,0.03)] relative overflow-hidden">
        
        {/* Decorative background blurs inside form area */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[30%] rounded-full bg-indigo-100/40 blur-3xl"></div>
          <div className="absolute bottom-[0%] right-[0%] w-[40%] h-[30%] rounded-full bg-blue-100/40 blur-3xl"></div>
        </div>

        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="mx-auto w-full max-w-md relative z-10 py-12">
          
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <AudioLines className="text-white w-6 h-6" />
            </div>
            <span className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">AudioCRM</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mb-3">
            Welcome back
          </h1>
          <p className="text-slate-500 font-medium text-lg mb-8">
            Please enter your credentials to access your workspace.
          </p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Work Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <Mail size={20} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@company.com"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-medium shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <Lock size={20} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-medium shadow-sm"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50/80 backdrop-blur text-red-600 rounded-2xl text-sm font-semibold border border-red-100">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full relative overflow-hidden flex items-center justify-center gap-2 bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 shadow-xl shadow-slate-900/10 group"
              >
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                {loading ? <Loader2 className="animate-spin relative z-10" size={20} /> : null}
                <span className="relative z-10">{loading ? 'Authenticating...' : 'Sign In'}</span>
                {!loading && <ArrowRight className="relative z-10" size={18} />}
              </button>
            </div>
          </form>

          <p className="mt-10 text-center text-sm font-medium text-slate-500">
            Is your company new to AudioCRM?{' '}
            <Link to="/register-company" className="text-indigo-600 font-bold hover:text-indigo-500 transition-colors ml-1">
              Create an Organization
            </Link>
          </p>
        </motion.div>
      </div>

      {/* Right Area - Visual Display */}
      <div className="hidden lg:flex flex-1 relative bg-[#0A0D14] overflow-hidden items-center justify-center">
        {/* Abstract Glowing Background Elements */}
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute bottom-1/4 left-1/4 w-[40rem] h-[40rem] bg-indigo-500/20 rounded-full blur-[120px] mix-blend-screen animate-pulse duration-1000"></div>
          <div className="absolute top-1/4 right-1/4 w-[30rem] h-[30rem] bg-blue-500/20 rounded-full blur-[100px] mix-blend-screen animate-pulse delay-700"></div>
          
          {/* Noise overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
        </div>

        {/* Hero Content */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="relative z-10 w-full max-w-2xl px-12">
          
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8">
            <Flame className="text-orange-400 w-4 h-4" />
            <span className="text-indigo-200 text-sm font-semibold tracking-wide uppercase">Multi-Tenant Intelligence</span>
          </div>

          <h2 className="text-5xl lg:text-6xl font-black text-white leading-[1.1] mb-6 tracking-tight">
            Streamline.<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-blue-400 to-cyan-400">
              Manage. Connect.
            </span>
          </h2>
          
          <p className="text-lg lg:text-xl text-slate-400 font-medium leading-relaxed mb-12 max-w-xl">
            Access your secure workspace instantly. Manage your organization's leads, calendar, and AI-powered meeting analytics all in one place.
          </p>

          {/* Floating Analytics Graph Mockup element */}
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-20 animate-pulse"></div>
            <div className="relative bg-white/5 border border-white/10 backdrop-blur-2xl rounded-2xl p-6 shadow-2xl overflow-hidden flex items-end gap-3 h-48">
              {[40, 70, 45, 90, 65, 85, 100].map((height, i) => (
                <motion.div 
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ duration: 1, delay: 0.5 + i * 0.1, type: "spring" }}
                  className="flex-1 bg-gradient-to-t from-blue-500 to-indigo-400 rounded-t-md opacity-80 hover:opacity-100 transition-opacity"
                ></motion.div>
              ))}
            </div>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
