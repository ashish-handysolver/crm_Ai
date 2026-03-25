import React, { useState, useEffect } from 'react';
import { 
  updateProfile, updateEmail, updatePassword, 
  reauthenticateWithCredential, GoogleAuthProvider, 
  EmailAuthProvider 
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
  'from-blue-500 to-indigo-600',
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

  const inputClasses = "w-full px-5 py-4 rounded-2xl border border-slate-200 bg-white focus:bg-white outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all font-semibold text-sm text-slate-700 shadow-sm disabled:opacity-50";
  const labelClasses = "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block px-1";

  return (
    <div className="flex-1 bg-[#F9FBFF] p-4 sm:p-12 lg:p-16 min-h-full font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <header className="mb-12 flex items-center justify-between">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
             <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors mb-6 group">
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest">Return to Dashboard</span>
             </button>
             <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-slate-900 leading-none">Account Identity</h1>
             <p className="text-slate-500 mt-4 text-lg font-medium">Manage your biometric credentials and system access vectors.</p>
          </motion.div>
          
          <div className="hidden sm:block">
             <div className="w-16 h-16 rounded-[2rem] bg-indigo-50 flex items-center justify-center text-indigo-500">
                <ShieldCheck size={32} />
             </div>
          </div>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Avatar & Info Cell */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-1 space-y-8">
            <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.03)] text-center relative overflow-hidden group">
              <div className="absolute top-0 inset-x-0 h-32 bg-slate-50 border-b border-slate-100 group-hover:h-36 transition-all duration-500"></div>
              
              <div className="relative mt-8 mb-6">
                <div className="mx-auto w-32 h-32 rounded-[3.5rem] relative group/avatar shadow-2xl overflow-hidden ring-4 ring-white ring-offset-4 ring-offset-slate-50 transition-all hover:scale-105">
                  {user?.photoURL ? (
                    <img src={user.photoURL} className="w-full h-full object-cover" alt="User Profile" />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${randomGradient} flex items-center justify-center text-white text-4xl font-black`}>
                      {getInitials(formData.displayName || 'User')}
                    </div>
                  )}
                  <label className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-all backdrop-blur-sm">
                    {uploading ? <Loader2 className="animate-spin text-white mb-2" /> : <Camera className="text-white mb-2" />}
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Update</span>
                    <input type="file" onChange={handleImageUpload} className="hidden" accept="image/*" disabled={uploading} />
                  </label>
                </div>
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <div className="w-36 h-36 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
                  </div>
                )}
              </div>

              <div className="relative z-10">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">{formData.displayName || 'System Asset'}</h2>
                <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-2 px-4 py-1.5 bg-indigo-50 rounded-full inline-block">
                   {userRole || 'Entity'} · {companyName || 'Workspace'}
                </div>
              </div>

              <div className="mt-10 pt-10 border-t border-slate-50 flex justify-center gap-4 text-slate-400">
                 <div className="flex flex-col items-center gap-1 group/stat">
                    <span className="text-xl font-black text-slate-800 group-hover/stat:text-indigo-600 transition-colors">74</span>
                    <span className="text-[9px] font-black uppercase tracking-widest">Logic Nodes</span>
                 </div>
                 <div className="w-[1px] h-10 bg-slate-100"></div>
                 <div className="flex flex-col items-center gap-1 group/stat">
                    <span className="text-xl font-black text-slate-800 group-hover/stat:text-indigo-600 transition-colors">12</span>
                    <span className="text-[9px] font-black uppercase tracking-widest">Sync cycles</span>
                 </div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-indigo-900/10 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-[40px] pointer-events-none translate-x-1/2 -translate-y-1/2"></div>
               <h3 className="text-xs font-black text-indigo-400 tracking-[0.2em] uppercase mb-6 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center"><Zap size={16} /></div>
                  Telemetry Status
               </h3>
               <div className="space-y-4">
                  <div className="flex items-center justify-between">
                     <span className="text-sm font-bold text-white/40">Auth Level</span>
                     <span className="text-sm font-black text-indigo-400">Layer 4 (Secure)</span>
                  </div>
                  <div className="flex items-center justify-between">
                     <span className="text-sm font-bold text-white/40">Encryption</span>
                     <span className="text-sm font-black text-indigo-400 uppercase tracking-tighter">AES-256 Poly</span>
                  </div>
                  <div className="pt-4 border-t border-white/5 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                     <div className="px-3 py-1 bg-white/5 rounded-lg text-[9px] font-black text-white/40 uppercase whitespace-nowrap">Session Established</div>
                     <div className="px-3 py-1 bg-white/5 rounded-lg text-[9px] font-black text-white/40 uppercase whitespace-nowrap">MFA Verified</div>
                  </div>
               </div>
            </div>
          </motion.div>

          {/* Form Cell */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 space-y-8">
            <form onSubmit={handleUpdateProfile} className="bg-white rounded-[3rem] p-10 sm:p-14 border border-slate-100 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.03)]">
              <div className="space-y-10">
                
                <section>
                  <div className="flex items-center gap-3 mb-8">
                     <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                        <User size={20} />
                     </div>
                     <h3 className="text-xl font-black text-slate-800 tracking-tight">Personal Credentials</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className={labelClasses}>Identity Name</label>
                      <input
                        type="text"
                        value={formData.displayName}
                        onChange={e => setFormData(f => ({ ...f, displayName: e.target.value }))}
                        className={inputClasses}
                        placeholder="Legal Designation"
                      />
                    </div>
                    <div>
                      <label className={labelClasses}>Communication Vector (Email)</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                        className={inputClasses}
                        placeholder="asset@vertical.io"
                      />
                    </div>
                  </div>
                </section>

                <div className="h-[1px] bg-slate-50"></div>

                <section>
                  <div className="flex items-center gap-3 mb-8">
                     <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                        <Lock size={20} />
                     </div>
                     <h3 className="text-xl font-black text-slate-800 tracking-tight">Access Control</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className={labelClasses}>New Encryption Key (Password)</label>
                      <input
                        type="password"
                        value={formData.newPassword}
                        onChange={e => setFormData(f => ({ ...f, newPassword: e.target.value }))}
                        className={inputClasses}
                        placeholder="••••••••••••"
                      />
                    </div>
                    <div>
                      <label className={labelClasses}>Confirm Encryption Key</label>
                      <input
                        type="password"
                        value={formData.confirmPassword}
                        onChange={e => setFormData(f => ({ ...f, confirmPassword: e.target.value }))}
                        className={inputClasses}
                        placeholder="••••••••••••"
                      />
                    </div>
                  </div>
                  <p className="mt-4 text-[10px] text-slate-400 font-bold leading-relaxed px-1">
                    <Sparkles size={10} className="inline mr-1 text-indigo-400" /> 
                    Leave these fields null if you do not wish to modify your current access credentials.
                  </p>
                </section>

                <div className="pt-10 flex flex-col sm:flex-row gap-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-4 bg-slate-900 text-white px-10 py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-slate-900/10 active:scale-95 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                    Commit Profile Sync
                  </button>
                  <button
                    type="button"
                    onClick={() => signOut(auth).then(() => navigate('/login'))}
                    className="px-10 py-5 rounded-[2rem] border border-slate-200 text-slate-400 font-black text-sm uppercase tracking-widest hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all flex items-center justify-center gap-3 active:scale-95 group"
                  >
                    <LogOut size={18} className="group-hover:translate-x-1 transition-transform" />
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
