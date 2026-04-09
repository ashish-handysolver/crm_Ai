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
            <div className="w-48 h-6 bg-white/10 rounded-full"></div>
            <div className="w-64 sm:w-96 h-8 sm:h-12 bg-white/10 rounded-xl"></div>
            <div className="w-full max-w-2xl h-4 bg-white/10 rounded"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-[350px] sm:h-[400px] bg-white/5 rounded-[2.5rem]"></div>
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
              <BarChart3 size={14} className="animate-pulse" /> Strategic Intelligence Vector
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">Lead Performance</h1>
            <p className="text-slate-400 font-medium max-w-2xl text-sm sm:text-base leading-relaxed">Visualizing conversion probability and AI-driven match scores across your lead pipeline.</p>
          </motion.div>
        </header>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8">
          <AnimatePresence mode="popLayout">
            {leads.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="col-span-full glass-card !bg-transparent !border-dashed !border-white/20 py-20 sm:py-32 flex flex-col items-center justify-center text-center max-w-2xl mx-auto w-full px-4"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center mb-6 sm:mb-8 shadow-xl shadow-black/20">
                  <Users size={32} className="text-slate-500 sm:w-10 sm:h-10" />
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white mb-3 tracking-tight">Intelligence Void</h3>
                <p className="text-slate-400 font-medium max-w-sm text-sm sm:text-base">No lead data available for multi-vector analysis. Initialize new profiles to see performance metrics.</p>
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
                  className="glass-card !bg-slate-900/40 !border-white/10 group p-5 sm:p-6 lg:p-8 flex flex-col relative overflow-hidden h-full hover:bg-slate-900/60 hover:border-indigo-500/30 transition-all duration-500 shadow-xl"
                >
                  {/* Decorative Gradient Background */}
                  <div className="absolute top-0 right-0 w-32 h-32 sm:w-48 sm:h-48 bg-indigo-500/10 rounded-full blur-3xl -z-0 opacity-40 group-hover:opacity-100 group-hover:bg-indigo-500/20 transition-all duration-500 translate-x-1/3 -translate-y-1/3"></div>

                  <div className="flex items-center sm:items-start gap-4 sm:gap-5 mb-6 sm:mb-8 relative z-10">
                    <div className="relative shrink-0">
                      <img
                        src={lead.avatar || `https://ui-avatars.com/api/?name=${lead.name}&background=random`}
                        alt={lead.name}
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover ring-2 ring-white/10 shadow-xl group-hover:ring-indigo-500/30 transition-all duration-300"
                      />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-full border-2 sm:border-[3px] border-slate-900 shadow-md" />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-white tracking-tight truncate group-hover:text-indigo-400 transition-colors">{lead.name}</h3>
                      <div className="flex items-center gap-1.5 mt-1 sm:mt-1.5 w-fit max-w-full">
                        <ExternalLink size={12} className="text-slate-500 shrink-0" />
                        <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest truncate">{lead.company}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 flex-1 relative z-10 flex flex-col justify-end">
                    <div className="bg-black/20 rounded-2xl p-4 sm:p-5 border border-white/5 group-hover:border-white/10 transition-colors">
                      <div className="flex justify-between items-end mb-3">
                        <div className="flex items-center gap-2 text-slate-400 font-black uppercase tracking-[0.2em] text-[9px] sm:text-[10px]">
                          <Target size={14} className="text-indigo-400 animate-pulse" /> Conversion AI
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="font-black text-white text-xl sm:text-2xl leading-none">{lead.score || 0}</span>
                          <span className="font-bold text-slate-500 text-xs mb-0.5">%</span>
                        </div>
                      </div>
                      <div className="w-full bg-white/5 h-1.5 sm:h-2 rounded-full overflow-hidden shadow-inner relative">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${lead.score || 0}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1.2, ease: "circOut", delay: 0.2 + (index * 0.1) }}
                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                        />
                      </div>
                      <div className="flex justify-between mt-2.5 text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest">
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
