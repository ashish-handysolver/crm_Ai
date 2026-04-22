import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { Loader2, Play, Search, Filter, Calendar, AudioWaveform, Clock, Sparkles, ShieldCheck, UserPlus, X, Send, Building2, Mail, User as UserIcon, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useDemo } from './DemoContext';
import { motion, AnimatePresence } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';
import { logActivity } from './utils/activity';
import SearchableSelect from './components/SearchableSelect';
import { PageLayout } from './components/layout/PageLayout';
import { PageHeader } from './components/layout/PageHeader';

export default function Reports({ user }: { user: any }) {
  const { companyId, role } = useAuth();
  const { isDemoMode, demoData } = useDemo();
  const [leads, setLeads] = useState<any[]>([]);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(!isDemoMode);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncingRecordId, setSyncingRecordId] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [isCreatingLead, setIsCreatingLead] = useState(false);
  const [quickLeadData, setQuickLeadData] = useState({ name: '', company: '', email: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [recToDelete, setRecToDelete] = useState<string | null>(null);

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
        const allLeads = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const filtered = role === 'team_member'
          ? allLeads.filter((l: any) => l.assignedTo === user.uid || l.authorUid === user.uid)
          : allLeads;
        setLeads(filtered);
      },
      (error) => console.error("Reports Leads Error:", error)
    );

    const unsubRecs = onSnapshot(
      query(collection(db, 'recordings'), where('companyId', '==', companyId)),
      (snap) => {
        let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const filteredRecs = role === 'team_member'
          ? data.filter((r: any) => r.authorUid === user.uid || leads.some(l => l.id === r.leadId))
          : data;
        setRecordings(filteredRecs);
        setLoading(false);
      },
      (error) => {
        console.error("Reports Recordings Error:", error);
        setLoading(false);
      }
    );

    return () => { unsubLeads(); unsubRecs(); };
  }, [companyId, isDemoMode, demoData, leads, role, user.uid]);

  const handleLinkRecordToLead = async (recordId: string, leadId: string) => {
    if (leadId === 'ADD_NEW') {
      setShowQuickAdd(true);
      return;
    }
    try {
      await updateDoc(doc(db, 'recordings', recordId), { leadId });
      setSyncingRecordId(null);
    } catch (err) {
      console.error("Error linking record to lead:", err);
      alert("Failed to link record.");
    }
  };

  const handleQuickAddLead = async () => {
    if (!quickLeadData.name || !quickLeadData.company || !companyId || !syncingRecordId) return;
    setIsCreatingLead(true);
    try {
      const newLeadId = uuidv4();
      const leadPayload = {
        ...quickLeadData,
        id: newLeadId,
        companyId,
        authorUid: user.uid,
        authorName: user.displayName || 'System',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        phase: (import.meta as any).env.VITE_DEFAULT_PHASE || 'DISCOVERY',
        health: (import.meta as any).env.VITE_DEFAULT_HEALTH || 'WARM',
        isInterested: true,
        score: 50,
        source: 'MANUAL_SYNC'
      };

      await setDoc(doc(db, 'leads', newLeadId), leadPayload);
      await updateDoc(doc(db, 'recordings', syncingRecordId), { leadId: newLeadId });

      await logActivity({
        leadId: newLeadId,
        companyId,
        type: 'SYSTEM',
        action: 'Lead Created via Session Sync',
        authorUid: user.uid,
        authorName: user.displayName || 'System',
        details: { note: `Lead created while syncing recording ${syncingRecordId}` }
      });

      setSyncingRecordId(null);
      setShowQuickAdd(false);
      setQuickLeadData({ name: '', company: '', email: '' });
    } catch (err) {
      console.error("Error creating and linking lead:", err);
      alert("Failed to create lead.");
    } finally {
      setIsCreatingLead(false);
    }
  };

  const initiateDelete = (recId: string) => {
    setRecToDelete(recId);
  };

  const handleDeleteRecording = async () => {
    if (!recToDelete) return;

    setIsDeleting(recToDelete);
    setError('');
    const idToNotify = recToDelete;
    setRecToDelete(null);

    try {
      if (isDemoMode) {
        setSuccess("Report deleted from the session matrix.");
      } else {
        const { deleteDoc, doc } = await import('firebase/firestore');
        await deleteDoc(doc(db, 'recordings', idToNotify));
        setSuccess("Intelligence report successfully purged.");
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to purge the intelligence report.");
    } finally {
      setIsDeleting(null);
    }
  };

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

  const linkedCount = enrichedRecordings.filter(rec => rec.lead).length;
  const unlinkedCount = enrichedRecordings.length - linkedCount;
  const audioCount = enrichedRecordings.filter((rec: any) => rec.fileType !== 'document').length;
  const documentCount = enrichedRecordings.filter((rec: any) => rec.fileType === 'document').length;

  const formatRecordingDate = (rec: any) => {
    if (!rec.createdAt?.toDate) return 'No date';
    return rec.createdAt.toDate().toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  const getTranscriptPreview = (transcript?: string) => {
    if (!transcript) return 'No transcript available for this record.';
    return transcript.length > 800 ? `${transcript.slice(0, 800).trim()}...` : transcript;
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="space-y-8 sm:space-y-12 animate-pulse">
          <div className="space-y-4 w-full">
            <div className="w-48 h-6 bg-[var(--crm-border)] rounded-full"></div>
            <div className="w-64 sm:w-96 h-8 sm:h-12 bg-[var(--crm-border)] rounded-xl"></div>
            <div className="w-full max-w-2xl h-4 bg-[var(--crm-border)] rounded"></div>
          </div>
          <div className="h-16 sm:h-20 bg-[var(--crm-border)] rounded-2xl w-full"></div>
          <div className="space-y-6 sm:space-y-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-48 sm:h-64 bg-[var(--crm-border)] rounded-[2.5rem] w-full"></div>
            ))}
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader 
        title="Call Intelligence"
        description="Access all captured conversation data and AI-generated insights across your client portfolio."
        badge="Intelligence Network"
        icon={AudioWaveform}
      />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      >
        {[
          { label: 'Total Records', value: enrichedRecordings.length, icon: <AudioWaveform size={18} />, tone: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20' },
          { label: 'Linked Leads', value: linkedCount, icon: <UserPlus size={18} />, tone: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Audio Files', value: audioCount, icon: <Play size={18} />, tone: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20' },
          { label: 'Documents', value: documentCount, icon: <Calendar size={18} />, tone: 'text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/20' },
        ].map((stat) => (
          <div key={stat.label} className="glass-card !bg-[var(--crm-card-bg)] !border-[var(--crm-border)] rounded-[1.6rem] p-4 sm:p-5">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${stat.tone}`}>
              {stat.icon}
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[var(--crm-text)] leading-none">{stat.value}</div>
            <div className="mt-2 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[var(--crm-text-muted)]">{stat.label}</div>
          </div>
        ))}
      </motion.div>

        <AnimatePresence>
          {(error || success) && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-sm border ${error ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
              {error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
              {error || success}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters & Tools */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card !bg-[var(--crm-card-bg)] !border-[var(--crm-border)] p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sm:gap-6 shadow-xl rounded-[2rem]"
        >
          <div className="w-full space-y-3">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--crm-text-muted)]">Search History</div>
            <div className="relative w-full max-w-2xl group shrink-0 lg:shrink">
              <div className="absolute inset-y-0 left-0 pl-4 sm:pl-5 flex items-center pointer-events-none z-10">
                <Search className="text-[var(--crm-text-muted)] group-focus-within:text-indigo-500 transition-colors" size={18} />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by transcript, lead name, or company"
                className="w-full pl-11 sm:pl-14 pr-4 sm:pr-6 py-3 sm:py-4 bg-[var(--crm-input-bg)] hover:bg-[var(--crm-hover-bg)] border border-[var(--crm-border)] rounded-2xl text-sm sm:text-base font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-[var(--crm-text-muted)] text-[var(--crm-text)] shadow-inner"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto lg:justify-end">
            <div className="px-4 py-3 bg-[var(--crm-control-bg)] border border-[var(--crm-border)] rounded-2xl text-[10px] font-black uppercase tracking-widest text-[var(--crm-text)]">
              {searchTerm ? `${enrichedRecordings.length} Match${enrichedRecordings.length === 1 ? '' : 'es'}` : `${enrichedRecordings.length} Visible`}
            </div>
            <div className="px-4 py-3 bg-[var(--crm-control-bg)] border border-[var(--crm-border)] rounded-2xl text-[10px] font-black uppercase tracking-widest text-[var(--crm-text-muted)]">
              {unlinkedCount} Unlinked
            </div>
          </div>
        </motion.div>

        {/* Intelligence Ledger */}
        <div className="space-y-8">
          <AnimatePresence mode="popLayout">
            {enrichedRecordings.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="glass-card !bg-transparent !border-dashed !border-[var(--crm-border)] py-32 flex flex-col items-center justify-center text-center max-w-3xl mx-auto w-full rounded-[2.5rem]"
              >
                <div className="w-24 h-24 bg-[var(--crm-card-bg)] border border-[var(--crm-border)] rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-black/10 translate-y-0 group-hover:-translate-y-2 transition-transform">
                  <Search className="text-[var(--crm-text-muted)]" size={40} />
                </div>
                <h3 className="text-2xl font-black text-[var(--crm-text)] mb-3 tracking-tight">No Matches Found</h3>
                <p className="text-[var(--crm-text-muted)] font-medium max-w-sm">No reports match your current search. Try a different lead name, company, or transcript keyword.</p>
              </motion.div>
            ) : (
              enrichedRecordings.map((rec, index) => (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, type: 'spring', stiffness: 200, damping: 25 }}
                  key={rec.id}
                  className="glass-card !bg-[var(--crm-card-bg)] group flex flex-col xl:flex-row relative overflow-hidden h-full border border-[var(--crm-border)] hover:border-indigo-500/30 transition-all duration-500 shadow-xl rounded-[2.5rem]"
                >
                  {/* Visual Accent */}
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 to-violet-600 opacity-60 group-hover:opacity-100 transition-opacity"></div>

                  {/* Client Context Partition */}
                  <div className="p-5 sm:p-6 lg:p-8 xl:w-[38%] bg-transparent border-b xl:border-b-0 xl:border-r border-[var(--crm-border)] flex flex-col justify-between relative z-10">
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black uppercase tracking-widest text-indigo-200">
                          {rec.fileType === 'document' ? 'Doc' : 'Audio'}
                        </span>
                        {rec.lead ? (
                          <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest text-emerald-300">
                            Linked
                          </span>
                        ) : (
                          <span className="px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-black uppercase tracking-widest text-amber-300">
                            Needs Linking
                          </span>
                        )}
                      </div>

                      {rec.lead ? (
                        <div className="flex items-center gap-5">
                          <div className="relative">
                            <img
                              src={rec.lead.avatar || `https://ui-avatars.com/api/?name=${rec.lead.name}&background=random`}
                              alt={rec.lead.name}
                              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover ring-2 sm:ring-4 ring-slate-900 shadow-xl shadow-black/40"
                            />
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 border-2 sm:border-4 border-slate-900 shadow-sm" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-black text-lg sm:text-xl lg:text-2xl text-[var(--crm-text)] tracking-tight truncate">{rec.lead.name}</h3>
                            <div className="text-[10px] sm:text-xs font-black text-indigo-400 mt-0.5 sm:mt-1 uppercase tracking-widest truncate flex items-center gap-1.5 sm:gap-2">
                              <Sparkles size={12} className="animate-pulse" /> {rec.lead.company}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[var(--crm-card-bg)] flex items-center justify-center text-[var(--crm-text-muted)] font-black text-xl sm:text-2xl shadow-inner border border-[var(--crm-border)] opacity-70">?</div>
                          <div className="space-y-2">
                            <div className="opacity-80">
                              <h3 className="font-extrabold text-lg sm:text-xl lg:text-2xl text-[var(--crm-text)] tracking-tight">Unlinked Record</h3>
                              <div className="text-[10px] sm:text-xs font-bold text-[var(--crm-text-muted)] mt-0.5 sm:mt-1 uppercase tracking-widest">Needs lead mapping</div>
                            </div>
                            {syncingRecordId === rec.id ? (
                              <SearchableSelect
                                options={leads}
                                value=""
                                onChange={(val) => handleLinkRecordToLead(rec.id, val)}
                                onAddNew={() => handleLinkRecordToLead(rec.id, 'ADD_NEW')}
                                placeholder="Link to Client..."
                                compact={true}
                                hideSearch={true}
                              />
                            ) : (
                              <button onClick={() => setSyncingRecordId(rec.id)} className="px-4 py-2 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 hover:text-white border border-indigo-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-1.5 w-fit active:scale-95">
                                <UserPlus size={12} /> Sync Lead
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex flex-col sm:flex-row xl:flex-col gap-3">
                      <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-black text-[var(--crm-text)] bg-[var(--crm-card-bg)] border border-[var(--crm-border)] py-3 px-3 sm:px-4 rounded-xl shadow-sm uppercase tracking-widest">
                        <Calendar size={14} className="text-indigo-400" />
                        {formatRecordingDate(rec)}
                      </div>
                      <Link
                        to={`/r/${rec.id}`}
                        className="w-full px-4 py-3.5 sm:py-4 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-2xl font-black text-[11px] sm:text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 border border-indigo-500/20 hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/20 active:scale-95 group/btn relative z-10"
                      >
                        <Play size={16} className="fill-current group-hover/btn:scale-110 transition-transform" />
                        <span>Open Record</span>
                      </Link>
                    </div>

                  </div>

                  {/* Intelligence Manifest column */}
                  <div className="p-5 pr-16 sm:p-6 sm:pr-20 lg:p-8 lg:pr-24 flex-1 flex flex-col relative bg-transparent z-10">
                    {(role === 'admin' || role === 'super_admin' || role === 'management') && (
                      <button
                        onClick={() => initiateDelete(rec.id)}
                        disabled={isDeleting === rec.id}
                        className="absolute top-4 right-4 sm:top-6 sm:right-6 w-11 h-11 sm:w-12 sm:h-12 shrink-0 bg-[var(--crm-card-bg)] hover:bg-rose-500/15 text-[var(--crm-text-muted)] hover:text-rose-400 border border-[var(--crm-border)] hover:border-rose-500/30 rounded-xl transition-all shadow-sm active:scale-95 group/del z-[20] flex items-center justify-center"
                        title="Delete record"
                      >
                        {isDeleting === rec.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                    )}
                    <div className="absolute top-4 right-4 sm:top-8 sm:right-10 text-[5rem] sm:text-[8rem] lg:text-[10rem] text-white/5 font-serif leading-none italic pointer-events-none select-none">"</div>
                    {/* Blur backing for card depth */}
                    <div className="absolute top-0 left-0 w-32 h-32 sm:w-48 sm:h-48 bg-indigo-500/10 rounded-full blur-3xl opacity-0 group-hover:opacity-60 transition-all duration-700 pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>

                    <div className="space-y-5 relative z-10 h-full">
                      <div className="relative group/transcript">
                        <div className="absolute -inset-4 bg-indigo-500/10 rounded-[2.5rem] opacity-0 group-hover/transcript:opacity-100 transition-opacity pointer-events-none blur-xl"></div>
                        <p className="text-sm sm:text-base lg:text-lg text-[var(--crm-text)] leading-relaxed font-medium relative z-10 line-clamp-5">
                          {getTranscriptPreview(rec.transcript)}
                        </p>
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
          <p className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-[0.3em] flex items-center gap-3">
            <ShieldCheck size={14} /> Secure report archive
          </p>
        </div>

        {/* Quick Add Lead Modal */}
        <AnimatePresence>
          {showQuickAdd && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => !isCreatingLead && setShowQuickAdd(false)}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-md bg-[var(--crm-card-bg)] border border-[var(--crm-border)] rounded-[2.5rem] shadow-2xl overflow-hidden p-8 sm:p-10"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
                      <UserPlus size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-[var(--crm-text)] uppercase tracking-tight">Quick Sync Lead</h3>
                      <p className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest">Create & Link Session</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowQuickAdd(false)}
                    className="p-2 text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest ml-1">Full Name</label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--crm-text-muted)]" size={16} />
                      <input
                        type="text"
                        value={quickLeadData.name}
                        onChange={(e) => setQuickLeadData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="John Doe"
                        className="w-full pl-12 pr-4 py-4 bg-[var(--crm-input-bg)] border border-[var(--crm-border)] rounded-2xl text-sm font-bold text-[var(--crm-text)] outline-none focus:border-indigo-500 transition-all placeholder:text-[var(--crm-text-muted)] shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest ml-1">Company</label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--crm-text-muted)]" size={16} />
                      <input
                        type="text"
                        value={quickLeadData.company}
                        onChange={(e) => setQuickLeadData(prev => ({ ...prev, company: e.target.value }))}
                        placeholder="Acme Corp"
                        className="w-full pl-12 pr-4 py-4 bg-[var(--crm-input-bg)] border border-[var(--crm-border)] rounded-2xl text-sm font-bold text-[var(--crm-text)] outline-none focus:border-indigo-500 transition-all placeholder:text-[var(--crm-text-muted)] shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest ml-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--crm-text-muted)]" size={16} />
                      <input
                        type="email"
                        value={quickLeadData.email}
                        onChange={(e) => setQuickLeadData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="john@example.com"
                        className="w-full pl-12 pr-4 py-4 bg-[var(--crm-input-bg)] border border-[var(--crm-border)] rounded-2xl text-sm font-bold text-[var(--crm-text)] outline-none focus:border-indigo-500 transition-all placeholder:text-[var(--crm-text-muted)] shadow-inner"
                      />
                    </div>
                  </div>

                  <button
                    disabled={!quickLeadData.name || !quickLeadData.company || isCreatingLead}
                    onClick={handleQuickAddLead}
                    className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-500/20 active:scale-95 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3 mt-4"
                  >
                    {isCreatingLead ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>
                        <Send size={16} />
                        Sync Intelligence
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {/* Confirmation Modal */}
        <AnimatePresence>
          {recToDelete && (
            <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setRecToDelete(null)}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-md bg-[var(--crm-card-bg)] border border-rose-500/30 rounded-[2.5rem] shadow-2xl overflow-hidden p-8 sm:p-10 text-center"
              >
                <div className="w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-rose-500/20">
                   <Trash2 size={32} className="text-rose-500" />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Confirm Purge</h3>
                <p className="text-sm font-bold text-slate-400 leading-relaxed mb-8">
                  Are you sure you want to permanently delete this intelligence report? This action will purge all conversation data from the secure matrix and cannot be reversed.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => setRecToDelete(null)}
                    className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                  >
                    Abort Mission
                  </button>
                  <button
                    onClick={handleDeleteRecording}
                    className="flex-1 py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-rose-500/20 active:scale-95"
                  >
                    Confirm Deletion
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
    </PageLayout>
  );
}
