import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle, AudioLines, Flame, Sparkles } from 'lucide-react';
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
    <div className="flex min-h-[100dvh] bg-[#0A0D14] font-sans selection:bg-indigo-500 selection:text-white overflow-hidden" style={{ width: '100%' }}>
      {/* Left Area - Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-12 lg:flex-none lg:w-[45%] xl:w-[40%] bg-[#0A0D14] border-r border-white/10 z-10 relative overflow-hidden">

        {/* Decorative background blurs inside form area */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[30%] rounded-full bg-indigo-500/10 blur-3xl"></div>
          <div className="absolute bottom-[0%] right-[0%] w-[40%] h-[30%] rounded-full bg-purple-500/10 blur-3xl"></div>
        </div>

        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="mx-auto w-full max-w-md relative z-10 py-12">

          <div className="flex items-center gap-3 mb-12 group/logo cursor-default">
            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center shadow-xl shadow-black/20 border border-white/10 p-2.5 transition-all duration-500 group-hover/logo:rotate-12 group-hover/logo:scale-110 overflow-hidden">
              <img src="/logo.png" className="w-full h-full object-contain" alt="handycrm.ai" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tighter text-white leading-none mb-1 lowercase">handycrm.ai</span>
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] leading-none opacity-80">Next-Gen Intelligence</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
            Welcome back
          </h1>
          <p className="text-slate-400 font-medium text-lg mb-8">
            Please enter your credentials to access your workspace.
          </p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">Work Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                  <Mail size={20} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@company.com"
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:bg-white/10 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-semibold text-white placeholder:text-slate-500 placeholder:font-medium shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                  <Lock size={20} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:bg-white/10 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-semibold text-white placeholder:text-slate-500 placeholder:font-medium shadow-sm"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-4 bg-rose-500/10 backdrop-blur text-rose-400 rounded-2xl text-sm font-semibold border border-rose-500/20">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl py-5 font-black text-base transition-all active:scale-95 shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2 disabled:opacity-50 group"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Lock size={18} />}
                <span className="text-base">{loading ? 'Authenticating...' : 'Secure Access'}</span>
                {!loading && <ArrowRight className="opacity-70 group-hover:translate-x-1 transition-transform" size={18} />}
              </button>
            </div>
          </form>

          <p className="mt-12 text-center text-sm font-black text-slate-500 uppercase tracking-widest">
            Don't have a secure workspace yet?{' '}
            <Link to="/register-company" className="text-indigo-400 hover:text-indigo-300 transition-colors ml-1 decoration-skip-ink decoration-2 underline">
              Create Organization
            </Link>
          </p>

        </motion.div>
        <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center justify-center gap-2 mb-8 cursor-default relative z-10">
          Made with <span className="text-[12px] animate-pulse">🧡</span> by Handysolver &copy; {new Date().getFullYear()}
        </p>
      </div>

      {/* Right Area - Hero & Demo Showcase */}
      <div className="hidden lg:flex flex-1 relative bg-[#0A0D14] overflow-hidden items-center justify-center">
        {/* Abstract Glowing Background Elements - Ported from RegisterCompany */}
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[40rem] h-[40rem] bg-indigo-500/20 rounded-full blur-[120px] mix-blend-screen animate-pulse duration-1000"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-purple-500/20 rounded-full blur-[100px] mix-blend-screen animate-pulse delay-700"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50rem] h-[50rem] bg-blue-500/10 rounded-full blur-[150px] mix-blend-screen"></div>

          {/* Noise overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
        </div>

        {/* Hero Content Layer */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="relative z-10 w-full max-w-2xl px-12">

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8">
            <Flame className="text-indigo-400 w-4 h-4" />
            <span className="text-indigo-200 text-sm font-semibold tracking-wide uppercase">Multi-Tenant Intelligence</span>
          </div>

          <h2 className="text-5xl lg:text-6xl font-black text-white leading-[1.1] mb-5 tracking-tightest">
            Streamline.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-indigo-400 to-cyan-400">
              Manage. Connect.
            </span>
          </h2>

          <p className="text-lg lg:text-xl text-slate-400 font-medium leading-relaxed mb-10 max-w-xl">
            Access your secure workspace instantly. Experience the next generation of sales intelligence. Summarize meetings, track lead progress, and boost productivity with AI.
          </p>

          {/* Floating UI Mockup element - Interactive Bar Graph from RegisterCompany */}
          <div className="bg-[#1E293B]/20 border border-white/10 backdrop-blur-3xl rounded-2xl p-8 shadow-2xl relative overflow-hidden flex items-end gap-3 h-56 group/graph">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-2xl blur opacity-20 group-hover/graph:opacity-40 transition-opacity"></div>
            {[35, 65, 40, 85, 60, 80, 100].map((height, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ duration: 1.2, delay: 0.5 + i * 0.1, type: "spring" }}
                className="flex-1 bg-gradient-to-t from-indigo-500/80 to-indigo-400/80 rounded-t-md relative group/bar hover:from-indigo-500 hover:to-indigo-300 transition-all border-t border-white/10"
              >
                <div className="absolute inset-0 bg-blue-400/10 blur-sm opacity-0 group-hover/bar:opacity-100 transition-opacity"></div>
              </motion.div>
            ))}
          </div>
          {/* 
          <div className="grid grid-cols-2 gap-12 pt-12 mt-4 border-t border-white/5">
             <div className="space-y-2">
                <div className="text-2xl font-black text-white">99.8%</div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Transcription Accuracy</div>
             </div>
             <div className="space-y-2 text-right">
                <button
                   onClick={() => {
                     setDemoMode(true);
                     navigate('/');
                   }}
                   className="px-6 py-3 bg-white text-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 ml-auto"
                >
                  <Flame size={14} /> Launch Demo
                </button>
             </div>
          </div> */}

        </motion.div>
      </div>
    </div>
  );
}
