import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, onSnapshot, updateDoc, deleteField, addDoc, Timestamp } from 'firebase/firestore';
import { ref, getBytes } from 'firebase/storage';
import { useAuth } from './contexts/AuthContext';
import { db, storage } from './firebase';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2, AlertTriangle, Archive, Zap, Wand2, Sparkles, CheckSquare, AlignLeft,
  Briefcase, ChevronLeft, Calendar, Edit, Check, Plus, Trash2, ArrowUpRight,
  CalendarDays, Clock, RotateCcw, Download, X, Maximize2, Minimize2
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { jsPDF } from 'jspdf';
import TranscriptPlayer from './TranscriptPlayer';
import { uploadFileToGemini } from './utils/gemini';

export default function LeadInsights({ user }: { user: any }) {
  const { id } = useParams();
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

  useEffect(() => {
    if (!id) return;
    const fetchLead = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'leads', id));
        if (docSnap.exists()) {
          setLead({ id: docSnap.id, ...docSnap.data() });
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

    return () => { unsub(); munsubMeetings(); };
  }, [id, lead, selectedRecId]);

  useEffect(() => {
    if (lead !== null) setLoading(false);
  }, [lead]);

  const selectedRec = recordings.find(r => r.id === selectedRecId);

  useEffect(() => {
    if (!selectedRec || !selectedRec.transcript || selectedRec.aiInsights || generatingAI) return;
    if (attemptedRecs.current.has(selectedRec.id)) return; // Prevent infinite retry loops

    const generateInsights = async () => {
      attemptedRecs.current.add(selectedRec.id);
      setGeneratingAI(true);
      try {
        const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY || '';
        if (!apiKey) return;

        const ai = new GoogleGenAI({ apiKey });
        const prompt = `
          Analyze this sales call transcript and extract actionable intelligence. 
          Respond ONLY in strict JSON format. 
          ALL generated insights, summaries, and outputs MUST be written in English, regardless of the language spoken in the transcript.

          Focus specifically on creating high-quality "meetingMinutes" which should be a comprehensive, bulleted summary of the discussion. 
          Ensure every key topic, decision, and question from the meeting script is captured as a separate point in "meetingMinutes".
          
          Transcript: "${selectedRec.transcript}"
          
          Required JSON Structure:
          {
            "painPoints": ["point 1", "point 2", "point 3"],
            "requirements": ["req 1", "req 2", "req 3"],
            "nextActions": ["action 1", "action 2"],
            "improvements": ["improvement 1", "improvement 2"],
            "meetingMinutes": ["Key discussion point from call...", "Decision made regarding...", "Client asked about...", "Action agreed on..."],
            "overview": "A concise 3-sentence executive summary of the prospect's situation and goals.",
            "sentiment": "Positive",
            "tasks": [
              { "title": "...", "assignee": "Self", "dueDate": "Tomorrow", "completed": false }
            ],
            "recommendedPhase": "Evaluate the conversation and strictly return ONE of these exact strings: DISCOVERY, NURTURING, QUALIFIED, WON, LOST, INACTIVE",
            "leadScore": "A number from 0 to 100 evaluating the lead's conversion probability based on the call."
          }
        `;

        const validModels = [
          'gemini-2.5-flash',
          'gemini-2.0-flash',
          'gemini-2.0-flash-lite',
          'gemini-2.0-pro-exp'
        ];

        let success = false;
        let parsed = null;

        for (const modelName of validModels) {
          try {
            console.log(`Attempting intelligence generation with model: ${modelName}`);
            const response = await ai.models.generateContent({
              model: modelName,
              config: { responseMimeType: "application/json" },
              contents: [{ role: 'user', parts: [{ text: prompt }] }]
            });

            const rawText = response.text || "{}";
            const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            parsed = JSON.parse(jsonStr);
            success = true;
            break;
          } catch (err: any) {
            const status = err?.status || err?.code;
            if (status === 429) {
              await new Promise(resolve => setTimeout(resolve, 3000));
              continue;
            } else if (status === 404) {
              continue;
            }
            throw err;
          }
        }

        if (!success || !parsed) throw new Error("All Gemini models exhausted or unavailable.");

        if (parsed.tasks && Array.isArray(parsed.tasks)) {
          parsed.tasks = parsed.tasks.map((t: any) => ({ ...t, completed: false }));
        }

        console.log("AI Results Produced:", parsed);

        await updateDoc(doc(db, 'recordings', selectedRec.id), {
          aiInsights: parsed
        });

        // Auto-sync the Sales State Machine and Score
        const leadUpdates: any = {};
        if (parsed.recommendedPhase && lead.phase !== parsed.recommendedPhase.toUpperCase()) {
          leadUpdates.phase = parsed.recommendedPhase.toUpperCase();
        }
        if (parsed.leadScore !== undefined) {
          const newScore = Number(parsed.leadScore);
          if (!isNaN(newScore)) {
            leadUpdates.score = newScore;
          }
        }

        if (Object.keys(leadUpdates).length > 0) {
          leadUpdates.updatedAt = Timestamp.now();
          await updateDoc(doc(db, 'leads', lead.id), leadUpdates);
          setLead((prev: any) => ({ ...prev, ...leadUpdates }));
        }
      } catch (err) {
        console.error("Failed to generate AI insights:", err);
      } finally {
        setGeneratingAI(false);
      }
    };

    generateInsights();
  }, [selectedRec, generatingAI]);

  const handleRegenerate = async () => {
    if (!selectedRec) return;
    setGeneratingAI(false); // Reset lock
    attemptedRecs.current.delete(selectedRec.id); // Allow the retry
    await updateDoc(doc(db, 'recordings', selectedRec.id), {
      aiInsights: deleteField()
    });
  };

  const handleSyncTranscript = async () => {
    if (!selectedRec || !selectedRec.audioUrl || syncingTranscript) return;
    setSyncingTranscript(true);
    try {
      const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY || '';
      if (!apiKey) return;

      const storageRef = ref(storage, selectedRec.audioUrl);
      const buffer = await getBytes(storageRef);
      const blob = new Blob([buffer], { type: 'audio/webm' });

      const fileUri = await uploadFileToGemini(blob, apiKey);
      const ai = new GoogleGenAI({ apiKey });

      const genResult = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        config: {
          responseMimeType: "application/json",
        },
        contents: [{
          role: 'user', parts: [
            { text: "Transcribe this audio recording of a sales/lead call. Return a JSON object with a 'fullText' string and a 'segments' array. Each segment must be an object with 'text' (the word or short phrase), 'startTime' (in seconds as a float), and 'endTime' (in seconds as a float). Provide ONLY the raw JSON string." },
            { fileData: { mimeType: blob.type || "audio/webm", fileUri } }
          ]
        }]
      });

      const rawContent = genResult.text || "{}";
      const jsonStr = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonStr);

      await updateDoc(doc(db, 'recordings', selectedRec.id), {
        transcript: parsed.fullText || selectedRec.transcript,
        transcriptData: parsed.segments || []
      });
    } catch (err) {
      console.error("Transcription sync failed:", err);
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

  if (loading) {
    return (
      <div className="flex-1 bg-slate-50/50 flex items-center justify-center min-h-[100dvh]">
        <Loader2 className="animate-spin text-indigo-500 w-12 h-12" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex-1 bg-slate-50/50 flex items-center justify-center min-h-[100dvh] text-slate-400 font-black uppercase tracking-widest text-sm">
        Lead Record Missing
      </div>
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

  const getPhaseProgress = (phase: string) => {
    switch (phase?.toUpperCase()) {
      case 'INACTIVE':
      case 'LOST': return 10;
      case 'DISCOVERY': return 25;
      case 'NURTURING': return 50;
      case 'QUALIFIED': return 75;
      case 'WON':
      case 'CLOSED': return 100;
      default: return 60;
    }
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

    // Actionable Items
    // doc.setFontSize(14);
    // doc.setFont("helvetica", "bold");
    // doc.text("STRATEGIC ACTION ITEMS", margin, y);
    // y += 10;
    // doc.setFontSize(10);
    // doc.setFont("helvetica", "normal");

    // const tasks = Array.isArray(insights.tasks) ? insights.tasks : [];
    // if (tasks.length === 0) {
    //   doc.text("- No open tasks detected.", margin, y);
    // } else {
    //   tasks.forEach((t: any) => {
    //     if (y > 270) { doc.addPage(); y = 20; }
    //     const status = t.completed ? "[DONE] " : "[OPEN] ";
    //     const tText = `${status}${t.title} (${t.assignee} / ${t.dueDate})`;
    //     const tLines = doc.splitTextToSize(`• ${tText}`, 165);
    //     doc.text(tLines, margin, y);
    //     y += (tLines.length * 6) + 2;
    //   });
    // }

    // y += 15;

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
    <div className="flex-1 bg-slate-50/50 min-h-screen overflow-y-auto">
      <div className="max-w-7xl mx-auto p-4 sm:p-8 lg:p-12 space-y-10">

        {/* Navigation & Header */}
        <div className="flex flex-col gap-6 sm:gap-8">
          <Link to="/clients" className="inline-flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-[0.2em] transition-all group w-fit">
            <div className="p-2 bg-white border border-slate-200 rounded-xl group-hover:border-indigo-200 group-hover:shadow-lg group-hover:shadow-indigo-500/5 transition-all">
              <ChevronLeft size={14} />
            </div>
            Back to Pipeline
          </Link>

          <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 sm:gap-10">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">
                <Zap size={14} className="animate-pulse" /> Intelligence Vector Alpha
              </div>
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-none">
                {lead.company || lead.name}
              </h1>
              <p className="text-slate-500 font-medium max-w-2xl text-sm sm:text-lg italic leading-relaxed">
                Aggregated meeting heuristics and AI-generated insights.
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-wrap sm:flex-nowrap gap-4 shrink-0">
              <div className="glass-card !p-4 !rounded-2xl border-slate-200/60 shadow-xl shadow-slate-200/20 flex flex-col items-end flex-1 sm:min-w-[160px]">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Lead Phase</div>
                <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border shadow-sm ${lead.status === 'Won' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : lead.status === 'Lost' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${lead.status === 'Won' ? 'bg-emerald-500' : lead.status === 'Lost' ? 'bg-rose-500' : 'bg-indigo-500 animate-pulse'}`} />
                  {lead.status === 'Won' ? 'Closed-Won' : lead.status === 'Lost' ? 'Disqualified' : 'In Progress'}
                </span>
              </div>

              <div className="glass-card !p-4 !rounded-2xl border-slate-200/60 shadow-xl shadow-slate-200/20 flex flex-col items-end flex-1 sm:min-w-[160px]">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Call Sentiment</div>
                <div className="relative w-full">
                  <select
                    value={insights.sentiment}
                    onChange={handleSentimentChange}
                    className={`w-full px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border shadow-sm appearance-none cursor-pointer outline-none transition-all pr-8 ${insights.sentiment === 'Positive' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100/50' : insights.sentiment === 'Negative' ? 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100/50' : 'bg-slate-50 text-slate-600 border-slate-200/60 hover:bg-slate-100'}`}
                    disabled={!selectedRec}
                  >
                    <option value="Positive">Positive</option>
                    <option value="Neutral">Neutral</option>
                    <option value="Negative">Negative</option>
                    <option value="Analyzing...">Analyzing...</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <Edit size={12} />
                  </div>
                </div>
              </div>
            </motion.div>
          </header>
        </div>

        {/* Intelligence Timeline */}
        <div className="glass-card !p-2 !rounded-3xl border-slate-200/60 flex flex-nowrap items-center gap-3 overflow-x-auto shadow-xl shadow-slate-200/20 hide-scrollbar scroll-smooth">
          <div className="pl-6 pr-8 shrink-0 hidden sm:flex items-center gap-3 border-r border-slate-100 py-3">
            <Calendar size={18} className="text-slate-400" />
            <span className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase">Recordings</span>
          </div>
          <div className="flex gap-3 py-2 px-3 sm:px-0">
            {recordings.length > 0 ? (
              recordings.map((rec) => {
                const dateStr = rec.createdAt?.toDate ? rec.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : 'Legacy Core';
                const isSelected = selectedRecId === rec.id;
                return (
                  <button
                    key={rec.id}
                    onClick={() => setSelectedRecId(rec.id)}
                    className={`shrink-0 px-5 sm:px-6 py-2.5 sm:py-3 rounded-[1.2rem] text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition-all shadow-sm border whitespace-nowrap active:scale-95 ${isSelected ? 'bg-slate-900 text-white border-transparent shadow-xl shadow-slate-400/20' : 'bg-white text-slate-500 hover:bg-slate-50 border-slate-200/60'}`}
                  >
                    {dateStr}
                  </button>
                );
              })
            ) : (
              <span className="text-xs font-bold text-slate-400 py-3 px-6 italic uppercase tracking-widest">Initialization Pending...</span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        {selectedRec && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-end gap-4">
            <button
              onClick={handleExportPDF}
              className="px-6 py-3 rounded-2xl bg-white text-slate-600 hover:text-slate-900 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-slate-200/50 border border-slate-200/60 transition-all flex items-center gap-2 active:scale-95"
            >
              <Download size={14} /> Export Summary
            </button>
            <button
              onClick={handleRegenerate}
              disabled={generatingAI}
              className="px-6 py-3 rounded-2xl btn-primary text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-200 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {generatingAI ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {generatingAI ? 'Synchronizing...' : 'Regenerate Intelligence'}
            </button>
          </motion.div>
        )}

        <AnimatePresence>
          {generatingAI && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <div className="p-6 bg-indigo-50/50 border border-indigo-100 rounded-3xl flex items-center justify-center gap-4 text-indigo-600 font-black text-xs shadow-inner uppercase tracking-widest">
                <Sparkles size={18} className="animate-pulse" /> AI is analyzing the conversation...
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Intelligence Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { id: 'painPoints', title: 'Friction Points', icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
            { id: 'requirements', title: 'Core Objectives', icon: Archive, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
            { id: 'nextActions', title: 'Strategic Vectors', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
            { id: 'improvements', title: 'Critical Enhancers', icon: Wand2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' }
          ].map((col, idx) => {
            const Icon = col.icon;
            const dataArr = insights[col.id] || [];
            return (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} key={col.id} className="glass-card !rounded-[2.5rem] border-slate-200/60 overflow-hidden group/card hover:border-indigo-200/60 transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/5 flex flex-col h-[420px]">
                <div className="p-8 flex flex-col h-full">
                  <div className="flex justify-between items-center mb-8 shrink-0">
                    <h3 className="font-black text-slate-900 flex items-center gap-3 text-sm uppercase tracking-widest">
                      <div className={`p-2 rounded-xl ${col.bg} ${col.color} border ${col.border}`}><Icon size={16} /></div> {col.title}
                    </h3>
                    <button
                      onClick={() => handleArrayAdd(col.id)}
                      className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 border border-slate-100 rounded-xl transition-all active:scale-95 shadow-sm"
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
                            className="w-full text-xs font-bold bg-slate-50/50 border border-slate-200/60 rounded-2xl p-4 outline-none focus:ring-4 focus:ring-indigo-500/5 resize-none min-h-[100px] text-slate-700 shadow-inner"
                            value={editingItem.value}
                            onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                          />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingItem(null)} className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all tracking-widest">Cancel</button>
                            <button onClick={handleArraySave} className="px-5 py-2 text-[10px] font-black uppercase bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 active:scale-95 transition-all tracking-widest flex items-center gap-2"><Check size={12} /> Commit</button>
                          </div>
                        </div>
                      ) : (
                        <li key={i} className="group/item relative pl-4 leading-relaxed bg-slate-50/50 hover:bg-white p-4 rounded-[1.5rem] border border-transparent hover:border-slate-200/60 transition-all shadow-sm flex items-start gap-3">
                          <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${col.color.replace('text-', 'bg-')}`}></div>
                          <span className="text-xs font-semibold text-slate-600 pr-10">{item}</span>
                          <div className="absolute top-4 right-4 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-all translate-x-0 sm:translate-x-2 sm:group-hover:translate-x-0">
                            <button onClick={() => setEditingItem({ field: col.id, index: i, value: item })} className="p-1.5 text-slate-400 hover:text-indigo-600 bg-white border border-slate-100 rounded-lg shadow-sm transition-all"><Edit size={12} /></button>
                            <button onClick={() => handleArrayDelete(col.id, i)} className="p-1.5 text-slate-400 hover:text-rose-600 bg-white border border-slate-100 rounded-lg shadow-sm transition-all"><Trash2 size={12} /></button>
                          </div>
                        </li>
                      );
                    })}
                    {dataArr.length === 0 && (
                      <li className="text-[10px] font-black text-slate-300 uppercase italic tracking-widest text-center py-4">No data points captured.</li>
                    )}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Split View */}
        <div className="flex flex-col xl:flex-row gap-6 mb-8">

          {/* High-Level Overview & Progress */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Executive Summary Card */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="lg:col-span-2 bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl text-white relative overflow-hidden group/summary border border-slate-700/50">
              <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-[120px] pointer-events-none translate-x-1/3 -translate-y-1/3 opacity-50"></div>

              <div className="relative z-10 space-y-10">
                <div className="flex justify-between items-start">
                  <h3 className="font-black text-white flex items-center gap-4 text-lg uppercase tracking-[0.2em]">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10 backdrop-blur-md shadow-xl"><Sparkles className="text-indigo-300" size={24} /></div>
                    AI Summary
                  </h3>
                  <div className="flex gap-2">
                    {editingOverview === null ? (
                      <>
                        <button onClick={handleRegenerate} disabled={generatingAI} title="Recalibrate Analysis" className="p-2.5 text-indigo-300 hover:text-white hover:bg-white/10 bg-white/5 border border-white/10 rounded-xl transition-all shadow-xl disabled:opacity-50">
                          <RotateCcw size={18} className={generatingAI ? "animate-spin" : ""} />
                        </button>
                        <button onClick={() => setEditingOverview(insights.overview)} title="Override Content" className="p-2.5 text-indigo-300 hover:text-white hover:bg-white/10 bg-white/5 border border-white/10 rounded-xl transition-all shadow-xl">
                          <Edit size={18} />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                {editingOverview !== null ? (
                  <div className="space-y-6">
                    <textarea
                      autoFocus
                      className="w-full text-[13px] leading-loose font-medium bg-white/5 border border-white/10 rounded-[2rem] p-8 text-white/90 outline-none focus:ring-4 focus:ring-indigo-500/20 min-h-[220px] shadow-inner font-sans tracking-wide"
                      value={editingOverview}
                      onChange={e => setEditingOverview(e.target.value)}
                    />
                    <div className="flex justify-end gap-3">
                      <button onClick={() => setEditingOverview(null)} className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 hover:text-white transition-all tracking-widest">Abort</button>
                      <button onClick={handleOverviewSave} className="px-8 py-3 text-[10px] font-black uppercase bg-indigo-500 hover:bg-indigo-400 text-white flex items-center gap-2 rounded-xl shadow-2xl shadow-indigo-500/20 active:scale-95 transition-all tracking-widest"><Check size={14} /> Commit Changes</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-lg md:text-xl leading-relaxed font-medium text-slate-300 pr-10 italic font-serif">
                    "{insights.overview}"
                  </p>
                )}
              </div>
            </motion.div>

            {/* Pipeline Stage Visualizer */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="glass-card !rounded-[2.5rem] border-slate-200/60 p-12 shadow-2xl shadow-slate-200/20 flex flex-col justify-center relative overflow-hidden group/stage">
              <div className="absolute -top-10 -right-10 w-48 h-48 bg-indigo-50 rounded-full blur-[80px] -z-0 group-hover:bg-indigo-100 transition-colors duration-700"></div>

              <div className="relative z-10 space-y-10">
                <div className="text-[10px] font-black text-slate-400 tracking-[0.3em] uppercase">Pipeline Stage</div>

                <div className="space-y-6">
                  <div className="w-full bg-slate-100 h-4 rounded-full relative overflow-hidden shadow-inner flex items-center p-1">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${getPhaseProgress(lead.phase)}%` }}
                      transition={{ duration: 1.5, type: 'spring', bounce: 0.4 }}
                      className="h-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-400 rounded-full shadow-lg shadow-indigo-600/20"
                    />
                  </div>

                  <div className="flex items-end justify-between">
                    <h2 className="text-4xl lg:text-5xl font-black tracking-tight text-slate-900 uppercase">
                      {lead.phase?.toLowerCase() || 'Deployment'}
                    </h2>
                    <div className="flex flex-col items-end">
                      <span className="text-2xl font-black text-indigo-600">{getPhaseProgress(lead.phase)}%</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pipeline Score</span>
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
              <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm">
                <CalendarDays size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase tracking-[0.05em]">Meetings History</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{meetings.length} LOGGED MEETINGS</p>
              </div>
            </div>
            <button
              onClick={() => setShowMeetingModal(true)}
              className="px-8 py-3 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-slate-200/20 active:scale-95"
            >
              + Create Session
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
                    className={`glass-card !p-6 border-slate-200/60 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/5 group/meet ${isPast ? 'opacity-60 bg-slate-50/50' : 'hover:border-indigo-200/60'}`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${isPast ? 'bg-white border-slate-200 text-slate-300' : 'bg-indigo-50 border-indigo-100 text-indigo-600 shadow-sm'}`}>
                        {isPast ? <RotateCcw size={18} /> : <CalendarDays size={18} />}
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${isPast ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm'}`}>
                        {isPast ? 'Concluded' : 'Pending'}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div className="font-extrabold text-slate-900 group-hover/meet:text-indigo-600 transition-colors text-sm line-clamp-1">{m.title}</div>
                      {d && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            <Calendar size={12} className="text-indigo-500/50" /> {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                          <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            <Clock size={12} className="text-indigo-500/50" /> {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="glass-card !py-20 text-center border-slate-200/60 border border-dashed shadow-inner flex flex-col items-center gap-4">
              <div className="p-4 bg-slate-50 rounded-full text-slate-200">
                <CalendarDays size={40} />
              </div>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] italic">No active session schedules detected.</p>
            </div>
          )}
        </motion.div>

        {/* Strategic Intelligence Deep-Dive */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Actionable Path */}
          <div className="glass-card !rounded-[2.5rem] border-slate-200/60 p-8 shadow-xl shadow-slate-200/20 flex flex-col group/card relative">
            <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-6">
              <h3 className="font-black text-slate-900 flex items-center gap-3 text-sm uppercase tracking-widest">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm"><CheckSquare size={18} /></div> Actionable Path
              </h3>
              <div className="flex gap-2">
                <button onClick={() => setExpandedSection('tasks')} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 border border-slate-100 rounded-xl transition-all shadow-sm">
                  <Maximize2 size={16} />
                </button>
                <button onClick={handleTaskAdd} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 border border-slate-100 rounded-xl transition-all active:scale-95 shadow-sm">
                  <Plus size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto max-h-[500px] pr-2 scrollbar-hide">
              {insights.tasks.length === 0 && (
                <div className="text-center p-12 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200/60 flex flex-col items-center gap-4">
                  <div className="p-3 bg-white rounded-full text-slate-200"><CheckSquare size={24} /></div>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">No strategic tasks defined.</p>
                </div>
              )}

              {insights.tasks.map((task: any, idx: number) => {
                const isEditingTask = editingItem?.field === 'tasks' && editingItem?.index === idx;
                return (
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} key={idx} className={`p-4 rounded-2xl border transition-all flex items-start gap-4 group/task ${task.completed ? 'bg-slate-50/50 border-slate-200/40 opacity-60' : 'bg-white border-slate-200/60 hover:border-indigo-200/60 shadow-sm hover:shadow-lg hover:shadow-indigo-500/5'}`}>
                    <button
                      onClick={() => handleTaskToggle(idx)}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border transition-all ${task.completed ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 hover:border-indigo-300'}`}
                    >
                      {task.completed && <Check size={12} strokeWidth={4} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      {isEditingTask ? (
                        <div className="space-y-3">
                          <input type="text" value={JSON.parse(editingItem.value || "{}").title} onChange={e => {
                            const parsed = JSON.parse(editingItem.value || "{}");
                            parsed.title = e.target.value;
                            setEditingItem({ ...editingItem, value: JSON.stringify(parsed) });
                          }} className="w-full text-xs font-bold bg-slate-50/50 border border-slate-200/60 p-3 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/5" />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingItem(null)} className="px-3 py-1.5 text-[9px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all tracking-widest">Abort</button>
                            <button onClick={async () => {
                              const parsed = JSON.parse(editingItem.value);
                              const newArr = [...insights.tasks];
                              newArr[idx] = parsed;
                              await saveInsights({ ...insights, tasks: newArr });
                              setEditingItem(null);
                            }} className="px-5 py-1.5 text-[9px] font-black uppercase bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 active:scale-95 transition-all tracking-widest">Commit</button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1 py-1">
                          <h4 className={`font-bold text-sm leading-relaxed ${task.completed ? 'text-slate-400 line-through' : 'text-slate-900 font-extrabold'}`}>{task.title}</h4>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{task.assignee} &bull; {task.dueDate}</span>
                        </div>
                      )}
                    </div>

                    {!isEditingTask && (
                      <div className="flex sm:hidden group-hover/task:flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/task:opacity-100 transition-all translate-x-0 sm:translate-x-2 sm:group-hover:translate-x-0">
                        <button onClick={() => setEditingItem({ field: 'tasks', index: idx, value: JSON.stringify(task) })} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-all"><Edit size={14} /></button>
                        <button onClick={() => handleTaskDelete(idx)} className="p-1.5 text-slate-400 hover:text-rose-600 transition-all"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Minutes of Meeting */}
          <div className="glass-card !rounded-[2.5rem] border-slate-200/60 p-8 shadow-xl shadow-slate-200/20 flex flex-col group/card relative">
            <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-6">
              <h3 className="font-black text-slate-900 flex items-center gap-3 text-sm uppercase tracking-widest">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm"><AlignLeft size={18} /></div> Session Minutes
              </h3>
              <div className="flex gap-2">
                <button onClick={() => setExpandedSection('minutes')} className="p-2 text-slate-400 hover:text-emerald-600 bg-slate-50 border border-slate-100 rounded-xl transition-all shadow-sm">
                  <Maximize2 size={16} />
                </button>
                <button
                  onClick={() => handleArrayAdd('meetingMinutes')}
                  className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 border border-slate-100 rounded-xl transition-all active:scale-95 shadow-sm"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto max-h-[500px] pr-2 scrollbar-hide">
              {(Array.isArray(insights.meetingMinutes) ? insights.meetingMinutes : []).map((point: string, idx: number) => {
                const isEditingThis = editingItem?.field === 'meetingMinutes' && editingItem?.index === idx;
                return (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} key={idx} className="group/item relative bg-slate-50/50 hover:bg-white p-6 rounded-2xl border border-transparent hover:border-slate-200/60 transition-all shadow-sm hover:shadow-lg hover:shadow-slate-500/5">
                    {isEditingThis ? (
                      <div className="space-y-3">
                        <textarea
                          autoFocus
                          className="w-full text-xs font-bold bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 outline-none focus:ring-4 focus:ring-indigo-500/5 resize-none min-h-[100px] text-slate-700 shadow-inner"
                          value={editingItem.value}
                          onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                        />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditingItem(null)} className="px-3 py-1.5 text-[9px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all tracking-widest">Abort</button>
                          <button onClick={handleArraySave} className="px-5 py-1.5 text-[9px] font-black uppercase bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 active:scale-95 transition-all tracking-widest">Commit</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-4">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2.5 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                        <span className="text-[13px] font-bold text-slate-900 leading-relaxed pr-10">{point}</span>
                        <div className="absolute top-4 right-4 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-all translate-x-0 sm:translate-x-2 sm:group-hover:translate-x-0">
                          <button onClick={() => setEditingItem({ field: 'meetingMinutes', index: idx, value: point })} className="p-1.5 text-slate-400 hover:text-indigo-600 bg-white border border-slate-100 rounded-lg shadow-sm transition-all"><Edit size={12} /></button>
                          <button onClick={() => handleArrayDelete('meetingMinutes', idx)} className="p-1.5 text-slate-400 hover:text-rose-600 bg-white border border-slate-100 rounded-lg shadow-sm transition-all"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Transcript Core */}
          <div className="glass-card !rounded-[2.5rem] border-slate-200/60 p-8 shadow-xl shadow-slate-200/20 flex flex-col relative overflow-hidden group/transcript">
            <div className="absolute top-10 right-10 text-9xl text-slate-100 font-serif leading-none italic pointer-events-none select-none z-0 rotate-12 -mr-8 -mt-8 opacity-50">"</div>
            <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-6 relative z-10">
              <h3 className="font-black text-slate-900 flex items-center gap-3 text-sm uppercase tracking-widest">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 shadow-sm"><AlignLeft size={18} /></div> Audio Intelligence
              </h3>
              <div className="flex gap-2">
                {/* {selectedRec && selectedRec.audioUrl && !selectedRec.transcriptData && (
                  <button
                    onClick={handleSyncTranscript}
                    disabled={syncingTranscript}
                    className="p-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 shadow-sm rounded-xl transition-all flex items-center gap-2 text-[8px] font-black px-4 uppercase tracking-[0.2em] disabled:opacity-50 active:scale-95"
                  >
                    {syncingTranscript ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                    {syncingTranscript ? 'Syncing...' : 'Sync Subtitles'}
                  </button>
                )} */}
                {/* {selectedRec && (
                  <Link to={`/r/${selectedRec.id}`} className="p-2.5 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-white border border-slate-100 shadow-sm rounded-xl transition-all flex items-center gap-2 text-[8px] font-black px-4 uppercase tracking-[0.2em] active:scale-95">
                    Full <ArrowUpRight size={14} />
                  </Link>
                )} */}
              </div>
            </div>
            <div className="flex-1 bg-slate-50/80 p-8 rounded-[2rem] border border-slate-100 overflow-y-auto max-h-[400px] relative z-10 shadow-inner group-hover/transcript:bg-white transition-all duration-500 scrollbar-hide">
              {selectedRec?.transcript ? (
                <TranscriptPlayer
                  audioUrl={selectedRec.audioUrl}
                  transcriptData={selectedRec.transcriptData}
                  fallbackText={selectedRec.transcript}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] italic text-center py-20 gap-6">
                  <div className="w-20 h-20 bg-white border border-slate-100 rounded-[2rem] flex items-center justify-center shadow-xl shadow-slate-200/50">
                    <Zap size={32} className="text-slate-200 animate-pulse" />
                  </div>
                  No active payload detected.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lead Identity Footer Card */}
        <div className="bg-slate-900 rounded-[3rem] p-12 flex flex-col md:flex-row items-center justify-between gap-10 relative overflow-hidden shadow-2xl border border-slate-700/50">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none translate-x-1/3 -translate-y-1/3 opacity-50"></div>

          <div className="flex flex-col md:flex-row items-center gap-8 relative z-10 text-center md:text-left">
            <div className="w-24 h-24 bg-white/10 p-1.5 border-4 border-white/5 rounded-[2.5rem] flex items-center justify-center overflow-hidden shadow-2xl backdrop-blur-md">
              <img src={lead.avatar || `https://ui-avatars.com/api/?name=${lead.name || 'User'}&background=random`} className="object-cover w-full h-full rounded-[2rem]" alt={lead.name || 'Lead'} />
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-black text-indigo-400 tracking-[0.4em] uppercase">Core Entity Identity</div>
              <div className="font-black text-white text-3xl md:text-4xl tracking-tight leading-none">{lead.company || lead.name}</div>
              <div className="text-sm font-semibold text-slate-400 mt-2 flex flex-wrap justify-center md:justify-start gap-4 uppercase tracking-widest text-[9px]">
                <span className="flex items-center gap-2 shadow-sm bg-white/5 px-3 py-1 rounded-full border border-white/5">{lead.email || 'NO_EMAIL_VECTOR'}</span>
                <span className="flex items-center gap-2 shadow-sm bg-white/5 px-3 py-1 rounded-full border border-white/5">{lead.phone || 'NO_PHONETIC_LINK'}</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 md:w-auto w-full">
            <Link to={`/clients/${lead.id}/edit`} className="w-full md:w-auto px-10 py-5 bg-white text-slate-900 hover:bg-indigo-50 hover:text-indigo-600 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-2xl hover:shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-3">
              <Edit size={18} /> Modify Profile
            </Link>
          </div>
        </div>

        {/* Global Expanded Modal for Details */}
        <AnimatePresence>
          {expandedSection && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-12 overflow-hidden">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setExpandedSection(null)} className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl" />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 40 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 40 }}
                className="bg-white rounded-[3rem] shadow-[0_32px_120px_rgba(0,0,0,0.5)] w-full max-w-5xl h-full max-h-[85vh] border border-slate-800/10 relative z-10 flex flex-col overflow-hidden"
              >
                <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                  <div className="space-y-1">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">
                      {expandedSection === 'tasks' ? 'Full Actionable Path' : 'Detailed Session Minutes'}
                    </h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enhanced Intelligence View</p>
                  </div>
                  <button onClick={() => setExpandedSection(null)} className="p-4 bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-900 border border-slate-100 rounded-2xl transition-all shadow-sm active:scale-95">
                    <Minimize2 size={24} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-10 md:p-16 space-y-8 scrollbar-hide">
                  {expandedSection === 'tasks' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {insights.tasks.map((task: any, idx: number) => (
                        <div key={idx} className={`p-8 rounded-[2rem] border transition-all flex items-start gap-6 ${task.completed ? 'bg-slate-50/50 border-slate-200/40 opacity-60' : 'bg-white border-slate-200/60 shadow-xl shadow-slate-200/20'}`}>
                          <button onClick={() => handleTaskToggle(idx)} className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-1 border transition-all ${task.completed ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'}`}>
                            {task.completed && <Check size={16} strokeWidth={4} />}
                          </button>
                          <div className="space-y-3">
                            <h4 className={`text-xl font-black tracking-tight ${task.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{task.title}</h4>
                            <div className="flex gap-4">
                              <span className="text-xs font-black text-indigo-500 bg-indigo-50 px-3 py-1 rounded-lg uppercase tracking-widest">{task.assignee}</span>
                              <span className="text-xs font-black text-slate-400 bg-slate-50 px-3 py-1 rounded-lg uppercase tracking-widest flex items-center gap-2"><Clock size={12} /> {task.dueDate}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-8 max-w-4xl mx-auto">
                      {(Array.isArray(insights.meetingMinutes) ? insights.meetingMinutes : []).map((point: string, idx: number) => (
                        <div key={idx} className="flex gap-8 group">
                          <div className="relative">
                            <div className="w-4 h-4 rounded-full bg-emerald-500 mt-2 shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.5)] z-10 relative"></div>
                            {idx !== insights.meetingMinutes.length - 1 && (
                              <div className="absolute top-6 left-2 w-[2px] h-[calc(100%+2rem)] bg-slate-100 -translate-x-1/2"></div>
                            )}
                          </div>
                          <div className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100 group-hover:bg-white transition-all flex-1 shadow-sm group-hover:shadow-xl group-hover:shadow-emerald-500/5">
                            <p className="text-lg md:text-xl font-bold text-slate-700 leading-relaxed italic pr-4">"{point}"</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-8 bg-slate-900 flex justify-between items-center text-white">
                  <p className="text-xs font-black uppercase tracking-widest opacity-60">HandyCRM.AI Intelligent Protocol v4.2</p>
                  <div className="flex gap-2">
                    <Sparkles size={16} className="text-indigo-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest">End of Stream</span>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Create Meeting Modal */}
      <AnimatePresence>
        {showMeetingModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMeetingModal(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 40 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="bg-white rounded-[3rem] shadow-[0_32px_120px_rgba(0,0,0,0.4)] w-full max-w-xl border border-slate-100 relative z-10 overflow-hidden"
            >
              <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Define Session</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocol Generation Parameters</p>
                </div>
                <button onClick={() => setShowMeetingModal(false)} className="p-3 bg-white hover:bg-rose-50 hover:text-rose-500 border border-slate-100 rounded-2xl transition-all shadow-sm active:scale-95">
                  <X size={20} />
                </button>
              </div>
              <div className="p-10 space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block ml-1">Session Designation</label>
                  <input placeholder="e.g. Strategic Alignment Summit" type="text" value={meetingForm.title} onChange={e => setMeetingForm(f => ({ ...f, title: e.target.value }))} className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/5 font-bold text-sm transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block ml-1">Calendar Vector</label>
                    <input type="date" value={meetingForm.date} onChange={e => setMeetingForm(f => ({ ...f, date: e.target.value }))} className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/5 font-bold text-sm transition-all appearance-none" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block ml-1">Temporal Anchor</label>
                    <input type="time" value={meetingForm.time} onChange={e => setMeetingForm(f => ({ ...f, time: e.target.value }))} className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/5 font-bold text-sm transition-all appearance-none" />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block ml-1">Strategic Constraints</label>
                  <textarea placeholder="Outline key objectives for this deployment..." value={meetingForm.notes} onChange={e => setMeetingForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/5 font-bold text-sm transition-all resize-none min-h-[120px]" />
                </div>
              </div>
              <div className="p-10 bg-slate-50/80 flex gap-6 border-t border-slate-100">
                <button onClick={() => setShowMeetingModal(false)} className="flex-1 py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all">Cancel</button>
                <button onClick={handleSaveMeeting} disabled={savingMeeting} className="flex-1 py-5 rounded-[1.5rem] font-black bg-indigo-600 text-white hover:bg-slate-900 transition-all text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl shadow-indigo-500/20 active:scale-95 disabled:opacity-50">
                  {savingMeeting ? <Loader2 size={16} className="animate-spin" /> : null} Initiate Session
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
