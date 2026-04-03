import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Loader2, Users, BarChart3, ArrowRight, ExternalLink, Sparkles, Target, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useDemo } from './DemoContext';

export default function Analytics({ user }: { user: any }) {
  const { companyId } = useAuth();
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
      setLeads(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId, isDemoMode, demoData]);

  if (loading) {
    return (
      <div className="flex-1 bg-orange-50 flex items-center justify-center min-h-[100dvh]">
        <Loader2 className="animate-spin text-orange-500 w-12 h-12" />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50/50 min-h-screen overflow-y-auto">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-8 lg:p-12 space-y-12">
        
        {/* Header Section */}
        <header>
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 sm:space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">
              <BarChart3 size={14} className="animate-pulse" /> Strategic Intelligence Vector
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 leading-none">Lead Performance</h1>
            <p className="text-slate-500 font-medium max-w-2xl text-sm sm:text-base">Visualizing conversion probability and AI-driven match scores across your lead pipeline.</p>
          </motion.div>
        </header>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {leads.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="col-span-full glass-card !bg-transparent !border-dashed !border-slate-200 py-32 flex flex-col items-center justify-center text-center max-w-2xl mx-auto w-full"
              >
                <div className="w-24 h-24 bg-white border border-slate-200 rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-slate-200/20">
                  <Users size={40} className="text-slate-300" />
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Intelligence Void</h3>
                <p className="text-slate-500 font-medium max-w-sm">No lead data available for multi-vector analysis. Initialize new profiles to see performance metrics.</p>
                <Link to="/clients/new" className="mt-10 btn-primary">
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
                  className="glass-card group p-6 sm:p-8 flex flex-col relative overflow-hidden h-full ring-1 ring-slate-100 hover:ring-indigo-100 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-500"
                >
                  {/* Decorative Gradient Background */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-0 opacity-0 group-hover:opacity-60 transition-opacity"></div>

                  <div className="flex items-start gap-5 mb-10 relative z-10">
                    <div className="relative shrink-0">
                      <img
                        src={lead.avatar || `https://ui-avatars.com/api/?name=${lead.name}&background=random`}
                        alt={lead.name}
                        className="w-18 h-18 rounded-[1.5rem] object-cover ring-4 ring-white shadow-xl shadow-slate-200/40 group-hover:ring-indigo-50 transition-all duration-300"
                      />
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-full border-4 border-white shadow-md flex items-center justify-center" />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight truncate group-hover:text-indigo-600 transition-colors">{lead.name}</h3>
                      <div className="flex items-center gap-1.5 mt-2 bg-slate-50 w-fit px-3 py-1 rounded-lg border border-slate-100">
                        <ExternalLink size={12} className="text-slate-400" /> 
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">{lead.company}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 flex-1 relative z-10">
                    <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100 group-hover:bg-white transition-colors">
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2 text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">
                          <Target size={14} className="text-indigo-400 animate-pulse" /> Conversion AI
                        </div>
                        <span className="font-black text-indigo-600 text-lg">{lead.score || 0}%</span>
                      </div>
                      <div className="w-full bg-slate-200/40 h-3 rounded-full overflow-hidden shadow-inner relative">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${lead.score || 0}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1.2, ease: "circOut", delay: 0.2 + (index * 0.1) }}
                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                        />
                      </div>
                      <div className="flex justify-between mt-3 text-[9px] font-black text-slate-300 uppercase tracking-widest px-1">
                        <span>Low Fit</span>
                        <span>Prime Target</span>
                      </div>
                    </div>
                  </div>

                  <Link
                    to={`/analytics/${lead.id}`}
                    className="btn-primary w-full mt-8 shadow-lg shadow-indigo-100 group/btn relative overflow-hidden"
                  >
                    <Sparkles size={18} className="relative z-10 group-hover/btn:scale-110 transition-transform" />
                    <span className="relative z-10">Deep Dive Analysis</span>
                    <ArrowRight size={18} className="relative z-10 group-hover/btn:translate-x-1 transition-transform" />
                  </Link>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Security Footer */}
        <div className="text-center pt-10">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] flex items-center justify-center gap-3">
             Strategic Multi-Vector Processing Protocol v4.0
          </p>
        </div>

      </div>
    </div>
  );
}
