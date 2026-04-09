import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle, AudioLines, Flame, Sparkles, Building2 } from 'lucide-react';
import { motion } from 'motion/react';
import {
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useDemo } from './DemoContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(location.state?.error || '');

  const { setDemoMode } = useDemo();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      try {
        // Check if user is active in Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.active === false) {
            await signOut(auth);
            setError("Contact admin: your account is deactivated.");
            setLoading(false);
            return;
          }
        }
      } catch (dbErr: any) {
        if (dbErr?.code === 'permission-denied') {
          await signOut(auth);
          setError("Contact admin: your account is deactivated or restricted.");
          setLoading(false);
          return;
        }
        console.warn("Could not fetch user profile:", dbErr);
      }

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
    <div className="flex min-h-[100dvh] bg-[#030014] font-sans selection:bg-indigo-500 selection:text-white overflow-hidden relative" style={{ width: '100%' }}>
      {/* Neural Background for the whole page */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#4f46e510_0%,transparent_50%)]"></div>
      </div>

      {/* Left Area - Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-12 lg:flex-none lg:w-[45%] xl:w-[40%] bg-black/40 backdrop-blur-2xl border-r border-white/5 z-10 relative overflow-hidden shadow-2xl">

        {/* Decorative background blurs inside form area */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-[10%] -left-[10%] w-[50%] h-[30%] rounded-full bg-indigo-500/10 blur-[100px] animate-pulse"></div>
          <div className="absolute bottom-[10%] -right-[10%] w-[40%] h-[30%] rounded-full bg-purple-500/10 blur-[100px] animate-pulse delay-1000"></div>
        </div>

        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease: "easeOut" }} className="mx-auto w-full max-w-md relative z-10 py-12">

          <div className="flex items-center gap-4 mb-14 group/logo cursor-default">
            <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center shadow-2xl shadow-black/40 border border-white/10 p-3 transition-all duration-700 group-hover/logo:rotate-[15deg] group-hover/logo:scale-110 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-transparent opacity-0 group-hover/logo:opacity-100 transition-opacity"></div>
              <img src="/logo.png" className="w-full h-full object-contain relative z-10" alt="handycrm.ai" />
            </div>
            <div className="flex flex-col">
              <span className="text-3xl font-black tracking-tightest text-white leading-none mb-1 lowercase">handycrm.ai</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] leading-none">Neural Hub</span>
                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
              </div>
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-white mb-4 leading-tight">
            Login
          </h1>


          <form onSubmit={handleLogin} className="space-y-8">
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-5 flex items-center text-slate-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="identity@company.com"
                  className="w-full pl-14 pr-6 py-5 bg-white/[0.03] border border-white/10 rounded-2xl focus:bg-white/[0.07] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all font-bold text-white placeholder:text-slate-600 shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-5 flex items-center text-slate-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-14 pr-6 py-5 bg-white/[0.03] border border-white/10 rounded-2xl focus:bg-white/[0.07] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all font-bold text-white placeholder:text-slate-600 shadow-inner"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-4 bg-rose-500/10 backdrop-blur text-rose-400 rounded-2xl text-sm font-semibold border border-rose-500/20">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl py-5 font-black text-lg transition-all active:scale-[0.98] shadow-2xl shadow-indigo-500/30 flex items-center justify-center gap-3 disabled:opacity-50 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none"></div>
                {loading ? <Loader2 className="animate-spin" size={22} /> : <div className="p-1.5 bg-white/10 rounded-lg group-hover:scale-110 transition-transform"><Sparkles size={18} className="text-indigo-200" /></div>}
                <span>{loading ? 'Login...' : 'Login'}</span>
                {!loading && <ArrowRight className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1.5 transition-all" size={20} />}
              </button>
            </div>
          </form>

          <div className="mt-14 pt-10 border-t border-white/5 flex flex-col items-center gap-6">
            <p className="text-xs font-black text-slate-600 uppercase tracking-[0.2em]">
              Create New Orgnization?
            </p>
            <Link
              to="/register-company"
              className="group flex items-center gap-3 px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all active:scale-95"
            >
              <Building2 size={18} className="text-slate-400 group-hover:text-indigo-400 transition-colors" />
              <span className="text-sm font-black text-white uppercase tracking-widest">Create Organization</span>
              <ArrowRight size={16} className="text-slate-500 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

        </motion.div>

        <div className="mt-auto py-10 flex flex-col items-center gap-4 relative z-10">
          <div className="flex items-center gap-6 opacity-40">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-white"></div>
            <p className="text-[10px] font-black text-white uppercase tracking-[0.3em] whitespace-nowrap">
              Secure Intelligence Protocol v2.4
            </p>
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-white"></div>
          </div>
          <p className="text-white text-[10px]   tracking-[0.2em]">HandyCRM.AI Powered By Handysolver.com</p>
        </div>
      </div>

      {/* Right Area - Hero & Neural Visualization */}
      <div className="hidden lg:flex flex-1 relative bg-[#030014] overflow-hidden items-center justify-center border-l border-white/5">

        {/* Animated Grid / Pattern - Ported from Analytics style */}
        <div className="absolute inset-0 z-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(99, 102, 241, 0.15) 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>

        {/* Abstract Glowing Background Elements */}
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.1, 0.2, 0.1]
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/4 left-1/4 w-[50rem] h-[50rem] bg-indigo-600/20 rounded-full blur-[140px] mix-blend-screen"
          ></motion.div>
          <motion.div
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.1, 0.15, 0.1]
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-1/4 right-1/4 w-[40rem] h-[40rem] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen"
          ></motion.div>

          <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
        </div>

        {/* Neural Network SVG Decor */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-30">
          <svg width="100%" height="100%" className="absolute inset-0">
            <defs>
              <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4f46e5" stopOpacity="0" />
                <stop offset="50%" stopColor="#4f46e5" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.path
              d="M-100,200 Q400,100 900,400 T1500,200"
              stroke="url(#lineGrad)"
              strokeWidth="2"
              fill="none"
              animate={{ d: ["M-100,200 Q400,100 900,400 T1500,200", "M-100,300 Q400,200 900,500 T1500,300", "M-100,200 Q400,100 900,400 T1500,200"] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            />
          </svg>
        </div>

        {/* Hero Content Layer */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, ease: "easeOut" }} className="relative z-10 w-full max-w-2xl px-16 text-center">

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-2xl mb-12 shadow-2xl"
          >
            <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_#6366f1]"></div>
            <span className="text-indigo-200 text-[10px] font-black tracking-[0.3em] uppercase">Enterprise Cognitive Layer</span>
          </motion.div>

          <h2 className="text-6xl xl:text-7xl font-black text-white leading-[1] mb-8 tracking-tightest">
            Cognitive<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 animate-gradient-x">
              Sales Logic.
            </span>
          </h2>
          <p className="text-xl text-slate-400 font-medium leading-relaxed mb-14 max-w-xl mx-auto opacity-80">
            Secure multi-tenant gateway to your augmented sales intelligence. Synced, summarized, and optimized in real-time.
          </p>

          {/* Floating UI Mockup element - High Fidelity Bar Graph */}
          <div className="glass-card !bg-black/30 !border-white/10 !rounded-[2rem] p-10 shadow-3xl relative overflow-hidden group/graph pt-16">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500"></div>
            <div className="absolute top-4 left-6 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Real-time Analysis active</span>
            </div>

            <div className="flex items-end gap-4 h-48 relative z-10">
              {[45, 75, 55, 95, 70, 85, 100].map((height, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-3 group/bar">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ duration: 1.5, delay: 0.6 + i * 0.1, ease: [0.33, 1, 0.68, 1] }}
                    className="w-full bg-gradient-to-t from-indigo-600/40 via-indigo-500/80 to-indigo-400 rounded-t-xl relative border-t border-white/20 shadow-[0_-10px_30px_rgba(99,102,241,0.2)] group-hover/bar:brightness-125 transition-all"
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-all text-[10px] font-black text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-md backdrop-blur-md border border-indigo-500/20">
                      {height}%
                    </div>
                  </motion.div>
                </div>
              ))}
            </div>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
