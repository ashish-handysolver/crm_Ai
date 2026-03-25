import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Mail, Shield, User, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db, firebaseConfig } from './firebase';

export default function Team({ user, companyId }: { user: any, companyId: string | null }) {
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('user');
  
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!companyId) return;

    const q = query(collection(db, 'users'), where('companyId', '==', companyId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTeamMembers(users);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    
    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      // 1. Create the user using Firebase REST API (Identity Toolkit)
      // This prevents the current Admin from being logged out!
      const apiKey = firebaseConfig.apiKey || (import.meta as any).env.VITE_FIREBASE_API_KEY;
      if (!apiKey) throw new Error("API Key missing. Cannot provision account.");

      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to create user account.");
      }

      const newUid = data.localId;

      // 2. Set the user's Display Name via REST API (Optional but good UX)
      try {
        await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken: data.idToken,
            displayName: displayName,
            returnSecureToken: false
          })
        });
      } catch (err) {
        console.warn("Failed to set display name on auth profile", err);
      }

      // 3. Create the Firestore User Document linking them to the company
      await setDoc(doc(db, 'users', newUid), {
        uid: newUid,
        email: email,
        displayName: displayName,
        companyId: companyId,
        role: role,
        createdAt: Timestamp.now()
      });

      setSuccess(`User ${displayName} has been added successfully!`);
      setIsAdding(false);
      setEmail('');
      setPassword('');
      setDisplayName('');
      setRole('user');
      
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      console.error("Error adding user:", err);
      if (err.message === 'EMAIL_EXISTS') {
        setError("This email address is already in use by another account.");
      } else {
        setError(err.message || "An unexpected error occurred.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (!companyId) {
    return (
      <div className="flex-1 p-8 min-h-[calc(100vh-88px)] flex items-center justify-center">
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-700">Company Context Missing</h2>
          <p className="text-slate-500 mt-2">You need to be associated with an organization to manage team members.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 text-slate-900 p-8 min-h-[calc(100vh-88px)] bg-transparent">
      <div className="max-w-[1000px] mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <div className="text-xs font-extrabold text-blue-500 tracking-widest uppercase mb-1.5 flex items-center gap-2">
              <Shield size={14} /> 
              Organization Management
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">Team Members</h1>
          </div>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="bg-slate-900 text-white hover:bg-slate-800 shadow-lg px-6 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 shadow-slate-900/20 hover:-translate-y-0.5"
          >
            {isAdding ? <Users size={18} /> : <UserPlus size={18} />}
            {isAdding ? 'View Roster' : 'Add New Member'}
          </button>
        </header>

        {success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl flex items-center gap-3 font-medium shadow-sm">
            <CheckCircle2 size={20} className="text-emerald-500" />
            {success}
          </div>
        )}

        <AnimatePresence mode="wait">
          {isAdding ? (
            <motion.div 
              key="add-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden p-8"
            >
              <h2 className="text-2xl font-bold mb-6">Create Employee Account</h2>
              <form onSubmit={handleAddUser} className="max-w-md space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Full Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400"><User size={18} /></div>
                    <input type="text" required value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Jane Doe" className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:border-blue-500 outline-none transition-all font-medium" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400"><Mail size={18} /></div>
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@yourcompany.com" className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:border-blue-500 outline-none transition-all font-medium" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Initial Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400"><Shield size={18} /></div>
                    <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" minLength={6} className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:border-blue-500 outline-none transition-all font-medium" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Role Configuration</label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className={`border-2 rounded-2xl p-4 cursor-pointer transition-all ${role === 'user' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-slate-300'}`}>
                      <input type="radio" name="role" value="user" checked={role === 'user'} onChange={() => setRole('user')} className="hidden" />
                      <div className="font-bold mb-1">Standard User</div>
                      <div className="text-xs opacity-75 leading-tight">Can manage leads and data for the entire organization.</div>
                    </label>
                    <label className={`border-2 rounded-2xl p-4 cursor-pointer transition-all ${role === 'admin' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:border-slate-300'}`}>
                      <input type="radio" name="role" value="admin" checked={role === 'admin'} onChange={() => setRole('admin')} className="hidden" />
                      <div className="font-bold mb-1">Company Admin</div>
                      <div className="text-xs opacity-75 leading-tight">Can add users and edit company billing/settings.</div>
                    </label>
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold flex items-center gap-2 border border-red-100">
                    <AlertCircle size={16} className="shrink-0" />
                    {error}
                  </div>
                )}

                <div className="pt-4 flex items-center gap-3">
                  <button type="submit" disabled={actionLoading} className="flex-1 bg-blue-600 text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />}
                    {actionLoading ? 'Provisioning...' : 'Add Team Member'}
                  </button>
                  <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div 
              key="list-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 md:px-8 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-extrabold text-slate-800">Organization Roster</h3>
                </div>
                {loading ? (
                  <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-slate-300" size={32} /></div>
                ) : teamMembers.length === 0 ? (
                  <div className="p-20 text-center text-slate-500 font-medium italic">No team members found in this company.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {teamMembers.map(member => (
                      <div key={member.id} className="p-6 md:px-8 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center font-bold text-indigo-700 text-lg border border-indigo-200/50">
                            {member.displayName?.charAt(0) || <User size={20} />}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 flex items-center gap-2">
                              {member.displayName}
                              {member.role === 'admin' && <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md uppercase tracking-widest">Admin</span>}
                              {member.uid === user.uid && <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md uppercase tracking-widest">You</span>}
                            </div>
                            <div className="text-sm font-medium text-slate-500">{member.email}</div>
                          </div>
                        </div>
                        <div className="hidden md:block text-xs font-bold text-slate-300 uppercase tracking-widest">
                          Joined {member.createdAt?.toDate ? member.createdAt.toDate().toLocaleDateString() : 'Unknown'}
                        </div>
                      </div>
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
