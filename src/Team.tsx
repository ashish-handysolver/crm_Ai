import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Mail, Shield, User, Loader2, CheckCircle2, AlertCircle, RefreshCw, ChevronLeft, Key, Lock, Briefcase, Zap, Edit, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, doc, setDoc, Timestamp, getDoc, deleteDoc } from 'firebase/firestore';
import { db, firebaseConfig } from './firebase';
import { useDemo } from './DemoContext';
import { useAuth } from './contexts/AuthContext';

export default function Team({ user, companyId }: { user: any, companyId: string | null }) {
  const { isDemoMode, demoData } = useDemo();
  const { role } = useAuth();
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(!isDemoMode);
  const [isAdding, setIsAdding] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [isActiveStatus, setIsActiveStatus] = useState(true);

  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isDemoMode) {
      setTeamMembers(demoData.team);
      setLoading(false);
      return;
    }
    if (!companyId) return;

    const q = query(collection(db, 'users'), where('companyId', '==', companyId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTeamMembers(users);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId, isDemoMode, demoData]);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      if (editingUserId) {
        await setDoc(doc(db, 'users', editingUserId), {
          displayName: displayName,
          role: newUserRole,
          active: isActiveStatus
        }, { merge: true });
        setSuccess(`Operation Successful: Node ${displayName} updated.`);
      } else {
        const apiKey = firebaseConfig.apiKey || (import.meta as any).env.VITE_FIREBASE_API_KEY;
        if (!apiKey) throw new Error("Security Vector: API Key missing. Authentication bridge failed.");

        const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, returnSecureToken: true })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Protocol Error: Account initialization aborted.");

        const newUid = data.localId;

        try {
          await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: data.idToken, displayName: displayName, returnSecureToken: false })
          });
        } catch (err) { console.warn("Identity metadata propagation failed", err); }

        await setDoc(doc(db, 'users', newUid), {
          uid: newUid,
          email: email,
          displayName: displayName,
          companyId: companyId,
          role: newUserRole,
          active: isActiveStatus,
          createdAt: Timestamp.now()
        });

        setSuccess(`Operation Successful: Node ${displayName} registered to the company matrix.`);
      }

      setIsAdding(false);
      setEditingUserId(null);
      setEmail('');
      setPassword('');
      setDisplayName('');
      setNewUserRole('user');
      setIsActiveStatus(true);

      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      console.error("Error saving user:", err);
      if (err.message === 'EMAIL_EXISTS') setError("Conflict Detected: Email address already mapped to an existing entity.");
      else setError(err.message || "Logic Failure: An unexpected error occurred during provisioning.");
    } finally {
      setActionLoading(false);
    }
  };

  if (!companyId && !isDemoMode) {
    return (
      <div className="flex-1 bg-white flex items-center justify-center min-h-[calc(100vh-88px)]">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white p-12 rounded-[2.5rem] border border-slate-200 shadow-xl text-center max-w-md">
          <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-rose-500/10">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Access Restricted</h2>
          <p className="text-slate-500 mt-4 leading-relaxed font-medium">Authentication context for your organization is missing or invalid. Contact your system administrator.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50/50 min-h-screen overflow-y-auto">
      <div className="max-w-7xl mx-auto p-4 sm:p-8 lg:p-12 space-y-10">
        
        {/* Header Section */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 sm:gap-10">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">
              <Users size={14} className="animate-pulse" /> Personnel Management Protocol
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 leading-none">Security Team</h1>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-wrap items-center gap-3">
            {!isDemoMode && (
              <button 
                onClick={() => {
                  setIsAdding(!isAdding);
                  if (!isAdding) {
                    setEditingUserId(null);
                    setEmail('');
                    setPassword('');
                    setDisplayName('');
                    setNewUserRole('user');
                    setIsActiveStatus(true);
                  }
                }}
                className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 ${isAdding ? 'bg-white text-slate-600 border border-slate-200 shadow-slate-200/20' : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700'}`}
              >
                {isAdding ? <ChevronLeft size={18} /> : <UserPlus size={18} />}
                {isAdding ? 'Back to Inventory' : 'Add Operator'}
              </button>
            )}
            {isDemoMode && (
              <div className="px-6 py-3 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <Lock size={16} /> Read-only Proxy
              </div>
            )}
          </motion.div>
        </header>

        {success && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl flex items-center gap-4 text-sm font-bold shadow-xl shadow-emerald-500/5">
            <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 size={20} />
            </div>
            {success}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {isAdding ? (
            <motion.div
              key="add-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass-card !rounded-[2.5rem] overflow-hidden relative"
            >
              <div className="p-6 sm:p-12 space-y-10">
                <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner border border-indigo-100"><Key size={22} /></div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">{editingUserId ? 'Modify Node' : 'Initialize Node'}</h2>
                </div>

                <form onSubmit={handleSaveUser} className="space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12">
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Designation Registry</label>
                          <div className="relative group/input">
                            <User className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-indigo-500 transition-colors" size={18} />
                            <input
                              type="text"
                              value={displayName}
                              onChange={e => setDisplayName(e.target.value)}
                              placeholder="Full Name"
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-16 pr-6 text-sm font-bold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-inner"
                              required
                            />
                          </div>

                          {!editingUserId && (
                            <>
                              <div className="relative group/input">
                                <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-indigo-500 transition-colors" size={18} />
                                <input
                                  type="email"
                                  value={email}
                                  onChange={e => setEmail(e.target.value)}
                                  placeholder="Corporate Email"
                                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-16 pr-6 text-sm font-bold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-inner"
                                  required
                                />
                              </div>
                              <div className="relative group/input">
                                <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-indigo-500 transition-colors" size={18} />
                                <input
                                  type="password"
                                  value={password}
                                  onChange={e => setPassword(e.target.value)}
                                  placeholder="Access Password"
                                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-16 pr-6 text-sm font-bold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-inner"
                                  required
                                  minLength={6}
                                />
                              </div>
                            </>
                          )}

                          {!!editingUserId && (
                            <div className="relative group/input">
                              <Shield className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-indigo-500 transition-colors" size={18} />
                              <select 
                                value={isActiveStatus ? 'active' : 'inactive'} 
                                onChange={e => setIsActiveStatus(e.target.value === 'active')} 
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-16 pr-6 text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-inner appearance-none"
                              >
                                <option value="active">Operational (Active)</option>
                                <option value="inactive">Suspended (Inactive)</option>
                              </select>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-6">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Authorization Matrix</label>
                        {[
                          { id: 'user', label: 'Operator', desc: 'Standard CRM data access' },
                          { id: 'admin', label: 'Nexus Admin', desc: 'System-wide override control' }
                        ].map(r => (
                          <label key={r.id} className={`block p-5 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden group ${newUserRole === r.id ? 'bg-indigo-50 border-indigo-500 shadow-lg shadow-indigo-500/10' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                            <input type="radio" className="sr-only" name="role" value={r.id} checked={newUserRole === r.id} onChange={e => setNewUserRole(e.target.value)} />
                            <div className="flex items-start gap-4 relative z-10">
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 transition-all ${newUserRole === r.id ? `border-indigo-500 bg-indigo-500` : 'border-slate-300'}`}>
                                {newUserRole === r.id && <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />}
                              </div>
                              <div>
                                <div className={`font-black tracking-tight text-base mb-1 ${newUserRole === r.id ? `text-indigo-900` : 'text-slate-800'}`}>{r.label}</div>
                                <div className={`text-xs font-medium ${newUserRole === r.id ? `text-indigo-600/80` : 'text-slate-400'}`}>{r.desc}</div>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {error && (
                      <div className="p-5 bg-rose-50 text-rose-600 rounded-2xl text-sm font-bold flex items-center gap-4 border border-rose-100 shadow-xl shadow-rose-500/5">
                        <AlertCircle size={20} className="shrink-0" />
                        {error}
                      </div>
                    )}

                    <div className="pt-6 border-t border-slate-50">
                      <button type="submit" disabled={actionLoading} className="w-full sm:w-auto px-12 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-3">
                        {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                        <span>{actionLoading ? 'Synchronizing...' : editingUserId ? 'Commit Changes' : 'Deploy Node'}</span>
                      </button>
                    </div>
                </form>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="list-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="glass-card !p-0 !rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-xl shadow-slate-200/40">
                <div className="p-6 sm:px-10 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-3">
                    <Briefcase size={16} /> Personnel Inventory
                  </h3>
                  <div className="text-[10px] w-fit font-black text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 uppercase tracking-widest">{teamMembers.length} Operational Nodes</div>
                </div>

                {loading ? (
                  <div className="p-24 sm:p-32 flex flex-col items-center justify-center gap-6">
                    <Loader2 className="animate-spin text-indigo-500 w-12 h-12" />
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Crawling Organizational Ledger...</span>
                  </div>
                ) : teamMembers.length === 0 ? (
                  <div className="p-24 sm:p-32 text-center flex flex-col items-center gap-6">
                    <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-center text-slate-300 shadow-inner">
                      <Users size={40} />
                    </div>
                    <p className="text-slate-400 font-black italic max-w-xs uppercase text-[10px] tracking-widest">No human resources detected in current company partition.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                          <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Member Profile</th>
                          <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hidden sm:table-cell">Protocol Tier</th>
                          <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hidden lg:table-cell">Deployment</th>
                          <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {teamMembers.map((member, idx) => (
                          <motion.tr
                            key={member.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="hover:bg-indigo-50/30 transition-all group"
                          >
                            <td className="p-6">
                              <div className="flex items-center gap-4">
                                <div className={`relative shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg border-2 shadow-sm transition-transform group-hover:scale-110 ${member.role === 'admin' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                  {member.displayName?.charAt(0) || <User size={20} />}
                                  {member.active !== false && <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-4 border-white shadow-sm" />}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{member.displayName}</div>
                                  <div className="text-xs font-semibold text-slate-400 truncate">{member.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-6 hidden sm:table-cell">
                              {member.role === 'admin' ? (
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-indigo-200">
                                  <Shield size={10} /> Nexus Admin
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 text-slate-500 text-[9px] font-black uppercase tracking-widest rounded-lg shadow-sm">
                                  Operator
                                </div>
                              )}
                            </td>
                            <td className="p-6 hidden lg:table-cell">
                               <div className="flex flex-col gap-1">
                                  <span className={`w-fit px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${member.active !== false ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                    {member.active !== false ? 'Operational' : 'Suspended'}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-400">{member.createdAt?.toDate ? member.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Legacy Core'}</span>
                               </div>
                            </td>
                            <td className="p-6 text-right">
                              <div className="flex items-center justify-end gap-3">
                                 <button
                                    onClick={() => {
                                      setEditingUserId(member.id);
                                      setDisplayName(member.displayName || '');
                                      setEmail(member.email || '');
                                      setNewUserRole(member.role || 'user');
                                      setIsActiveStatus(member.active !== false);
                                      setIsAdding(true);
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="p-2.5 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-slate-100 transition-all shadow-sm active:scale-95"
                                  >
                                    <Edit size={18} />
                                  </button>
                                  {(role === 'admin' || role === 'super_admin') && member.uid !== user.uid && (
                                    <button
                                      onClick={async () => {
                                        if (!window.confirm("Confirm deletion protocol? This action is irreversible.")) return;
                                        await deleteDoc(doc(db, 'users', member.id));
                                      }}
                                      className="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-white border border-transparent hover:border-slate-100 transition-all shadow-sm active:scale-95"
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  )}
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
