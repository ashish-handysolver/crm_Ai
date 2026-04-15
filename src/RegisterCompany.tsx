import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Building2, Mail, Lock, User as UserIcon, ArrowRight, Loader2, CheckCircle2, AlertCircle, Sparkles, AudioLines, Flame
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithRedirect,
  GoogleAuthProvider,
  getRedirectResult,
  signOut
} from 'firebase/auth';
import { doc, setDoc, Timestamp, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export default function RegisterCompany() {
  const [companyName, setCompanyName] = useState('');
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  // Handle Google Redirect Result
  useEffect(() => {
    const handleRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          const pendingCompanyName = sessionStorage.getItem('pending_company_name');
          if (pendingCompanyName) {
            setCompanyName(pendingCompanyName);
            setLoading(true);

            // Check if user already exists in DB
            const userDoc = await getDoc(doc(db, 'users', result.user.uid));
            if (userDoc.exists() && userDoc.data().companyId) {
              navigate('/'); // They already have an account/company
            } else {
              await finalizeRegistration(result.user, result.user.displayName || 'Admin User', pendingCompanyName);
            }
            sessionStorage.removeItem('pending_company_name');
          }
        }
      } catch (err: any) {
        console.error("Redirect result error:", err);
        setError("Registration failed: " + (err.message || "Unknown error"));
        setLoading(false);
      }
    };
    handleRedirect();
  }, [auth]);

  const slugify = (text: string) => {
    return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setError("Please enter a company name.");
      return;
    }
    setLoading(true);
    setError('');

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await finalizeRegistration(user, userName);
    } catch (err: any) {
      console.error("Registration error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError("This email is already registered. Please log in.");
      } else {
        setError(err.message || "Failed to register. Please try again.");
      }
      setLoading(false);
    }
  };

  const finalizeRegistration = async (user: any, displayName: string, overrideCompanyName?: string) => {
    const finalCompanyName = overrideCompanyName || companyName;
    const companySlug = slugify(finalCompanyName);
    const companyId = companySlug || uuidv4().slice(0, 8);

    try {
      try {
        const companySnap = await getDoc(doc(db, 'companies', companyId));
        if (companySnap.exists()) {
          throw new Error(`The organization name "${finalCompanyName}" is already taken.`);
        }
      } catch (err: any) {
        if (!err.message.includes('permission')) throw err;
      }

      if (displayName !== user.displayName) {
        await updateProfile(user, { displayName });
      }

      await setDoc(doc(db, 'companies', companyId), {
        id: companyId,
        name: finalCompanyName,
        createdBy: user.uid,
        createdAt: Timestamp.now()
      });

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: displayName,
        companyId: companyId,
        role: 'admin',
        createdAt: Timestamp.now()
      });

      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to finalize setup.");
      setLoading(false);
    }
  };

  const handleGoToLogin = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (auth.currentUser) {
      await signOut(auth);
    }
    navigate('/login');
  };

  return (
    <div className="flex min-h-[100dvh] bg-[var(--crm-bg)] font-sans selection:bg-indigo-500 selection:text-white overflow-hidden relative" style={{ width: '100%' }}>
      {/* Neural Background for the whole page */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#4f46e510_0%,transparent_50%)]"></div>
      </div>

      {/* Left Area - Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-12 lg:flex-none lg:w-[45%] xl:w-[40%] bg-[var(--crm-card-bg)] backdrop-blur-2xl border-r border-[var(--crm-border)] z-10 relative overflow-hidden shadow-2xl">

        {/* Decorative background blurs inside form area */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-[20%] -left-[10%] w-[50%] h-[30%] rounded-full bg-indigo-500/10 blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-[20%] -right-[10%] w-[40%] h-[30%] rounded-full bg-purple-500/10 blur-[120px] animate-pulse delay-700"></div>
        </div>

        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease: "easeOut" }} className="mx-auto w-full max-w-md relative z-10 py-12">

          <Link to="/" className="flex items-center gap-4 group/logo mb-12">
            <div className="w-14 h-14 bg-[var(--crm-bg)]/20 rounded-2xl flex items-center justify-center shadow-2xl shadow-black/40 border border-[var(--crm-border)] p-3 transition-all duration-700 group-hover/logo:rotate-[15deg] group-hover/logo:scale-110 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-transparent opacity-0 group-hover/logo:opacity-100 transition-opacity"></div>
              <img src="/logo.png" className="w-full h-full object-contain relative z-10" alt="handycrm.ai" />
            </div>
            <div className="flex flex-col">
              <span className="text-3xl font-black tracking-tightest text-[var(--crm-text)] leading-none mb-1 lowercase">handycrm<span className="text-indigo-500">.ai</span></span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] leading-none">Registration Node</span>
                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
              </div>
            </div>
          </Link>

          <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-[var(--crm-text)] mb-4 leading-tight">
            Create account
          </h1>


          <form onSubmit={handleRegister} className="space-y-8">
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-[var(--crm-text-muted)] uppercase tracking-widest ml-1">Organization Name</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-5 flex items-center text-slate-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none">
                        <Building2 size={18} />
                      </div>
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={e => setCompanyName(e.target.value)}
                        placeholder="e.g. Global Tech Solutions"
                        className="w-full pl-14 pr-6 py-5 bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] rounded-2xl focus:bg-[var(--crm-bg)]/40 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all font-bold text-[var(--crm-text)] placeholder:text-[var(--crm-text-muted)] shadow-inner"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => companyName.trim() ? setStep(2) : setError("Please enter an organization name.")}
                    className="w-full bg-[var(--crm-bg)]/20 hover:bg-[var(--crm-bg)]/40 text-[var(--crm-text)] border border-[var(--crm-border)] rounded-2xl py-5 font-black text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3 group"
                  >
                    <span>Proceed</span>
                    <ArrowRight size={20} className="group-hover:translate-x-1.5 transition-transform text-indigo-400" />
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-[var(--crm-text-muted)] uppercase tracking-widest ml-1">User Name</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-5 flex items-center text-slate-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none">
                          <UserIcon size={18} />
                        </div>
                        <input required type="text" value={userName} onChange={e => setUserName(e.target.value)} placeholder="Full Name" className="w-full pl-14 pr-6 py-5 bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] rounded-2xl focus:bg-[var(--crm-bg)]/40 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all font-bold text-[var(--crm-text)] placeholder:text-[var(--crm-text-muted)] shadow-inner" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-[var(--crm-text-muted)] uppercase tracking-widest ml-1">Email Address</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-5 flex items-center text-slate-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none">
                          <Mail size={18} />
                        </div>
                        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@domain.com" className="w-full pl-14 pr-6 py-5 bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] rounded-2xl focus:bg-[var(--crm-bg)]/40 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all font-bold text-[var(--crm-text)] placeholder:text-[var(--crm-text-muted)] shadow-inner" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-[var(--crm-text-muted)] uppercase tracking-widest ml-1">Password</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-5 flex items-center text-slate-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none">
                          <Lock size={18} />
                        </div>
                        <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters" minLength={6} className="w-full pl-14 pr-6 py-5 bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] rounded-2xl focus:bg-[var(--crm-bg)]/40 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all font-bold text-[var(--crm-text)] placeholder:text-[var(--crm-text-muted)] shadow-inner" />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 bg-[var(--crm-bg)]/20 hover:bg-[var(--crm-bg)]/40 text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] border border-[var(--crm-border)] rounded-2xl py-5 font-black text-sm uppercase tracking-widest transition-all active:scale-95"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl py-5 font-black text-lg transition-all active:scale-[0.98] shadow-2xl shadow-indigo-500/30 flex items-center justify-center gap-3 disabled:opacity-50 group relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none"></div>
                      {loading ? <Loader2 className="animate-spin" size={22} /> : <div className="p-1.5 bg-white/10 rounded-lg group-hover:scale-110 transition-transform"><Sparkles size={18} className="text-indigo-200" /></div>}
                      <span>{loading ? 'Creating...' : 'Create'}</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          <div className="mt-14 pt-10 border-t border-[var(--crm-border)] flex flex-col items-center gap-6">
            <p className="text-xs font-black text-[var(--crm-text-muted)] uppercase tracking-[0.2em]">
              Already Registered?
            </p>
            <button
              onClick={handleGoToLogin}
              className="group flex items-center gap-3 px-8 py-4 bg-[var(--crm-bg)]/20 hover:bg-[var(--crm-bg)]/40 border border-[var(--crm-border)] rounded-2xl transition-all active:scale-95"
            >
              <Lock size={18} className="text-[var(--crm-text-muted)] group-hover:text-indigo-400 transition-colors" />
              <span className="text-sm font-black text-[var(--crm-text)] uppercase tracking-widest">Sign in</span>
              <ArrowRight size={16} className="text-[var(--crm-text-muted)] group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {auth.currentUser && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-6 py-4 rounded-xl border border-indigo-500/20 shadow-xl shadow-indigo-500/5">
              <AlertCircle size={16} className="shrink-0" />
              <span>Active Identity Detected: {auth.currentUser.email}. Log out first to re-link.</span>
            </motion.div>
          )}
        </motion.div>

        <div className="mt-auto py-10 flex flex-col items-center gap-4 relative z-10">
          <div className="flex items-center gap-6 opacity-40">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-[var(--crm-text)]"></div>
            <p className="text-[10px] font-black text-[var(--crm-text)] uppercase tracking-[0.3em] whitespace-nowrap">
              Secure Onboarding Protocol v1.9
            </p>
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-[var(--crm-text)]"></div>
          </div>
          <p className="text-[var(--crm-text)] text-[10px]   tracking-[0.2em]">HandyCRM.AI Powered By Handysolver.com</p>
        </div>
      </div>

      {/* Right Area - Visual Display */}
      <div className="hidden lg:flex flex-1 relative bg-[var(--crm-bg)] overflow-hidden items-center justify-center border-l border-[var(--crm-border)]">

        {/* Animated Grid / Pattern */}
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
              initial={{ d: "M-100,200 Q400,100 900,400 T1500,200" }}
              stroke="url(#lineGrad)"
              strokeWidth="2"
              fill="none"
              animate={{ d: ["M-100,200 Q400,100 900,400 T1500,200", "M-100,300 Q400,200 900,500 T1500,300", "M-100,200 Q400,100 900,400 T1500,200"] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            />
          </svg>
        </div>

        {/* Hero Content Layer */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="relative z-10 w-full max-w-2xl px-12 text-center">

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-2xl mb-8 shadow-2xl"
          >
            <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_#6366f1]"></div>
            <span className="text-indigo-200 text-[10px] font-black tracking-[0.3em] uppercase">Multi-Tenant Intelligence</span>
          </motion.div>

          <h2 className="text-5xl lg:text-6xl font-black text-[var(--crm-text)] leading-[1.1] mb-5 tracking-tightest">
            Streamline.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 animate-gradient-x">
              Manage. Connect.
            </span>
          </h2>
          <p className="text-lg lg:text-xl text-slate-400 font-medium leading-relaxed mb-10 max-w-xl mx-auto opacity-80">
            Access your secure workspace instantly. Manage your organization's leads, calendar, and AI-powered meeting analytics with the Handysolver edge.
          </p>

          {/* Floating UI Mockup element */}
          <div className="glass-card !bg-[var(--crm-card-bg)] !border-[var(--crm-border)] !rounded-[2rem] p-10 shadow-3xl relative overflow-hidden flex items-end gap-3 h-56 group/graph pt-16 mt-8">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500"></div>
            <div className="absolute top-4 left-6 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
              <span className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest">Network Visualization active</span>
            </div>

            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-2xl blur opacity-20 group-hover/graph:opacity-40 transition-opacity"></div>
            {[35, 65, 40, 85, 60, 80, 100].map((height, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ duration: 1.2, delay: 0.5 + i * 0.1, type: "spring" }}
                className="flex-1 bg-gradient-to-t from-indigo-600/40 via-indigo-500/80 to-indigo-400 rounded-t-xl relative group/bar hover:brightness-125 transition-all border-t border-white/20 shadow-[0_-10px_30px_rgba(99,102,241,0.2)]"
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
