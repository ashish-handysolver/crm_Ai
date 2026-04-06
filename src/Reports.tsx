import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Loader2, Play, Search, Filter, Calendar, AudioWaveform, Clock, Sparkles, ShieldCheck } from 'lucide-react';
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
    <div className="flex-1 bg-slate-50/50 min-h-screen overflow-y-auto">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-8 lg:p-12 space-y-6 sm:space-y-10">

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">
              <AudioWaveform size={14} className="animate-pulse" /> Archive Intelligence
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-900 leading-tight">Call Intelligence</h1>
            <p className="text-slate-500 font-medium max-w-2xl">Access all captured conversation data and AI-generated insights across your client portfolio.</p>
          </motion.div>
        </header>

        {/* Filters & Tools */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card !bg-white/80 p-4 sm:p-5 flex flex-col lg:flex-row items-center justify-between gap-6"
        >
          <div className="relative w-full max-w-2xl group">
            <div className="absolute inset-y-0 left-0 pl-4 sm:pl-5 flex items-center pointer-events-none">
              <Search className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full pl-11 sm:pl-14 pr-4 sm:pr-6 py-3 sm:py-4 bg-slate-50 hover:bg-white border border-slate-200 rounded-2xl text-sm sm:text-base font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all placeholder:text-slate-300 text-slate-700 shadow-inner"
            />
          </div>
          <div className="flex gap-4 w-full lg:w-auto">
            <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 sm:gap-3 px-6 py-3 sm:px-8 sm:py-4 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-black text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95">
              <Filter size={18} /> Refine Logic
            </button>
            {/* Additional reporting tools can be added here */}
          </div>
        </motion.div>

        {/* Intelligence Ledger */}
        <div className="space-y-8">
          <AnimatePresence mode="popLayout">
            {enrichedRecordings.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="glass-card !bg-transparent !border-dashed !border-slate-200 py-32 flex flex-col items-center justify-center text-center max-w-3xl mx-auto w-full"
              >
                <div className="w-24 h-24 bg-white border border-slate-200 rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-slate-200/20 translate-y-0 group-hover:-translate-y-2 transition-transform">
                  <Search className="text-slate-300" size={40} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Zero Matches Found</h3>
                <p className="text-slate-500 font-medium max-w-sm">No intelligence reports match your current search parameters. Adjust your filters or explore new data.</p>
              </motion.div>
            ) : (
              enrichedRecordings.map((rec, index) => (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, type: 'spring', stiffness: 200, damping: 25 }}
                  key={rec.id}
                  className="glass-card group flex flex-col lg:flex-row relative overflow-hidden h-full ring-1 ring-slate-100 hover:ring-indigo-100 transition-all duration-500"
                >
                  {/* Visual Accent */}
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 to-violet-600 opacity-80 group-hover:opacity-100 transition-opacity"></div>

                  {/* Client Context Partition */}
                  <div className="p-5 sm:p-8 lg:p-10 lg:w-[40%] bg-slate-50/30 border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col justify-between relative">
                    <div className="space-y-8">
                      {rec.lead ? (
                        <div className="flex items-center gap-5">
                          <div className="relative">
                            <img
                              src={rec.lead.avatar || `https://ui-avatars.com/api/?name=${rec.lead.name}&background=random`}
                              alt={rec.lead.name}
                              className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl object-cover ring-2 sm:ring-4 ring-white shadow-xl shadow-slate-200/40"
                            />
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-500 border-2 sm:border-4 border-white shadow-sm" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-black text-lg sm:text-xl text-slate-900 tracking-tight truncate">{rec.lead.name}</h3>
                            <div className="text-[10px] sm:text-xs font-black text-indigo-500 mt-0.5 sm:mt-1 uppercase tracking-widest truncate flex items-center gap-1.5 sm:gap-2">
                              <Sparkles size={12} className="animate-pulse" /> {rec.lead.company}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-5 opacity-60">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-slate-200/50 flex items-center justify-center text-slate-400 font-black text-xl sm:text-2xl shadow-inner border border-slate-200">?</div>
                          <div>
                            <h3 className="font-extrabold text-lg sm:text-xl text-slate-700 tracking-tight">Unlinked Session</h3>
                            <div className="text-[10px] sm:text-xs font-bold text-slate-400 mt-0.5 sm:mt-1 uppercase tracking-widest">Isolated Discovery</div>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 bg-white border border-slate-200 py-2 px-4 rounded-xl shadow-sm uppercase tracking-widest">
                          <Calendar size={14} className="text-indigo-400" />
                          {rec.createdAt?.toDate ? rec.createdAt.toDate().toLocaleString(undefined, { dateStyle: 'medium' }) : 'Alpha Log'}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 bg-white border border-slate-200 py-2 px-4 rounded-xl shadow-sm uppercase tracking-widest">
                          <Clock size={14} className="text-indigo-400" />
                          {rec.createdAt?.toDate ? rec.createdAt.toDate().toLocaleString(undefined, { timeStyle: 'short' }) : '00:00'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-12">
                      <Link
                        to={`/r/${rec.id}`}
                        className="btn-primary w-full shadow-lg shadow-indigo-100 group/btn"
                      >
                        <Play size={18} className="fill-current group-hover/btn:scale-110 transition-transform" />
                        <span>Analysis Terminal</span>
                      </Link>
                    </div>
                  </div>

                  {/* Intelligence Manifest column */}
                  <div className="p-5 sm:p-8 lg:p-12 flex-1 flex flex-col relative bg-white/40">
                    <div className="absolute top-4 right-4 sm:top-8 sm:right-10 text-[6rem] sm:text-[10rem] text-indigo-500/5 font-serif leading-none italic pointer-events-none select-none">"</div>

                    <div className="space-y-6 relative z-10">
                      <div className="inline-flex items-center gap-2 text-[10px] font-black text-indigo-400 tracking-[0.2em] uppercase bg-indigo-50/50 px-3 py-1.5 rounded-lg border border-indigo-100">
                        <Sparkles size={14} /> Semantic Snapshot
                      </div>

                      <div className="relative group/transcript">
                        <div className="absolute -inset-4 bg-indigo-50/30 rounded-[2.5rem] opacity-0 group-hover/transcript:opacity-100 transition-opacity pointer-events-none blur-xl"></div>
                        <p className="text-sm sm:text-lg md:text-xl text-slate-600 italic leading-relaxed font-medium relative z-10 line-clamp-3">
                          "{rec.transcript}"
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-6 border-t border-slate-100">
                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        </div>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">AI Confidence Monitor: Active</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Secure Ledger Badge */}
        <div className="flex justify-center pt-10">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] flex items-center gap-3">
            <ShieldCheck size={14} /> Enterprise Audit Protocol v4.0.2 - Standard Secured
          </p>
        </div>
      </div>
    </div>
  );
}
