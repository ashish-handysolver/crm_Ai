import React from 'react';
import { collection, query, onSnapshot, getDocs, doc, where, orderBy, limit, deleteDoc, writeBatch, setDoc, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, firebaseConfig } from './firebase';
import { 
  Loader2, Users, Building2, BarChart3, Search, Filter, 
  ArrowUpRight, ShieldCheck, Globe, Activity, Mail, Calendar,
  MoreVertical, Trash2, ExternalLink, ArrowLeft, MessageSquare, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function SuperAdmin() {
  const [companies, setCompanies] = React.useState<any[]>([]);
  const [allUsers, setAllUsers] = React.useState<any[]>([]);
  const [allLeads, setAllLeads] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [fetchingData, setFetchingData] = React.useState({ companies: true, users: true, leads: true });
  const [searchTerm, setSearchTerm] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'companies' | 'users' | 'leads'>('companies');
  const [selectedOrg, setSelectedOrg] = React.useState<any | null>(null);
  const [orgData, setOrgData] = React.useState<{ leads: any[], users: any[], recentActivities: any[] }>({ leads: [], users: [], recentActivities: [] });
  const [loadingOrg, setLoadingOrg] = React.useState(false);
  const [selectedLead, setSelectedLead] = React.useState<any | null>(null);
  const [isAddingUser, setIsAddingUser] = React.useState(false);
  const [newUserEmail, setNewUserEmail] = React.useState('');
  const [newUserPassword, setNewUserPassword] = React.useState('');
  const [newUserDisplayName, setNewUserDisplayName] = React.useState('');
  const [newUserRole, setNewUserRole] = React.useState('user');
  const [actionLoading, setActionLoading] = React.useState(false);
  
  const navigate = useNavigate();

  React.useEffect(() => {
    // Basic session check for standalone console
    const isSuper = sessionStorage.getItem('is_super_admin');
    if (!isSuper) {
      navigate('/super-login');
      return;
    }

    const unsubscribeAuthStatus = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && isSuper) {
        // Listen to all companies
        const unsubCompanies = onSnapshot(collection(db, 'companies'), (snapshot) => {
          setCompanies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          setFetchingData(prev => ({ ...prev, companies: false }));
        }, (error) => {
          console.error("Companies Listener Error:", error);
          setFetchingData(prev => ({ ...prev, companies: false }));
        });

        // Listen to all users
        const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
          setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          setFetchingData(prev => ({ ...prev, users: false }));
        }, (error) => {
          console.error("Users Listener Error:", error);
          setFetchingData(prev => ({ ...prev, users: false }));
        });

        // Listen to all leads
        const unsubLeads = onSnapshot(collection(db, 'leads'), (snapshot) => {
          setAllLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          setFetchingData(prev => ({ ...prev, leads: false }));
        }, (error) => {
          console.error("Leads Listener Error:", error);
          setFetchingData(prev => ({ ...prev, leads: false }));
        });

        setLoading(false);

        // Cleanup sub-listeners when auth changes or component unmounts
        return () => {
          unsubCompanies();
          unsubUsers();
          unsubLeads();
        };
      } else if (!loading) {
         setLoading(false);
      }
    });

    return () => {
      unsubscribeAuthStatus();
    };
  }, []);

  const fetchOrgDetails = async (org: any) => {
    setLoadingOrg(true);
    setSelectedOrg(org);
    try {
      // Fetch leads for this org
      const leadsSnap = await getDocs(query(collection(db, 'leads'), where('companyId', '==', org.id)));
      const leads = leadsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filter global users for this org
      const orgUsers = allUsers.filter(u => u.companyId === org.id);

      // Fetch recent recordings for this org without orderBy/limit to bypass missing index
      const recsSnap = await getDocs(query(
        collection(db, 'recordings'), 
        where('companyId', '==', org.id)
      ));
      let recs = recsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort in memory to avoid "missing index" error
      recs.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : 0;
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : 0;
        return dateB - dateA;
      });
      
      // Limit to 10 most recent
      recs = recs.slice(0, 10);

      setOrgData({ leads, users: orgUsers, recentActivities: recs });
    } catch (err) {
      console.error("Error fetching org details:", err);
    } finally {
      setLoadingOrg(false);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this lead and all its associated data? This cannot be undone.")) return;
    
    try {
      // 1. Delete associated recordings first
      const recordingsSnap = await getDocs(query(collection(db, 'recordings'), where('leadId', '==', leadId)));
      const batch = writeBatch(db);
      recordingsSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();

      // 2. Delete the lead itself
      await deleteDoc(doc(db, 'leads', leadId));
      
      setSelectedLead(null);
      // Data will auto-update via onSnapshot
    } catch (err: any) {
      console.error("Error deleting lead:", err);
      alert("Failed to delete lead. Check console for details.");
    }
  };

  const handleAddUserToOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;
    
    setActionLoading(true);
    try {
      const apiKey = firebaseConfig.apiKey || (import.meta as any).env.VITE_FIREBASE_API_KEY;
      if (!apiKey) throw new Error("Security Vector: API Key missing from environment.");

      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newUserEmail, password: newUserPassword, returnSecureToken: true })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Protocol Error: Account initialization aborted.");

      const newUid = data.localId;

      await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: data.idToken, displayName: newUserDisplayName, returnSecureToken: false })
      });

      await setDoc(doc(db, 'users', newUid), {
        uid: newUid,
        email: newUserEmail,
        displayName: newUserDisplayName,
        companyId: selectedOrg.id,
        role: newUserRole,
        createdAt: Timestamp.now()
      });

      setIsAddingUser(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserDisplayName('');
      fetchOrgDetails(selectedOrg);
      alert("User successfully provisioned and added to " + selectedOrg.name);
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredCompanies = companies.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = allUsers.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.companyId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLeads = allLeads.filter(l => 
    l.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.companyId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex-1 bg-orange-50 flex items-center justify-center min-h-[100dvh]">
        <Loader2 className="animate-spin text-orange-500 w-12 h-12" />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-orange-50 text-black p-4 sm:p-6 lg:p-10 min-h-[100dvh] font-sans">
      <div className="max-w-[1400px] mx-auto">
        
        <AnimatePresence mode="wait">
          {!selectedOrg ? (
            <motion.div 
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100/50 text-orange-600 text-[10px] font-bold uppercase tracking-widest mb-3 border border-orange-200/50">
                    <ShieldCheck size={14} /> System Authority
                  </div>
                  <h1 className="text-3xl md:text-5xl font-black tracking-tight text-black mb-2">Super Admin Console</h1>
                  <p className="text-slate-500 font-medium">Global oversight of all registered entities and users across the platform.</p>
                </div>
                <button 
                  onClick={() => { sessionStorage.removeItem('is_super_admin'); navigate('/super-login'); }}
                  className="px-6 py-3 bg-orange-50 border border-orange-200 rounded-2xl text-sm font-bold text-slate-600 hover:text-rose-600 hover:border-rose-100 transition-all shadow-sm"
                >
                  Terminate Session
                </button>
              </header>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                {[
                  { label: 'Total Organizations', value: companies.length, icon: Building2, color: 'text-blue-500', bg: 'bg-blue-50' },
                  { label: 'Registered Users', value: allUsers.length, icon: Users, color: 'text-orange-500', bg: 'bg-orange-50' },
                  { label: 'Active Sessions', value: 'Live', icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                  { label: 'Global Reach', value: 'BOM1', icon: Globe, color: 'text-pink-500', bg: 'bg-pink-50' },
                ].map((stat, idx) => (
                  <motion.div key={idx} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }} className="bg-orange-50 p-6 rounded-3xl border border-orange-100 shadow-sm flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center shadow-inner`}>
                      <stat.icon size={24} />
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</div>
                      <div className="text-2xl font-black text-black">{stat.value}</div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Search & Tabs */}
              <div className="bg-orange-50 rounded-[2.5rem] border border-orange-100 shadow-sm overflow-hidden flex flex-col">
                <div className="p-6 border-b border-orange-50 flex flex-col md:flex-row justify-between items-center gap-6">
                  <div className="flex p-1 bg-orange-100 rounded-2xl w-full md:w-auto">
                    <button onClick={() => setActiveTab('companies')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'companies' ? 'bg-orange-50 text-black shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Organizations</button>
                    <button onClick={() => setActiveTab('users')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-orange-50 text-black shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Users</button>
                    <button onClick={() => setActiveTab('leads')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'leads' ? 'bg-orange-50 text-black shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Leads</button>
                  </div>
                  
                  <div className="relative w-full md:w-96 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" size={18} />
                    <input 
                      type="text" 
                      placeholder={`Search ${activeTab}...`} 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-orange-50 border border-orange-200 rounded-2xl focus:bg-orange-50 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 font-semibold outline-none transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto min-h-[400px]">
                  {(activeTab === 'companies' && fetchingData.companies) || 
                   (activeTab === 'users' && fetchingData.users) || 
                   (activeTab === 'leads' && fetchingData.leads) ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <Loader2 className="animate-spin text-orange-500" size={32} />
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading data...</span>
                    </div>
                  ) : activeTab === 'companies' ? (
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-orange-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-orange-50/50">
                          <th className="py-5 px-8">Company</th>
                          <th className="py-5 px-6">ID</th>
                          <th className="py-5 px-6">Created</th>
                          <th className="py-5 px-6">Admin UID</th>
                          <th className="py-5 px-8 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredCompanies.map(c => (
                          <tr key={c.id} className="hover:bg-orange-50/50 transition-all group cursor-pointer" onClick={() => fetchOrgDetails(c)}>
                            <td className="py-5 px-8">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center font-black shadow-sm group-hover:scale-110 transition-transform">{c.name?.charAt(0)}</div>
                                <div className="font-extrabold text-black text-base">{c.name}</div>
                              </div>
                            </td>
                            <td className="py-5 px-6"><code className="text-xs bg-orange-100 px-2 py-1 rounded-lg text-slate-600 font-bold">{c.id}</code></td>
                            <td className="py-5 px-6 text-sm font-medium text-slate-500 flex items-center gap-2"><Calendar size={14} /> {c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString() : 'Unknown'}</td>
                            <td className="py-5 px-6"><code className="text-[10px] text-slate-400">{c.createdBy}</code></td>
                            <td className="py-5 px-8 text-right">
                              <button className="p-2 text-slate-400 hover:text-orange-600 bg-orange-50 hover:bg-orange-50 border border-transparent hover:border-orange-100 rounded-xl transition-all shadow-sm"><ArrowUpRight size={18} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : activeTab === 'leads' ? (
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-orange-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-orange-50/50">
                          <th className="py-5 px-8">Lead Name</th>
                          <th className="py-5 px-6">Company</th>
                          <th className="py-5 px-6">Source</th>
                          <th className="py-5 px-6">Status</th>
                          <th className="py-5 px-6">Created On</th>
                          <th className="py-5 px-8 text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredLeads.map(l => {
                          const company = companies.find(c => c.id === l.companyId);
                          return (
                            <tr key={l.id} className="hover:bg-orange-50/50 transition-all group">
                              <td className="py-5 px-8">
                                <div className="font-extrabold text-black">{l.name}</div>
                                <div className="text-xs text-slate-500 font-medium">{l.email || l.phone}</div>
                              </td>
                              <td className="py-5 px-6 text-sm font-bold text-slate-600">{company?.name || l.companyId}</td>
                              <td className="py-5 px-6"><span className="text-[10px] bg-orange-100 px-2 py-1 rounded-lg text-slate-500 font-bold">{l.source || 'Direct'}</span></td>
                              <td className="py-5 px-6">
                                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${l.status === 'New' ? 'bg-blue-50 text-orange-600 border-blue-100' : 'bg-orange-50 text-slate-500 border-orange-100'}`}>{l.status || 'Unknown'}</span>
                              </td>
                              <td className="py-5 px-6 text-xs font-semibold text-slate-400">{l.createdAt?.toDate ? l.createdAt.toDate().toLocaleDateString() : 'N/A'}</td>
                              <td className="py-5 px-8 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setSelectedLead(l); }}
                                    className="p-2 text-slate-400 hover:text-orange-600 bg-orange-50 hover:bg-orange-50 rounded-xl transition-all"
                                  >
                                    <ExternalLink size={18} />
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteLead(l.id); }}
                                    className="p-2 text-slate-300 hover:text-rose-600 bg-orange-50 hover:bg-orange-50 rounded-xl transition-all"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-orange-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-orange-50/50">
                          <th className="py-5 px-8">User Profile</th>
                          <th className="py-5 px-6">Organization ID</th>
                          <th className="py-5 px-6">Role</th>
                          <th className="py-5 px-6">Last Login</th>
                          <th className="py-5 px-8 text-right">Operations</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredUsers.map(u => (
                          <tr key={u.id} className="hover:bg-orange-50/50 transition-all group">
                            <td className="py-5 px-8">
                              <div className="flex items-center gap-4">
                                <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}&background=random`} className="w-10 h-10 rounded-full object-cover border-2 border-orange-50 shadow-sm" alt="" />
                                <div>
                                  <div className="font-extrabold text-black">{u.displayName}</div>
                                  <div className="text-xs text-slate-500 font-medium">{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-5 px-6 text-sm font-bold text-slate-600">{u.companyId || 'N/A'}</td>
                            <td className="py-5 px-6">
                              <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${u.role === 'super_admin' ? 'bg-pink-50 text-pink-600 border-pink-100' : u.role === 'admin' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-orange-50 text-slate-500 border-orange-100'}`}>{u.role || 'user'}</span>
                            </td>
                            <td className="py-5 px-6 text-xs font-semibold text-slate-400">Not recorded</td>
                            <td className="py-5 px-8 text-right">
                              <div className="flex items-center justify-end gap-3">
                                <button 
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const newStatus = u.active !== false ? false : true;
                                    await setDoc(doc(db, 'users', u.id), { active: newStatus }, { merge: true });
                                  }}
                                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${u.active !== false ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100'}`}
                                >
                                  {u.active !== false ? 'Active' : 'Inactive'}
                                </button>
                                <button className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <button onClick={() => setSelectedOrg(null)} className="flex items-center gap-2 text-slate-500 hover:text-black font-bold mb-8 transition-colors group">
                <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Back to Admin Dashboard
              </button>

              <div className="flex flex-col lg:flex-row gap-10 items-start">
                {/* Left Column: Stats & Meta */}
                <div className="w-full lg:w-80 shrink-0 space-y-6">
                  <div className="bg-orange-50 p-8 rounded-[2.5rem] border border-orange-100 shadow-sm text-center">
                    <div className="w-20 h-20 bg-orange-100 rounded-[2rem] flex items-center justify-center shadow-inner">
                      <Building2 className="text-slate-400" size={32} />
                    </div>
                    <h2 className="text-4xl font-black text-black tracking-tight">{selectedOrg.name}</h2>
                    <p className="text-slate-500 font-bold text-sm">Company Details & History</p>
                    <div className="mt-8 pt-8 border-t border-orange-50 space-y-4">
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-400 font-bold uppercase tracking-tight text-[10px]">Total Leads</span>
                          <span className="text-black font-black">{orgData.leads.length}</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-400 font-bold uppercase tracking-tight text-[10px]">Active Users</span>
                          <span className="text-black font-black">{orgData.users.length}</span>
                       </div>
                    </div>
                  </div>

                  <div className="bg-orange-50/50 p-6 rounded-3xl border border-orange-100 text-sm">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Metadata</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-slate-600 font-medium">
                        <Calendar size={14} className="text-slate-400" />
                        Created: {selectedOrg.createdAt?.toDate?.().toLocaleDateString() || 'N/A'}
                      </div>
                      <div className="flex items-center gap-3 text-slate-600 font-medium overflow-hidden">
                        <ShieldCheck size={14} className="text-slate-400 shrink-0" />
                        <span className="truncate">Root: {selectedOrg.createdBy}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Detailed Lists */}
                <div className="flex-1 w-full space-y-10">
                  {loadingOrg ? (
                    <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-4">
                       <Loader2 className="animate-spin text-orange-500" size={40} />
                       <span className="font-bold text-sm tracking-widest uppercase">Fetching Node Data...</span>
                    </div>
                  ) : (
                    <>
                      {/* Leads Section */}
                      <section>
                         <h3 className="text-xl font-black text-black mb-6 flex items-center gap-3"><Users className="text-orange-400" /> Organizational Leads</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {orgData.leads.length > 0 ? orgData.leads.map(lead => (
                              <div key={lead.id} className="bg-orange-50 p-5 rounded-3xl border border-orange-100 shadow-sm flex items-center justify-between group hover:border-orange-100 transition-all">
                                 <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold ${lead.status === 'New' ? 'bg-blue-400' : 'bg-slate-400'}`}>
                                       {lead.name.charAt(0)}
                                    </div>
                                    <div className="cursor-pointer" onClick={() => setSelectedLead(lead)}>
                                       <h4 className="font-extrabold text-black group-hover:text-orange-600 transition-colors">{lead.name}</h4>
                                       <p className="text-xs text-slate-400 font-bold">{lead.email || lead.phone || 'No Contact Data'}</p>
                                    </div>
                                 </div>
                                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${lead.status === 'New' ? 'bg-blue-50 text-orange-600' : 'bg-orange-50 text-slate-400'}`}>
                                   {lead.status}
                                </span>
                              </div>
                            )) : (
                              <div className="col-span-full py-10 text-center text-slate-400 font-bold border-2 border-dashed border-orange-200 rounded-3xl uppercase tracking-widest text-xs">No Leads Recorded</div>
                            )}
                         </div>
                      </section>

                      {/* User Accounts Section */}
                      <section>
                         <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black text-black flex items-center gap-3"><ShieldCheck className="text-rose-400" /> Account Access</h3>
                            <button 
                              onClick={() => setIsAddingUser(!isAddingUser)}
                              className="px-4 py-2 bg-black text-white rounded-xl text-xs font-bold hover:bg-orange-600 transition-all shadow-sm"
                            >
                              {isAddingUser ? 'Cancel' : '+ Add User'}
                            </button>
                         </div>

                         <AnimatePresence>
                            {isAddingUser && (
                               <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-6 bg-orange-100 rounded-2xl p-6 border border-orange-200 overflow-hidden">
                                  <form onSubmit={handleAddUserToOrg} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <input type="text" placeholder="Full Name" required value={newUserDisplayName} onChange={e => setNewUserDisplayName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-orange-200 text-sm font-bold" />
                                     <input type="email" placeholder="Email Address" required value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-orange-200 text-sm font-bold" />
                                     <input type="password" placeholder="Password" required minLength={6} value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-orange-200 text-sm font-bold" />
                                     <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-orange-200 text-sm font-bold">
                                        <option value="user">Standard User</option>
                                        <option value="admin">Org Admin</option>
                                     </select>
                                     <button type="submit" disabled={actionLoading} className="md:col-span-2 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-orange-700 disabled:opacity-50">
                                        {actionLoading ? 'Initializing...' : 'Confirm and Provision User'}
                                     </button>
                                  </form>
                               </motion.div>
                            )}
                         </AnimatePresence>
                         <div className="bg-orange-50 rounded-[2rem] border border-orange-100 overflow-hidden">
                            <table className="w-full text-left">
                               <thead className="bg-orange-50">
                                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                     <th className="py-4 px-6">User</th>
                                     <th className="py-4 px-6">Role</th>
                                     <th className="py-4 px-6 text-right">Ops</th>
                                  </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-50">
                                  {orgData.users.map(u => (
                                     <tr key={u.id} className="text-sm">
                                        <td className="py-4 px-6 font-bold">{u.displayName}</td>
                                        <td className="py-4 px-6"><span className="bg-orange-50 text-orange-600 px-2 py-1 rounded-lg text-[10px] uppercase font-black">{u.role}</span></td>
                                        <td className="py-4 px-6 text-right">
                                          <div className="flex items-center justify-end gap-3">
                                            <button 
                                              onClick={async () => {
                                                const newStatus = u.active !== false ? false : true;
                                                await setDoc(doc(db, 'users', u.id), { active: newStatus }, { merge: true });
                                                fetchOrgDetails(selectedOrg);
                                              }}
                                              className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter border transition-all ${u.active !== false ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100'}`}
                                            >
                                              {u.active !== false ? 'Active' : 'Inactive'}
                                            </button>
                                            <button className="text-slate-300 hover:text-slate-600 transition-colors"><MoreVertical size={16} /></button>
                                          </div>
                                        </td>
                                     </tr>
                                  ))}
                               </tbody>
                            </table>
                         </div>
                      </section>

                      {/* Activity Feed Section */}
                      <section>
                         <h3 className="text-xl font-black text-black mb-6 flex items-center gap-3"><Clock className="text-emerald-400" /> Recent Intelligence Logs</h3>
                         <div className="space-y-4">
                            {orgData.recentActivities.length > 0 ? orgData.recentActivities.map(rec => (
                              <div key={rec.id} className="bg-orange-50 p-6 rounded-3xl border border-orange-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                   <div className="w-10 h-10 bg-orange-100 text-slate-400 rounded-full flex items-center justify-center font-bold">
                                      <MessageSquare size={18} />
                                   </div>
                                   <div>
                                      <div className="font-extrabold text-black flex items-center gap-2">
                                         Audio Interaction
                                         <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full">Transcribed</span>
                                      </div>
                                      <p className="text-xs text-slate-500 font-medium">{rec.createdAt?.toDate?.().toLocaleString() || 'N/A'}</p>
                                   </div>
                                </div>
                                <code className="text-[10px] bg-orange-50 text-slate-400 px-3 py-1.5 rounded-xl font-bold">{rec.id}</code>
                              </div>
                            )) : (
                              <div className="py-10 text-center text-slate-400 font-bold border-2 border-dashed border-orange-200 rounded-3xl uppercase tracking-widest text-xs">No Recent Activity Found</div>
                            )}
                         </div>
                      </section>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lead Detail Modal */}
        <AnimatePresence>
          {selectedLead && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedLead(null)}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl bg-orange-50 rounded-[2.5rem] shadow-2xl overflow-hidden"
              >
                <div className="p-8">
                  <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center text-2xl font-black shadow-inner">
                        {selectedLead.name?.charAt(0)}
                      </div>
                      <div>
                        <h2 className="text-3xl font-black text-black leading-tight">{selectedLead.name}</h2>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="px-2.5 py-1 bg-orange-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-widest">{selectedLead.status || 'New'}</span>
                          <span className="text-slate-400 text-xs font-bold">{selectedLead.id}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedLead(null)} className="p-2 hover:bg-orange-50 rounded-xl transition-colors text-slate-400 hover:text-black">
                      <ArrowLeft size={24} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Contact Details</h3>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 text-slate-700 font-bold">
                            <Mail size={16} className="text-orange-400" /> {selectedLead.email || 'N/A'}
                          </div>
                          <div className="flex items-center gap-3 text-slate-700 font-bold">
                            <Globe size={16} className="text-orange-400" /> {selectedLead.phone || 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Details</h3>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 text-slate-600 font-bold text-xs">
                            <Building2 size={16} className="text-slate-300" /> Company: {selectedLead.companyId}
                          </div>
                          <div className="flex items-center gap-3 text-slate-600 font-bold text-xs">
                            <Calendar size={16} className="text-slate-300" /> Created: {selectedLead.createdAt?.toDate?.().toLocaleString() || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-orange-50 rounded-3xl p-6 border border-orange-100">
                       <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Lead Summary</h3>
                       <p className="text-slate-600 text-sm font-medium leading-relaxed italic">
                         {selectedLead.summary || "No automated summary available for this lead yet. Intelligence engine is monitoring interactions."}
                       </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button className="flex-1 bg-orange-600 text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-orange-100 hover:bg-orange-700 transition-all flex items-center justify-center gap-2">
                       <Mail size={18} /> Contact Lead
                    </button>
                    <button onClick={() => setSelectedLead(null)} className="px-8 bg-orange-100 text-slate-600 py-4 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all">
                       Close
                    </button>
                    <button 
                      onClick={() => handleDeleteLead(selectedLead.id)}
                      className="p-4 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-100 transition-all"
                      title="Delete Lead"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
