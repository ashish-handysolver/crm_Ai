import React from 'react';
import {
  Plus, TrendingUp, Zap, Target, MoreHorizontal, Activity, ArrowUpRight, ArrowRight, Users, Sparkles, UserCircle, CalendarDays, Flame, ChevronLeft, ChevronRight, LayoutDashboard, Search, FileText
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isDemoMode) {
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

  const totalClients = leads.length;
  const recentLeads = leads.slice(0, 5);
  const getPhaseCount = (phase: string) => leads.filter(l => l.phase?.toUpperCase() === phase.toUpperCase()).length;

  const DEFAULT_PHASES = String((import.meta as any).env.VITE_PIPELINE_STAGES || 'DISCOVERY,CONNECTED,NURTURING,QUALIFIED,WON,LOST,INACTIVE').split(',').map(p => p.trim());
  const availablePhases = Array.from(new Set([...DEFAULT_PHASES, ...customPhases]));
  const pipelineData = availablePhases.map(phase => ({
    name: phase,
    value: getPhaseCount(phase)
  }));

  const conversionRate = totalClients > 0 ? ((getPhaseCount('QUALIFIED') / totalClients) * 100).toFixed(1) : '0';
  const estimatedValue = 0.0;

  const healthCategories = ['HOT', 'WARM', 'COLD'];
  const healthData = healthCategories.map(health => ({
    label: health,
    count: leads.filter(l => (l.health || 'WARM').toUpperCase() === health).length
  }));

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="flex-1 bg-transparent min-h-full">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-8 lg:p-12 space-y-10">

        {/* Header Section */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 sm:gap-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Activity className="text-indigo-600" size={18} />
              </div>
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Operational Overview</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-none">
              Welcome back, <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">{user.displayName || 'User'}</span>
            </h1>
          </motion.div>

          {/* <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="relative group flex-1 sm:flex-none">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
              <input
                type="text"
                placeholder="Search..."
                className="pl-10 pr-4 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-2xl w-full sm:w-64 focus:sm:w-80 transition-all outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 shadow-sm text-sm font-medium"
              />
            </div>
          </motion.div> */}
        </header>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 bg-white/5 p-1.5 rounded-2xl w-full sm:w-fit border border-white/10 backdrop-blur-sm shadow-inner overflow-hidden">
          {[
            { id: 'overview', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
            { id: 'analytics', label: 'AI Analytics', icon: <Sparkles size={16} /> },
            { id: 'reports', label: 'Reports', icon: <FileText size={16} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-2 px-1.5 sm:px-6 py-2.5 rounded-xl text-[10px] sm:text-sm font-bold transition-all min-w-0 ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
            >
              <span className="shrink-0">{tab.icon}</span>
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' ? (
            <motion.div
              key="overview"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="space-y-10"
            >
              {/* KPI Section */}
              <div className="grid grid-cols-3 md:grid-cols-3 gap-3 md:gap-8">
                {[
                  { label: 'Total Clients', value: totalClients, icon: <Users size={24} />, color: 'bg-indigo-500' },
                  { label: 'Conversion', value: `${conversionRate}%`, icon: <Target size={24} />, color: 'bg-emerald-500' },
                  { label: 'Pipeline Val', value: `$${estimatedValue}M`, icon: <Zap size={24} />, color: 'bg-purple-500' },
                ].map((kpi, i) => (
                  <motion.div key={i} variants={itemVariants} className="glass-card p-4 sm:p-8 group hover:scale-[1.02] transition-all relative overflow-hidden flex flex-col justify-between min-h-[140px] sm:min-h-0">
                    <div className="absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="flex flex-col sm:flex-row justify-between items-start mb-2 sm:mb-6 gap-2 relative z-10 w-full">
                      <div className={`w-8 h-8 sm:w-14 sm:h-14 ${kpi.color} text-white rounded-xl sm:rounded-2xl flex items-center justify-center  shadow-${kpi.color.split('-')[1]}-200`}>
                        {React.cloneElement(kpi.icon as React.ReactElement, { size: 14 })}
                      </div>

                    </div>
                    <div>
                      <div className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tighter relative z-10 truncate leading-none mb-2">{kpi.value}</div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between relative z-10 gap-1">
                        <span className="text-[7px] sm:text-[10px] font-black text-slate-400 uppercase tracking-tighter leading-none">{kpi.label}</span>
                        <span className="text-[6px] sm:text-[8px] font-bold text-slate-300 italic hidden sm:block"></span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Pipeline Card */}
                <motion.section variants={itemVariants} className="glass-card p-5 sm:p-8 bg-white/5 border border-white/10 relative overflow-hidden">
                  <h2 className="text-lg sm:text-2xl font-black text-white flex items-center gap-2 mb-4 sm:mb-6">
                    <Target size={20} className="text-indigo-400" />
                    Sales Pipeline
                  </h2>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {pipelineData.map((item) => {
                      const phaseColors: Record<string, string> = {
                        'DISCOVERY': 'from-blue-500/10 to-cyan-500/10 text-blue-400 border-blue-500/20',
                        'CONNECTED': 'from-teal-500/10 to-emerald-500/10 text-teal-400 border-teal-500/20',
                        'NURTURING': 'from-purple-500/10 to-fuchsia-500/10 text-purple-400 border-purple-500/20',
                        'QUALIFIED': 'from-indigo-500/10 to-violet-500/10 text-indigo-400 border-indigo-500/20',
                        'WON': 'from-emerald-500/10 to-teal-500/10 text-emerald-400 border-emerald-500/20',
                        'LOST': 'from-rose-500/10 to-red-500/10 text-rose-400 border-rose-500/20',
                        'INACTIVE': 'from-slate-500/10 to-gray-500/10 text-slate-400 border-white/10'
                      };
                      const c = phaseColors[item.name.toUpperCase()] || phaseColors['INACTIVE'];

                      return (
                        <div
                          key={item.name}
                          onClick={() => navigate('/clients', { state: { phase: item.name } })}
                          className={`p-4 sm:p-5 rounded-2xl border bg-gradient-to-br ${c} flex flex-col items-center text-center cursor-pointer group transition-all hover:scale-105`}
                        >
                          <span className="text-xl sm:text-3xl font-black mb-1">{item.value}</span>
                          <span className="text-[7px] sm:text-[10px] font-black uppercase tracking-widest opacity-80 truncate w-full px-1">{item.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </motion.section>

                {/* Health Status */}
                <motion.section variants={itemVariants} className="glass-card p-5 sm:p-8 bg-white/5 border border-white/10">
                  <h2 className="text-lg sm:text-2xl font-black text-white mb-4 sm:mb-6 flex items-center gap-2">
                    <Flame size={20} className="text-rose-500" />
                    Status Overview
                  </h2>
                  <div className="grid grid-cols-3 gap-3">
                    {healthData.map(item => {
                      const colors = item.label === 'HOT' ? 'from-rose-500/10 to-orange-500/10 text-rose-400 border-rose-500/20' :
                        item.label === 'WARM' ? 'from-amber-500/10 to-yellow-500/10 text-amber-400 border-amber-500/20' :
                          'from-slate-500/10 to-indigo-500/10 text-slate-400 border-white/10';
                      const icons = item.label === 'HOT' ? '🔥' : item.label === 'WARM' ? '☀️' : '❄️';
                      return (
                        <div
                          key={item.label}
                          onClick={() => navigate('/clients', { state: { health: item.label } })}
                          className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl border bg-gradient-to-br ${colors} flex flex-col items-center text-center group hover:scale-105 transition-all cursor-pointer`}
                        >
                          <span className="text-lg sm:text-3xl mb-1 sm:mb-2">{icons}</span>
                          <span className="hidden sm:block text-[8px] sm:text-[10px] font-black uppercase tracking-widest opacity-60 mb-0.5">{item.label}</span>
                          <span className="text-xl sm:text-3xl font-black">{item.count}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-6 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-3 hidden sm:flex">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-600 rounded-lg sm:rounded-xl flex items-center justify-center text-white font-bold text-xs">AI</div>
                    <p className="text-[10px] sm:text-xs font-bold text-slate-300">Your pipeline is looking <span className="text-rose-400">Hot</span> today. Leads need follow-up.</p>
                  </div>
                </motion.section>
              </div>

              {/* Recent Activity Table */}
              <motion.section variants={itemVariants} className="glass-card overflow-hidden">
                <div className="p-6 sm:p-10 border-b border-white/10 flex justify-between items-center bg-white/5">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white">Recent Activity</h2>
                    <p className="hidden sm:block text-sm font-bold text-slate-400 mt-1">Latest client interactions and status updates</p>
                  </div>
                  <Link to="/clients" className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl bg-indigo-600 text-white text-[10px] sm:text-xs font-bold hover:bg-indigo-500 transition-all shadow-lg active:scale-95">
                    View All
                    <ArrowUpRight size={14} />
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  {/* Desktop Table View */}
                  <table className="w-full text-left hidden md:table">
                    <thead>
                      <tr className="bg-white/5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-white/10">
                        <th className="py-5 px-10">Lead Name</th>
                        <th className="py-5 px-10">Pipeline</th>
                        <th className="py-5 px-10">Recent Interaction</th>
                        <th className="py-5 px-10">Status</th>
                        <th className="py-5 px-10 text-right">Insights</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentLeads.map((item, idx) => (
                        <tr key={item.id} className={`group hover:bg-white/5 transition-colors ${idx !== recentLeads.length - 1 ? 'border-b border-white/5' : ''}`}>
                          <td className="py-6 px-10">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center font-black text-white group-hover:bg-indigo-500/20 group-hover:text-indigo-300 transition-colors shadow-sm">
                                {item.name?.charAt(0)}
                              </div>
                              <div>
                                <div className="font-extrabold text-white group-hover:text-indigo-400 transition-colors uppercase text-xs tracking-tight">{item.name}</div>
                                <div className="text-[10px] font-bold text-slate-400 lowercase">{item.email || 'No email provided'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-6 px-10">
                            <div className="inline-flex px-3 py-1.5 rounded-full bg-white/10 text-slate-300 text-[9px] font-black uppercase tracking-widest group-hover:bg-indigo-500/20 group-hover:text-indigo-300 transition-colors border border-white/10">
                              {item.phase || 'NEW'}
                            </div>
                          </td>
                          <td className="py-6 px-10">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                              {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Just now'}
                            </div>
                          </td>
                          <td className="py-6 px-10">
                            <select
                              value={item.health || 'WARM'}
                              onChange={(e) => handleHealthChange(item.id, e.target.value)}
                              className={`text-[9px] font-black px-4 py-2 rounded-xl uppercase tracking-widest outline-none cursor-pointer border appearance-none text-center transition-all ${item.health === 'HOT' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20' :
                                item.health === 'COLD' ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' :
                                  'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                                }`}
                            >
                              <option value="HOT">HOT 🔥</option>
                              <option value="WARM">WARM ☀️</option>
                              <option value="COLD">COLD ❄️</option>
                            </select>
                          </td>
                          <td className="py-6 px-10 text-right">
                            <Link to={`/analytics/${item.id}`} className="p-3 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all inline-block shadow-sm">
                              <Sparkles size={18} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Mobile Card List View */}
                  <div className="grid grid-cols-1 gap-4 p-4 md:hidden">
                    {recentLeads.map((item) => (
                      <div key={item.id} className="p-5 rounded-3xl bg-white/5 border border-white/10 flex flex-col gap-5 group active:bg-white/10 transition-all">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/10 border border-white/10 rounded-xl flex items-center justify-center font-black text-indigo-400 shadow-sm text-sm">
                              {item.name?.charAt(0)}
                            </div>
                            <div>
                              <div className="font-extrabold text-white text-xs uppercase tracking-tight">{item.name}</div>
                              <div className="text-[10px] font-bold text-slate-400 lowercase">{item.email}</div>
                            </div>
                          </div>
                          <Link to={`/analytics/${item.id}`} className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl shadow-sm">
                            <Sparkles size={16} />
                          </Link>
                        </div>

                        <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-4">
                          <div className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/10 text-slate-300 text-[8px] font-black uppercase tracking-widest">
                            {item.phase || 'NEW'}
                          </div>
                          <select
                            value={item.health || 'WARM'}
                            onChange={(e) => handleHealthChange(item.id, e.target.value)}
                            className={`text-[8px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest outline-none border appearance-none transition-all ${item.health === 'HOT' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                              item.health === 'COLD' ? 'bg-slate-800 text-slate-300 border-slate-700' :
                                'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}
                          >
                            <option value="HOT">HOT</option>
                            <option value="WARM">WARM</option>
                            <option value="COLD">COLD</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>

                  {leads.length === 0 && !loading && (
                    <div className="py-20 text-center">
                      <LayoutDashboard className="mx-auto text-slate-200 mb-4" size={48} />
                      <p className="font-bold text-slate-400 uppercase tracking-widest text-sm">No clients found in registry</p>
                    </div>
                  )}
                </div>
              </motion.section>
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
  );
}
