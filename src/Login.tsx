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
    <div className="flex min-h-[100dvh] bg-slate-50/50 font-sans selection:bg-indigo-500 selection:text-white overflow-hidden" style={{ width: '100%' }}>
      {/* Left Area - Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-12 lg:flex-none lg:w-[45%] xl:w-[40%] bg-white border-r border-slate-100 z-10 shadow-[20px_0_40px_-20px_rgba(0,0,0,0.03)] relative overflow-hidden">

        {/* Decorative background blurs inside form area */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[30%] rounded-full bg-indigo-50/50 blur-3xl"></div>
          <div className="absolute bottom-[0%] right-[0%] w-[40%] h-[30%] rounded-full bg-slate-50/50 blur-3xl"></div>
        </div>

        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="mx-auto w-full max-w-md relative z-10 py-12">

          <div className="flex items-center gap-3 mb-12 group/logo cursor-default">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/5 border border-slate-100 p-2.5 transition-all duration-500 group-hover/logo:rotate-12 group-hover/logo:scale-110 overflow-hidden">
              <img src="/logo.png" className="w-full h-full object-contain" alt="handycrm.ai" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tighter text-slate-900 leading-none mb-1 lowercase">handycrm.ai</span>
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] leading-none opacity-80">Next-Gen Intelligence</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-black mb-3">
            Welcome back
          </h1>
          <p className="text-slate-500 font-medium text-lg mb-8">
            Please enter your credentials to access your workspace.
          </p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Work Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                  <Mail size={20} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@company.com"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-semibold text-black placeholder:text-slate-400 placeholder:font-medium shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                  <Lock size={20} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-semibold text-black placeholder:text-slate-400 placeholder:font-medium shadow-sm"
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
                className="w-full btn-primary !py-5 shadow-2xl shadow-indigo-200"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Lock size={18} />}
                <span className="text-base">{loading ? 'Authenticating...' : 'Secure Access'}</span>
                {!loading && <ArrowRight className="opacity-70 group-hover:translate-x-1 transition-transform" size={18} />}
              </button>
            </div>
          </form>

          <p className="mt-12 text-center text-sm font-black text-slate-400 uppercase tracking-widest">
            Don't have a secure workspace yet?{' '}
            <Link to="/register-company" className="text-indigo-600 hover:text-indigo-500 transition-colors ml-1 decoration-skip-ink decoration-2 underline">
              Create Organization
            </Link>
          </p>

        </motion.div>
        <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest flex items-center justify-center gap-2 mb-8 lowercase">
          Build &copy; {new Date().getFullYear()} handycrm.ai - enterprise grade security
        </p>
      </div>

      {/* Right Area - Hero & Demo Showcase */}
      <div className="hidden lg:flex flex-1 relative bg-slate-950 overflow-hidden items-center justify-center">
        {/* Animated Background Gradients */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[150px] animate-pulse pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px] animate-pulse delay-1000 pointer-events-none"></div>

        {/* Hero Content Layer */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="relative z-10 w-full max-w-4xl px-20 space-y-16">
          
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-indigo-400 text-xs font-black uppercase tracking-widest backdrop-blur-md">
              <Sparkles size={16} /> Now with 2.0 AI Engines
            </div>
            <h2 className="text-6xl xl:text-7xl font-black text-white leading-tight tracking-tighter">
              Unlock the <span className="text-indigo-400">Power</span> of Your Data.
            </h2>
            <p className="text-xl text-slate-400 font-medium leading-relaxed max-w-2xl italic">
              Experience the next generation of sales intelligence. Summarize meetings, track lead progress, and boost productivity with AI.
            </p>
          </div>

          {/* Interactive Mockup Container */}
          <div className="glass-card !p-2 !rounded-[2.5rem] border-white/5 shadow-3xl shadow-indigo-500/10 relative group perspective-1000">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
            <div className="relative overflow-hidden rounded-[2.2rem] aspect-[16/10] bg-slate-900 border border-white/10">
              {/* Actual Image Mockup */}
              <img 
                src="/dashboard-preview.png" 
                alt="handycrm.ai dashboard"
                className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-700 hover:scale-105"
              />
              {/* Mockup Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
              
              {/* Play Demo Button Overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                   onClick={() => {
                     setDemoMode(true);
                     navigate('/');
                   }}
                   className="px-10 py-5 bg-white text-indigo-600 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl hover:scale-110 active:scale-95 transition-all flex items-center gap-3"
                >
                  <Flame size={20} /> Launch Demo Experience
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-12 pt-8 border-t border-white/5">
             <div className="space-y-2">
                <div className="text-2xl font-black text-white">99.8%</div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Transcription Accuracy</div>
             </div>
             <div className="space-y-2">
                <div className="text-2xl font-black text-white">85%</div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Efficiency Increase</div>
             </div>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
