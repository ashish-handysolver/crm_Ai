import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Loader2, Play, Search, Filter, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Reports({ user }: { user: any }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const unsubLeads = onSnapshot(
      query(collection(db, 'leads'), where('ownerUid', '==', user.uid)),
      (snap) => {
        setLeads(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => {
        console.error("Reports Leads Error:", error);
      }
    );

    const unsubRecs = onSnapshot(
      query(collection(db, 'recordings'), where('authorUid', '==', user.uid)),
      (snap) => {
        let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Reports: Recordings fetched raw:", data.length);
        data = data.filter(d => (d as any).authorUid === user.uid || !(d as any).authorUid);
        console.log("Reports: Recordings filtered:", data.length, "User UID:", user?.uid);
        setRecordings(data);
        setLoading(false);
      },
      (error) => {
        console.error("Reports Recordings Error:", error);
        setLoading(false);
      }
    );

    return () => { unsubLeads(); unsubRecs(); };
  }, [user]);

  const enrichedRecordings = recordings
    .map(rec => {
      // Handles both correct schema 'leadId' and loophole 'meetingId'
      const lead = leads.find(l => l.id === rec.meetingId || l.id === rec.leadId);
      return { ...rec, lead };
    })
    .sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    });

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
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-1">Intelligence</div>
            <h1 className="text-3xl font-bold tracking-tight">Call Reports</h1>
          </div>
        </header>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 mb-6 flex items-center justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search transcripts or client name..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4256]/20 transition-all placeholder:text-slate-400"
              />
            </div>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">
                <Filter size={16} /> Filter
              </button>
            </div>
        </div>

        {/* Grouping / List */}
        <div className="space-y-4">
          {enrichedRecordings.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-slate-500 font-medium">No call recordings found yet.</p>
            </div>
          ) : (
            enrichedRecordings.map((rec) => (
              <div key={rec.id} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col md:flex-row">
                {/* Left info column */}
                <div className="p-6 md:w-1/3 bg-slate-50/50 border-r border-slate-100 flex flex-col justify-between">
                  <div>
                    {rec.lead ? (
                      <div className="flex items-center gap-3 mb-4">
                        <img src={rec.lead.avatar || `https://ui-avatars.com/api/?name=${rec.lead.name}&background=random`} alt="" className="w-10 h-10 rounded-xl object-cover" />
                        <div>
                          <h3 className="font-bold text-slate-900">{rec.lead.name}</h3>
                          <div className="text-xs text-slate-500">{rec.lead.company} {rec.lead.location ? `• ${rec.lead.location}` : ''}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 mb-4 opacity-70">
                        <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500 font-bold">?</div>
                        <div>
                          <h3 className="font-bold text-slate-700">Unassigned Call</h3>
                          <div className="text-xs text-slate-500">No client linked</div>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-white border border-slate-200 py-1.5 px-3 rounded-lg w-max mb-6">
                      <Calendar size={14} />
                      {rec.createdAt?.toDate ? rec.createdAt.toDate().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown Date'}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 md:mt-0">
                    <Link to={`/r/${rec.id}`} className="flex-1 bg-[#3b4256] text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-slate-800 transition-colors">
                      <Play size={12} className="fill-current" /> Play Audio & Read
                    </Link>
                  </div>
                </div>

                {/* Right transcript column */}
                <div className="p-6 flex-1 flex flex-col">
                  <div className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-3">Call Transcript</div>
                  <div className="flex-1 bg-slate-50 rounded-xl p-4 border border-slate-100 text-sm text-slate-600 italic line-clamp-4 leading-relaxed overflow-hidden">
                    "{rec.transcript}"
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
