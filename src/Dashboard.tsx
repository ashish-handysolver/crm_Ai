import React from 'react';
import {
  Plus, TrendingUp, Zap, Target, MoreHorizontal, Activity, ArrowUpRight, ArrowRight, Users, Sparkles, UserCircle, CalendarDays, Flame, ChevronLeft, ChevronRight, LayoutDashboard, Search, FileText, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import Reports from './Reports';
import Analytics from './Analytics';
import { db } from './firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useAuth } from './contexts/AuthContext';
import { useDemo } from './DemoContext';
import { logActivity } from './utils/activity';
import { PageLayout } from './components/layout/PageLayout';
import { PageHeader } from './components/layout/PageHeader';

export default function Dashboard({ user }: { user: any }) {
  const { companyId, role } = useAuth();
  const { isDemoMode, demoData } = useDemo();
  const [activeTab, setActiveTab] = React.useState<'overview' | 'reports' | 'analytics'>('overview');
  const [leads, setLeads] = React.useState<any[]>([]);
  const [teamMembers, setTeamMembers] = React.useState<any[]>([]);
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
      setTeamMembers(demoData.team || []);
      setLoading(false);
      return;
    }

    if (!companyId) return;

    setLoading(true);
    const q = query(collection(db, 'leads'), where('companyId', '==', companyId));
    const unsubscribeLeads = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a: any, b: any) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));

      const filtered = role === 'team_member'
        ? data.filter((l: any) => l.assignedTo === user.uid || l.authorUid === user.uid)
        : data;

      setLeads(filtered);
      setLoading(false);
    });

    getDoc(doc(db, 'companies', companyId)).then(snap => {
      if (snap.exists()) {
        setCustomPhases(snap.data().customPhases || []);
      }
    }).catch(console.error);

    const qUsers = query(collection(db, 'users'), where('companyId', '==', companyId));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      setTeamMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeLeads();
      unsubscribeUsers();
    };
  }, [companyId, isDemoMode, demoData, role, user.uid]);

  const handleHealthChange = async (leadId: string, newHealth: string) => {
    if (isDemoMode) return;
    try {
      if (!isDemoMode) {
        const lead = leads.find(l => l.id === leadId);
        const oldHealth = lead?.health || 'WARM';
        await updateDoc(doc(db, 'leads', leadId), { health: newHealth });

        await logActivity({
          leadId,
          companyId,
          type: 'FIELD_CHANGE',
          action: 'Health Status Synchronization',
          authorUid: user.uid,
          authorName: user.displayName || 'System',
          details: {
            field: 'health',
            oldValue: oldHealth,
            newValue: newHealth
          }
        });
      }
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

  const interestedCount = leads.filter(l => l.isInterested !== false).length;
  const notInterestedCount = leads.filter(l => l.isInterested === false).length;

  const healthCategories = ['HOT', 'WARM', 'COLD'];
  const healthData = healthCategories.map(health => ({
    label: health,
    count: leads.filter(l => (l.health || 'WARM').toUpperCase() === health).length
  }));

  const teamMetrics = React.useMemo(() => {
    const connectedPhases = ['CONNECTED', 'NURTURING', 'QUALIFIED', 'WON'];
    const isConnectedLead = (lead: any) => {
      const phase = (lead.phase || lead.status || '').toUpperCase();
      return connectedPhases.includes(phase);
    };

    return teamMembers.map(member => {
      const uId = member.uid || member.id;
      const assignedLeads = leads.filter(l => l.assignedTo === uId || l.assignedTo === member.id || l.assignedTo === member.uid);
      const totalAssigned = assignedLeads.length;

      const connectedCount = assignedLeads.filter(isConnectedLead).length;

      const convertedCount = assignedLeads.filter(l =>
        l.phase?.toUpperCase() === 'WON'
      ).length;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const connectedTodayCount = assignedLeads.filter(l => {
        const phase = (l.phase || l.status || '').toUpperCase();
        if (phase !== 'CONNECTED') return false;
        if (!l.updatedAt) return false;
        const date = l.updatedAt.toDate ? l.updatedAt.toDate() : new Date(l.updatedAt);
        return date >= today;
      }).length;

      return {
        ...member,
        totalAssigned,
        connectedCount,
        convertedCount,
        connectedTodayCount
      };
    }).sort((a, b) => b.totalAssigned - a.totalAssigned);
  }, [teamMembers, leads]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <PageLayout>
      <PageHeader 
        title={`Welcome back, ${user.displayName?.split(' ')[0] || 'User'}`}
        description="Here is what's happening with your sales pipeline today."
        badge="Command Center"
        icon={LayoutDashboard}
        actions={
          <div className="flex items-center gap-1.5 bg-[var(--crm-border)] p-1.5 rounded-2xl border border-[var(--crm-border)] backdrop-blur-sm shadow-inner overflow-hidden">
            {[
              { id: 'overview', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
              { id: 'analytics', label: 'AI Analytics', icon: <Sparkles size={16} /> },
              { id: 'reports', label: 'Reports', icon: <FileText size={16} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20' : 'text-[var(--crm-text-muted)] hover:text-[var(--crm-text)]'}`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        }
      />

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
                  { label: 'Total Leads', value: totalClients, icon: <Users size={24} />, color: 'bg-indigo-500', link: '/clients' },
                  { label: 'Conversion', value: `${conversionRate}%`, icon: <Target size={24} />, color: 'bg-emerald-500', link: '/clients' },
                  // { label: 'Interested', value: interestedCount, icon: <ThumbsUp size={24} />, color: 'bg-cyan-500', link: '/clients', filter: { isInterested: true } },
                  // { label: 'Not Interested', value: notInterestedCount, icon: <ThumbsDown size={24} />, color: 'bg-rose-500', link: '/clients', filter: { isInterested: false } },
                  { label: 'Turnover', value: `₹ ${estimatedValue}`, icon: <Zap size={24} />, color: 'bg-purple-500' },
                ].map((kpi, i) => (
                  <motion.div
                    key={i}
                    variants={itemVariants}
                    onClick={() => kpi.link && navigate(kpi.link, { state: (kpi as any).filter })}
                    className={`glass-card p-4 sm:p-8 group hover:scale-[1.02] transition-all relative overflow-hidden flex flex-col justify-between min-h-[140px] sm:min-h-0 bg-[var(--crm-card-bg)] border border-[var(--crm-border)] ${kpi.link ? 'cursor-pointer' : ''}`}
                  >
                    <div className="absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 bg-indigo-500 rounded-full -translate-y-1/2 translate-x-1/2" style={{ opacity: 'var(--crm-glow-opacity)' }} />
                    <div className="flex flex-col sm:flex-row justify-between items-start mb-2 sm:mb-6 gap-2 relative z-10 w-full">
                      <div className={`w-8 h-8 sm:w-14 sm:h-14 ${kpi.color} text-white rounded-xl sm:rounded-2xl flex items-center justify-center  shadow-${kpi.color.split('-')[1]}-200`}>
                        {React.cloneElement(kpi.icon as React.ReactElement, { size: 14 })}
                      </div>

                    </div>
                    <div>
                      <div className="text-2xl sm:text-4xl lg:text-5xl font-black text-[var(--crm-text)] tracking-tighter relative z-10 truncate leading-none mb-2">{kpi.value}</div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between relative z-10 gap-1">
                        <span className="text-[7px] sm:text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-tighter leading-none">{kpi.label}</span>
                        <span className="text-[6px] sm:text-[8px] font-bold text-[var(--crm-text-muted)] opacity-50 italic hidden sm:block"></span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Pipeline Card */}
                <motion.section variants={itemVariants} className="glass-card p-5 sm:p-8 bg-[var(--crm-card-bg)] border border-[var(--crm-border)] relative overflow-hidden">
                  <h2 className="text-lg sm:text-2xl font-black text-[var(--crm-text)] flex items-center gap-2 mb-4 sm:mb-6">
                    <Target size={20} className="text-indigo-400" />
                    Sales Pipeline
                  </h2>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {pipelineData.map((item) => {
                      const phaseColors: Record<string, string> = {
                        'DISCOVERY': 'from-blue-500/10 to-cyan-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
                        'CONNECTED': 'from-teal-500/10 to-emerald-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
                        'NURTURING': 'from-purple-500/10 to-fuchsia-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
                        'QUALIFIED': 'from-indigo-500/10 to-violet-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
                        'WON': 'from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                        'LOST': 'from-rose-500/10 to-red-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
                        'INACTIVE': 'from-slate-500/10 to-gray-500/10 text-slate-500 dark:text-slate-400 border-white/10'
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
                <motion.section variants={itemVariants} className="glass-card p-5 sm:p-8 bg-[var(--crm-card-bg)] border border-[var(--crm-border)]">
                  <h2 className="text-lg sm:text-2xl font-black text-[var(--crm-text)] mb-4 sm:mb-6 flex items-center gap-2">
                    <Flame size={20} className="text-rose-500" />
                    Lead Temperature
                  </h2>
                  <div className="grid grid-cols-3 gap-3">
                    {healthData.map(item => {
                      const colors = item.label === 'HOT' ? 'from-rose-500/10 to-orange-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' :
                        item.label === 'WARM' ? 'from-amber-500/10 to-yellow-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                          'from-slate-500/10 to-indigo-500/10 text-slate-500 dark:text-slate-400 border-[var(--crm-border)]';
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
                    <p className="text-[10px] sm:text-xs font-bold text-[var(--crm-text-muted)]">Your pipeline is looking <span className="text-rose-400">Hot</span> today. Leads need follow-up.</p>
                  </div>
                </motion.section>
              </div>

              {/* Team Performance Table */}
              <motion.section variants={itemVariants} className="glass-card overflow-hidden">
                <div className="p-6 sm:p-10 border-b border-[var(--crm-border)] flex justify-between items-center bg-[var(--crm-bg)]/20">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-[var(--crm-text)]">Team Performance</h2>
                  </div>

                </div>
                <div className="overflow-x-auto">
                  {/* Desktop Table View */}
                  <table className="w-full text-left hidden md:table">
                    <thead>
                      <tr className="bg-[var(--crm-bg)]/20 text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest border-b border-[var(--crm-border)]">
                        <th className="py-5 px-10">Entity Name</th>
                        <th className="py-5 px-10 text-center">Assigned Leads</th>
                        <th className="py-5 px-10 text-center">Connected Till Date</th>
                        <th className="py-5 px-10 text-center">Connected Today</th>
                        <th className="py-5 px-10 text-center">Converted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamMetrics.map((item, idx) => (
                        <tr key={item.id || idx} className={`group hover:bg-[var(--crm-bg)]/20 transition-colors ${idx !== teamMetrics.length - 1 ? 'border-b border-[var(--crm-border)]' : ''}`}>
                          <td className="py-6 px-10">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-[var(--crm-bg)]/20 rounded-xl flex items-center justify-center font-black text-[var(--crm-text)] group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors shadow-sm">
                                {item.displayName?.charAt(0) || <UserCircle size={18} />}
                              </div>
                              <div>
                                <div className="font-extrabold text-[var(--crm-text)] group-hover:text-indigo-400 transition-colors uppercase text-xs tracking-tight">{item.displayName || 'Unknown Entity'}</div>
                                <div className="text-[10px] font-bold text-[var(--crm-text-muted)] lowercase">{item.email || 'No registry entry'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-6 px-10 text-center">
                            <div className="inline-flex px-4 py-2 rounded-xl bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] text-[var(--crm-text)] text-sm font-black transition-colors">
                              {item.totalAssigned}
                            </div>
                          </td>
                          <td className="py-6 px-10 text-center">
                            <div className="inline-flex px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-black transition-colors">
                              {item.connectedCount}
                            </div>
                          </td>
                          <td className="py-6 px-10 text-center">
                            <div className="inline-flex px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-black transition-colors">
                              {item.connectedTodayCount}
                            </div>
                          </td>
                          <td className="py-6 px-10 text-center">
                            <div className="inline-flex px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-black transition-colors">
                              {item.convertedCount}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Mobile Card List View */}
                  <div className="grid grid-cols-1 gap-4 p-4 md:hidden">
                    {teamMetrics.map((item, idx) => (
                      <div key={item.id || idx} className="p-5 rounded-3xl bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] flex flex-col gap-5 group active:bg-[var(--crm-bg)]/40 transition-all">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] rounded-xl flex items-center justify-center font-black text-indigo-400 shadow-sm text-sm">
                              {item.displayName?.charAt(0) || <UserCircle size={16} />}
                            </div>
                            <div>
                              <div className="font-extrabold text-[var(--crm-text)] text-xs uppercase tracking-tight">{item.displayName || 'Unknown'}</div>
                              <div className="text-[10px] font-bold text-[var(--crm-text-muted)] lowercase">{item.email}</div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 border-t border-[var(--crm-border)] pt-4">
                          <div className="px-3 py-2 rounded-xl bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] text-center flex flex-col items-center">
                            <span className="text-[10px] font-black uppercase text-[var(--crm-text-muted)] tracking-widest mb-0.5">Assigned</span>
                            <span className="text-sm font-black text-[var(--crm-text)]">{item.totalAssigned}</span>
                          </div>
                          <div className="px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-center flex flex-col items-center">
                            <span className="text-[10px] font-black uppercase text-orange-400/70 tracking-widest mb-0.5">Connected</span>
                            <span className="text-sm font-black text-orange-400">{item.connectedCount}</span>
                          </div>
                          <div className="px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-center flex flex-col items-center">
                            <span className="text-[10px] font-black uppercase text-cyan-400/70 tracking-widest mb-0.5">Today</span>
                            <span className="text-sm font-black text-cyan-400">{item.connectedTodayCount}</span>
                          </div>
                          <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center flex flex-col items-center">
                            <span className="text-[10px] font-black uppercase text-emerald-400/70 tracking-widest mb-0.5">Converted</span>
                            <span className="text-sm font-black text-emerald-400">{item.convertedCount}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {teamMetrics.length === 0 && !loading && (
                    <div className="py-20 text-center">
                      <LayoutDashboard className="mx-auto text-[var(--crm-border)] mb-4" size={48} />
                      <p className="font-bold text-[var(--crm-text-muted)] uppercase tracking-widest text-sm">No human resources found</p>
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
    </PageLayout>
  );
}
