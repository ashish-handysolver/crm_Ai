import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, onSnapshot, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
import { ref, getBytes } from 'firebase/storage';
import { useAuth } from './contexts/AuthContext';
import { db, storage } from './firebase';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2, AlertTriangle, Archive, Zap, Wand2, Sparkles, CheckSquare, AlignLeft,
  Briefcase, ChevronLeft, Calendar, Edit, Check, Plus, Trash2, ArrowUpRight,
  CalendarDays, Clock, RotateCcw, Download, X, Maximize2, Minimize2, ShieldAlert,
  ThumbsUp, ThumbsDown, MessageSquare as MessageIcon, History
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import TranscriptPlayer from './TranscriptPlayer';
import { logActivity } from './utils/activity';
import { analyzeWithGroq, transcribeWithGroq } from './utils/ai-service';
import { PageLayout } from './components/layout/PageLayout';
import { PageHeader } from './components/layout/PageHeader';

export default function LeadInsights({ user }: { user: any }) {
  const { id } = useParams();
  const { role } = useAuth();

  const [lead, setLead] = useState<any>(null);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [selectedRecId, setSelectedRecId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [syncingTranscript, setSyncingTranscript] = useState(false);

  const [editingItem, setEditingItem] = useState<{ field: string, index: number, value: string } | null>(null);
  const [editingOverview, setEditingOverview] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [expandedSection, setExpandedSection] = useState<'tasks' | 'minutes' | null>(null);
  const attemptedRecs = useRef<Set<string>>(new Set());

  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [meetingForm, setMeetingForm] = useState({ title: '', date: '', time: '10:00', notes: '' });
  const [savingMeeting, setSavingMeeting] = useState(false);

  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchLead = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'leads', id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Access check
          if (role === 'team_member' && data.assignedTo !== user.uid && data.authorUid !== user.uid) {
            setLead('UNAUTHORIZED');
            return;
          }
          setLead({ id: docSnap.id, ...data });
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchLead();

    const q = query(collection(db, 'recordings'), where('leadId', '==', id));
    const unsub = onSnapshot(q, (snap) => {
      let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a: any, b: any) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tB - tA;
      });
      setRecordings(data);
      if (data.length > 0 && !selectedRecId) {
        setSelectedRecId(data[0].id);
      }
      if (lead === null) {
        setLoading(false);
      }
    });

    // Fetch meetings linked to this lead
    const mq = query(collection(db, 'meetings'), where('leadId', '==', id));
    const munsubMeetings = onSnapshot(mq, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      data.sort((a, b) => (a.scheduledAt?.toMillis?.() || 0) - (b.scheduledAt?.toMillis?.() || 0));
      setMeetings(data);
    });

    // Fetch Activity Logs
    const aq = query(collection(db, 'activity_logs'), where('leadId', '==', id));
    const unsubLogs = onSnapshot(aq, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setActivityLogs(data);
    });

    return () => { unsub(); munsubMeetings(); unsubLogs(); };
  }, [id, lead, selectedRecId, role, user.uid]);

  useEffect(() => {
    if (lead !== null) setLoading(false);
  }, [lead]);

  const selectedRec = recordings.find(r => r.id === selectedRecId);

  const normalizeInsights = (parsed: any) => {
    if (parsed?.tasks && Array.isArray(parsed.tasks)) {
      parsed.tasks = parsed.tasks.map((t: any) => ({ ...t, completed: Boolean(t.completed) }));
    }
    return parsed;
  };

  const syncLeadFromInsights = async (parsed: any) => {
    if (!lead || !parsed) return;
    const leadUpdates: any = {};

    if ((lead.phase || '').toUpperCase() === 'DISCOVERY') {
      leadUpdates.phase = 'CONNECTED';
    } else if (parsed.recommendedPhase && lead.phase !== parsed.recommendedPhase.toUpperCase()) {
      leadUpdates.phase = parsed.recommendedPhase.toUpperCase();
    }

    if (parsed.leadScore !== undefined) {
      const newScore = Math.max(0, Math.min(100, Math.round(Number(parsed.leadScore))));
      if (!isNaN(newScore)) {
        leadUpdates.score = newScore;
        leadUpdates.lastAIScoreSync = Timestamp.now();
      }
    }

    if (Object.keys(leadUpdates).length > 0) {
      leadUpdates.updatedAt = Timestamp.now();
      await updateDoc(doc(db, 'leads', lead.id), leadUpdates);
      setLead((prev: any) => ({ ...prev, ...leadUpdates }));
    }
  };

  useEffect(() => {
    if (!selectedRec || !selectedRec.transcript || selectedRec.aiInsights || generatingAI) return;
    if (attemptedRecs.current.has(selectedRec.id)) return; // Prevent infinite retry loops

    const generateInsights = async () => {
      attemptedRecs.current.add(selectedRec.id);
      setGeneratingAI(true);
      try {
        console.log("Analyzing interaction with Free AI Agent (Groq)...");
        const parsed = await analyzeWithGroq(selectedRec.transcript);

        if (!parsed) {
          throw new Error("Analytics retrieval failure.");
        }

        normalizeInsights(parsed);

        console.log("AI Results Produced:", parsed);

        await updateDoc(doc(db, 'recordings', selectedRec.id), {
          aiInsights: parsed
        });

        await syncLeadFromInsights(parsed);
      } catch (err) {
        console.error("Failed to generate AI insights:", err);
      } finally {
        setGeneratingAI(false);
      }
    };

    generateInsights();
  }, [selectedRec, generatingAI]);

  const handleRegenerate = async () => {
    if (!selectedRec || !selectedRec.transcript || generatingAI) return;
    setGeneratingAI(true);
    attemptedRecs.current.delete(selectedRec.id);
    try {
      const parsed = normalizeInsights(await analyzeWithGroq(selectedRec.transcript));

      await updateDoc(doc(db, 'recordings', selectedRec.id), {
        aiInsights: parsed,
        updatedAt: Timestamp.now()
      });

      await syncLeadFromInsights(parsed);
    } catch (err: any) {
      console.error("Failed to regenerate AI insights:", err);
      alert("Analytics regeneration failed: " + (err.message || "Unknown error"));
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleSyncTranscript = async () => {
    if (!selectedRec || !selectedRec.audioUrl || syncingTranscript) return;
    setSyncingTranscript(true);
    try {
      const storageRef = ref(storage, selectedRec.audioUrl);
      const buffer = await getBytes(storageRef);
      const blob = new Blob([buffer], { type: 'audio/webm' });
      const parsed = await transcribeWithGroq(blob);

      await updateDoc(doc(db, 'recordings', selectedRec.id), {
        transcript: parsed.fullText || selectedRec.transcript,
        transcriptData: parsed.segments || selectedRec.transcriptData
      });
    } catch (err: any) {
      console.error("Transcription sync failed:", err);
      if (err?.status === 429 || err?.message?.toLowerCase().includes('quota')) {
        alert("Intelligence services temporarily unavailable. Please try again later.");
      }
    } finally {
      setSyncingTranscript(false);
    }
  };

  const handleSaveMeeting = async () => {
    if (!meetingForm.title.trim() || !meetingForm.date) {
      alert("Title and date are required.");
      return;
    }
    setSavingMeeting(true);
    try {
      const [h, min] = meetingForm.time.split(':').map(Number);
      const scheduledDate = new Date(meetingForm.date);
      scheduledDate.setHours(h, min, 0, 0);

      await addDoc(collection(db, 'meetings'), {
        title: meetingForm.title,
        leadId: lead.id,
        leadName: lead.name || '',
        notes: meetingForm.notes,
        scheduledAt: Timestamp.fromDate(scheduledDate),
        companyId: lead.companyId,
        ownerUid: user?.uid || '',
        reminderSent: false,
      });
      setShowMeetingModal(false);
      setMeetingForm({ title: '', date: '', time: '10:00', notes: '' });
    } catch (err: any) {
      console.error(err);
      alert("Failed to save meeting.");
    } finally {
      setSavingMeeting(false);
    }
  };

  const calculateIntelligenceScore = () => {
    if (!lead) return 0;

    let score = 30; // Base baseline

    // 1. Engagement Density (Recordings)
    const recordingWeight = Math.min(recordings.length * 10, 30);
    score += recordingWeight;

    // 2. Commitment Pulse (Meetings)
    const meetingWeight = Math.min(meetings.length * 5, 15);
    score += meetingWeight;

    // 3. Activity Recency
    if (activityLogs.length > 0) {
      const lastActivity = activityLogs[0].createdAt?.toMillis?.() || 0;
      const hoursSince = (Date.now() - lastActivity) / (1000 * 60 * 60);
      if (hoursSince < 24) score += 10;
      else if (hoursSince < 168) score += 5;
    }

    // 4. Sentiment Analysis
    const latestRec = recordings[0];
    if (latestRec?.aiInsights?.sentiment === 'Positive') score += 15;

    // 5. Portfolio Health
    if (lead.health === 'HOT') score += 10;
    else if (lead.health === 'WARM') score += 5;

    return Math.min(score, 100);
  };

  const handleRecalculateIntelligence = async () => {
    if (!lead || syncingTranscript || generatingAI) return;
    const newScore = calculateIntelligenceScore();
    try {
      await updateDoc(doc(db, 'leads', lead.id), {
        score: newScore,
        lastIntelligenceSync: Timestamp.now()
      });
      setLead((prev: any) => ({ ...prev, score: newScore }));
    } catch (err) {
      console.error(err);
    }
  };

  const toggleInterest = async () => {
    if (!lead) return;
    const newStatus = !lead.isInterested;
    try {
      await updateDoc(doc(db, 'leads', lead.id), { isInterested: newStatus });
      setLead({ ...lead, isInterested: newStatus });

      await logActivity({
        leadId: lead.id,
        companyId: lead.companyId,
        type: 'INTEREST_CHANGE',
        action: newStatus ? 'Marked as Interested' : 'Marked as Not Interested',
        authorUid: user.uid,
        authorName: user.displayName || 'System',
        details: {
          field: 'isInterested',
          oldValue: lead.isInterested ?? true,
          newValue: newStatus
        }
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || isSubmittingNote) return;
    setIsSubmittingNote(true);
    try {
      await logActivity({
        leadId: lead.id,
        companyId: lead.companyId,
        type: 'MANUAL_NOTE',
        action: 'Added Manual Note',
        authorUid: user.uid,
        authorName: user.displayName || 'System',
        details: { note: newNote }
      });
      await handleRecalculateIntelligence();
      setNewNote('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  useEffect(() => {
    if (lead && recordings.length > 0 && !loading && !syncingTranscript && !generatingAI) {
      const currentScore = lead.score || 0;
      const newScore = calculateIntelligenceScore();
      if (Math.abs(currentScore - newScore) >= 1) { // Only update if significant change
        handleRecalculateIntelligence();
      }
    }
  }, [recordings.length, meetings.length, activityLogs.length, lead?.health]);

  if (loading) {
    return (
      <PageLayout>
        <div className="space-y-12 animate-pulse">
          <div className="space-y-4 w-full">
            <div className="w-32 h-4 bg-[var(--crm-border)] rounded-full"></div>
            <div className="w-64 sm:w-96 h-12 bg-[var(--crm-border)] rounded-xl"></div>
            <div className="w-full max-w-xl h-6 bg-[var(--crm-border)] rounded"></div>
          </div>
          <div className="h-16 bg-[var(--crm-border)] rounded-[1.2rem] w-full"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-[420px] bg-[var(--crm-border)]/50 rounded-[2.5rem]"></div>
            ))}
          </div>
        </div>
      </PageLayout>
    );
  }

  if (lead === 'UNAUTHORIZED') {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-[var(--crm-text-muted)] font-black uppercase tracking-widest text-sm p-8 text-center">
          <ShieldAlert size={48} className="text-rose-500 mb-4" />
          Access Denied: Resource Isolated
        </div>
      </PageLayout>
    );
  }

  if (!lead) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-[60vh] text-[var(--crm-text-muted)] font-black uppercase tracking-widest text-sm">
          Lead Record Missing
        </div>
      </PageLayout>
    );
  }

  const insights = selectedRec?.aiInsights || {
    sentiment: 'Analyzing...',
    painPoints: ['Capturing data...'],
    requirements: ['Capturing data...'],
    nextActions: ['Capturing data...'],
    improvements: ['Capturing data...'],
    overview: 'Analyzing the transcript to provide a comprehensive executive overview of the engagement...',
    meetingMinutes: ['Identifying meeting minutes...'],
    tasks: []
  };
  const lightCardClass = "glass-card !bg-[var(--crm-card-bg)] !rounded-[2.5rem] border-[var(--crm-border)] shadow-[0_18px_42px_-30px_rgba(15,23,42,0.32)]";
  const getPhaseProgress = (phase?: string) => {
    const phaseKey = (phase || '').toUpperCase();
    const phaseMap: Record<string, number> = {
      NEW: 10,
      DISCOVERY: 20,
      CONTACTED: 25,
      QUALIFIED: 40,
      PROPOSAL: 60,
      NEGOTIATION: 75,
      WON: 100,
      CLOSED_WON: 100,
      LOST: 0,
      CLOSED_LOST: 0,
      INACTIVE: 5,
    };

    return phaseMap[phaseKey] ?? 30;
  };

  const saveInsights = async (newInsights: any) => {
    if (!selectedRec) return;
    try {
      await updateDoc(doc(db, 'recordings', selectedRec.id), { aiInsights: newInsights });
    } catch (err) {
      console.error(err);
      alert("Failed to save changes.");
    }
  };

  const handleArraySave = async () => {
    if (!editingItem || !selectedRec) return;
    const { field, index, value } = editingItem;
    const newArr = [...insights[field]];
    newArr[index] = value;
    await saveInsights({ ...insights, [field]: newArr });
    setEditingItem(null);
  };

  const handleArrayDelete = async (field: string, index: number) => {
    if (!selectedRec) return;
    const newArr = insights[field].filter((_: any, i: number) => i !== index);
    await saveInsights({ ...insights, [field]: newArr });
  };

  const handleArrayAdd = async (field: string) => {
    if (!selectedRec) return;
    const newArr = [...insights[field], "New finding"];
    await saveInsights({ ...insights, [field]: newArr });
    setEditingItem({ field, index: newArr.length - 1, value: "New finding" });
  };

  const handleTaskToggle = async (index: number) => {
    if (!selectedRec) return;
    const newTasks = [...insights.tasks];
    newTasks[index].completed = !newTasks[index].completed;
    await saveInsights({ ...insights, tasks: newTasks });
  };

  const handleTaskDelete = async (index: number) => {
    if (!selectedRec) return;
    const newTasks = insights.tasks.filter((_: any, i: number) => i !== index);
    await saveInsights({ ...insights, tasks: newTasks });
  };

  const handleTaskAdd = async () => {
    if (!selectedRec) return;
    const newTasks = [...insights.tasks, { title: "New Action Item", assignee: "Owner", dueDate: "TBD", completed: false }];
    await saveInsights({ ...insights, tasks: newTasks });
  };

  const handleOverviewSave = async () => {
    if (!selectedRec || editingOverview === null) return;
    await saveInsights({ ...insights, overview: editingOverview });
    setEditingOverview(null);
  };

  const handleSentimentChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!selectedRec) return;
    await saveInsights({ ...insights, sentiment: e.target.value });
  };

  const handleExportPDF = () => {
    if (!lead || !insights) return;
    const doc = new jsPDF();
    const margin = 20;
    let y = 20;

    // Header & Branding
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("HANDYSOLVER", margin, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("EXECUTIVE INTELLIGENCE REPORT", margin, 32);

    const dateStr = new Date().toLocaleDateString();
    doc.text(`DATE: ${dateStr}`, 150, 32);

    y = 55;

    // Client Info
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("CLIENT Details", margin, y);
    y += 8;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Entity: ${lead.company || lead.name}`, margin, y);
    y += 6;
    doc.text(`Contact: ${lead.name}`, margin, y);
    y += 6;
    doc.text(`Disposition: ${lead.status || 'Active Agent'}`, margin, y);

    y += 15;
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(margin, y, 190, y);
    y += 15;

    // Executive Summary
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("AI EXECUTIVE SUMMARY", margin, y);
    y += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const overviewLines = doc.splitTextToSize(insights.overview || "No summary generated.", 170);
    doc.text(overviewLines, margin, y);
    y += (overviewLines.length * 6) + 15;

    // Minutes of Meeting
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("MINUTES OF MEETING", margin, y);
    y += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const momPoints = Array.isArray(insights.meetingMinutes) ? insights.meetingMinutes : [];
    if (momPoints.length === 0) {
      doc.text("- No minutes recorded.", margin, y);
      y += 10;
    } else {
      momPoints.forEach((point: string) => {
        if (y > 270) { doc.addPage(); y = 20; }
        const pLines = doc.splitTextToSize(`• ${point}`, 165);
        doc.text(pLines, margin, y);
        y += (pLines.length * 6) + 2;
      });
    }

    y += 15;

    // Full Meeting Script
    if (selectedRec.transcript) {
      doc.addPage();
      y = 20;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("FULL MEETING SCRIPT", margin, y);
      y += 10;
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100, 116, 139); // slate-500

      const scriptLines = doc.splitTextToSize(`"${selectedRec.transcript}"`, 170);
      scriptLines.forEach((line: string) => {
        if (y > 280) { doc.addPage(); y = 20; }
        doc.text(line, margin, y);
        y += 5;
      });
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("Confidential Intelligence Payload - Generated by Handysolver AudioCRM", 105, 290, { align: "center" });

    doc.save(`Handysolver_Report_${lead.name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <PageLayout>
      <PageHeader 
        title={lead.name}
        description="Deep intelligence view. Analyze interactions, track core objectives, and drive strategic outcomes."
        badge="Lead Insights"
        icon={Sparkles}
        actions={
          <div className="flex flex-wrap sm:flex-nowrap gap-4">
            <div className="glass-card !p-3 !rounded-xl !bg-[var(--crm-card-bg)] border-[var(--crm-border)] flex flex-col items-end min-w-[120px]">
              <div className="text-[8px] font-black text-indigo-400/60 uppercase tracking-widest mb-1">Neural Score</div>
              <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border ${lead.status === 'Won' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : lead.status === 'Lost' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
                {lead.status || 'In Progress'}
              </span>
            </div>

            <div className="glass-card !p-3 !rounded-xl !bg-[var(--crm-card-bg)] border-[var(--crm-border)] flex flex-col items-end min-w-[120px]">
              <div className="text-[8px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest mb-1">Phase Velocity</div>
              <button
                onClick={toggleInterest}
                className={`w-full px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border transition-all ${lead.isInterested !== false ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}
              >
                {lead.isInterested !== false ? <ThumbsUp size={10} /> : <ThumbsDown size={10} />}
                {lead.isInterested !== false ? 'Interested' : 'No'}
              </button>
            </div>

            <div className="glass-card !p-3 !rounded-xl !bg-[var(--crm-card-bg)] border-[var(--crm-border)] flex flex-col items-end min-w-[120px]">
              <div className="text-[8px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest mb-1">Mood Signal</div>
              <div className="relative w-full">
                <select
                  value={insights.sentiment}
                  onChange={handleSentimentChange}
                  className={`w-full px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border appearance-none cursor-pointer outline-none transition-all pr-6 ${insights.sentiment === 'Positive' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : insights.sentiment === 'Negative' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-[var(--crm-bg)]/20 text-[var(--crm-text-muted)] border-[var(--crm-border)]'}`}
                  disabled={!selectedRec}
                >
                  <option value="Positive">Positive</option>
                  <option value="Neutral">Neutral</option>
                  <option value="Negative">Negative</option>
                  <option value="Analyzing...">Analyzing...</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--crm-text-muted)]">
                  <Edit size={10} />
                </div>
              </div>
            </div>
          </div>
        }
      />

      <div className="space-y-12 pb-20">
        {/* Intelligence Timeline */}
        <div className="glass-card !p-3 !rounded-[2.5rem] !bg-[var(--crm-card-bg)] border-[var(--crm-border)] flex flex-nowrap items-center gap-4 overflow-x-auto shadow-2xl hide-scrollbar scroll-smooth">
          <div className="pl-6 pr-8 shrink-0 hidden sm:flex items-center gap-3 border-r border-[var(--crm-border)] py-3">
            <Calendar size={18} className="text-cyan-400" />
            <span className="text-[10px] font-black text-[var(--crm-text-muted)] tracking-[0.3em] uppercase">Intelligence Stream</span>
          </div>
          <div className="flex gap-4 py-2 px-3 sm:px-0">
            {recordings.length > 0 ? (
              recordings.map((rec) => {
                const dateStr = rec.createdAt?.toDate ? rec.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : 'Legacy Core';
                const isSelected = selectedRecId === rec.id;
                return (
                  <button
                    key={rec.id}
                    onClick={() => setSelectedRecId(rec.id)}
                    className={`shrink-0 px-6 py-3 rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition-all shadow-xl border whitespace-nowrap active:scale-95 ${isSelected ? 'bg-cyan-600 text-[var(--crm-text)] border-cyan-500 shadow-cyan-500/20' : 'bg-[var(--crm-bg)]/20 text-[var(--crm-text-muted)] hover:bg-[var(--crm-bg)]/40 border-[var(--crm-border)] hover:text-[var(--crm-text)]'}`}
                  >
                    {dateStr}
                  </button>
                );
              })
            ) : (
              <span className="text-xs font-bold text-[var(--crm-text-muted)] py-3 px-6 italic uppercase tracking-widest">Initialization Pending...</span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        {selectedRec && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-end gap-5">
            <button
              onClick={handleExportPDF}
              className="btn-secondary !rounded-[1.5rem] !px-8 !py-4 text-[10px]"
            >
              <Download size={14} /> Download PDF Report
            </button>
            <button
              onClick={handleRegenerate}
              disabled={generatingAI}
              className="btn-primary !rounded-[1.5rem] !px-8 !py-4 text-[10px]"
            >
              {generatingAI ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
              {generatingAI ? 'Regenerating...' : 'Regenerate Insights'}
            </button>
          </motion.div>
        )}

        <AnimatePresence>
          {generatingAI && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <div className="p-6 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl flex items-center justify-center gap-4 text-indigo-400 font-black text-xs shadow-inner uppercase tracking-widest">
                <Sparkles size={18} className="animate-pulse" /> AI is analyzing the conversation...
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Intelligence Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { id: 'painPoints', title: 'Friction Points', icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
            { id: 'requirements', title: 'Core Objectives', icon: Archive, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
            { id: 'nextActions', title: 'Strategic Vectors', icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
            { id: 'improvements', title: 'Critical Enhancers', icon: Wand2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' }
          ].map((col, idx) => {
            const Icon = col.icon;
            const dataArr = insights[col.id] || [];
            return (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} key={col.id} className="glass-card !bg-[var(--crm-card-bg)] !rounded-[2.5rem] border-[var(--crm-border)] overflow-hidden group/card hover:border-cyan-500/30 transition-all duration-500 hover:shadow-[0_20px_50px_-12px_rgba(6,182,212,0.15)] flex flex-col h-[420px]">
                <div className="p-8 flex flex-col h-full">
                  <div className="flex justify-between items-center mb-8 shrink-0">
                    <h3 className="font-black text-[var(--crm-text)] flex items-center gap-3 text-sm uppercase tracking-widest">
                      <div className={`p-2.5 rounded-xl ${col.bg} ${col.color} border ${col.border} shadow-lg`}><Icon size={16} /></div> {col.title}
                    </h3>
                    <button
                      onClick={() => handleArrayAdd(col.id)}
                      className="p-2 text-[var(--crm-text-muted)] hover:text-cyan-400 bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] rounded-xl transition-all active:scale-95 shadow-lg"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  <ul className="space-y-4 flex-1 overflow-y-auto scrollbar-hide pr-2">
                    {dataArr.map((item: string, i: number) => {
                      const isEditingThis = editingItem?.field === col.id && editingItem?.index === i;
                      return isEditingThis ? (
                        <div key={i} className="space-y-3">
                          <textarea
                            autoFocus
                            className="w-full text-xs font-bold bg-black/40 border border-white/10 rounded-2xl p-5 outline-none focus:ring-4 focus:ring-cyan-500/10 resize-none min-h-[120px] text-[var(--crm-text)] shadow-inner"
                            value={editingItem.value}
                            onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                          />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingItem(null)} className="px-5 py-2 text-[10px] font-black uppercase text-[var(--crm-text-muted)] hover:text-slate-300 transition-all tracking-widest">Cancel</button>
                            <button onClick={handleArraySave} className="px-6 py-2 text-[10px] font-black uppercase bg-cyan-600 text-[var(--crm-text)] rounded-xl shadow-xl shadow-cyan-500/20 active:scale-95 transition-all tracking-widest flex items-center gap-2 font-display"><Check size={12} /> Save</button>
                          </div>
                        </div>
                      ) : (
                        <li key={i} className="group/item relative pl-4 leading-relaxed bg-[var(--crm-control-bg)] hover:bg-[var(--crm-control-hover-bg)] p-5 rounded-[1.8rem] border border-[var(--crm-border)] transition-all shadow-sm flex items-start gap-3">
                          <div className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${col.color.replace('text-', 'bg-')} shadow-[0_0_8px_currentColor]`}></div>
                          <span className="text-xs font-semibold text-[var(--crm-text)] pr-16 leading-relaxed">{item}</span>
                          <div className="absolute top-5 right-5 flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-all translate-x-0 sm:translate-x-2 sm:group-hover:translate-x-0">
                            <button onClick={() => setEditingItem({ field: col.id, index: i, value: item })} className="p-2 text-[var(--crm-text-muted)] hover:text-cyan-400 bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] rounded-lg shadow-lg transition-all"><Edit size={12} /></button>
                            <button onClick={() => handleArrayDelete(col.id, i)} className="p-2 text-[var(--crm-text-muted)] hover:text-rose-400 bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] rounded-lg shadow-lg transition-all"><Trash2 size={12} /></button>
                          </div>
                        </li>
                      );
                    })}
                    {dataArr.length === 0 && (
                      <li className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase italic tracking-[0.2em] text-center py-10">No data points captured.</li>
                    )}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Split View */}
        <div className="flex flex-col xl:flex-row gap-8">
          {/* High-Level Overview & Progress */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full">
            {/* Executive Summary Card */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`lg:col-span-2 ${lightCardClass} p-10 text-[var(--crm-text)] relative overflow-hidden group/summary`}>
              <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-cyan-500/15 to-purple-500/15 rounded-full blur-[120px] pointer-events-none translate-x-1/3 -translate-y-1/3 opacity-40"></div>

              <div className="relative z-10 space-y-10">
                <div className="flex justify-between items-start">
                  <h3 className="font-black text-[var(--crm-text)] flex items-center gap-4 text-lg uppercase tracking-[0.3em] font-display">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--crm-control-bg)] flex items-center justify-center border border-[var(--crm-border)] backdrop-blur-xl shadow-2xl shadow-cyan-500/10"><Sparkles className="text-cyan-400" size={24} /></div>
                    AI Summary
                  </h3>
                  <div className="flex gap-3">
                    {editingOverview === null ? (
                      <>
                        <button onClick={handleRegenerate} disabled={generatingAI} title="Recalibrate Analysis" className="p-3 text-cyan-400 hover:text-[var(--crm-text)] hover:bg-[var(--crm-control-hover-bg)] bg-[var(--crm-control-bg)] border border-[var(--crm-border)] rounded-xl transition-all shadow-2xl disabled:opacity-50 active:scale-95">
                          {generatingAI ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
                        </button>
                        <button
                          onClick={() => setEditingOverview(insights.overview || '')}
                          title="Edit Summary"
                          className="p-3 text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] hover:bg-[var(--crm-control-hover-bg)] bg-[var(--crm-control-bg)] border border-[var(--crm-border)] rounded-xl transition-all shadow-2xl active:scale-95"
                        >
                          <Edit size={18} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditingOverview(null)}
                          title="Cancel"
                          className="p-3 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 bg-[var(--crm-control-bg)] border border-[var(--crm-border)] rounded-xl transition-all shadow-2xl active:scale-95"
                        >
                          <X size={18} />
                        </button>
                        <button
                          onClick={handleOverviewSave}
                          title="Save Summary"
                          className="p-3 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 bg-[var(--crm-control-bg)] border border-[var(--crm-border)] rounded-xl transition-all shadow-2xl active:scale-95"
                        >
                          <Check size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {editingOverview === null ? (
                  <p className="text-xl md:text-2xl leading-relaxed font-medium text-[var(--crm-text)] pr-10 italic font-serif opacity-90">
                    "{insights.overview || 'No summary generated yet.'}"
                  </p>
                ) : (
                  <textarea
                    value={editingOverview}
                    onChange={(e) => setEditingOverview(e.target.value)}
                    className="w-full min-h-[220px] bg-[var(--crm-control-bg)] border border-[var(--crm-border)] rounded-[2rem] p-6 text-base md:text-lg font-medium text-[var(--crm-text)] outline-none focus:ring-4 focus:ring-cyan-500/10 resize-none shadow-inner"
                  />
                )}
              </div>
            </motion.div>

            {/* Pipeline Stage Visualizer */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className={`${lightCardClass} p-12 flex flex-col justify-center relative overflow-hidden group/stage`}>
              <div className="absolute -top-10 -right-10 w-64 h-64 bg-cyan-500/10 rounded-full blur-[100px] -z-0 group-hover:bg-cyan-500/20 transition-all duration-1000"></div>

              <div className="relative z-10 space-y-12">
                <div className="text-[10px] font-black text-[var(--crm-text-muted)] tracking-[0.4em] uppercase">Intelligence Confidence</div>

                <div className="space-y-8">
                  <div className="w-full bg-[var(--crm-control-bg)] h-6 rounded-full relative overflow-hidden shadow-inner flex items-center p-1.5 border border-[var(--crm-border)]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${getPhaseProgress(lead.phase)}%` }}
                      transition={{ duration: 2, type: 'spring', bounce: 0.2 }}
                      className="h-full bg-gradient-to-r from-cyan-600 via-emerald-300 to-cyan-400 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.4)] relative"
                    >
                      <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.3)_50%,transparent_100%)] animate-shine bg-[length:200%_100%]"></div>
                    </motion.div>
                  </div>

                  <div className="flex items-end justify-between gap-4">
                    <h2 className="text-4xl lg:text-3xl font-black tracking-tight text-[var(--crm-text)] uppercase truncate font-display">
                      {lead.phase?.toLowerCase() || 'Deployment'}
                    </h2>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-3xl font-black text-cyan-400 font-display">{getPhaseProgress(lead.phase)}%</span>
                      <span className="text-[9px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest">Protocol Sync</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>

        </div>
        {/* Scheduled Sessions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-lg">
                <CalendarDays size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-[var(--crm-text)] tracking-tight leading-none uppercase tracking-[0.05em] font-display">Meetings History</h3>
                <p className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest">{meetings.length} LOGGED SESSIONS</p>
              </div>
            </div>
            <button
              onClick={() => setShowMeetingModal(true)}
              className="px-8 py-4 bg-[var(--crm-control-bg)] border border-[var(--crm-border)] text-[var(--crm-text)] hover:text-cyan-500 hover:border-cyan-500/50 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-2xl active:scale-95 flex items-center gap-2"
            >
              <Plus size={14} /> Schedule Meetings
            </button>
          </div>

          {meetings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {meetings.map((m, idx) => {
                const d = m.scheduledAt?.toDate?.();
                const isPast = d && d < new Date();
                return (
                  <motion.div key={m.id}
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }}
                    className={`${lightCardClass} !p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/5 group/meet ${isPast ? 'opacity-60' : 'hover:border-cyan-500/30'}`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-6">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${isPast ? 'bg-[var(--crm-control-bg)] border-[var(--crm-border)] text-[var(--crm-text-muted)]' : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400 shadow-xl shadow-cyan-500/10'}`}>
                        {isPast ? <RotateCcw size={20} /> : <CalendarDays size={20} />}
                      </div>
                      <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${isPast ? 'bg-[var(--crm-control-bg)] text-[var(--crm-text-muted)] border-[var(--crm-border)]' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-lg'}`}>
                        {isPast ? 'Concluded' : 'Pending'}
                      </span>
                    </div>
                    <div className="space-y-4">
                      <div className="font-black text-[var(--crm-text)] group-hover/meet:text-cyan-400 transition-colors text-sm line-clamp-1 uppercase tracking-tight">{m.title}</div>
                      {d && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2.5 text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest">
                            <Calendar size={12} className="text-cyan-500/50" /> {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                          <div className="flex items-center gap-2.5 text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest">
                            <Clock size={12} className="text-cyan-500/50" /> {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="glass-card !bg-[var(--crm-control-bg)] !py-24 text-center border-[var(--crm-border)] border border-dashed shadow-inner flex flex-col items-center gap-5 rounded-[2.5rem]">
              <div className="p-5 bg-[var(--crm-control-bg)] rounded-full text-[var(--crm-text-muted)] border border-[var(--crm-border)]">
                <CalendarDays size={48} />
              </div>
              <p className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-[0.3em] italic">No Meetings schedules.</p>
            </div>
          )}
        </motion.div>

        {/* Strategic Intelligence Deep-Dive */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Actionable Path */}
          <div className={`${lightCardClass} p-8 flex flex-col group/card relative`}>
            <div className="flex justify-between items-center mb-8 border-b border-[var(--crm-border)] pb-8 relative z-10">
              <h3 className="font-black text-[var(--crm-text)] flex items-center gap-4 text-sm uppercase tracking-widest font-display">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-lg"><CheckSquare size={18} /></div> Actionable Path
              </h3>
              <div className="flex gap-2">
                <button onClick={() => setExpandedSection('tasks')} className="p-2.5 text-[var(--crm-text-muted)] hover:text-cyan-500 bg-[var(--crm-control-bg)] border border-[var(--crm-border)] rounded-xl transition-all shadow-lg active:scale-95">
                  <Maximize2 size={16} />
                </button>
                <button onClick={handleTaskAdd} className="p-2.5 text-[var(--crm-text-muted)] hover:text-cyan-500 bg-[var(--crm-control-bg)] border border-[var(--crm-border)] rounded-xl transition-all active:scale-95 shadow-lg">
                  <Plus size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto max-h-[500px] pr-2 scrollbar-hide relative z-10">
              {insights.tasks.length === 0 && (
                <div className="text-center p-16 bg-[var(--crm-control-bg)] rounded-[2.5rem] border border-dashed border-[var(--crm-border)] flex flex-col items-center gap-5">
                  <div className="p-4 bg-[var(--crm-control-bg)] rounded-full text-[var(--crm-text-muted)]"><CheckSquare size={24} /></div>
                  <p className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-[0.2em] italic">No strategic tasks defined.</p>
                </div>
              )}

              {insights.tasks.map((task: any, idx: number) => {
                const isEditingTask = editingItem?.field === 'tasks' && editingItem?.index === idx;
                return (
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} key={idx} className={`p-5 rounded-2xl border transition-all flex items-start gap-5 group/task ${task.completed ? 'bg-[var(--crm-control-bg)] border-[var(--crm-border)] opacity-60' : 'bg-[var(--crm-control-bg)] border-[var(--crm-border)] hover:border-cyan-500/30 shadow-xl hover:shadow-cyan-500/5'}`}>
                    <button
                      onClick={() => handleTaskToggle(idx)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border transition-all ${task.completed ? 'bg-cyan-600 border-cyan-600 text-white' : 'bg-[var(--crm-card-bg)] border-[var(--crm-border)] hover:border-cyan-500'}`}
                    >
                      {task.completed && <Check size={14} strokeWidth={4} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      {isEditingTask ? (
                        <div className="space-y-4">
                          <input type="text" value={JSON.parse(editingItem.value || "{}").title} onChange={e => {
                            const parsed = JSON.parse(editingItem.value || "{}");
                            parsed.title = e.target.value;
                            setEditingItem({ ...editingItem, value: JSON.stringify(parsed) });
                          }} className="w-full text-xs font-bold bg-black/40 border border-white/10 p-4 rounded-xl outline-none focus:ring-4 focus:ring-cyan-500/10 text-[var(--crm-text)] shadow-inner" />
                          <div className="flex justify-end gap-3">
                            <button onClick={() => setEditingItem(null)} className="px-4 py-2 text-[10px] font-black uppercase text-[var(--crm-text-muted)] hover:text-slate-300 transition-all tracking-widest">Abort</button>
                            <button onClick={async () => {
                              const parsed = JSON.parse(editingItem.value);
                              const newArr = [...insights.tasks];
                              newArr[idx] = parsed;
                              await saveInsights({ ...insights, tasks: newArr });
                              setEditingItem(null);
                            }} className="px-6 py-2 text-[10px] font-black uppercase bg-cyan-600 text-[var(--crm-text)] rounded-xl shadow-xl shadow-cyan-500/20 active:scale-95 transition-all tracking-widest">Save</button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 py-1">
                          <h4 className={`font-bold text-sm leading-relaxed ${task.completed ? 'text-[var(--crm-text-muted)] line-through' : 'text-[var(--crm-text)] font-extrabold'}`}>{task.title}</h4>
                          <span className="text-[9px] font-black text-[var(--crm-text-muted)] uppercase tracking-[0.2em]">{task.assignee} &bull; {task.dueDate}</span>
                        </div>
                      )}
                    </div>

                    {!isEditingTask && (
                      <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover/task:opacity-100 transition-all translate-x-0 sm:translate-x-2 sm:group-hover:translate-x-0 shrink-0">
                        <button onClick={() => setEditingItem({ field: 'tasks', index: idx, value: JSON.stringify(task) })} className="p-2 text-[var(--crm-text-muted)] hover:text-cyan-500 transition-all bg-[var(--crm-card-bg)] border border-[var(--crm-border)] rounded-lg"><Edit size={14} /></button>
                        <button onClick={() => handleTaskDelete(idx)} className="p-2 text-[var(--crm-text-muted)] hover:text-rose-500 transition-all bg-[var(--crm-card-bg)] border border-[var(--crm-border)] rounded-lg"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Minutes of Meeting */}
          <div className={`${lightCardClass} p-8 flex flex-col group/card relative`}>
            <div className="flex justify-between items-center mb-8 border-b border-[var(--crm-border)] pb-8 relative z-10">
              <h3 className="font-black text-[var(--crm-text)] flex items-center gap-4 text-sm uppercase tracking-widest font-display">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg"><AlignLeft size={18} /></div> Session Minutes
              </h3>
              <div className="flex gap-2">
                <button onClick={() => setExpandedSection('minutes')} className="p-2.5 text-[var(--crm-text-muted)] hover:text-emerald-500 bg-[var(--crm-control-bg)] border border-[var(--crm-border)] rounded-xl transition-all shadow-lg active:scale-95">
                  <Maximize2 size={16} />
                </button>
                <button
                  onClick={() => handleArrayAdd('meetingMinutes')}
                  className="p-2.5 text-[var(--crm-text-muted)] hover:text-cyan-500 bg-[var(--crm-control-bg)] border border-[var(--crm-border)] rounded-xl transition-all active:scale-95 shadow-lg"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto max-h-[500px] pr-2 scrollbar-hide relative z-10">
              {(Array.isArray(insights.meetingMinutes) ? insights.meetingMinutes : []).map((point: string, idx: number) => {
                const isEditingThis = editingItem?.field === 'meetingMinutes' && editingItem?.index === idx;
                return (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} key={idx} className="group/item relative bg-[var(--crm-control-bg)] hover:bg-[var(--crm-control-hover-bg)] p-7 rounded-[1.8rem] border border-[var(--crm-border)] transition-all shadow-xl">
                    {isEditingThis ? (
                      <div className="space-y-4">
                        <textarea
                          autoFocus
                          className="w-full text-xs font-bold bg-black/40 border border-white/10 rounded-xl p-5 outline-none focus:ring-4 focus:ring-cyan-500/10 resize-none min-h-[120px] text-[var(--crm-text)] shadow-inner"
                          value={editingItem.value}
                          onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                        />
                        <div className="flex justify-end gap-3">
                          <button onClick={() => setEditingItem(null)} className="px-4 py-2 text-[10px] font-black uppercase text-[var(--crm-text-muted)] hover:text-slate-300 transition-all tracking-widest">Abort</button>
                          <button onClick={handleArraySave} className="px-6 py-2 text-[10px] font-black uppercase bg-cyan-600 text-[var(--crm-text)] rounded-xl shadow-xl shadow-cyan-500/20 active:scale-95 transition-all tracking-widest">Save</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2.5 shrink-0 shadow-[0_0_10px_rgba(52,211,153,0.6)]"></div>
                        <span className="text-[13px] font-bold text-[var(--crm-text)] leading-relaxed pr-16">{point}</span>
                        <div className="absolute top-6 right-6 flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-all translate-x-0 sm:translate-x-2 sm:group-hover:translate-x-0">
                          <button onClick={() => setEditingItem({ field: 'meetingMinutes', index: idx, value: point })} className="p-2 text-[var(--crm-text-muted)] hover:text-cyan-500 bg-[var(--crm-card-bg)] border border-[var(--crm-border)] rounded-xl shadow-lg transition-all"><Edit size={14} /></button>
                          <button onClick={() => handleArrayDelete('meetingMinutes', idx)} className="p-2 text-[var(--crm-text-muted)] hover:text-rose-500 bg-[var(--crm-card-bg)] border border-[var(--crm-border)] rounded-xl shadow-lg transition-all"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Transcript Core */}
          <div className={`${lightCardClass} p-8 flex flex-col relative overflow-hidden group/transcript`}>
            <div className="absolute top-10 right-10 text-9xl text-[var(--crm-text)]/5 font-serif leading-none italic pointer-events-none select-none z-0 rotate-12 -mr-8 -mt-8">"</div>
            <div className="flex justify-between items-center mb-8 border-b border-[var(--crm-border)] pb-8 relative z-10">
              <h3 className="font-black text-[var(--crm-text)] flex items-center gap-4 text-sm uppercase tracking-widest font-display">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-lg"><AlignLeft size={18} /></div> Audio Intelligence
              </h3>
              {/* {selectedRec && (
                <button
                  onClick={handleSyncTranscript}
                  disabled={syncingTranscript || !selectedRec.audioUrl}
                  className="p-2 text-purple-400 hover:text-[var(--crm-text)] bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                  title="Force re-sync of audio transcription"
                >
                  {syncingTranscript ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                  {syncingTranscript ? 'Syncing...' : 'Regenerate Transcript'}
                </button>
              )} */}
            </div>
            <div className="flex-1 bg-[var(--crm-control-bg)] p-8 rounded-[2rem] border border-[var(--crm-border)] overflow-y-auto max-h-[400px] relative z-10 shadow-inner group-hover/transcript:bg-[var(--crm-control-hover-bg)] transition-all duration-500 scrollbar-hide">
              {selectedRec?.transcript ? (
                <div className="text-[var(--crm-text)]">
                  <TranscriptPlayer
                    audioUrl={selectedRec.audioUrl}
                    transcriptData={selectedRec.transcriptData}
                    fallbackText={selectedRec.transcript}
                  />
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-[var(--crm-text-muted)] font-black text-[10px] uppercase tracking-[0.3em] italic text-center py-20 gap-8">
                  <div className="w-24 h-24 bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-indigo-500/5">
                    <Zap size={40} className="text-[var(--crm-text-muted)] animate-pulse" />
                  </div>
                  No active payload detected.
                </div>
              )}
            </div>
          </div>
        </div>



        <div className="bg-[var(--crm-card-bg)] rounded-[3rem] p-12 flex flex-col md:flex-row items-center justify-between gap-10 relative overflow-hidden shadow-[0_22px_48px_-34px_rgba(15,23,42,0.34)] border border-[var(--crm-border)] backdrop-blur-3xl">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none translate-x-1/3 -translate-y-1/3 opacity-50"></div>

          <div className="flex flex-col md:flex-row items-center gap-10 relative z-10 text-center md:text-left">
            <div className="w-28 h-28 bg-[var(--crm-control-bg)] p-2 border-4 border-[var(--crm-border)] rounded-[3rem] flex items-center justify-center overflow-hidden shadow-2xl backdrop-blur-2xl">
              <img src={lead.avatar || `https://ui-avatars.com/api/?name=${lead.name || 'User'}&background=random`} className="object-cover w-full h-full rounded-[2.5rem]" alt={lead.name || 'Lead'} />
            </div>
            <div className="space-y-3">
              <div className="text-[10px] font-black text-cyan-400 tracking-[0.4em] uppercase font-display">{lead.company}</div>
              <div className="font-black text-[var(--crm-text)] text-3xl md:text-5xl tracking-tight leading-none font-display">{lead.name}</div>
              <div className="text-sm font-semibold text-[var(--crm-text-muted)] mt-4 flex flex-wrap justify-center md:justify-start gap-4 uppercase tracking-[0.2em] text-[9px]">
                <span className="flex items-center gap-3 shadow-2xl bg-[var(--crm-control-bg)] px-4 py-2 rounded-full border border-[var(--crm-border)] text-[var(--crm-text)] backdrop-blur-md transition-all hover:bg-[var(--crm-control-hover-bg)]">{lead.email || 'NO_EMAIL_VECTOR'}</span>
                <span className="flex items-center gap-3 shadow-2xl bg-[var(--crm-control-bg)] px-4 py-2 rounded-full border border-[var(--crm-border)] text-[var(--crm-text)] backdrop-blur-md transition-all hover:bg-[var(--crm-control-hover-bg)]">{lead.phone || 'NO_PHONETIC_LINK'}</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 md:w-auto w-full">
            <Link to={`/clients/${lead.id}/edit`} className="w-full md:w-auto px-12 py-6 bg-[var(--crm-surface-strong)] text-[var(--crm-text)] hover:bg-cyan-500 hover:text-white rounded-[2rem] text-[10px] font-black uppercase tracking-[0.3em] transition-all shadow-[0_25px_50px_-12px_rgba(15,23,42,0.12)] hover:shadow-cyan-500/20 active:scale-95 flex items-center justify-center gap-3 font-display">
              <Edit size={18} /> Modify Profile
            </Link>
          </div>
        </div>


        <AnimatePresence>
          {expandedSection && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-12 overflow-hidden">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setExpandedSection(null)} className="absolute inset-0 bg-slate-950/95 backdrop-blur-3xl" />
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 40 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 40 }}
                className="bg-slate-900/80 rounded-[3.5rem] shadow-[0_32px_120px_rgba(0,0,0,0.8)] w-full max-w-6xl h-full max-h-[90vh] border border-white/10 relative z-10 flex flex-col overflow-hidden backdrop-blur-3xl"
              >
                <div className="p-12 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                  <div className="space-y-2">
                    <h2 className="text-3xl md:text-5xl font-black text-[var(--crm-text)] tracking-tight uppercase font-display">
                      {expandedSection === 'tasks' ? 'Operational Path' : 'Session Intelligence'}
                    </h2>
                    <p className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.4em]">High-Density Analytics View</p>
                  </div>
                  <button onClick={() => setExpandedSection(null)} className="p-5 bg-white/5 hover:bg-white/10 text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] border border-white/10 rounded-[2rem] transition-all shadow-2xl active:scale-95">
                    <Minimize2 size={32} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-12 md:p-20 space-y-10 scrollbar-hide">
                  {expandedSection === 'tasks' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {insights.tasks.map((task: any, idx: number) => (
                        <div key={idx} className={`p-10 rounded-[2.5rem] border transition-all flex items-start gap-8 ${task.completed ? 'bg-white/[0.02] border-white/5 opacity-50' : 'bg-white/[0.05] border-white/10 shadow-2xl shadow-black/40'}`}>
                          <button onClick={() => handleTaskToggle(idx)} className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-1 border transition-all ${task.completed ? 'bg-cyan-600 border-cyan-600 text-[var(--crm-text)]' : 'bg-white/5 border-white/20'}`}>
                            {task.completed && <Check size={20} strokeWidth={4} />}
                          </button>
                          <div className="space-y-4">
                            <h4 className={`text-2xl font-black tracking-tight ${task.completed ? 'text-[var(--crm-text-muted)] line-through' : 'text-[var(--crm-text)] font-display'}`}>{task.title}</h4>
                            <div className="flex gap-4">
                              <span className="text-[10px] font-black text-cyan-400 bg-cyan-500/10 px-4 py-1.5 rounded-full uppercase tracking-widest">{task.assignee}</span>
                              <span className="text-[10px] font-black text-[var(--crm-text-muted)] bg-white/5 px-4 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-2"><Clock size={12} /> {task.dueDate}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-12 max-w-5xl mx-auto">
                      {(Array.isArray(insights.meetingMinutes) ? insights.meetingMinutes : []).map((point: string, idx: number) => (
                        <div key={idx} className="flex gap-12 group">
                          <div className="relative">
                            <div className="w-5 h-5 rounded-full bg-emerald-500 mt-3 shrink-0 shadow-[0_0_20px_rgba(16,185,129,0.8)] z-10 relative"></div>
                            {idx !== insights.meetingMinutes.length - 1 && (
                              <div className="absolute top-8 left-2.5 w-[2px] h-[calc(100%+3rem)] bg-white/10 -translate-x-1/2"></div>
                            )}
                          </div>
                          <div className="bg-white/[0.03] p-10 rounded-[3rem] border border-white/5 group-hover:bg-white/[0.06] transition-all flex-1 shadow-2xl group-hover:shadow-[0_20px_60px_-12px_rgba(0,0,0,0.5)]">
                            <p className="text-xl md:text-3xl font-bold text-slate-200 leading-relaxed italic pr-6 opacity-90">"{point}"</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-10 bg-black/40 flex justify-between items-center text-[var(--crm-text)]/50 backdrop-blur-xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em]">HandyCRM Neural Protocol v8.0</p>
                  <div className="flex gap-3">
                    <Sparkles size={16} className="text-cyan-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest">End of Intelligence Stream</span>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Create Meeting Modal */}
        <AnimatePresence>
          {showMeetingModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMeetingModal(false)} className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl" />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 40 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 40 }}
                className="bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] rounded-[3.5rem] shadow-[0_32px_120px_rgba(0,0,0,0.8)] w-full max-w-2xl relative z-10 overflow-hidden backdrop-blur-3xl"
              >
                <div className="p-12 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-black text-[var(--crm-text)] tracking-tight uppercase font-display">Schedule Session</h2>
                    <p className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.4em]">Intelligence Deployment Parameters</p>
                  </div>
                  <button onClick={() => setShowMeetingModal(false)} className="p-4 bg-white/5 hover:bg-rose-500/10 hover:text-rose-500 border border-white/10 rounded-2xl transition-all shadow-xl active:scale-95 text-[var(--crm-text-muted)]">
                    <X size={24} />
                  </button>
                </div>
                <div className="p-12 space-y-10">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-[0.3em] block ml-2">Session Title</label>
                    <input placeholder="e.g. Strategic Synergy Summit" type="text" value={meetingForm.title} onChange={e => setMeetingForm(f => ({ ...f, title: e.target.value }))} className="w-full px-8 py-5 rounded-2xl border border-white/10 bg-white/5 focus:bg-white/10 focus:outline-none focus:ring-4 focus:ring-cyan-500/20 font-bold text-[var(--crm-text)] transition-all text-lg placeholder:text-slate-700" />
                  </div>
                  <div className="grid grid-cols-2 gap-10">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-[0.3em] block ml-2">Temporal Date</label>
                      <input type="date" value={meetingForm.date} onChange={e => setMeetingForm(f => ({ ...f, date: e.target.value }))} className="w-full px-8 py-5 rounded-2xl border border-white/10 bg-white/5 focus:bg-white/10 focus:outline-none focus:ring-4 focus:ring-cyan-500/20 font-bold text-[var(--crm-text)] transition-all appearance-none" />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-[0.3em] block ml-2">Temporal Time</label>
                      <input type="time" value={meetingForm.time} onChange={e => setMeetingForm(f => ({ ...f, time: e.target.value }))} className="w-full px-8 py-5 rounded-2xl border border-white/10 bg-white/5 focus:bg-white/10 focus:outline-none focus:ring-4 focus:ring-cyan-500/20 font-bold text-[var(--crm-text)] transition-all appearance-none" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-[0.3em] block ml-2">Strategic Briefing</label>
                    <textarea placeholder="Define key objectives for this intelligence session..." value={meetingForm.notes} onChange={e => setMeetingForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-8 py-5 rounded-2xl border border-white/10 bg-white/5 focus:bg-white/10 focus:outline-none focus:ring-4 focus:ring-cyan-500/20 font-bold text-[var(--crm-text)] transition-all resize-none min-h-[150px] placeholder:text-slate-700" />
                  </div>
                </div>
                <div className="p-12 bg-black/40 flex gap-8 border-t border-white/5">
                  <button onClick={() => setShowMeetingModal(false)} className="flex-1 py-6 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] transition-all">Abort</button>
                  <button onClick={handleSaveMeeting} disabled={savingMeeting} className="flex-1 py-6 rounded-[2rem] font-black bg-cyan-600 text-[var(--crm-text)] hover:bg-white hover:text-slate-900 transition-all text-[10px] uppercase tracking-[0.3em] flex items-center justify-center gap-4 shadow-[0_20px_40px_-12px_rgba(6,182,212,0.3)] active:scale-95 disabled:opacity-50 font-display">
                    {savingMeeting ? <Loader2 size={18} className="animate-spin" /> : null} Commit Session
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </PageLayout>
  );
}
