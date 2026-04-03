import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Mail, Shield, User, Loader2, CheckCircle2, AlertCircle, RefreshCw, ChevronLeft, Key, Lock, Briefcase, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, doc, setDoc, Timestamp, getDoc } from 'firebase/firestore';
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
      <div className="flex-1 bg-orange-50 flex items-center justify-center min-h-[calc(100vh-88px)]">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-orange-50 p-12 rounded-[2.5rem] border border-orange-200 shadow-xl text-center max-w-md">
          <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-rose-500/10">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Access Restricted</h2>
          <p className="text-slate-500 mt-4 leading-relaxed font-medium">Authentication context for your organization is missing or invalid. Contact your system administrator.</p>
        </motion.div>
      </div>
    );
  }

  const inputClasses = "w-full pl-12 pr-5 py-4 bg-orange-50 border border-orange-200 rounded-2xl focus:bg-orange-50 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-400 outline-none transition-all font-semibold text-slate-700 shadow-sm placeholder:text-slate-300";
  const labelClasses = "block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1";

  return (
    <div className="flex-1 bg-[#F9FBFF] text-black p-4 sm:p-8 lg:p-12 min-h-full font-sans overflow-x-hidden">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="text-[10px] font-black text-orange-500 tracking-[0.25em] uppercase mb-4 flex items-center gap-2">
              <Zap size={14} className="fill-orange-500 animate-pulse" /> Personnel Management Protocol
            </div>
            <h3 className="text-4xl sm:text-5xl font-black tracking-tighter text-black">Team Members</h3>

          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="shrink-0">
            {!isDemoMode && (role === 'admin' || role === 'super_admin') && (
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
                className={`w-full md:w-auto px-10 py-4 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 ${isAdding ? 'bg-orange-100 text-slate-600 hover:bg-slate-200 shadow-slate-200/20' : 'bg-black text-white hover:bg-orange-600 shadow-black/20'}`}
              >
                {isAdding ? <ChevronLeft size={18} /> : <UserPlus size={18} />}
                {isAdding ? 'Go Back' : 'Add New Member'}
              </button>
            )}
            {isDemoMode && (
              <div className="px-6 py-3 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <Lock size={16} /> Demo Restricted
              </div>
            )}
          </motion.div>
        </header>

        {success && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 p-5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl flex items-center gap-4 text-sm font-bold shadow-lg shadow-emerald-500/5">
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
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-orange-50 rounded-[2.5rem] border border-orange-100 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.03)] overflow-hidden relative group"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 rounded-bl-[100px] -z-0 pointer-events-none group-hover:bg-orange-100/50 transition-colors"></div>

              <div className="p-8 sm:p-12 relative z-10">
                <div className="flex items-center gap-4 mb-10 pb-4 border-b border-orange-50">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center shadow-inner"><Key size={20} /></div>
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">{editingUserId ? 'Edit Member Account' : 'Provision Member Account'}</h2>
                </div>

                <form onSubmit={handleSaveUser} className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div>
                      <label className={labelClasses}>Full Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors" size={20} />
                        <input type="text" required value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Jane Doe" className={inputClasses} />
                      </div>
                    </div>

                    <div>
                      <label className={labelClasses}>Email</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors" size={20} />
                        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@yourcompany.com" className={inputClasses} disabled={!!editingUserId} />
                      </div>
                    </div>

                    {!editingUserId && (
                      <div>
                        <label className={labelClasses}>Password</label>
                        <div className="relative">
                          <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors" size={20} />
                          <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters" minLength={6} className={inputClasses} />
                        </div>
                      </div>
                    )}

                    {!!editingUserId && (
                      <div>
                        <label className={labelClasses}>Account Status</label>
                        <div className="relative">
                          <select value={isActiveStatus ? 'active' : 'inactive'} onChange={e => setIsActiveStatus(e.target.value === 'active')} className={inputClasses}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-8">
                    <div>
                      <label className={labelClasses}>Permission Tier Selection</label>
                      <div className="space-y-4">
                        {[
                          { id: 'user', label: 'Standard Operator', desc: 'Full access to CRM vectors and intelligence datasets across the logic matrix.', color: 'indigo' },
                          { id: 'admin', label: 'Nexus Administrator', desc: 'Master override for team provisioning, billing configuration, and global logic.', color: 'violet' }
                        ].map(r => (
                          <label key={r.id} className={`group border-2 rounded-2xl p-5 cursor-pointer flex items-start gap-4 transition-all duration-300 shadow-sm hover:shadow-md ${newUserRole === r.id ? `border-${r.color}-500 bg-${r.color}-50 shadow-${r.color}-500/10` : 'border-orange-100 hover:border-orange-200'}`}>
                            <input type="radio" name="role" value={r.id} checked={newUserRole === r.id} onChange={() => setNewUserRole(r.id)} className="hidden" />
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 transition-all ${newUserRole === r.id ? `border-${r.color}-500 bg-${r.color}-500` : 'border-orange-300'}`}>
                              {newUserRole === r.id && <div className="w-2.5 h-2.5 rounded-full bg-orange-50 shadow-sm" />}
                            </div>
                            <div>
                              <div className={`font-black tracking-tight text-base mb-1 ${newUserRole === r.id ? `text-${r.color}-700` : 'text-slate-700'}`}>{r.label}</div>
                              <div className={`text-xs leading-relaxed font-semibold transition-colors ${newUserRole === r.id ? `text-${r.color}-600/70` : 'text-slate-400'}`}>{r.desc}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {error && (
                      <div className="p-4 bg-rose-50 text-rose-600 rounded-xl text-sm font-bold flex items-center gap-3 border border-rose-100 shadow-lg shadow-rose-500/5">
                        <AlertCircle size={20} className="shrink-0" />
                        {error}
                      </div>
                    )}

                    <div className="pt-4 flex items-center gap-4">
                      <button type="submit" disabled={actionLoading} className="flex-1 bg-black text-white py-4 rounded-2xl font-black shadow-xl shadow-black/20 hover:bg-orange-600 hover:-translate-y-1 transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95">
                        {actionLoading ? <Loader2 className="animate-spin" size={20} /> : <UserPlus size={20} />}
                        {actionLoading ? 'Saving...' : editingUserId ? 'Save Changes' : 'Provision Member'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="list-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="bg-orange-50 rounded-[2.5rem] border border-orange-100 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.02)] overflow-hidden">
                <div className="p-8 sm:px-10 border-b border-orange-50 flex items-center justify-between bg-orange-50/20">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Briefcase size={14} /> Organization Member
                  </h3>
                  <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{teamMembers.length} ACTIVE NODES</div>
                </div>

                {loading ? (
                  <div className="p-32 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="animate-spin text-orange-500" size={48} />
                    <span className="text-xs font-black text-slate-300 uppercase tracking-widest">Polling Ledger...</span>
                  </div>
                ) : teamMembers.length === 0 ? (
                  <div className="p-32 text-center flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-center text-slate-300 shadow-inner">
                      <Users size={32} />
                    </div>
                    <p className="text-slate-400 font-bold italic">No active personnel detected in current company partition.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-orange-50/50 border-b border-orange-100">
                        <tr>
                          <th className="text-left p-4 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Member</th>
                          <th className="text-left p-4 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Email</th>
                          <th className="text-left p-4 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Role</th>
                          <th className="text-left p-4 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                          <th className="text-left p-4 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Created</th>
                          <th className="text-left p-4 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-orange-50">
                        {teamMembers.map((member, idx) => (
                          <motion.tr
                            key={member.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="hover:bg-orange-50/30 transition-all"
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center font-black text-lg border ${member.role === 'admin' ? 'from-orange-100 to-purple-100 text-orange-700 border-orange-200/50' : 'from-slate-100 to-slate-200 text-slate-600 border-orange-200/50'}`}>
                                  {member.displayName?.charAt(0) || <User size={16} />}
                                </div>
                                <div>
                                  <div className="font-bold text-black">{member.displayName}</div>
                                  {member.uid === user.uid && (
                                    <span className="text-[9px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded shadow-sm uppercase tracking-tighter">Current Entity</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-sm font-semibold text-slate-600">{member.email}</td>
                            <td className="p-4">
                              {member.role === 'admin' && (
                                <span className="text-[9px] font-black bg-orange-500 text-white px-2 py-1 rounded shadow-sm uppercase tracking-tighter">Nexus Admin</span>
                              )}
                              {member.role === 'user' && (
                                <span className="text-[9px] font-black bg-slate-500 text-white px-2 py-1 rounded shadow-sm uppercase tracking-tighter">Standard Operator</span>
                              )}
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter border ${member.active !== false ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                {member.active !== false ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="p-4 text-xs font-bold text-slate-500">
                              {member.createdAt?.toDate ? member.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Alpha Partition'}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                {(role === 'admin' || role === 'super_admin') && member.uid !== user.uid && (
                                  <button
                                    onClick={async () => {
                                      const newStatus = member.active !== false ? false : true;
                                      await setDoc(doc(db, 'users', member.id), { active: newStatus }, { merge: true });
                                    }}
                                    className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter border transition-all ${member.active !== false ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100'}`}
                                  >
                                    {member.active !== false ? 'Deactivate' : 'Activate'}
                                  </button>
                                )}
                                {(role === 'admin' || role === 'super_admin' || member.uid === user.uid) && (
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
                                    className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter border transition-all bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100"
                                  >
                                    Edit
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
