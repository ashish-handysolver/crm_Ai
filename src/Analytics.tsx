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
    <div className="flex-1 bg-transparent min-h-screen overflow-y-auto">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-8 lg:p-12 space-y-8 sm:space-y-12">

        {/* Header Section */}
        <header className="mb-6 sm:mb-10">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 sm:space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">
              <BarChart3 size={14} className="animate-pulse" /> Lead Performance
            </div>
          </motion.div>
        </header>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8">
          <AnimatePresence mode="popLayout">
            {leads.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="col-span-full glass-card !bg-transparent !border-dashed !border-[var(--crm-border)] py-20 sm:py-32 flex flex-col items-center justify-center text-center max-w-2xl mx-auto w-full px-4"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] rounded-3xl flex items-center justify-center mb-6 sm:mb-8 shadow-xl shadow-black/20">
                  <Users size={32} className="text-[var(--crm-text-muted)] sm:w-10 sm:h-10" />
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-[var(--crm-text)] mb-3 tracking-tight">Intelligence Void</h3>
                <p className="text-[var(--crm-text-muted)] font-medium max-w-sm text-sm sm:text-base">No lead data available for multi-vector analysis. Initialize new profiles to see performance metrics.</p>
                <Link to="/clients/new" className="mt-8 sm:mt-10 btn-primary">
                  <Plus size={18} /> Initialize Leads
                </Link>
              </motion.div>
            ) : (
              leads.map((lead, index) => (
                <motion.div
                  key={lead.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, type: 'spring', stiffness: 200, damping: 25 }}
                  className="glass-card !bg-[var(--crm-card-bg)] !border-[var(--crm-border)] group p-5 sm:p-6 lg:p-8 flex flex-col relative overflow-hidden h-full hover:bg-[var(--crm-border)] hover:border-indigo-500/30 transition-all duration-500 shadow-xl"
                >
                  {/* Decorative Gradient Background */}
                  <div className="absolute top-0 right-0 w-32 h-32 sm:w-48 sm:h-48 bg-indigo-500/10 rounded-full blur-3xl -z-0 opacity-40 group-hover:opacity-100 group-hover:bg-indigo-500/20 transition-all duration-500 translate-x-1/3 -translate-y-1/3"></div>

                  <div className="flex items-center sm:items-start gap-4 sm:gap-5 mb-6 sm:mb-8 relative z-10">
                    <div className="relative shrink-0">
                      <img
                        src={lead.avatar || `https://ui-avatars.com/api/?name=${lead.name}&background=random`}
                        alt={lead.name}
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover ring-2 ring-[var(--crm-border)] shadow-xl group-hover:ring-indigo-500/30 transition-all duration-300"
                      />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-full border-2 sm:border-[3px] border-[var(--crm-bg)] shadow-md" />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-[var(--crm-text)] tracking-tight truncate group-hover:text-indigo-400 transition-colors">{lead.name}</h3>
                      <div className="flex items-center gap-1.5 mt-1 sm:mt-1.5 w-fit max-w-full">
                        <ExternalLink size={12} className="text-slate-500 shrink-0" />
                        <span className="text-[10px] sm:text-xs font-bold text-[var(--crm-text-muted)] uppercase tracking-widest truncate">{lead.company}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 flex-1 relative z-10 flex flex-col justify-end">
                    <div className="bg-[var(--crm-bg)]/20 rounded-2xl p-4 sm:p-5 border border-[var(--crm-border)] group-hover:border-[var(--crm-border)]/40 transition-colors">
                      <div className="flex justify-between items-end mb-3">
                        <div className="flex items-center gap-2 text-[var(--crm-text-muted)] font-black uppercase tracking-[0.2em] text-[10px]">
                          <Target size={14} className="text-indigo-400 animate-pulse" /> Conversion AI
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="font-black text-[var(--crm-text)] text-xl sm:text-2xl leading-none">{lead.score || 0}</span>
                          <span className="font-bold text-[var(--crm-text-muted)] text-xs mb-0.5">%</span>
                        </div>
                      </div>
                      <div className="w-full bg-[var(--crm-bg)]/20 h-1.5 sm:h-2 rounded-full overflow-hidden shadow-inner relative">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${lead.score || 0}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1.2, ease: "circOut", delay: 0.2 + (index * 0.1) }}
                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                        />
                      </div>
                      <div className="flex justify-between mt-2.5 text-[8px] sm:text-[9px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest">
                        <span>Low Fit</span>
                        <span>Prime Target</span>
                      </div>
                    </div>
                  </div>

                  <Link
                    to={`/analytics/${lead.id}`}
                    className="w-full mt-5 sm:mt-8 px-4 py-3.5 sm:py-4 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-2xl font-black text-[11px] sm:text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 border border-indigo-500/20 hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/20 active:scale-95 group/btn relative z-10"
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
