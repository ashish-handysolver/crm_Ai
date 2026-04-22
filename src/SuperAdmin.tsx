import React from 'react';
import { collection, query, onSnapshot, getDocs, doc, where, orderBy, limit, deleteDoc, writeBatch, setDoc, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, firebaseConfig } from './firebase';
import { 
  Loader2, Users, Building2, BarChart3, Search, Filter, 
  ArrowUpRight, ShieldCheck, Globe, Activity, Mail, Calendar,
  MoreVertical, Trash2, ExternalLink, ArrowLeft, MessageSquare, Clock,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from './components/ConfirmModal';

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
  const [leadToDelete, setLeadToDelete] = React.useState<string | null>(null);
  
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
      <div className="flex-1 bg-[#030014] flex items-center justify-center min-h-[100dvh]">
        <div className="relative">
          <Loader2 className="animate-spin text-indigo-500 w-16 h-16" />
          <div className="absolute inset-0 bg-indigo-500/20 blur-2xl animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#030014] text-white p-4 sm:p-8 lg:p-12 min-h-[100dvh] font-sans relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 right-0 w-[60rem] h-[60rem] bg-indigo-600/5 rounded-full blur-[160px] -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-[40rem] h-[40rem] bg-cyan-600/5 rounded-full blur-[140px] translate-y-1/2 -translate-x-1/2"></div>

      <div className="max-w-[1600px] mx-auto relative z-10">
        
        <AnimatePresence mode="wait">
          {!selectedOrg ? (
            <motion.div 
              key="list"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.5 }}
            >
              <header className="mb-14 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]">
                    <ShieldCheck size={14} className="animate-pulse" /> System Authority Node
                  </div>
                  <h1 className="text-5xl lg:text-7xl font-black tracking-tightest text-white leading-none">
                    Super <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-500 animate-gradient-x">Console</span>
                  </h1>
                  <p className="text-slate-400 font-medium text-lg max-w-2xl">Global intelligence oversight, entity provisioning, and protocol monitoring.</p>
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => { sessionStorage.removeItem('is_super_admin'); navigate('/super-login'); }}
                    className="group px-8 py-4 bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/50 rounded-2xl text-[10px] font-black text-slate-400 hover:text-rose-400 transition-all active:scale-95 flex items-center gap-3 uppercase tracking-widest shadow-2xl"
                  >
                    Terminate Uplink <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                  </button>
                </div>
              </header>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-14">
                {[
                  { label: 'Total Organizations', value: companies.length, icon: Building2, color: 'text-indigo-400', glow: 'shadow-indigo-500/10' },
                  { label: 'System Identities', value: allUsers.length, icon: Users, color: 'text-cyan-400', glow: 'shadow-cyan-500/10' },
                  { label: 'Uptime Protocol', value: 'Live', icon: Activity, color: 'text-emerald-400', glow: 'shadow-emerald-500/10' },
                  { label: 'Network Node', value: 'BOM-1', icon: Globe, color: 'text-violet-400', glow: 'shadow-violet-500/10' },
                ].map((stat, idx) => (
                  <motion.div 
                    key={idx} 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: idx * 0.1 }} 
                    className={`glass-card !bg-white/[0.02] border-white/5 hover:border-white/10 p-8 rounded-[2rem] transition-all group ${stat.glow} hover:shadow-2xl`}
                  >
                    <div className="flex items-center gap-6">
                      <div className={`w-16 h-16 rounded-2xl bg-white/5 border border-white/10 ${stat.color} flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500`}>
                        <stat.icon size={28} />
                      </div>
                      <div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2">{stat.label}</div>
                        <div className="text-3xl font-black text-white tracking-tight">{stat.value}</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Control Panel Section */}
              <div className="glass-card !bg-white/[0.01] border-white/5 rounded-[3rem] shadow-3xl overflow-hidden flex flex-col">
                <div className="p-8 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 bg-white/[0.02]">
                  <div className="flex p-1.5 bg-black/40 border border-white/5 rounded-2xl w-full md:w-auto">
                    {[
                      { id: 'companies', label: 'Organizations' },
                      { id: 'users', label: 'Identities' },
                      { id: 'leads', label: 'Protocol Nodes' }
                    ].map(tab => (
                      <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)} 
                        className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/40' : 'text-slate-500 hover:text-white'}`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  
                  <div className="relative w-full md:w-96 group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-cyan-400 transition-colors" size={20} />
                    <input 
                      type="text" 
                      placeholder={`Filter global ${activeTab}...`} 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-14 pr-6 py-4 bg-white/[0.03] border border-white/10 rounded-2xl focus:bg-white/[0.07] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 text-white font-bold outline-none transition-all shadow-inner"
                    />
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 flex gap-1">
                       <Filter size={14} className="text-slate-700" />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto min-h-[500px] scrollbar-hide">
                  {(activeTab === 'companies' && fetchingData.companies) || 
                   (activeTab === 'users' && fetchingData.users) || 
                   (activeTab === 'leads' && fetchingData.leads) ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-6">
                      <div className="relative">
                        <Loader2 className="animate-spin text-cyan-400" size={40} />
                        <div className="absolute inset-0 bg-cyan-400/20 blur-xl animate-pulse"></div>
                      </div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Establishing Logic Link...</span>
                    </div>
                  ) : activeTab === 'companies' ? (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] bg-white/[0.02]">
                          <th className="py-6 px-10">Entity Identification</th>
                          <th className="py-6 px-6">Access Hash</th>
                          <th className="py-6 px-6">Timestamp</th>
                          <th className="py-6 px-6">Root Authority</th>
                          <th className="py-6 px-10 text-right">Operations</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.03]">
                        {filteredCompanies.map(c => (
                          <tr key={c.id} className="hover:bg-white/[0.05] transition-all group cursor-pointer" onClick={() => fetchOrgDetails(c)}>
                            <td className="py-6 px-10">
                              <div className="flex items-center gap-5">
                                <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-2xl flex items-center justify-center font-black shadow-inner group-hover:scale-110 transition-transform duration-500 relative">
                                  {c.name?.charAt(0)}
                                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#030014] shadow-[0_0_10px_#10b981]"></div>
                                </div>
                                <div>
                                  <div className="font-extrabold text-white text-lg group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{c.name}</div>
                                  <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none mt-1.5 flex items-center gap-2">
                                    <div className="w-1 h-1 bg-slate-700 rounded-full"></div> Node Active
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-6 px-6"><code className="text-[10px] bg-white/5 border border-white/5 px-3 py-1.5 rounded-lg text-indigo-300 font-black tracking-widest">{c.id}</code></td>
                            <td className="py-6 px-6 text-[10px] font-black text-slate-500 uppercase flex items-center gap-3 mt-4"><Calendar size={14} className="text-indigo-500/50" /> {c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString() : 'N/A'}</td>
                            <td className="py-6 px-6"><code className="text-[10px] text-slate-600 font-bold tracking-tight">{c.createdBy}</code></td>
                            <td className="py-6 px-10 text-right">
                              <button className="p-3 text-slate-500 hover:text-white bg-white/5 hover:bg-indigo-600 border border-white/5 hover:border-indigo-400 rounded-xl transition-all shadow-xl active:scale-90"><ArrowUpRight size={20} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : activeTab === 'leads' ? (
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] bg-white/[0.02]">
                          <th className="py-6 px-10">Target Identification</th>
                          <th className="py-6 px-6">Origin Node</th>
                          <th className="py-6 px-6">Source</th>
                          <th className="py-6 px-6">Vital Status</th>
                          <th className="py-6 px-6">Epoch</th>
                          <th className="py-6 px-10 text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.03]">
                        {filteredLeads.map(l => {
                          const company = companies.find(c => c.id === l.companyId);
                          return (
                            <tr key={l.id} className="hover:bg-white/[0.05] transition-all group">
                              <td className="py-6 px-10">
                                <div className="font-extrabold text-white text-base group-hover:text-cyan-400 transition-colors">{l.name}</div>
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">{l.email || l.phone}</div>
                              </td>
                              <td className="py-6 px-6 text-[10px] font-black text-indigo-400 uppercase tracking-widest">{company?.name || l.companyId}</td>
                              <td className="py-6 px-6"><span className="text-[10px] bg-white/5 px-3 py-1.5 rounded-lg text-slate-400 font-black border border-white/5">{l.source || 'Direct'}</span></td>
                              <td className="py-6 px-6">
                                <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border ${l.status === 'New' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-[0_0_10px_rgba(34,211,238,0.1)]' : 'bg-white/5 text-slate-500 border-white/5'}`}>{l.status || 'Unknown'}</span>
                              </td>
                              <td className="py-6 px-6 text-[10px] font-black text-slate-600">{l.createdAt?.toDate ? l.createdAt.toDate().toLocaleDateString() : 'N/A'}</td>
                              <td className="py-6 px-10 text-right">
                                <div className="flex items-center justify-end gap-3">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setSelectedLead(l); }}
                                    className="p-3 text-slate-500 hover:text-cyan-400 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5"
                                  >
                                    <ExternalLink size={18} />
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteLead(l.id); }}
                                    className="p-3 text-slate-700 hover:text-rose-500 bg-white/5 hover:bg-rose-500/10 rounded-xl transition-all border border-white/5"
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
                        <tr className="border-b border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] bg-white/[0.02]">
                          <th className="py-6 px-10">Subject Profile</th>
                          <th className="py-6 px-6">Domain ID</th>
                          <th className="py-6 px-6">Role Protocol</th>
                          <th className="py-6 px-6">Activity</th>
                          <th className="py-6 px-10 text-right">Ops</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.03]">
                        {filteredUsers.map(u => (
                          <tr key={u.id} className="hover:bg-white/[0.05] transition-all group">
                            <td className="py-6 px-10">
                              <div className="flex items-center gap-5">
                                <div className="relative">
                                  <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}&background=000&color=fff`} className="w-12 h-12 rounded-2xl object-cover border border-white/10 shadow-2xl group-hover:scale-105 transition-transform" alt="" />
                                  <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#030014] ${u.active !== false ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-slate-700'}`}></div>
                                </div>
                                <div>
                                  <div className="font-extrabold text-white text-base group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{u.displayName}</div>
                                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-6 px-6 text-[10px] font-black text-slate-400 tracking-widest uppercase">{u.companyId || 'N/A'}</td>
                            <td className="py-6 px-6">
                              <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border ${u.role === 'super_admin' ? 'bg-violet-500/20 text-violet-400 border-violet-500/30' : u.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-white/5 text-slate-500 border-white/5'}`}>{u.role || 'user'}</span>
                            </td>
                            <td className="py-6 px-6 text-[10px] font-black text-slate-600">NULL_EPOCH</td>
                            <td className="py-6 px-10 text-right">
                              <div className="flex items-center justify-end gap-4">
                                <button 
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const newStatus = u.active !== false ? false : true;
                                    await setDoc(doc(db, 'users', u.id), { active: newStatus }, { merge: true });
                                  }}
                                  className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border transition-all ${u.active !== false ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'}`}
                                >
                                  {u.active !== false ? 'Sanctioned' : 'Restricted'}
                                </button>
                                <button className="p-2 text-slate-700 hover:text-white transition-colors"><Trash2 size={18} /></button>
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
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
            >
              <button onClick={() => setSelectedOrg(null)} className="flex items-center gap-3 text-slate-500 hover:text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mb-12 transition-all group">
                <ArrowLeft size={20} className="group-hover:-translate-x-2 transition-transform" /> Retract to Dashboard
              </button>

              <div className="flex flex-col lg:flex-row gap-10 items-start">
                {/* Left Column: Stats & Meta */}
                <div className="w-full lg:w-80 shrink-0 space-y-6">
                  <div className="glass-card !bg-white/[0.02] border-white/5 p-10 rounded-[3rem] shadow-3xl text-center relative overflow-hidden group/meta">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-cyan-500 opacity-20 group-hover/meta:opacity-100 transition-opacity"></div>
                    <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-[2.5rem] flex items-center justify-center shadow-inner mx-auto mb-6 group-hover:scale-110 transition-transform duration-700">
                      <Building2 className="text-indigo-400" size={40} />
                    </div>
                    <h2 className="text-4xl font-black text-white tracking-tightest mb-2">{selectedOrg.name}</h2>
                    <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px]">Entity Node Identification</p>
                    
                    <div className="mt-10 pt-10 border-t border-white/5 space-y-6">
                       <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                          <span className="text-slate-500 font-black uppercase tracking-tight text-[10px]">Logic Nodes</span>
                          <span className="text-indigo-400 font-black text-lg">{orgData.leads.length}</span>
                       </div>
                       <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                          <span className="text-slate-500 font-black uppercase tracking-tight text-[10px]">Active Identities</span>
                          <span className="text-cyan-400 font-black text-lg">{orgData.users.length}</span>
                       </div>
                    </div>
                  </div>

                  <div className="glass-card !bg-white/[0.01] border-white/5 p-8 rounded-3xl text-sm space-y-4">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">System Metadata</h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 text-slate-400 font-bold text-xs uppercase tracking-wider">
                        <Calendar size={16} className="text-indigo-500/50" />
                        Created: {selectedOrg.createdAt?.toDate?.().toLocaleDateString() || 'N/A'}
                      </div>
                      <div className="flex items-center gap-4 text-slate-400 font-bold text-xs uppercase tracking-wider overflow-hidden">
                        <ShieldCheck size={16} className="text-cyan-500/50 shrink-0" />
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
                      <section className="space-y-8">
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-2xl">
                               <Users size={24} />
                            </div>
                            <h3 className="text-2xl font-black text-white tracking-tight uppercase tracking-widest">Organizational Node Stream</h3>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {orgData.leads.length > 0 ? orgData.leads.map(lead => (
                              <div key={lead.id} onClick={() => setSelectedLead(lead)} className="glass-card !bg-white/[0.02] p-6 rounded-3xl border-white/5 shadow-2xl flex items-center justify-between group cursor-pointer hover:border-indigo-500/30 hover:bg-white/[0.04] transition-all">
                                 <div className="flex items-center gap-5">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg border ${lead.status === 'New' ? 'bg-indigo-600 border-indigo-400' : 'bg-slate-800 border-slate-700'} group-hover:scale-110 transition-transform`}>
                                       {lead.name.charAt(0)}
                                    </div>
                                    <div>
                                       <h4 className="font-extrabold text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{lead.name}</h4>
                                       <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-none mt-1.5">{lead.email || 'LOGGED_ANONYMOUS'}</p>
                                    </div>
                                 </div>
                                <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border ${lead.status === 'New' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.2)]' : 'bg-white/5 text-slate-600 border-white/5'}`}>
                                   {lead.status}
                                </span>
                              </div>
                            )) : (
                              <div className="col-span-full py-16 text-center text-slate-600 font-black border-2 border-dashed border-white/5 rounded-[3rem] uppercase tracking-[0.4em] text-[10px] italic">Zero Node Latency Detected</div>
                            )}
                         </div>
                      </section>

                      {/* User Accounts Section */}
                      <section className="space-y-8">
                         <div className="flex items-center justify-between">
                            <h3 className="text-2xl font-black text-white tracking-tight uppercase tracking-widest flex items-center gap-4">
                               <div className="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-400 border border-rose-500/20 shadow-2xl">
                                  <ShieldCheck size={24} />
                               </div>
                               Account Provisioning
                            </h3>
                            <button 
                              onClick={() => setIsAddingUser(!isAddingUser)}
                              className="px-6 py-3 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-cyan-400 transition-all shadow-xl active:scale-95"
                            >
                              {isAddingUser ? 'Abort' : 'Initialize Identity'}
                            </button>
                         </div>
 
                         <AnimatePresence>
                            {isAddingUser && (
                               <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="mb-10 glass-card !bg-white/5 rounded-[2.5rem] p-10 border-white/10 overflow-hidden shadow-3xl">
                                  <form onSubmit={handleAddUserToOrg} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                     <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Legal Identity</label>
                                        <input type="text" placeholder="Full Name" required value={newUserDisplayName} onChange={e => setNewUserDisplayName(e.target.value)} className="w-full px-6 py-4 bg-black/40 border border-white/10 rounded-2xl text-white font-bold text-sm focus:border-cyan-500/50 outline-none transition-all" />
                                     </div>
                                     <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Encryption Hash (Email)</label>
                                        <input type="email" placeholder="Email Address" required value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} className="w-full px-6 py-4 bg-black/40 border border-white/10 rounded-2xl text-white font-bold text-sm focus:border-cyan-500/50 outline-none transition-all" />
                                     </div>
                                     <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Access Barrier (Password)</label>
                                        <input type="password" placeholder="Min 6 characters" required minLength={6} value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} className="w-full px-6 py-4 bg-black/40 border border-white/10 rounded-2xl text-white font-bold text-sm focus:border-cyan-500/50 outline-none transition-all" />
                                     </div>
                                     <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Privilege Level</label>
                                        <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} className="w-full px-6 py-4 bg-black/40 border border-white/10 rounded-2xl text-white font-bold text-sm focus:border-cyan-500/50 outline-none transition-all appearance-none cursor-pointer">
                                           <option value="user" className="bg-slate-900">Standard Operator</option>
                                           <option value="admin" className="bg-slate-900">Org Supervisor</option>
                                        </select>
                                     </div>
                                     <button type="submit" disabled={actionLoading} className="md:col-span-2 bg-indigo-600 hover:bg-indigo-500 text-white py-5 rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 disabled:opacity-50 mt-4 relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none"></div>
                                        {actionLoading ? <Loader2 className="animate-spin" size={20} /> : 'Execute Provisioning Protocol'}
                                     </button>
                                  </form>
                               </motion.div>
                            )}
                         </AnimatePresence>
                         <div className="glass-card !bg-white/[0.01] border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
                            <table className="w-full text-left">
                               <thead>
                                  <tr className="bg-white/[0.03] text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                     <th className="py-6 px-10">Subject Identity</th>
                                     <th className="py-6 px-6">Privilege Protocol</th>
                                     <th className="py-6 px-10 text-right">Ops</th>
                                  </tr>
                               </thead>
                               <tbody className="divide-y divide-white/[0.03]">
                                  {orgData.users.map(u => (
                                     <tr key={u.id} className="text-sm group hover:bg-white/[0.02] transition-all">
                                        <td className="py-6 px-10 font-bold text-white group-hover:text-cyan-400 transition-colors">{u.displayName}</td>
                                        <td className="py-6 px-6"><span className="bg-white/5 border border-white/5 text-indigo-400 px-3 py-1.5 rounded-xl text-[10px] uppercase font-black shadow-inner">{u.role}</span></td>
                                        <td className="py-6 px-10 text-right">
                                          <div className="flex items-center justify-end gap-5">
                                             <button 
                                               onClick={async () => {
                                                 const newStatus = u.active !== false ? false : true;
                                                 await setDoc(doc(db, 'users', u.id), { active: newStatus }, { merge: true });
                                                 fetchOrgDetails(selectedOrg);
                                               }}
                                               className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${u.active !== false ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.1)]'}`}
                                             >
                                               {u.active !== false ? 'Authorized' : 'Blacklisted'}
                                             </button>
                                             <button className="text-slate-700 hover:text-white transition-colors p-2 bg-white/5 rounded-xl"><MoreVertical size={18} /></button>
                                          </div>
                                        </td>
                                     </tr>
                                  ))}
                               </tbody>
                            </table>
                         </div>
                      </section>
 
                      {/* Activity Feed Section */}
                      <section className="space-y-8">
                         <h3 className="text-2xl font-black text-white tracking-tight uppercase tracking-widest flex items-center gap-4">
                            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-500/20 shadow-2xl">
                               <Clock size={24} />
                            </div>
                            System Intelligence Stream
                         </h3>
                         <div className="space-y-4">
                            {orgData.recentActivities.length > 0 ? orgData.recentActivities.map(rec => (
                              <div key={rec.id} className="glass-card !bg-white/[0.02] p-8 rounded-[2rem] border-white/5 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:border-emerald-500/30 transition-all">
                                <div className="flex items-center gap-6">
                                   <div className="w-14 h-14 bg-white/5 text-slate-500 rounded-2xl flex items-center justify-center font-bold border border-white/5 shadow-inner group-hover:scale-110 transition-transform duration-500">
                                      <MessageSquare size={22} className="group-hover:text-emerald-400 transition-colors" />
                                   </div>
                                   <div>
                                      <div className="font-extrabold text-white text-lg flex items-center gap-3">
                                         Audio Interaction Captured
                                         <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]">Processed</span>
                                      </div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">{rec.createdAt?.toDate?.().toLocaleString() || 'N/A'}</p>
                                   </div>
                                </div>
                                <code className="text-[10px] bg-black/40 border border-white/5 text-indigo-400 px-4 py-2 rounded-2xl font-black tracking-widest uppercase shadow-inner group-hover:border-indigo-500/50 transition-all">{rec.id}</code>
                              </div>
                            )) : (
                              <div className="py-16 text-center text-slate-600 font-black border-2 border-dashed border-white/5 rounded-[3.5rem] uppercase tracking-[0.4em] text-[10px] italic">No Interaction Metadata Available</div>
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
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-12">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedLead(null)}
                className="absolute inset-0 bg-black/80 backdrop-blur-xl"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 40 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 40 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="relative w-full max-w-4xl glass-card !bg-slate-900/60 !backdrop-blur-3xl !border-white/10 rounded-[3.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden border border-white/10 group/modal"
              >
                {/* Decorative border glow */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-0 group-hover/modal:opacity-100 transition-opacity duration-1000"></div>

                <div className="p-10 sm:p-16">
                  <div className="flex flex-col md:flex-row justify-between items-start gap-10 mb-14">
                    <div className="flex items-center gap-8">
                      <div className="w-24 h-24 bg-white/5 border border-white/10 text-cyan-400 rounded-[2rem] flex items-center justify-center text-4xl font-black shadow-inner relative group-hover:scale-110 transition-transform duration-700">
                        {selectedLead.name?.charAt(0)}
                        <div className="absolute inset-0 bg-cyan-400/20 blur-2xl rounded-full opacity-20"></div>
                      </div>
                      <div className="space-y-3">
                        <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tightest leading-tight">{selectedLead.name}</h2>
                        <div className="flex items-center gap-4">
                          <span className="px-4 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(99,102,241,0.1)]">{selectedLead.status || 'New Node'}</span>
                          <code className="text-slate-600 text-[10px] font-black tracking-widest uppercase">{selectedLead.id}</code>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedLead(null)} className="p-4 hover:bg-white/10 rounded-2xl transition-all text-slate-500 hover:text-white border border-transparent hover:border-white/10 active:scale-95">
                      <ArrowLeft size={32} />
                    </button>
                  </div>
 
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-14">
                    <div className="space-y-10">
                      <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-6 border-b border-white/5 pb-3">Operational Details</h3>
                        <div className="space-y-6">
                          <div className="flex items-center gap-5 text-slate-300 font-bold text-sm bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-all">
                            <Mail size={20} className="text-cyan-400" /> {selectedLead.email || 'ENCRYPTED_FIELD'}
                          </div>
                          <div className="flex items-center gap-5 text-slate-300 font-bold text-sm bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-all">
                            <Globe size={20} className="text-cyan-400" /> {selectedLead.phone || 'NO_SIGNAL_DEVICE'}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-6 border-b border-white/5 pb-3">Protocol Metadata</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white/[0.02] p-5 rounded-2xl border border-white/5">
                             <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">Subject Origin</div>
                             <div className="text-xs text-white font-black truncate">{selectedLead.companyId}</div>
                          </div>
                          <div className="bg-white/[0.02] p-5 rounded-2xl border border-white/5">
                             <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">Epoch Logged</div>
                             <div className="text-xs text-white font-black truncate">{selectedLead.createdAt?.toDate?.().toLocaleDateString() || 'N/A'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="glass-card !bg-white/[0.03] rounded-[2.5rem] p-10 border-white/10 shadow-2xl relative overflow-hidden flex flex-col justify-center">
                       <div className="absolute top-4 left-6 flex items-center gap-2">
                          <Sparkles size={14} className="text-indigo-400 animate-pulse" />
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Intelligence Insight v2</span>
                       </div>
                       <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-8 border-b border-white/5 pb-3 opacity-0">Hidden</h3>
                       <p className="text-slate-300 text-lg font-medium leading-[1.8] italic relative">
                         <span className="text-4xl text-indigo-500/30 absolute -top-4 -left-6 font-serif">"</span>
                         {selectedLead.summary || "No automated intelligence profile has been generated for this subject yet. Internal systems are monitoring current data vectors for synthesis."}
                         <span className="text-4xl text-indigo-500/30 absolute -bottom-10 -right-2 font-serif">"</span>
                       </p>
                    </div>
                  </div>
 
                  <div className="flex flex-wrap gap-4">
                    <button className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-5 rounded-[2rem] font-black text-[12px] uppercase tracking-[0.2em] shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-95 group relative overflow-hidden">
                       <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none"></div>
                       <Mail size={20} /> Establish Direct Link
                    </button>
                    <button onClick={() => setSelectedLead(null)} className="px-12 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white py-5 rounded-[2rem] font-black text-[12px] uppercase tracking-[0.2em] border border-white/10 transition-all active:scale-95">
                       Close Node
                    </button>
                    <button 
                      onClick={() => setLeadToDelete(selectedLead.id)}
                      className="p-5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-[2rem] hover:bg-rose-500/20 transition-all active:scale-95"
                      title="Terminate Node"
                    >
                      <Trash2 size={24} />
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        <ConfirmModal
          open={leadToDelete !== null}
          title="Delete lead permanently?"
          message="This will permanently delete the lead and all associated data. This action cannot be undone."
          confirmLabel="Delete permanently"
          onCancel={() => setLeadToDelete(null)}
          onConfirm={async () => {
            if (!leadToDelete) return;
            const id = leadToDelete;
            setLeadToDelete(null);
            await handleDeleteLead(id);
          }}
        />
      </div>
    </div>
  );
}
