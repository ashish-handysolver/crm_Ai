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
            navigate('/super-admin-console');
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
              navigate('/super-admin-console');
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
    <div className="min-h-screen bg-[#0A0D14] flex items-center justify-center p-4 font-sans selection:bg-rose-500 selection:text-white">
      {/* Background Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[40rem] h-[40rem] bg-indigo-500/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-rose-500/10 rounded-full blur-[100px]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-rose-600 to-rose-400 rounded-2xl shadow-[0_0_30px_rgba(225,29,72,0.3)] mb-6">
            <ShieldCheck className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">Super Admin Login</h1>
          <p className="text-slate-400 font-medium">Access for authorized admins only</p>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center text-slate-500 group-focus-within:text-rose-400 transition-colors">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@system.com"
                  className="w-full pl-12 pr-5 py-4 bg-white/5 border border-white/5 rounded-2xl text-white placeholder:text-slate-600 font-semibold focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center text-slate-500 group-focus-within:text-rose-400 transition-colors">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-12 pr-5 py-4 bg-white/5 border border-white/5 rounded-2xl text-white placeholder:text-slate-600 font-semibold focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all"
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-sm font-bold"
              >
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full group bg-gradient-to-r from-rose-600 to-rose-500 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-rose-900/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-3"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  Login Now <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-12 text-center text-slate-500 text-sm font-bold flex items-center justify-center gap-2">
          <AudioLines size={16} className="text-slate-700" />
          Powered by Handysolver Security Framework
        </div>
      </motion.div>
    </div>
  );
}
