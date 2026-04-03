import React from 'react';
import {
  Plus, TrendingUp, Zap, Target, MoreHorizontal, Activity, ArrowUpRight, Users, Sparkles, UserCircle, CalendarDays, Flame, ChevronLeft, ChevronRight, LayoutDashboard, Search, FileText
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
  const pipelineRef = React.useRef<HTMLDivElement | null>(null);

  const scrollPipeline = (direction: 'left' | 'right') => {
    if (!pipelineRef.current) return;
    const offset = pipelineRef.current.clientWidth;
    pipelineRef.current.scrollBy({ left: direction === 'left' ? -offset : offset, behavior: 'smooth' });
  };

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

  const DEFAULT_PHASES = ['DISCOVERY', 'NURTURING', 'QUALIFIED', 'WON', 'LOST', 'INACTIVE'];
  const availablePhases = Array.from(new Set([...DEFAULT_PHASES, ...customPhases, ...leads.map(l => l.phase).filter(Boolean)]));
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
    <div className="flex-1 bg-slate-50/50 min-h-full">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-8 lg:p-12 space-y-10">

        {/* Header Section */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-2">
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                 <Activity className="text-indigo-600" size={18} />
               </div>
               <span className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em]">Live Overview</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">
              Welcome back, <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">{user.displayName || 'User'}</span>
            </h1>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-4">
            <div className="relative group hidden sm:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search anything..." 
                className="pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl w-64 focus:w-80 transition-all outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 shadow-sm text-sm"
              />
            </div>
            {!isDemoMode ? (
              <Link to="/clients/new" className="btn-primary">
                <Plus size={18} />
                <span>New Lead</span>
              </Link>
            ) : (
              <div className="px-4 py-2 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-200">
                Demo Environment
              </div>
            )}
          </motion.div>
        </header>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-200/50 p-1.5 rounded-2xl w-fit border border-slate-200/40 backdrop-blur-sm">
          {[
            { id: 'overview', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
            { id: 'analytics', label: 'AI Analytics', icon: <Sparkles size={16} /> },
            { id: 'reports', label: 'Reports', icon: <FileText size={16} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-500/10' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {tab.icon}
              {tab.label}
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                {[
                  { label: 'Total Clients', value: totalClients, icon: <Users size={24} />, color: 'bg-indigo-500', trend: '+12%', sub: 'Active database' },
                  { label: 'Conversion Rate', value: `${conversionRate}%`, icon: <Target size={24} />, color: 'bg-emerald-500', trend: '+5.4%', sub: 'Qualified / Total' },
                  { label: 'Pipeline Value', value: `$${estimatedValue}M`, icon: <Zap size={24} />, color: 'bg-purple-500', trend: 'Stable', sub: 'Projected revenue' },
                ].map((kpi, i) => (
                  <motion.div key={i} variants={itemVariants} className="glass-card p-8 group hover:scale-[1.02] transition-all">
                    <div className="flex justify-between items-start mb-6">
                      <div className={`w-14 h-14 ${kpi.color} text-white rounded-2xl flex items-center justify-center shadow-lg shadow-${kpi.color.split('-')[1]}-200`}>
                        {kpi.icon}
                      </div>
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase">
                        <TrendingUp size={12} /> {kpi.trend}
                      </div>
                    </div>
                    <div className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">{kpi.value}</div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{kpi.label}</span>
                      <span className="text-[10px] font-bold text-slate-300 italic">{kpi.sub}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Pipeline Card */}
                <motion.section variants={itemVariants} className="glass-card p-10 relative overflow-hidden">
                   <div className="relative z-10 flex flex-col h-full">
                      <div className="flex justify-between items-center mb-8">
                        <h2 className="text-2xl font-black flex items-center gap-3">
                          <Target size={24} className="text-indigo-500" />
                          Sales Pipeline
                        </h2>
                        <div className="flex gap-2">
                           <button onClick={() => scrollPipeline('left')} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"><ChevronLeft size={18} /></button>
                           <button onClick={() => scrollPipeline('right')} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"><ChevronRight size={18} /></button>
                        </div>
                      </div>
                      
                      <div ref={pipelineRef} className="flex gap-6 overflow-x-auto pb-4 hide-scrollbar scroll-smooth">
                        {pipelineData.map((item, i) => {
                          const phaseLeads = leads.filter(l => l.phase?.toUpperCase() === item.name.toUpperCase()).slice(0, 3);
                          const colors: Record<string, string> = {
                            'DISCOVERY': 'from-blue-500/10 to-indigo-500/10 text-blue-600 border-blue-100',
                            'NURTURING': 'from-purple-500/10 to-pink-500/10 text-purple-600 border-purple-100',
                            'QUALIFIED': 'from-indigo-500/10 to-blue-500/10 text-indigo-600 border-indigo-100',
                            'WON': 'from-emerald-500/10 to-teal-500/10 text-emerald-600 border-emerald-100',
                            'LOST': 'from-rose-500/10 to-red-500/10 text-rose-600 border-rose-100',
                            'INACTIVE': 'from-slate-500/10 to-slate-500/10 text-slate-500 border-slate-100'
                          };
                          const colorClass = colors[item.name.toUpperCase()] || 'from-slate-500/5 to-slate-500/5 text-slate-500 border-slate-100';

                          return (
                            <div key={item.name} className="min-w-[240px] p-8 rounded-[2.5rem] bg-white border border-slate-100 group hover:shadow-2xl hover:shadow-indigo-500/5 hover:-translate-y-1 transition-all relative overflow-hidden">
                               <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${colorClass.split(' ').slice(0,2).join(' ')} rounded-bl-[40px] opacity-10 transition-opacity group-hover:opacity-20`}></div>
                               
                               <div className="relative z-10">
                                 <div className="flex justify-between items-start mb-6">
                                    <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${colorClass}`}>
                                       {item.name}
                                    </div>
                                    <span className="text-2xl font-black text-slate-900">{item.value}</span>
                                 </div>

                                 <div className="flex -space-x-3 mb-6">
                                    {phaseLeads.map((lead, idx) => (
                                      <div key={idx} className="w-10 h-10 rounded-xl border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 overflow-hidden shadow-sm">
                                         {lead.avatar ? <img src={lead.avatar} className="w-full h-full object-cover" /> : lead.name.charAt(0)}
                                      </div>
                                    ))}
                                    {item.value > 3 && (
                                      <div className="w-10 h-10 rounded-xl border-2 border-white bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-400 shadow-sm">
                                         +{item.value - 3}
                                      </div>
                                    )}
                                    {item.value === 0 && (
                                      <div className="w-10 h-10 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300">
                                         <Users size={16} />
                                      </div>
                                    )}
                                 </div>

                                 <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${totalClients > 0 ? (item.value / totalClients) * 100 : 0}%` }}
                                      className="h-full bg-indigo-500 group-hover:bg-indigo-600 transition-colors"
                                    />
                                 </div>
                                 <div className="mt-3 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                    <span>Pipeline Share</span>
                                    <span>{totalClients > 0 ? Math.round((item.value / totalClients) * 100) : 0}%</span>
                                 </div>
                               </div>
                            </div>
                          );
                        })}
                      </div>
                   </div>
                </motion.section>

                {/* Health Status */}
                <motion.section variants={itemVariants} className="glass-card p-10 bg-gradient-to-br from-white to-slate-50">
                  <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
                    <Flame size={24} className="text-rose-500" />
                    Status Overview
                  </h2>
                  <div className="grid grid-cols-3 gap-4">
                    {healthData.map(item => {
                      const colors = item.label === 'HOT' ? 'from-rose-50 to-orange-50 text-rose-600 border-rose-100' : 
                                   item.label === 'WARM' ? 'from-amber-50 to-yellow-50 text-amber-600 border-amber-100' : 
                                   'from-slate-50 to-indigo-50 text-slate-600 border-slate-100';
                      const icons = item.label === 'HOT' ? '🔥' : item.label === 'WARM' ? '☀️' : '❄️';
                      return (
                        <div key={item.label} className={`p-6 rounded-3xl border bg-gradient-to-br ${colors} flex flex-col items-center text-center group hover:scale-105 transition-all`}>
                           <span className="text-3xl mb-3">{icons}</span>
                           <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{item.label}</span>
                           <span className="text-3xl font-black">{item.count}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-8 p-4 rounded-2xl bg-indigo-600/5 border border-indigo-600/10 flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold">AI</div>
                    <p className="text-xs font-bold text-slate-500">Your pipeline is looking <span className="text-rose-600">Hot</span> today. 12 leads need immediate follow-up.</p>
                  </div>
                </motion.section>
              </div>

              {/* Recent Activity Table */}
              <motion.section variants={itemVariants} className="glass-card overflow-hidden">
                <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-white/50">
                   <div>
                      <h2 className="text-2xl font-black">Recent Activity</h2>
                      <p className="text-sm font-bold text-slate-400 mt-1">Latest client interactions and status updates</p>
                   </div>
                   <Link to="/clients" className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95">
                      View All
                      <ArrowUpRight size={14} />
                   </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-100/50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
                        <th className="py-5 px-10">Lead Name</th>
                        <th className="py-5 px-10">Pipeline</th>
                        <th className="py-5 px-10">Recent Interaction</th>
                        <th className="py-5 px-10">Status</th>
                        <th className="py-5 px-10 text-right">Insights</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentLeads.map((item, idx) => (
                        <tr key={item.id} className={`group hover:bg-white transition-colors ${idx !== recentLeads.length - 1 ? 'border-b border-slate-50' : ''}`}>
                          <td className="py-6 px-10">
                            <div className="flex items-center gap-4">
                               <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                  {item.name?.charAt(0)}
                               </div>
                               <div>
                                  <div className="font-extrabold text-slate-900">{item.name}</div>
                                  <div className="text-xs font-bold text-slate-400">{item.email || 'No email provided'}</div>
                               </div>
                            </div>
                          </td>
                          <td className="py-6 px-10">
                            <div className="inline-flex px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                               {item.phase || 'NEW'}
                            </div>
                          </td>
                          <td className="py-6 px-10">
                             <div className="text-sm font-bold text-slate-500">
                                {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Just now'}
                             </div>
                          </td>
                          <td className="py-6 px-10">
                            <select
                              value={item.health || 'WARM'}
                              onChange={(e) => handleHealthChange(item.id, e.target.value)}
                              className={`text-[10px] font-black px-4 py-2 rounded-xl uppercase tracking-widest outline-none cursor-pointer border appearance-none text-center transition-all ${
                                item.health === 'HOT' ? 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100' : 
                                item.health === 'COLD' ? 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200' : 
                                'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100'
                              }`}
                            >
                              <option value="HOT">HOT 🔥</option>
                              <option value="WARM">WARM ☀️</option>
                              <option value="COLD">COLD ❄️</option>
                            </select>
                          </td>
                          <td className="py-6 px-10 text-right">
                             <Link to={`/analytics/${item.id}`} className="p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all inline-block">
                                <Sparkles size={18} />
                             </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

