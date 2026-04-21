import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Mail, Shield, User, Loader2, CheckCircle2, AlertCircle, RefreshCw, ChevronLeft, Key, Lock, Briefcase, Zap, Edit, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, doc, setDoc, Timestamp, getDoc, deleteDoc } from 'firebase/firestore';
import SearchableSelect from './components/SearchableSelect';
import { db, firebaseConfig } from './firebase';
import { useDemo } from './DemoContext';
import { useAuth } from './contexts/AuthContext';

export default function Team({ user, companyId, embedded = false }: { user: any, companyId: string | null, embedded?: boolean }) {
  const { isDemoMode, demoData } = useDemo();
  const { role } = useAuth();
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(!isDemoMode);
  const [isAdding, setIsAdding] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [newUserRole, setNewUserRole] = useState('team_member');
  const [isActiveStatus, setIsActiveStatus] = useState(true);

  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const activeMembers = teamMembers.filter(member => member.active !== false).length;
  const adminMembers = teamMembers.filter(member => member.role === 'admin').length;
  const managerMembers = teamMembers.filter(member => member.role === 'management').length;
  const inputClasses = "w-full rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-control-bg)] py-4 pl-16 pr-6 text-sm font-bold text-[var(--crm-text)] placeholder:text-[var(--crm-text-muted)] focus:bg-[var(--crm-card-bg)] focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all shadow-inner";
  const sectionLabelClasses = "text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest px-1";

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
      setNewUserRole('team_member');
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
      <div className="flex-1 bg-transparent flex items-center justify-center min-h-[calc(100vh-88px)]">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900 p-12 rounded-[2.5rem] border border-white/10 shadow-2xl text-center max-w-md">
          <div className="w-20 h-20 bg-rose-500/20 text-rose-400 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-rose-500/10 border border-rose-500/30">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl font-black text-[var(--crm-text)] tracking-tight">Access Restricted</h2>
          <p className="text-slate-400 mt-4 leading-relaxed font-medium">Authentication context for your organization is missing or invalid. Contact your system administrator.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`flex-1 bg-transparent overflow-y-auto ${embedded ? 'min-h-0' : 'min-h-screen'}`}>
      <div className={`${embedded ? 'space-y-8' : 'max-w-7xl mx-auto p-4 sm:p-8 lg:p-12 space-y-10'}`}>

        {/* Header Section */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 sm:gap-10">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">
              <Users size={14} className="animate-pulse" /> Team Settings
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-[var(--crm-text)] leading-none">Team Members</h1>
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
                    setNewUserRole('team_member');
                    setIsActiveStatus(true);
                  }
                }}
                className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 ${isAdding ? 'bg-white/5 text-white border border-white/10 hover:bg-white/10 shadow-black/20' : 'bg-indigo-600 text-white shadow-indigo-500/20 hover:bg-indigo-500'}`}
              >
                {isAdding ? <ChevronLeft size={18} /> : <UserPlus size={18} />}
                {isAdding ? 'Back' : 'Add Member'}
              </button>
            )}
            {isDemoMode && (
              <div className="px-6 py-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <Lock size={16} /> Read-only Proxy
              </div>
            )}
          </motion.div>
        </header>

        {success && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center gap-4 text-sm font-bold shadow-xl shadow-emerald-500/5">
            <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-lg">
              <CheckCircle2 size={20} />
            </div>
            {success}
          </motion.div>
        )}

        {!isAdding && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card !rounded-[1.8rem] border border-[var(--crm-border)] p-5">
              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--crm-text-muted)]">Total Members</div>
              <div className="mt-3 text-3xl font-black text-[var(--crm-text)]">{teamMembers.length}</div>
            </div>
            <div className="glass-card !rounded-[1.8rem] border border-[var(--crm-border)] p-5">
              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--crm-text-muted)]">Active Users</div>
              <div className="mt-3 text-3xl font-black text-emerald-500">{activeMembers}</div>
            </div>
            <div className="glass-card !rounded-[1.8rem] border border-[var(--crm-border)] p-5">
              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--crm-text-muted)]">Admins / Managers</div>
              <div className="mt-3 text-3xl font-black text-indigo-500">{adminMembers + managerMembers}</div>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {isAdding ? (
            <motion.div
              key="add-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass-card !bg-[var(--crm-card-bg)] !border-[var(--crm-border)] !rounded-[2.5rem] overflow-hidden relative"
            >
              <div className="p-6 sm:p-12 space-y-10">
                <div className="flex items-center gap-4 pb-6 border-b border-[var(--crm-border)]">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-inner border border-indigo-500/30"><Key size={22} /></div>
                  <h2 className="text-2xl font-black text-[var(--crm-text)] tracking-tight">{editingUserId ? 'Edit Member' : 'Add New User'}</h2>
                </div>

                <form onSubmit={handleSaveUser} className="space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12">
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <label className={sectionLabelClasses}>Personal Info</label>
                        <div className="relative group/input">
                          <User className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--crm-text-muted)] group-focus-within/input:text-indigo-400 transition-colors" size={18} />
                          <input
                            type="text"
                            value={displayName}
                            onChange={e => setDisplayName(e.target.value)}
                            placeholder="Full Name"
                            className={inputClasses}
                            required
                          />
                        </div>

                        {!editingUserId && (
                          <>
                            <div className="relative group/input">
                              <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--crm-text-muted)] group-focus-within/input:text-indigo-400 transition-colors" size={18} />
                              <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="Email Address"
                                className={inputClasses}
                                required
                              />
                            </div>
                            <div className="relative group/input">
                              <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--crm-text-muted)] group-focus-within/input:text-indigo-400 transition-colors" size={18} />
                              <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Password"
                                className={inputClasses}
                                required
                                minLength={6}
                              />
                            </div>
                          </>
                        )}

                        {!!editingUserId && (
                          <div className="relative group/input">
                            <Shield className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--crm-text-muted)] group-focus-within/input:text-indigo-400 transition-colors" size={18} />
                            <SearchableSelect
                              options={[
                                { id: 'active', name: 'Active' },
                                { id: 'inactive', name: 'Inactive' }
                              ]}
                              value={isActiveStatus ? 'active' : 'inactive'}
                              onChange={val => setIsActiveStatus(val === 'active')}
                              hideSearch={true}
                              compact={true}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <label className={sectionLabelClasses}>Permissions</label>
                      {[
                        { id: 'team_member', label: 'Team Member', desc: 'Standard CRM data access' },
                        { id: 'management', label: 'Management', desc: 'Can see all leads & manage team' },
                        { id: 'admin', label: 'Admin', desc: 'System-wide override control' }
                      ].map(r => (
                        <label key={r.id} className={`block p-5 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden group ${newUserRole === r.id ? 'bg-indigo-500/10 border-indigo-500 shadow-lg shadow-indigo-500/10' : 'bg-[var(--crm-control-bg)] border-[var(--crm-border)] hover:border-indigo-500/20'}`}>
                          <input type="radio" className="sr-only" name="role" value={r.id} checked={newUserRole === r.id} onChange={e => setNewUserRole(e.target.value)} />
                          <div className="flex items-start gap-4 relative z-10">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 transition-all ${newUserRole === r.id ? `border-indigo-500 bg-indigo-500` : 'border-[var(--crm-text-muted)]'}`}>
                              {newUserRole === r.id && <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />}
                            </div>
                            <div>
                              <div className={`font-black tracking-tight text-base mb-1 ${newUserRole === r.id ? `text-[var(--crm-text)]` : 'text-[var(--crm-text)]'}`}>{r.label}</div>
                              <div className={`text-xs font-medium ${newUserRole === r.id ? `text-indigo-400` : 'text-[var(--crm-text-muted)]'}`}>{r.desc}</div>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="p-5 bg-rose-500/10 text-rose-400 rounded-2xl text-sm font-bold flex items-center gap-4 border border-rose-500/20 shadow-xl shadow-rose-500/5">
                      <AlertCircle size={20} className="shrink-0 mt-0.5" />
                      {error}
                    </div>
                  )}

                  <div className="pt-6 border-t border-[var(--crm-border)]">
                    <button type="submit" disabled={actionLoading} className="w-full sm:w-auto px-12 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95">
                      {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                      <span>{actionLoading ? 'Synchronizing...' : editingUserId ? 'Save Changes' : 'Add Member'}</span>
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
              <div className="glass-card !bg-transparent !p-0 !rounded-[2.5rem] overflow-hidden border border-[var(--crm-border)] shadow-2xl">
                <div className="p-6 sm:px-10 border-b border-[var(--crm-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--crm-control-bg)]">
                  <h3 className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-[0.25em] flex items-center gap-3">
                    <Briefcase size={16} /> Team Members
                  </h3>
                  <div className="text-[10px] w-fit font-black text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/30 uppercase tracking-widest shadow-sm">{teamMembers.length} Members</div>
                </div>

                {loading ? (
                  <div className="w-full p-6 sm:p-8 grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="p-6 animate-pulse rounded-[1.8rem] border border-[var(--crm-border)] bg-[var(--crm-control-bg)]">
                        <div className="flex items-center gap-4 mb-5">
                          <div className="w-12 h-12 rounded-xl bg-[var(--crm-border)] shrink-0"></div>
                          <div className="space-y-2">
                            <div className="w-32 h-4 bg-[var(--crm-border)] rounded"></div>
                            <div className="w-48 h-3 bg-[var(--crm-border)] rounded"></div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="h-10 bg-[var(--crm-border)] rounded-xl"></div>
                          <div className="h-10 bg-[var(--crm-border)] rounded-xl"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : teamMembers.length === 0 ? (
                  <div className="p-24 sm:p-32 text-center flex flex-col items-center gap-6 bg-[var(--crm-control-bg)]">
                    <div className="w-20 h-20 bg-[var(--crm-card-bg)] border border-[var(--crm-border)] rounded-3xl flex items-center justify-center text-[var(--crm-text-muted)] shadow-inner">
                      <Users size={40} />
                    </div>
                    <p className="text-[var(--crm-text-muted)] font-black italic max-w-xs uppercase text-[10px] tracking-widest">No team members found for this workspace yet.</p>
                  </div>
                ) : (
                  <div className="p-6 sm:p-8 grid grid-cols-1 xl:grid-cols-2 gap-5 bg-transparent">
                    {teamMembers.map((member, idx) => (
                      <motion.div
                        key={member.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="rounded-[1.9rem] border border-[var(--crm-border)] bg-[var(--crm-control-bg)] p-5 sm:p-6 transition-all hover:border-indigo-500/25 hover:bg-[var(--crm-control-hover-bg)]"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className={`relative shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg border shadow-sm ${member.role === 'admin' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30' : member.role === 'management' ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' : 'bg-[var(--crm-card-bg)] text-[var(--crm-text)] border-[var(--crm-border)]'}`}>
                              {member.displayName?.charAt(0) || <User size={20} />}
                              {member.active !== false && <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-4 border-[var(--crm-surface-strong)] shadow-sm" />}
                            </div>
                            <div className="min-w-0">
                              <div className="font-extrabold text-[var(--crm-text)] truncate">{member.displayName}</div>
                              <div className="text-xs font-semibold text-[var(--crm-text-muted)] truncate">{member.email}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingUserId(member.id);
                                setDisplayName(member.displayName || '');
                                setEmail(member.email || '');
                                setNewUserRole(member.role || 'team_member');
                                setIsActiveStatus(member.active !== false);
                                setIsAdding(true);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="p-2.5 rounded-xl text-[var(--crm-text-muted)] hover:text-indigo-500 hover:bg-indigo-500/10 border border-[var(--crm-border)] transition-all shadow-sm active:scale-95"
                            >
                              <Edit size={16} />
                            </button>
                            {(role === 'admin' || role === 'super_admin') && member.uid !== user.uid && (
                              <button
                                onClick={async () => {
                                  if (!window.confirm("Confirm deletion protocol? This action is irreversible.")) return;
                                  await deleteDoc(doc(db, 'users', member.id));
                                }}
                                className="p-2.5 rounded-xl text-[var(--crm-text-muted)] hover:text-rose-500 hover:bg-rose-500/10 border border-[var(--crm-border)] transition-all shadow-sm active:scale-95"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2.5">
                          {member.role === 'admin' ? (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 text-indigo-500 border border-indigo-500/30 text-[9px] font-black uppercase tracking-widest rounded-xl shadow-sm">
                              <Shield size={10} /> Admin
                            </div>
                          ) : member.role === 'management' ? (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/30 text-[9px] font-black uppercase tracking-widest rounded-xl shadow-sm">
                              <Briefcase size={10} /> Management
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--crm-card-bg)] border border-[var(--crm-border)] text-[var(--crm-text)] text-[9px] font-black uppercase tracking-widest rounded-xl shadow-sm">
                              Team Member
                            </div>
                          )}

                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${member.active !== false ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                            {member.active !== false ? 'Active' : 'Inactive'}
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-4 text-[10px] font-bold text-[var(--crm-text-muted)]">
                          <span>Created</span>
                          <span>{member.createdAt?.toDate ? member.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Legacy'}</span>
                        </div>
                      </motion.div>
                    ))}
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
