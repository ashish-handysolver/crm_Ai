import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Loader2, Users, BarChart3, ArrowRight, ExternalLink, Sparkles, Target, Plus, Activity, TrendingUp, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useDemo } from './DemoContext';

export default function Analytics({ user }: { user: any }) {
  const { companyId, role } = useAuth();
  const { isDemoMode, demoData } = useDemo();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(!isDemoMode);

  useEffect(() => {
    if (isDemoMode) {
      setLeads(demoData.leads);
      setLoading(false);
      return;
    }

    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'leads'), where('companyId', '==', companyId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const filtered = role === 'team_member'
        ? data.filter((l: any) => l.assignedTo === user.uid || l.authorUid === user.uid)
        : data;
      setLeads(filtered);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId, isDemoMode, demoData]);

  const avgScore = leads.length > 0 ? Math.round(leads.reduce((acc, lead) => acc + (lead.score || 0), 0) / leads.length) : 0;
  const primeTargets = leads.filter(l => (l.score || 0) >= 70).length;
  const warmTargets = leads.filter(l => (l.score || 0) >= 40 && (l.score || 0) < 70).length;
  const lowFitTargets = leads.filter(l => (l.score || 0) < 40).length;
  const hotLeads = leads.filter(l => (l.health || 'WARM').toUpperCase() === 'HOT').length;
  const topLeads = [...leads].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 4);
  const scoreLabel = avgScore >= 70 ? 'Strong pipeline' : avgScore >= 40 ? 'Needs nurturing' : 'Needs attention';
  const scoreTone = avgScore >= 70 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : avgScore >= 40 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  const softPanelClass = 'rounded-[1.6rem] border border-[var(--crm-border)] bg-[var(--crm-control-bg)] shadow-[0_10px_30px_-24px_rgba(15,23,42,0.45)]';
  const raisedCardClass = 'glass-card !rounded-[2rem] border border-[var(--crm-border)] bg-[var(--crm-card-bg)] shadow-[0_18px_45px_-32px_rgba(15,23,42,0.38)]';
  const subtleBadgeClass = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-500 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm';

  const getScoreTone = (score: number) => {
    if (score >= 70) return 'from-emerald-500 to-teal-500 text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
    if (score >= 40) return 'from-amber-500 to-yellow-500 text-amber-400 border-amber-500/20 bg-amber-500/10';
    return 'from-rose-500 to-red-500 text-rose-400 border-rose-500/20 bg-rose-500/10';
  };

  const statCards = [
    { label: 'Tracked Leads', value: leads.length, icon: <Users size={18} />, tone: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
    { label: 'Average Score', value: `${avgScore}%`, icon: <Target size={18} />, tone: scoreTone },
    { label: 'Prime Targets', value: primeTargets, icon: <Sparkles size={18} />, tone: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Hot Leads', value: hotLeads, icon: <Zap size={18} />, tone: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  ];

  if (loading) {
    return (
      <div className="flex-1 bg-transparent min-h-screen overflow-y-auto">
        <div className="max-w-[1400px] mx-auto p-4 sm:p-8 lg:p-12 space-y-8 sm:space-y-12 animate-pulse">
          <div className="space-y-3 sm:space-y-4">
            <div className="w-48 h-6 bg-[var(--crm-bg)]/20 rounded-full"></div>
            <div className="w-64 sm:w-96 h-8 sm:h-12 bg-[var(--crm-bg)]/20 rounded-xl"></div>
            <div className="w-full max-w-2xl h-4 bg-[var(--crm-bg)]/20 rounded"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-[350px] sm:h-[400px] bg-[var(--crm-card-bg)] rounded-[2.5rem]"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-transparent min-h-full overflow-y-auto">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-8 lg:p-12 space-y-6 sm:space-y-8">

        {/* Header Section */}
        <header>
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className={`${raisedCardClass} p-5 sm:p-7 overflow-hidden`}>
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
              <div className="space-y-3">
                <div className={subtleBadgeClass}>
                  <BarChart3 size={14} /> Lead Performance
                </div>
                <div>
                  <h2 className="text-2xl sm:text-4xl font-black text-[var(--crm-text)] tracking-tight">Analytics</h2>
                  <p className="mt-2 text-sm sm:text-base font-medium text-[var(--crm-text-muted)] max-w-2xl">
                    Track conversion score, lead temperature, and the accounts worth immediate follow-up.
                  </p>
                </div>
              </div>

              <div className={`rounded-2xl border px-4 py-3 text-left lg:text-right ${scoreTone}`}>
                <div className="text-[9px] font-black uppercase tracking-widest opacity-80">Pipeline Health</div>
                <div className="text-lg font-black text-[var(--crm-text)]">{scoreLabel}</div>
                <div className="text-xs font-bold opacity-80">{avgScore}% average score</div>
              </div>
            </div>
          </motion.div>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {statCards.map((stat) => (
            <div key={stat.label} className={`${raisedCardClass} !rounded-[1.6rem] p-4 sm:p-5`}>
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${stat.tone}`}>
                {stat.icon}
              </div>
              <div className="text-2xl sm:text-3xl font-black text-[var(--crm-text)] leading-none">{stat.value}</div>
              <div className="mt-2 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[var(--crm-text-muted)]">{stat.label}</div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 sm:gap-6">
          <div className={`${raisedCardClass} p-5 sm:p-6`}>
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-[var(--crm-text)]">Score Distribution</h3>
                <p className="text-xs sm:text-sm font-medium text-[var(--crm-text-muted)]">How your leads are spread by conversion fit.</p>
              </div>
              <TrendingUp className="text-indigo-400 shrink-0" size={22} />
            </div>
            <div className={`${softPanelClass} space-y-4 p-4 sm:p-5`}>
              {[
                { label: 'Prime', count: primeTargets, color: 'bg-emerald-500', text: 'text-emerald-400' },
                { label: 'Nurture', count: warmTargets, color: 'bg-amber-500', text: 'text-amber-400' },
                { label: 'Low fit', count: lowFitTargets, color: 'bg-rose-500', text: 'text-rose-400' },
              ].map((item) => {
                const pct = leads.length ? Math.round((item.count / leads.length) * 100) : 0;
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest mb-2">
                      <span className={item.text}>{item.label}</span>
                      <span className="text-[var(--crm-text-muted)]">{item.count} leads</span>
                    </div>
                    <div className="h-3 rounded-full bg-[var(--crm-control-bg)] border border-[var(--crm-border)] overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`${raisedCardClass} p-5 sm:p-6`}>
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-[var(--crm-text)]">Priority Leads</h3>
                <p className="text-xs sm:text-sm font-medium text-[var(--crm-text-muted)]">Highest scoring accounts right now.</p>
              </div>
              <Activity className="text-cyan-400 shrink-0" size={22} />
            </div>
            <div className="space-y-3">
              {topLeads.map((lead) => (
                <Link key={lead.id} to={`/analytics/${lead.id}`} className={`${softPanelClass} flex items-center gap-3 p-3 hover:bg-[var(--crm-control-hover-bg)] transition-all`}>
                  <img
                    src={lead.avatar || `https://ui-avatars.com/api/?name=${lead.name}&background=random`}
                    alt={lead.name}
                    className="w-10 h-10 rounded-xl object-cover border border-[var(--crm-border)]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-black text-[var(--crm-text)] truncate">{lead.name}</div>
                    <div className="text-[10px] font-bold text-[var(--crm-text-muted)] uppercase tracking-widest truncate">{lead.company || 'No company'}</div>
                  </div>
                  <div className="text-sm font-black text-[var(--crm-text)]">{lead.score || 0}%</div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          <AnimatePresence mode="popLayout">
            {leads.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="col-span-full glass-card !bg-transparent !border-dashed !border-[var(--crm-border)] py-16 sm:py-24 flex flex-col items-center justify-center text-center max-w-2xl mx-auto w-full px-4"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[var(--crm-control-bg)] border border-[var(--crm-border)] rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-black/10">
                  <Users size={32} className="text-[var(--crm-text-muted)] sm:w-10 sm:h-10" />
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-[var(--crm-text)] mb-3 tracking-tight">No analytics yet</h3>
                <p className="text-[var(--crm-text-muted)] font-medium max-w-sm text-sm sm:text-base">Add a few leads and HandyCRM will show scores, priority accounts, and pipeline health here.</p>
                <Link to="/clients/new" className="mt-8 sm:mt-10 btn-primary">
                  <Plus size={18} /> Add Leads
                </Link>
              </motion.div>
            ) : (
              leads.map((lead, index) => (
                <motion.div
                  key={lead.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, type: 'spring', stiffness: 200, damping: 25 }}
                  className="group flex h-full flex-col overflow-hidden p-4 sm:p-5 lg:p-6 transition-all duration-500 hover:border-indigo-500/30 hover:bg-[var(--crm-hover-bg)]"
                  style={{
                    background: 'linear-gradient(180deg, var(--crm-card-bg) 0%, color-mix(in srgb, var(--crm-card-bg) 88%, white 12%) 100%)',
                    border: '1px solid var(--crm-border)',
                    borderRadius: '2rem',
                    boxShadow: '0 20px 42px -30px rgba(15, 23, 42, 0.35)',
                  }}
                >
                  <div className="flex items-center sm:items-start gap-3 sm:gap-4 mb-5 sm:mb-6 relative z-10">
                    <div className="relative shrink-0">
                      <img
                        src={lead.avatar || `https://ui-avatars.com/api/?name=${lead.name}&background=random`}
                        alt={lead.name}
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover ring-2 ring-[var(--crm-border)] shadow-xl group-hover:ring-indigo-500/30 transition-all duration-300"
                      />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-full border-2 sm:border-[3px] border-[var(--crm-bg)] shadow-md" />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <h3 className="text-base sm:text-lg lg:text-xl font-black text-[var(--crm-text)] tracking-tight truncate group-hover:text-indigo-400 transition-colors">{lead.name}</h3>
                      <div className="flex items-center gap-1.5 mt-1 sm:mt-1.5 w-fit max-w-full">
                        <ExternalLink size={12} className="text-[var(--crm-text-muted)] shrink-0" />
                        <span className="text-[10px] sm:text-xs font-bold text-[var(--crm-text-muted)] uppercase tracking-widest truncate">{lead.company || 'No company'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5 flex-1 relative z-10 flex flex-col justify-end">
                    <div className={`${softPanelClass} p-4 group-hover:border-[var(--crm-border)]/60 transition-colors`}>
                      <div className="flex justify-between items-end mb-3">
                        <div className="flex items-center gap-2 text-[var(--crm-text-muted)] font-black uppercase tracking-[0.2em] text-[10px]">
                          <Target size={14} className="text-indigo-400 animate-pulse" /> Conversion AI
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="font-black text-[var(--crm-text)] text-xl sm:text-2xl leading-none">{lead.score || 0}</span>
                          <span className="font-bold text-[var(--crm-text-muted)] text-xs mb-0.5">%</span>
                        </div>
                      </div>
                      <div className="relative h-1.5 w-full overflow-hidden rounded-full border border-[var(--crm-border)] bg-[var(--crm-bg)]/8 shadow-inner sm:h-2">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${lead.score || 0}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1.2, ease: "circOut", delay: 0.2 + (index * 0.1) }}
                          className={`absolute top-0 left-0 h-full bg-gradient-to-r ${getScoreTone(lead.score || 0).split(' ').slice(0, 2).join(' ')} rounded-full`}
                        />
                      </div>
                      <div className="flex justify-between mt-2.5 text-[8px] sm:text-[9px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest">
                        <span>Low Fit</span>
                        <span>Prime Target</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest ${getScoreTone(lead.score || 0).split(' ').slice(2).join(' ')}`}>
                        {(lead.health || 'WARM').toUpperCase()}
                      </div>
                      <div className={`${softPanelClass} rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--crm-text-muted)] truncate`}>
                        {lead.phase || 'DISCOVERY'}
                      </div>
                    </div>
                  </div>

                  <Link
                    to={`/analytics/${lead.id}`}
                    className="w-full mt-5 px-4 py-3.5 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-2xl font-black text-[11px] sm:text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 border border-indigo-500/20 hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/20 active:scale-95 group/btn relative z-10"
                  >
                    <Sparkles size={16} className="group-hover/btn:animate-pulse" />
                    <span>Deep Dive Analysis</span>
                    <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                  </Link>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
