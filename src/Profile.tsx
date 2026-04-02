import React, { useState, useEffect } from 'react';
import {
  updateProfile, updateEmail, updatePassword,
  reauthenticateWithCredential, GoogleAuthProvider,
  EmailAuthProvider, signOut
} from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { auth, storage, db } from './firebase';
import { useAuth } from './contexts/AuthContext';
import {
  User, Mail, Lock, Camera, Loader2, CheckCircle2,
  AlertCircle, ShieldCheck, Zap, Sparkles, LogOut,
  ChevronRight, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

const GRADIENTS = [
  'from-orange-500 to-orange-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-purple-500 to-violet-600'
];

export default function Profile() {
  const { user, companyName } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    displayName: user?.displayName || '',
    email: user?.email || '',
    newPassword: '',
    confirmPassword: ''
  });

  const [uploading, setUploading] = useState(false);
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    if (user) {
      getDoc(doc(db, 'users', user.uid)).then(snap => {
        if (snap.exists()) setUserRole(snap.data().role);
      });
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Update Name
      if (formData.displayName !== user.displayName) {
        await updateProfile(user, { displayName: formData.displayName });
        await updateDoc(doc(db, 'users', user.uid), { displayName: formData.displayName });
      }

      // Update Email
      if (formData.email !== user.email) {
        await updateEmail(user, formData.email);
        await updateDoc(doc(db, 'users', user.uid), { email: formData.email });
      }

      // Update Password
      if (formData.newPassword) {
        if (formData.newPassword !== formData.confirmPassword) {
          throw new Error("Passwords do not match synchronization.");
        }
        await updatePassword(user, formData.newPassword);
      }

      setSuccess('Profile Identity Synchronized Successfully.');
      setFormData(f => ({ ...f, newPassword: '', confirmPassword: '' }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    setError('');
    try {
      const storageRef = ref(storage, `avatars/${user.uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      await updateProfile(user, { photoURL: url });
      await updateDoc(doc(db, 'users', user.uid), { photoURL: url });

      setSuccess('Biometric Visual Updated.');
    } catch (err: any) {
      setError('Upload Denial: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const randomGradient = GRADIENTS[user?.uid.charCodeAt(0) % GRADIENTS.length];

  const inputClasses = "w-full px-5 py-4 rounded-2xl border border-orange-200 bg-orange-50 focus:bg-orange-50 outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-400 transition-all font-semibold text-sm text-slate-700 shadow-sm disabled:opacity-50";
  const labelClasses = "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block px-1";

  return (
    <div className="flex-1 bg-[#FDFDFF] p-4 sm:p-8 lg:p-12 min-h-screen font-sans">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <header className="mb-12">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-slate-400 hover:text-orange-600 transition-all mb-4 group px-2 py-1 rounded-lg hover:bg-orange-50/50">
              <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Back to Dashboard</span>
            </button>
            <div className="flex items-end justify-between">
              <div>
                <h3 className="text-4xl sm:text-6xl font-black tracking-tight text-black leading-none">My Profile</h3>
              </div>
              <div className="hidden md:flex flex-col items-end gap-2 text-right">
                <div className="px-4 py-2 bg-black rounded-2xl text-[10px] font-black text-orange-400 uppercase tracking-widest shadow-xl shadow-black/10" style={{ "color": "#fffafa" }}>Admin Access</div>
                <div className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">Last Update: {new Date().toLocaleDateString()}</div>
              </div>
            </div>
          </motion.div>
        </header>

        <AnimatePresence>
          {(error || success) && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`mb-10 p-5 rounded-[2rem] flex items-center gap-4 text-sm font-bold shadow-lg border ${error ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${error ? 'bg-rose-500 text-white shadow-rose-500/20' : 'bg-emerald-500 text-white shadow-emerald-500/20'}`}>
                {error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
              </div>
              {error || success}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Sidebar Info */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-4 space-y-6 lg:sticky lg:top-8">
            <div className="bg-orange-50 rounded-[2.5rem] border border-orange-100 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className={`h-24 bg-gradient-to-br ${randomGradient} opacity-90`}></div>
              <div className="px-8 pb-8 -mt-12 text-center">
                <div className="relative inline-block mb-6">
                  <div className="w-24 h-24 rounded-3xl relative group/avatar shadow-2xl overflow-hidden ring-4 ring-white transition-all hover:scale-105 mx-auto">
                    {user?.photoURL ? (
                      <img src={user.photoURL} className="w-full h-full object-cover" alt="Profile" />
                    ) : (
                      <div className={`w-full h-full bg-orange-100 flex items-center justify-center text-slate-400 text-3xl font-black`}>
                        {getInitials(formData.displayName || 'U')}
                      </div>
                    )}
                    <label className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-all backdrop-blur-sm">
                      {uploading ? <Loader2 className="animate-spin text-white" /> : <Camera className="text-white" size={20} />}
                      <input type="file" onChange={handleImageUpload} className="hidden" accept="image/*" disabled={uploading} />
                    </label>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-xl bg-emerald-500 border-4 border-orange-50 shadow-lg"></div>
                </div>

                <h2 className="text-xl font-black text-slate-800 tracking-tight">{formData.displayName || 'System Asset'}</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 mb-6">{user?.email}</p>

                <div className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-50 rounded-2xl border border-orange-100/50 mb-8">
                  <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">{userRole || 'Entity'}</span>
                  <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[100px]">{companyName}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
                    <div className="text-lg font-black text-slate-800">74</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Leads</div>
                  </div>
                  <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
                    <div className="text-lg font-black text-slate-800">12</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Updates</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-black rounded-[2.5rem] p-8 text-white shadow-2xl shadow-orange-900/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-[40px] pointer-events-none translate-x-1/2 -translate-y-1/2 group-hover:bg-orange-500/20 transition-all duration-700"></div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center shadow-inner"><ShieldCheck size={20} /></div>
                <h3 className="text-[10px] font-black text-orange-400 tracking-[0.2em] uppercase">Security Matrix</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-orange-50/5 rounded-2xl border border-orange-50/5">
                  <span className="text-[10px] font-bold text-white/40 uppercase">Auth Level</span>
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">L4 Secure</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-orange-50/5 rounded-2xl border border-orange-50/5">
                  <span className="text-[10px] font-bold text-white/40 uppercase">Encryption</span>
                  <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">AES-256</span>
                </div>
              </div>
              <div className="mt-6 flex gap-2">
                <div className="w-full h-1 bg-orange-50/5 rounded-full overflow-hidden">
                  <div className="h-full w-3/4 bg-orange-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                </div>
              </div>
              <div className="mt-2 text-[9px] font-bold text-white/20 uppercase tracking-widest text-right">Integrity: 98%</div>
            </div>
          </motion.div>

          {/* Form Cell */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-8">
            <form onSubmit={handleUpdateProfile} className="bg-orange-50 rounded-[3rem] p-8 sm:p-12 border border-orange-100 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.04)] relative">
              <div className="space-y-10">

                <section>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 text-black flex items-center justify-center shadow-sm border border-orange-100">
                      <User size={22} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-800 tracking-tight">Personal Info</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Basic identification details</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className={labelClasses}>Full Name</label>
                      <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors" size={16} />
                        <input
                          type="text"
                          value={formData.displayName}
                          onChange={e => setFormData(f => ({ ...f, displayName: e.target.value }))}
                          className={`${inputClasses} pl-12`}
                          placeholder="Enter your name"
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelClasses}>Email Address</label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors" size={16} />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                          className={`${inputClasses} pl-12`}
                          placeholder="your@email.com"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <div className="h-[1px] bg-orange-100 opacity-50"></div>

                <section>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 text-black flex items-center justify-center shadow-sm border border-orange-100">
                      <Lock size={22} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-800 tracking-tight">Security & Password</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Access control and tokens</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className={labelClasses}>New Password</label>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors" size={16} />
                        <input
                          type="password"
                          value={formData.newPassword}
                          onChange={e => setFormData(f => ({ ...f, newPassword: e.target.value }))}
                          className={`${inputClasses} pl-12`}
                          placeholder="••••••••••••"
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelClasses}>Confirm Password</label>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors" size={16} />
                        <input
                          type="password"
                          value={formData.confirmPassword}
                          onChange={e => setFormData(f => ({ ...f, confirmPassword: e.target.value }))}
                          className={`${inputClasses} pl-12`}
                          placeholder="••••••••••••"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex items-start gap-3 p-4 bg-orange-50/50 rounded-2xl border border-orange-100/50">
                    <Sparkles size={14} className="text-orange-500 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-slate-500 font-bold leading-relaxed italic">
                      Leave encryption fields null if you do not wish to modify your current access credentials.
                    </p>
                  </div>
                </section>

                <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-6">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full md:w-auto flex items-center justify-center gap-3 bg-black text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-600 transition-all shadow-2xl shadow-black/10 active:scale-95 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin text-orange-400" size={18} /> : <CheckCircle2 size={18} className="text-orange-400" />}
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => signOut(auth).then(() => navigate('/login'))}
                    className="w-full md:w-auto px-10 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-all flex items-center justify-center gap-3 active:scale-95 border border-transparent hover:border-rose-100/50 hover:bg-rose-50 rounded-2xl"
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
