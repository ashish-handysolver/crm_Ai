import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, Mail, Loader2, AlertCircle, ArrowRight, AudioLines } from 'lucide-react';
import { motion } from 'motion/react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export default function SuperLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const adminEmail = (import.meta as any).env.VITE_SUPER_ADMIN_EMAIL;
    const adminPassword = (import.meta as any).env.VITE_SUPER_ADMIN_PASSWORD;

    if (email === adminEmail && password === adminPassword) {
      signInWithEmailAndPassword(auth, email, password)
        .then(() => {
          sessionStorage.setItem('is_super_admin', 'true');
          setTimeout(() => {
            navigate('/super-admin');
          }, 1000);
        })
        .catch(async (err) => {
          if (err.code === 'auth/user-not-found') {
            // Auto-provision the super admin user
            try {
              const userCredential = await createUserWithEmailAndPassword(auth, email, password);
              // Initialize user doc with super_admin role
              await setDoc(doc(db, 'users', userCredential.user.uid), {
                uid: userCredential.user.uid,
                email: email,
                displayName: 'System Admin',
                role: 'super_admin',
                onboardingComplete: true,
                createdAt: new Date()
              });

              sessionStorage.setItem('is_super_admin', 'true');
              navigate('/super-admin');
            } catch (createErr) {
              console.error("Auto-provisioning failed:", createErr);
              setError("System account provisioning failed. Please check Firebase Auth settings.");
              setLoading(false);
            }
          } else {
            console.error("Firebase Auth Error:", err);
            setError("Authentication failed: " + err.message);
            setLoading(false);
          }
        });
    } else {
      setError('Invalid system administrator credentials.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030014] flex items-center justify-center p-4 font-sans selection:bg-indigo-500 selection:text-white overflow-hidden relative">
      {/* Background Glows and Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-[50rem] h-[50rem] bg-indigo-500/10 rounded-full blur-[140px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[40rem] h-[40rem] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse delay-700"></div>

        {/* Abstract "Neural" Grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-12">
          <motion.div
            initial={{ rotate: -15, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 100 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-3xl mb-8 group"
          >
            <ShieldCheck className="text-cyan-400 w-10 h-10 group-hover:scale-110 transition-transform" />
            <div className="absolute inset-0 bg-cyan-400/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </motion.div>

          <div className="space-y-2">
            <h1 className="text-4xl font-black text-white tracking-tightest leading-none">
              Super <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">Admin</span> Login
            </h1>
          </div>
        </div>

        <div className="glass-card !bg-black/40 !backdrop-blur-3xl !border-white/5 !p-10 !rounded-[2.5rem] shadow-3xl relative overflow-hidden group/card">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-indigo-500 opacity-50 group-hover/card:opacity-100 transition-opacity"></div>

          <form onSubmit={handleLogin} className="space-y-8">
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-5 flex items-center text-slate-500 group-focus-within:text-cyan-400 transition-colors pointer-events-none">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@system.io"
                  className="w-full pl-14 pr-6 py-5 bg-white/[0.03] border border-white/10 rounded-2xl text-white placeholder:text-slate-700 font-bold focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/50 transition-all shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-5 flex items-center text-slate-500 group-focus-within:text-cyan-400 transition-colors pointer-events-none">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-14 pr-6 py-5 bg-white/[0.03] border border-white/10 rounded-2xl text-white placeholder:text-slate-700 font-bold focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/50 transition-all shadow-inner"
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-4 p-5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-xs font-bold leading-relaxed shadow-lg shadow-rose-900/10"
              >
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full group bg-indigo-600 hover:bg-indigo-500 text-white py-5 rounded-2xl font-black text-lg shadow-2xl shadow-indigo-900/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none"></div>
              {loading ? <Loader2 className="animate-spin" size={22} /> : (
                <>
                  Login <ArrowRight size={22} className="group-hover:translate-x-2 transition-transform text-cyan-200" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-16 text-center space-y-4">
          <div className="inline-flex items-center gap-6 opacity-30">
            <div className="h-px w-10 bg-gradient-to-r from-transparent to-white"></div>
            <AudioLines size={20} className="text-white" />
            <div className="h-px w-10 bg-gradient-to-l from-transparent to-white"></div>
          </div>
          <p className="text-white text-[10px]   tracking-[0.2em]">HandyCRM.AI Powered By Handysolver.com</p>
        </div>
      </motion.div>
    </div>
  );
}
