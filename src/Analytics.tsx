import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Loader2, Users, BarChart3, ArrowRight, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

export default function Analytics({ user }: { user: any }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'leads'), where('ownerUid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLeads(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return (
      <div className="flex-1 bg-[#f8fafc] flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-slate-300 w-12 h-12" />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#f8fafc] text-slate-900 p-8 min-h-screen">
      <div className="max-w-[1400px] mx-auto">
        <header className="mb-10">
          <div className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-1 flex items-center gap-2">
            <BarChart3 size={14} className="text-indigo-500" /> Advanced Metrics
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Lead Analytics Portal</h1>
          <p className="text-slate-500 mt-2 text-lg">Gain deep behavioral insights into your lead network.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {leads.length === 0 ? (
            <div className="col-span-full py-20 bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm text-center">
              <Users size={48} className="text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No leads found to analyze yet.</p>
            </div>
          ) : (
            leads.map((lead, index) => (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200/60 hover:shadow-xl hover:shadow-indigo-500/5 transition-all group"
              >
                <div className="flex items-center gap-4 mb-8">
                  <div className="relative">
                    <img
                      src={lead.avatar || `https://ui-avatars.com/api/?name=${lead.name}&background=random`}
                      alt={lead.name}
                      className="w-16 h-16 rounded-2xl object-cover ring-4 ring-slate-50 group-hover:ring-indigo-50 transition-all"
                    />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white shadow-sm" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{lead.name}</h3>
                    <p className="text-slate-500 font-medium flex items-center gap-1.5">
                      <ExternalLink size={12} /> {lead.company}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-slate-50">
                   <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Prediction Score</span>
                      <span className="font-bold text-indigo-600">{lead.score}%</span>
                   </div>
                   <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${lead.score}%` }} />
                   </div>
                </div>

                <Link
                  to={`/analytics/${lead.id}`}
                  className="w-full mt-8 bg-slate-950 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 group-hover:bg-indigo-600 transition-all shadow-lg shadow-slate-900/10 active:scale-[0.98]"
                >
                  View Full Insights <ArrowRight size={16} />
                </Link>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
