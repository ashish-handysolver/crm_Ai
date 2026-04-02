import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Loader2, Play, Search, Filter, Calendar, AudioWaveform, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useDemo } from './DemoContext';
import { motion, AnimatePresence } from 'motion/react';

export default function Reports({ user }: { user: any }) {
  const { companyId } = useAuth();
  const { isDemoMode, demoData } = useDemo();
  const [leads, setLeads] = useState<any[]>([]);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(!isDemoMode);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isDemoMode) {
      setLeads(demoData.leads);
      const formattedRecs = demoData.recordings.map(r => ({
        ...r,
        createdAt: { toMillis: () => r.createdAt.seconds * 1000 }
      }));
      setRecordings(formattedRecs);
      setLoading(false);
      return;
    }

    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubLeads = onSnapshot(
      query(collection(db, 'leads'), where('companyId', '==', companyId)),
      (snap) => {
        setLeads(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => console.error("Reports Leads Error:", error)
    );

    const unsubRecs = onSnapshot(
      query(collection(db, 'recordings'), where('companyId', '==', companyId)),
      (snap) => {
        let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRecordings(data);
        setLoading(false);
      },
      (error) => {
        console.error("Reports Recordings Error:", error);
        setLoading(false);
      }
    );

    return () => { unsubLeads(); unsubRecs(); };
  }, [companyId, isDemoMode, demoData]);

  const enrichedRecordings = recordings
    .map(rec => {
      const lead = leads.find(l => l.id === rec.meetingId || l.id === rec.leadId);
      return { ...rec, lead };
    })
    .filter(rec => {
      if (!searchTerm) return true;
      const lower = searchTerm.toLowerCase();
      const matchTranscript = rec.transcript?.toLowerCase().includes(lower);
      const matchLead = rec.lead?.name?.toLowerCase().includes(lower) || rec.lead?.company?.toLowerCase().includes(lower);
      return matchTranscript || matchLead;
    })
    .sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    });

  if (loading) {
    return (
      <div className="flex-1 bg-orange-50 flex items-center justify-center min-h-[100dvh]">
        <Loader2 className="animate-spin text-orange-500 w-12 h-12" />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-orange-50 text-black p-4 sm:p-6 lg:p-10 min-h-full">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100/50 text-orange-600 text-[10px] font-bold uppercase tracking-widest mb-3 border border-orange-200/50">
              <AudioWaveform size={14} /> Intelligence
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-black">Call Recordings</h1>
          </motion.div>
        </header>

        {/* Filters */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} delay={0.1} className="bg-orange-50 rounded-2xl border border-orange-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] p-4 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full max-w-lg group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search transcripts or client name..."
              className="w-full pl-12 pr-4 py-3 bg-orange-50 hover:bg-orange-50 border border-orange-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all placeholder:text-slate-400 text-slate-700"
            />
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 border border-orange-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-orange-50 hover:border-orange-300 transition-all">
              <Filter size={16} /> Filter
            </button>
          </div>
        </motion.div>

        {/* Grouping / List */}
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {enrichedRecordings.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="text-center py-24 bg-orange-50 rounded-[2.5rem] border-2 border-dashed border-orange-200 shadow-sm max-w-2xl mx-auto w-full"
              >
                <div className="w-20 h-20 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Search className="text-slate-300" size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-700 mb-2">No Reports Found</h3>
                <p className="text-slate-500 font-medium">Try adjusting your search or check back later after uploading new intelligence.</p>
              </motion.div>
            ) : (
              enrichedRecordings.map((rec, index) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
                  key={rec.id}
                  className="bg-orange-50 rounded-[2rem] border border-orange-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden flex flex-col lg:flex-row group hover:border-orange-100 transition-colors relative"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-orange-400 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                  {/* Left info column */}
                  <div className="p-6 md:p-8 lg:w-[35%] bg-gradient-to-br from-slate-50 to-white border-b lg:border-b-0 lg:border-r border-orange-100 flex flex-col justify-between relative z-10">
                    <div>
                      {rec.lead ? (
                        <div className="flex items-center gap-4 mb-6">
                          <img src={rec.lead.avatar || `https://ui-avatars.com/api/?name=${rec.lead.name}&background=random`} alt="" className="w-14 h-14 rounded-2xl object-cover ring-4 ring-white shadow-sm" />
                          <div>
                            <h3 className="font-extrabold text-lg text-black">{rec.lead.name}</h3>
                            <div className="text-xs font-semibold text-slate-500 mt-0.5 max-w-[200px] truncate bg-orange-100 px-2 py-0.5 rounded-md inline-flex">{rec.lead.company} {rec.lead.location ? `• ${rec.lead.location}` : ''}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 mb-6 opacity-80">
                          <div className="w-14 h-14 rounded-2xl bg-slate-200/60 flex items-center justify-center text-slate-400 font-black text-xl shadow-inner">?</div>
                          <div>
                            <h3 className="font-extrabold text-lg text-slate-700">Unassigned Call</h3>
                            <div className="text-xs font-semibold text-slate-400 mt-0.5">No bound client</div>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mb-8">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-orange-50 border border-orange-200 py-1.5 px-3 rounded-lg shadow-sm">
                          <Calendar size={14} className="text-slate-400" />
                          {rec.createdAt?.toDate ? rec.createdAt.toDate().toLocaleString(undefined, { dateStyle: 'medium' }) : 'Unknown Date'}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-orange-50 border border-orange-200 py-1.5 px-3 rounded-lg shadow-sm">
                          <Clock size={14} className="text-slate-400" />
                          {rec.createdAt?.toDate ? rec.createdAt.toDate().toLocaleString(undefined, { timeStyle: 'short' }) : 'Unknown Time'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto">
                      <Link to={`/r/${rec.id}`} className="w-full bg-black text-white py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-gradient-to-r hover:from-orange-500 hover:to-orange-600 transition-all shadow-lg shadow-black/10 active:scale-[0.98] group/btn overflow-hidden relative">
                        <div className="absolute inset-0 bg-orange-50/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 ease-out"></div>
                        <Play size={14} className="fill-current relative z-10 group-hover/btn:scale-110 transition-transform" />
                        <span className="relative z-10">Play Audio / Open</span>
                      </Link>
                    </div>
                  </div>

                  {/* Right transcript column */}
                  <div className="p-6 md:p-8 flex-1 flex flex-col relative bg-orange-50">
                    <div className="absolute top-8 right-8 text-9xl text-slate-50 font-serif leading-none italic pointer-events-none select-none -translate-y-4">"</div>
                    <div className="text-[10px] font-bold text-orange-400 tracking-widest uppercase mb-4 flex items-center gap-2 relative z-10">
                      <AudioWaveform size={14} /> Snippet Preview
                    </div>
                    <div className="flex-1 bg-orange-50/50 rounded-2xl p-6 border border-orange-100 relative z-10 group-hover:bg-orange-50 transition-colors">
                      <p className="text-sm md:text-base text-slate-600 italic line-clamp-4 leading-relaxed font-medium">
                        "{rec.transcript}"
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
