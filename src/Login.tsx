import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle, AudioLines, Flame } from 'lucide-react';
import { motion } from 'motion/react';
import {
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

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
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

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
    <div className="flex min-h-screen bg-orange-50 font-sans selection:bg-orange-500 selection:text-white" style={{ width: '100%' }}>
      {/* Left Area - Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-12 lg:flex-none lg:w-[45%] xl:w-[40%] bg-orange-50 border-r border-orange-100 z-10 shadow-[20px_0_40px_-20px_rgba(0,0,0,0.03)] relative overflow-hidden">

        {/* Decorative background blurs inside form area */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[30%] rounded-full bg-orange-100/40 blur-3xl"></div>
          <div className="absolute bottom-[0%] right-[0%] w-[40%] h-[30%] rounded-full bg-blue-100/40 blur-3xl"></div>
        </div>

        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="mx-auto w-full max-w-md relative z-10 py-12">

          <div className="flex items-center gap-3 mb-6 group/logo cursor-default">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-600 to-orange-700 rounded-2xl flex items-center justify-center shadow-xl shadow-orange-500/20 shadow-lg border border-orange-50/20 p-2 transition-transform duration-500 group-hover/logo:rotate-[10deg]">
              <AudioLines className="text-white" size={24} />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 leading-none mb-1">Handysolver</span>
              <span className="text-[9px] font-black text-orange-500 uppercase tracking-[0.2em] leading-none">Intelligence Hub</span>
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
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 group-focus-within:text-orange-500 transition-colors">
                  <Mail size={20} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@company.com"
                  className="w-full pl-12 pr-4 py-4 bg-orange-50/50 border border-orange-200 rounded-2xl focus:bg-orange-50 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-semibold text-black placeholder:text-slate-400 placeholder:font-medium shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 group-focus-within:text-orange-500 transition-colors">
                  <Lock size={20} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-4 bg-orange-50/50 border border-orange-200 rounded-2xl focus:bg-orange-50 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-semibold text-black placeholder:text-slate-400 placeholder:font-medium shadow-sm"
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
                className="w-full relative overflow-hidden flex items-center justify-center gap-2 bg-[#0F172A] text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 shadow-xl shadow-black/10 group"
              >
                <div className="absolute inset-0 bg-orange-50/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                {loading ? <Loader2 className="animate-spin relative z-10" size={20} /> : null}
                <span className="relative z-10 text-base">{loading ? 'Authenticating...' : 'Sign In'}</span>
                {!loading && <ArrowRight className="relative z-10 opacity-70 group-hover:translate-x-1 transition-transform" size={18} />}
              </button>
            </div>
          </form>

          <p className="mt-8 text-center text-sm font-medium text-slate-500">
            Is your company new to AudioCRM?{' '}
            <Link to="/register-company" className="text-orange-600 font-bold hover:text-orange-500 transition-colors ml-1">
              Create an Organization
            </Link>
          </p>

        </motion.div>
        <p className="text-[11px] font-medium text-slate-500 flex items-center justify-center gap-1.5">
          Made with <span className="text-[14px]">🧡</span> by Handysolver &copy; {new Date().getFullYear()}
        </p>
      </div>

      {/* Right Area - Visual Display */}
      <div className="hidden lg:flex flex-1 relative bg-[#0A0D14] overflow-hidden items-center justify-center">
        {/* Abstract Glowing Background Elements */}
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute bottom-1/4 left-1/4 w-[40rem] h-[40rem] bg-orange-500/20 rounded-full blur-[120px] mix-blend-screen animate-pulse duration-1000"></div>
          <div className="absolute top-1/4 right-1/4 w-[30rem] h-[30rem] bg-blue-500/20 rounded-full blur-[100px] mix-blend-screen animate-pulse delay-700"></div>

          {/* Noise overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
        </div>

        {/* Hero Content */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="relative z-10 w-full max-w-2xl px-12">

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50/5 border border-orange-50/10 backdrop-blur-md mb-8">
            <Flame className="text-orange-400 w-4 h-4" />
            <span className="text-orange-200 text-sm font-semibold tracking-wide uppercase">Multi-Tenant Intelligence</span>
          </div>

          <h2 className="text-5xl lg:text-6xl font-black text-white leading-[1.1] mb-5 tracking-tightest">
            Streamline.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-orange-400 to-cyan-400">
              Manage. Connect.
            </span>
          </h2>

          <p className="text-lg lg:text-xl text-slate-400 font-medium leading-relaxed mb-10 max-w-xl">
            Access your secure workspace instantly. Manage your organization's leads, calendar, and AI-powered meeting analytics with the Handysolver edge.
          </p>

          {/* Floating Analytics Graph Mockup element */}
          <div className="bg-[#1E293B]/20 border border-orange-50/10 backdrop-blur-3xl rounded-2xl p-8 shadow-2xl relative overflow-hidden flex items-end gap-3 h-56 group/graph">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/20 to-orange-500/20 rounded-2xl blur opacity-20 group-hover/graph:opacity-40 transition-opacity"></div>
            {[35, 65, 40, 85, 60, 80, 100].map((height, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ duration: 1.2, delay: 0.5 + i * 0.1, type: "spring" }}
                className="flex-1 bg-gradient-to-t from-orange-500/80 to-orange-400/80 rounded-t-md relative group/bar hover:from-orange-500 hover:to-orange-300 transition-all border-t border-orange-50/20"
              >
                <div className="absolute inset-0 bg-blue-400/10 blur-sm opacity-0 group-hover/bar:opacity-100 transition-opacity"></div>
              </motion.div>
            ))}
          </div>

        </motion.div>
      </div>
    </div>
  );
}
