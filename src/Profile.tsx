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
  ChevronRight, ArrowLeft, ExternalLink, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

const GRADIENTS = [
  'from-indigo-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-blue-500 to-indigo-600',
  'from-slate-700 to-slate-900'
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

      setSuccess('Profile identity synchronized successfully.');
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

      setSuccess('Identity visual updated successfully.');
    } catch (err: any) {
      setError('Upload denial: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const randomGradient = GRADIENTS[user?.uid.charCodeAt(0) % GRADIENTS.length];

  const inputClasses = "w-full px-6 py-4 rounded-2xl border border-slate-200 bg-white focus:bg-white outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all font-semibold text-sm text-slate-700 shadow-sm disabled:opacity-50";
  const labelClasses = "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block px-1";

  return (
    <div className="flex-1 bg-slate-50/50 p-4 sm:p-8 lg:p-12 min-h-screen font-sans overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-12">

        {/* Navigation & Header Section */}
        <div className="flex flex-col gap-6 sm:gap-8">
          <button 
            onClick={() => navigate(-1)} 
            className="inline-flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-[0.2em] transition-all group w-fit"
          >
            <div className="p-2 bg-white border border-slate-200 rounded-xl group-hover:border-indigo-200 group-hover:shadow-lg group-hover:shadow-indigo-500/5 transition-all">
              <ArrowLeft size={14} />
            </div>
            Back Protocol
          </button>

          <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 sm:gap-10">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-2 sm:space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">
                <Sparkles size={14} className="animate-pulse" /> Access Authorization Verified
              </div>
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-none">Account Configuration</h1>
              <p className="text-slate-500 font-medium max-w-2xl text-sm sm:text-lg italic leading-relaxed">Manage your neural identity and authentication vectors.</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 shrink-0">
               <div className="px-5 py-3 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/20 flex flex-col items-end min-w-[140px] sm:min-w-[160px]">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Authorization Tier</div>
                  <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg text-[10px] font-black uppercase flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    {userRole || 'Entity'}
                  </span>
               </div>
            </motion.div>
          </header>
        </div>

        <AnimatePresence>
          {(error || success) && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`p-6 rounded-[2.5rem] flex items-center gap-6 text-sm font-bold shadow-2xl border ${error ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${error ? 'bg-rose-500 text-white shadow-rose-500/20' : 'bg-emerald-500 text-white shadow-emerald-500/20'}`}>
                {error ? <AlertCircle size={24} /> : <CheckCircle2 size={24} />}
              </div>
              <span className="text-base tracking-tight">{error || success}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start pb-20">

          {/* Sidebar Identity Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-4 space-y-8 lg:sticky lg:top-8">
            
            <div className="glass-card !rounded-[3rem] border-slate-200 shadow-2xl shadow-slate-200/40 overflow-hidden relative group">
              <div className={`h-32 bg-gradient-to-br ${randomGradient} opacity-90 transition-transform duration-700 group-hover:scale-110`}></div>
              
              <div className="px-10 pb-10 -mt-16 text-center relative z-10">
                <div className="relative inline-block mb-8">
                  <div className="w-32 h-32 rounded-[2.5rem] relative group/avatar shadow-3xl overflow-hidden p-1.5 bg-white transition-all hover:scale-105 mx-auto">
                    <div className="w-full h-full rounded-[2rem] overflow-hidden bg-slate-100">
                      {user?.photoURL ? (
                        <img src={user.photoURL} className="w-full h-full object-cover" alt="Profile" />
                      ) : (
                        <div className={`w-full h-full bg-indigo-50 flex items-center justify-center text-indigo-400 text-4xl font-black`}>
                          {getInitials(formData.displayName || 'U')}
                        </div>
                      )}
                    </div>
                    <label className="absolute inset-0 bg-slate-900/80 opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-all backdrop-blur-md rounded-[2rem]">
                      {uploading ? <Loader2 className="animate-spin text-white" /> : <Camera className="text-white mb-2" size={24} />}
                      <span className="text-[9px] font-black text-white uppercase tracking-widest">{uploading ? 'Processing' : 'Update Visual'}</span>
                      <input type="file" onChange={handleImageUpload} className="hidden" accept="image/*" disabled={uploading} />
                    </label>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-2xl bg-emerald-500 border-4 border-white shadow-lg flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                  </div>
                </div>

                <div className="space-y-1 mb-8">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{formData.displayName || 'Anonymous Asset'}</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
                    <Mail size={12} className="text-indigo-400" /> {user?.email}
                  </p>
                </div>

                <div className="flex items-center justify-center gap-3 px-5 py-3 bg-slate-50 rounded-2xl border border-slate-100 mb-10 shadow-sm">
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{userRole || 'Stakeholder'}</span>
                  <div className="w-1 h-1 rounded-full bg-slate-300" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[120px]">{companyName || 'handycrm.ai'}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 hover:border-indigo-100 transition-all group/stat">
                    <div className="text-2xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">74</div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Lead Vectors</div>
                  </div>
                  <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 hover:border-indigo-100 transition-all group/stat">
                    <div className="text-2xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">12</div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">AI Insights</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Summary */}
            <div className="bg-slate-900 rounded-[2.5rem] sm:rounded-[3rem] p-8 sm:p-10 text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-[60px] pointer-events-none translate-x-1/2 -translate-y-1/2 group-hover:bg-indigo-500/20 transition-all duration-700"></div>
              
              <div className="flex items-center gap-4 mb-6 sm:mb-8">
                <div className="w-11 h-11 sm:w-12 h-12 rounded-xl sm:rounded-2xl bg-white/10 text-indigo-300 flex items-center justify-center border border-white/10 backdrop-blur-md shadow-xl"><ShieldCheck size={24} /></div>
                <div className="space-y-0.5">
                  <h3 className="text-xs sm:text-sm font-black text-white tracking-[0.1em] uppercase">Security Matrix</h3>
                  <div className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-widest">Protocol Version 4.0.2</div>
                </div>
              </div>

              <div className="space-y-4 sm:space-y-6">
                <div className="flex items-center justify-between p-3.5 sm:p-4 bg-white/5 rounded-2xl border border-white/5 group-hover:border-indigo-500/20 transition-all">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Authorization</span>
                  <span className="text-[9px] sm:text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    L5 SECURE
                  </span>
                </div>
                <div className="flex items-center justify-between p-3.5 sm:p-4 bg-white/5 rounded-2xl border border-white/5 group-hover:border-indigo-500/20 transition-all">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Storage Type</span>
                  <span className="text-[9px] sm:text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">AES-256 Cloud</span>
                </div>
              </div>

              <div className="mt-10 pt-8 border-t border-white/5 flex flex-col gap-4">
                <div className="flex justify-between items-end">
                   <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Integrity Pulse</div>
                   <div className="text-[18px] font-black text-white">99.9%</div>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '99.9%' }}
                    transition={{ duration: 2, ease: "easeOut" }}
                    className="h-full bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.6)]" 
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Configuration Cell */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-8">
            <form onSubmit={handleUpdateProfile} className="glass-card !rounded-[2.5rem] sm:!rounded-[3.5rem] p-6 sm:p-14 border-slate-200 shadow-2xl shadow-slate-200/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-full blur-[120px] pointer-events-none translate-x-1/3 -translate-y-1/3"></div>
              
              <div className="relative z-10 space-y-10 sm:space-y-14">

                <section className="space-y-8 sm:space-y-10">
                  <div className="flex items-center gap-4 sm:gap-6">
                    <div className="w-12 h-12 sm:w-14 h-14 rounded-xl sm:rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-inner">
                      <User size={24} className="sm:hidden" />
                      <User size={28} className="hidden sm:block" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase tracking-[0.05em]">Personal Metadata</h3>
                      <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Core Identity Verification</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-3">
                      <label className={labelClasses}>Full Identification Name</label>
                      <div className="relative group/input">
                        <User className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-indigo-500 transition-colors" size={18} />
                        <input
                          type="text"
                          value={formData.displayName}
                          onChange={e => setFormData(f => ({ ...f, displayName: e.target.value }))}
                          className={`${inputClasses} pl-16`}
                          placeholder="Your official designation"
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className={labelClasses}>Registered Email Vector</label>
                      <div className="relative group/input">
                        <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-indigo-500 transition-colors" size={18} />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                          className={`${inputClasses} pl-16`}
                          placeholder="primary@handycrm.ai"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <div className="h-px bg-slate-100"></div>

                <section className="space-y-10">
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center border border-slate-800 shadow-2xl">
                      <Lock size={28} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase tracking-[0.05em]">Security Protocols</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Credential Access Control</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-3">
                      <label className={labelClasses}>New Access Token</label>
                      <div className="relative group/input">
                        <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-indigo-500 transition-colors" size={18} />
                        <input
                          type="password"
                          value={formData.newPassword}
                          onChange={e => setFormData(f => ({ ...f, newPassword: e.target.value }))}
                          className={`${inputClasses} pl-16`}
                          placeholder="••••••••••••"
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className={labelClasses}>Confirm Token Vector</label>
                      <div className="relative group/input">
                        <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-indigo-500 transition-colors" size={18} />
                        <input
                          type="password"
                          value={formData.confirmPassword}
                          onChange={e => setFormData(f => ({ ...f, confirmPassword: e.target.value }))}
                          className={`${inputClasses} pl-16`}
                          placeholder="••••••••••••"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4 p-6 bg-indigo-50/30 rounded-[2rem] border border-indigo-100/50 group/tip transition-all hover:bg-white">
                    <div className="p-2 bg-white rounded-xl text-indigo-500 shadow-sm border border-indigo-50 group-hover:scale-110 transition-transform">
                      <Sparkles size={16} />
                    </div>
                    <p className="text-[11px] text-slate-500 font-bold leading-relaxed italic pr-4">
                      Security Advisor: Leave the password fields null if you intend to maintain existing biometric and cryptographic access tokens.
                    </p>
                  </div>
                </section>

                <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-8">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full md:w-auto flex items-center justify-center gap-4 bg-indigo-600 text-white px-12 py-6 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-900 transition-all shadow-2xl shadow-indigo-500/20 active:scale-95 disabled:opacity-50 group"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                    {loading ? 'Synchronizing Intelligence...' : 'Commit Configuration'}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => signOut(auth).then(() => navigate('/login'))}
                    className="w-full md:w-auto px-10 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-rose-600 transition-all flex items-center justify-center gap-3 active:scale-95 border border-transparent hover:border-rose-100 hover:bg-rose-50 rounded-[1.5rem]"
                  >
                    <LogOut size={18} />
                    Terminate Session
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
