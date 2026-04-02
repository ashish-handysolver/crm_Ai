import React from 'react';
import {
  Plus, TrendingUp, Zap, Target, MoreHorizontal, Activity, ArrowUpRight, Users, Sparkles, UserCircle, CalendarDays, Flame
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import Reports from './Reports';
import Analytics from './Analytics';
import { db } from './firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useAuth } from './contexts/AuthContext';
import { useDemo } from './DemoContext';



export default function Dashboard({ user }: { user: any }) {
  const { companyId } = useAuth();
  const { isDemoMode, demoData } = useDemo();
  const [activeTab, setActiveTab] = React.useState<'overview' | 'reports' | 'analytics'>('overview');
  const [leads, setLeads] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(!isDemoMode);
  const [customPhases, setCustomPhases] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (isDemoMode) {
      // For demo mode, we transform the JSON data into a format that mimics Firestore docs
      const formattedLeads = demoData.leads.map(l => ({
        ...l,
        updatedAt: { toMillis: () => l.updatedAt.seconds * 1000 }
      }));
      setLeads(formattedLeads);
      setLoading(false);
      return;
    }

    if (!companyId) return;

    setLoading(true);
    const q = query(collection(db, 'leads'), where('companyId', '==', companyId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by updatedAt descending
      data.sort((a: any, b: any) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
      setLeads(data);
      setLoading(false);
    });

    getDoc(doc(db, 'companies', companyId)).then(snap => {
      if (snap.exists()) {
        setCustomPhases(snap.data().customPhases || []);
      }
    }).catch(console.error);

    return () => unsubscribe();
  }, [companyId, isDemoMode, demoData]);

  const handleHealthChange = async (leadId: string, newHealth: string) => {
    if (isDemoMode) return;
    try {
      await updateDoc(doc(db, 'leads', leadId), { health: newHealth });
    } catch (e) {
      console.error('Failed to update health', e);
    }
  };

  // Derived KPIs
  const totalClients = leads.length;
  const recentLeads = leads.slice(0, 4);

  const getPhaseCount = (phase: string) => leads.filter(l => l.phase?.toUpperCase() === phase.toUpperCase()).length;

  const DEFAULT_PHASES = ['DISCOVERY', 'NURTURING', 'QUALIFIED', 'WON', 'LOST', 'INACTIVE'];
  const availablePhases = Array.from(new Set([...DEFAULT_PHASES, ...customPhases, ...leads.map(l => l.phase).filter(Boolean)]));
  const pipelineData = availablePhases.map(phase => ({
    name: phase,
    value: getPhaseCount(phase)
  }));

  // Logic for conversion: qualified / total
  const conversionRate = totalClients > 0 ? ((getPhaseCount('QUALIFIED') / totalClients) * 100).toFixed(1) : '0';

  // Logic for value: arbitrary estimation for now as we don't have a value field
  // const estimatedValue = (totalClients * 12500 / 1000000).toFixed(1); // 12.5k avg value
  const estimatedValue = 0.0; // 12.5k avg value

  return (
    <div className="flex-1 bg-slate-50 text-slate-900 min-h-full">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-10 space-y-8">

        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-100/50 text-indigo-600 text-xs font-bold uppercase tracking-widest mb-3">
              <Activity size={14} />
              Command Center
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">Your Business</h1>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
            {!isDemoMode && (
              <Link to="/clients/new" className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-indigo-500/30 active:scale-[0.98] transition-all relative overflow-hidden group">
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                <Plus size={16} className="relative z-10" />
                <span className="relative z-10">Add Client</span>
              </Link>
            )}
            {isDemoMode && (
              <div className="px-4 py-2 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl text-xs font-black uppercase tracking-widest">
                Demo Only
              </div>
            )}
          </motion.div>
        </header>

        {/* Global Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-200/50 p-1 rounded-2xl w-fit border border-slate-200/40">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'analytics' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'reports' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Call Reports
          </button>
        </div>

        <div className="mt-8">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' ? (
              <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-8">
                {/* Top KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase flex justify-between">
                      Clients <TrendingUp size={14} className="text-emerald-500" />
                    </div>
                    <div className="text-4xl font-black mt-4">{totalClients.toLocaleString()}</div>
                    <div className="text-xs text-slate-400 mt-2 font-bold">+0% from last month</div>
                  </div>
                  <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase flex justify-between">
                      Conversion <Target size={14} className="text-blue-500" />
                    </div>
                    <div className="text-4xl font-black mt-4">{conversionRate}%</div>
                    <div className="text-xs text-slate-400 mt-2 font-bold">Qualified Leads</div>
                  </div>
                  <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase flex justify-between">
                      Value <Sparkles size={14} className="text-violet-500" />
                    </div>
                    <div className="text-4xl font-black mt-4">${estimatedValue}M</div>
                    <div className="text-xs text-slate-400 mt-2 font-bold">Estimated pipeline potential</div>
                  </div>
                  <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase flex justify-between">
                      Hot Leads <Flame size={14} className="text-orange-500" />
                    </div>
                    <div className="text-4xl font-black mt-4">{leads.filter(l => l.health === 'HOT').length}</div>
                    <div className="text-xs text-slate-400 mt-2 font-bold">Clients ready to close</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Sales Stages */}
                  <section className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                    <h2 className="text-xl font-extrabold mb-6 flex items-center gap-2"><Target size={20} className="text-blue-500" /> Sales Pipeline</h2>
                    <div className="grid grid-cols-2 gap-4">
                      {pipelineData.map(item => (
                        <div key={item.name} className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1 truncate" title={item.name}>{item.name}</div>
                          <div className="text-2xl font-black">{item.value}</div>
                          <div className="text-[10px] font-bold text-slate-400 mt-1">
                            {totalClients > 0 ? ((item.value / totalClients) * 100).toFixed(0) : 0}% of total
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Health Stages */}
                  <section className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                    <h2 className="text-xl font-extrabold mb-6 flex items-center gap-2"><Flame size={20} className="text-orange-500" /> Health Pipeline</h2>
                    <div className="grid grid-cols-3 gap-4">
                      {['HOT', 'WARM', 'COLD'].map(health => (
                        <div key={health} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-center">
                          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                            {health === 'HOT' ? '🔥' : health === 'WARM' ? '☀️' : '❄️'} {health}
                          </div>
                          <div className="text-3xl font-black text-slate-800">{leads.filter(l => (l.health || 'WARM') === health).length}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                {/* Key Clients */}
                <section className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                  <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                    <h2 className="text-xl font-extrabold">Recent Clients</h2>
                    <Link to="/clients" className="text-sm font-bold text-indigo-600 flex items-center gap-1">All Clients <ArrowUpRight size={16} /></Link>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 tracking-widest border-b border-slate-100">
                          <th className="py-4 px-8">Client</th>
                          <th className="py-4 px-8">Stage</th>
                          <th className="py-4 px-8">Created Date</th>
                          <th className="py-4 px-8">Health</th>
                          {/* <th className="py-4 px-8 text-right">Actions</th> */}
                        </tr>
                      </thead>
                      <tbody>
                        {recentLeads.map(item => (
                          <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-8">
                              <div className="font-bold text-slate-900">{item.name}</div>
                              <div className="text-xs text-slate-500">{item.email || item.phone}</div>
                            </td>
                            <td className="py-4 px-8">
                              <span className="text-[10px] font-bold bg-slate-100 px-2 py-1 rounded text-slate-600">{item.phase || 'NEW'}</span>
                            </td>
                            <td className="py-4 px-8 text-sm font-semibold text-slate-500">
                              {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="py-4 px-8">
                              <select
                                value={item.health || 'WARM'}
                                onChange={(e) => handleHealthChange(item.id, e.target.value)}
                                className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest appearance-none outline-none cursor-pointer text-center ${item.health === 'HOT' ? 'text-emerald-700 bg-emerald-100 border border-emerald-200 hover:bg-emerald-200' : item.health === 'COLD' ? 'text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200' : 'text-amber-700 bg-amber-100 border border-amber-200 hover:bg-amber-200'}`}
                              >
                                <option value="HOT">🔥 HOT</option>
                                <option value="WARM">☀️ WARM</option>
                                <option value="COLD">❄️ COLD</option>
                              </select>
                            </td>
                            {/* <td className="py-4 px-8 text-right">
                              <Link to="/clients" className="text-slate-400 hover:text-indigo-600 transition-colors"><MoreHorizontal size={18} /></Link>
                            </td> */}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </motion.div>
            ) : activeTab === 'analytics' ? (
              <motion.div key="analytics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                <Analytics user={user} />
              </motion.div>
            ) : (
              <motion.div key="reports" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                <Reports user={user} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
