import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Building2, Mail, Lock, User as UserIcon, ArrowRight, Loader2, CheckCircle2, AlertCircle, Sparkles, AudioLines
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
    <div className="flex min-h-screen bg-white font-sans selection:bg-indigo-500 selection:text-white">
      {/* Left Area - Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-12 lg:flex-none lg:w-[45%] xl:w-[40%] bg-white border-r border-slate-100 z-10 shadow-[20px_0_40px_-20px_rgba(0,0,0,0.03)] relative overflow-hidden">
        
        {/* Decorative background blurs inside form area */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[30%] rounded-full bg-blue-100/40 blur-3xl"></div>
          <div className="absolute bottom-[0%] right-[0%] w-[40%] h-[30%] rounded-full bg-indigo-100/40 blur-3xl"></div>
        </div>

        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="mx-auto w-full max-w-md relative z-10 py-12">
          
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-slate-200/50 border border-slate-100 p-1.5 overflow-hidden">
              <img src="/logo.png" alt="CRM AI Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">CRM AI</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mb-3">
            Create your account
          </h1>
          <p className="text-slate-500 font-medium text-lg mb-8">
            Set up your company to start managing leads and AI meeting notes easily.
          </p>

          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Company Name</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 group-focus-within:text-indigo-500 transition-colors"><Building2 size={20} /></div>
                <input 
                  type="text" 
                  required 
                  value={companyName} 
                  onChange={e => setCompanyName(e.target.value)} 
                  placeholder="e.g. Acme Corp" 
                  className="w-full pl-12 pr-4 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-semibold text-slate-900 shadow-sm" 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Your Name</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 group-focus-within:text-indigo-500 transition-colors"><UserIcon size={20} /></div>
                  <input type="text" required value={userName} onChange={e => setUserName(e.target.value)} placeholder="John Doe" className="w-full pl-12 pr-4 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-semibold shadow-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Work Email</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 group-focus-within:text-indigo-500 transition-colors"><Mail size={20} /></div>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" className="w-full pl-12 pr-4 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-semibold shadow-sm" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 group-focus-within:text-indigo-500 transition-colors"><Lock size={20} /></div>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" minLength={6} className="w-full pl-12 pr-4 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-semibold shadow-sm" />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50/80 backdrop-blur text-red-600 rounded-2xl text-sm font-semibold border border-red-100">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full relative overflow-hidden flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-2xl font-bold hover:shadow-lg hover:shadow-indigo-500/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 group">
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
              {loading ? <Loader2 className="animate-spin relative z-10" size={20} /> : <CheckCircle2 className="relative z-10" size={20} />}
              <span className="relative z-10">{loading ? 'Setting up...' : 'Create Account'}</span>
            </button>
          </form>

          <p className="mt-10 text-center text-sm font-medium text-slate-500">
            Already have an account?{' '}
            <button onClick={handleGoToLogin} className="text-indigo-600 font-bold hover:text-indigo-500 transition-colors ml-1">
              Sign in to Workspace
            </button>
          </p>

          {auth.currentUser && (
            <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-amber-600 bg-amber-50 px-4 py-3 rounded-xl border border-amber-100">
              <AlertCircle size={14} />
              Logged in as {auth.currentUser.email}. To register a new organization, click Sign in to log out first.
            </div>
          )}
        </motion.div>
      </div>

      {/* Right Area - Visual Display */}
      <div className="hidden lg:flex flex-1 relative bg-[#0A0D14] overflow-hidden items-center justify-center">
        {/* Abstract Glowing Background Elements */}
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[40rem] h-[40rem] bg-indigo-500/20 rounded-full blur-[120px] mix-blend-screen animate-pulse duration-1000"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-purple-500/20 rounded-full blur-[100px] mix-blend-screen animate-pulse delay-700"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50rem] h-[50rem] bg-blue-500/10 rounded-full blur-[150px] mix-blend-screen"></div>
          
          {/* Noise overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
        </div>

        {/* Hero Content */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="relative z-10 w-full max-w-2xl px-12">
          
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8">
            <Sparkles className="text-indigo-400 w-4 h-4" />
            <span className="text-indigo-200 text-sm font-semibold tracking-wide uppercase">Smart Audio Notes</span>
          </div>

          <h2 className="text-5xl lg:text-6xl font-black text-white leading-[1.1] mb-6 tracking-tight">
            Record.<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
              Listen. Grow.
            </span>
          </h2>
          
          <p className="text-lg lg:text-xl text-slate-400 font-medium leading-relaxed mb-12 max-w-xl">
            Make your sales better with AI meeting notes, easy lead tracking, and simple workflows that work for your whole team.
          </p>

          {/* Floating UI Mockup element */}
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-30 animate-pulse"></div>
            <div className="relative bg-white/5 border border-white/10 backdrop-blur-2xl rounded-2xl p-6 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                 <div className="flex gap-2">
                   <div className="w-3 h-3 rounded-full bg-slate-600/50"></div>
                   <div className="w-3 h-3 rounded-full bg-slate-600/50"></div>
                   <div className="w-3 h-3 rounded-full bg-slate-600/50"></div>
                 </div>
                 <div className="text-xs font-bold text-slate-400 bg-white/5 px-3 py-1 rounded-full">Secure Workspace</div>
              </div>
              <div className="space-y-4">
                <div className="h-2 w-3/4 bg-slate-700/50 rounded-full"></div>
                <div className="h-2 w-1/2 bg-slate-700/50 rounded-full"></div>
                <div className="h-2 w-5/6 bg-slate-700/50 rounded-full"></div>
                <div className="h-2 w-2/3 bg-slate-700/50 rounded-full"></div>
              </div>
              <div className="mt-8 flex gap-4">
                 <div className="flex-1 h-24 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl border border-indigo-500/20"></div>
                 <div className="flex-1 h-24 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl border border-blue-500/20"></div>
              </div>
            </div>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
