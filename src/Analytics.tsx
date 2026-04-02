import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Loader2, Users, BarChart3, ArrowRight, ExternalLink, Sparkles, Target } from 'lucide-react';
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
      <div className="flex-1 bg-slate-50 flex items-center justify-center min-h-[100dvh]">
        <Loader2 className="animate-spin text-indigo-500 w-12 h-12" />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-10 min-h-full">
      <div className="max-w-[1400px] mx-auto">
        <header className="mb-10 md:mb-14">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-100/50 text-pink-600 text-[10px] font-bold uppercase tracking-widest mb-3 border border-pink-200/50">
              <BarChart3 size={14} /> Advanced Metrics
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-3">Lead Analytics</h1>

          </motion.div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          <AnimatePresence mode="popLayout">
            {leads.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="col-span-full py-24 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200/60 text-center flex flex-col items-center justify-center max-w-2xl mx-auto w-full"
              >
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                  <Users size={40} className="text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-700 mb-2">No Active Leads</h3>
                <p className="text-slate-500 font-medium max-w-sm">There are no leads available to analyze. Add a new prospect to begin building insights.</p>
                <Link to="/clients/new" className="mt-8 px-6 py-3 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition-colors">
                  Import Leads
                </Link>
              </motion.div>
            ) : (
              leads.map((lead, index) => (
                <motion.div
                  key={lead.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, type: 'spring', stiffness: 200, damping: 20 }}
                  className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:border-indigo-100/80 transition-all group flex flex-col relative overflow-hidden h-full"
                >
                  <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-indigo-50/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

                  <div className="flex items-start gap-4 mb-8 relative z-10">
                    <div className="relative shrink-0">
                      <img
                        src={lead.avatar || `https://ui-avatars.com/api/?name=${lead.name}&background=random`}
                        alt={lead.name}
                        className="w-16 h-16 rounded-[1.25rem] object-cover ring-4 ring-slate-50 group-hover:ring-white group-hover:shadow-lg group-hover:shadow-indigo-500/20 transition-all duration-300"
                      />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <h3 className="text-xl font-black text-slate-900 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-indigo-600 group-hover:to-purple-600 transition-all truncate tracking-tight">{lead.name}</h3>
                      <p className="text-slate-500 text-sm font-semibold flex items-center gap-1.5 mt-0.5 truncate bg-slate-50 w-fit px-2 py-0.5 rounded-md">
                        <ExternalLink size={12} className="shrink-0" /> <span className="truncate">{lead.company}</span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-5 flex-1 relative z-10">
                    <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
                      <div className="flex justify-between items-center text-sm mb-3">
                        <span className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                          <Target size={12} className="text-indigo-400" /> Prediction Score
                        </span>
                        <span className="font-extrabold text-indigo-600 text-base">{lead.score || 0}%</span>
                      </div>
                      <div className="w-full bg-slate-200/50 h-2.5 rounded-full overflow-hidden shadow-inner relative">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${lead.score || 0}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1, delay: 0.2 + (index * 0.1) }}
                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                        />
                      </div>
                    </div>
                  </div>

                  <Link
                    to={`/analytics/${lead.id}`}
                    className="w-full mt-6 bg-slate-900 group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-slate-900/10 group-hover:shadow-indigo-500/25 active:scale-[0.98] relative overflow-hidden z-10"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                    <Sparkles size={16} className="relative z-10" />
                    <span className="relative z-10">View Full Insights</span>
                    <ArrowRight size={16} className="relative z-10 group-hover:translate-x-1 transition-transform" />
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
