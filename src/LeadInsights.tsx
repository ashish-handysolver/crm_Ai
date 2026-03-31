import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, onSnapshot, updateDoc, deleteField } from 'firebase/firestore';
import { useAuth } from './contexts/AuthContext';
import { db } from './firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, AlertTriangle, Archive, Zap, Wand2, Sparkles, CheckSquare, AlignLeft, Briefcase, ChevronLeft, Calendar, Edit3, Check, Plus, Trash2, ArrowUpRight, CalendarDays, Clock, RotateCcw, Download } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { jsPDF } from 'jspdf';

export default function LeadInsights({ user }: { user: any }) {
  const { id } = useParams();
  const [lead, setLead] = useState<any>(null);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [selectedRecId, setSelectedRecId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingAI, setGeneratingAI] = useState(false);

  const [editingItem, setEditingItem] = useState<{ field: string, index: number, value: string } | null>(null);
  const [editingOverview, setEditingOverview] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<any[]>([]);

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

    const generateInsights = async () => {
      setGeneratingAI(true);
      try {
        const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY || '';
        if (!apiKey) return;

        const ai = new GoogleGenAI({ apiKey });
        const prompt = `
          Analyze this sales call transcript and extract actionable intelligence. 
          Respond ONLY in strict JSON format. 

          Focus specifically on creating high-quality "meetingMinutes" which should be a comprehensive, bulleted summary of the discussion. 
          Ensure every key topic, decision, and question from the meeting script is captured as a separate point in "meetingMinutes".
          
          Transcript: "${selectedRec.transcript}"
          
          Required JSON Structure:
          {
            "painPoints": ["point 1", "point 2", "point 3"],
            "requirements": ["req 1", "req 2", "req 3"],
            "nextActions": ["action 1", "action 2"],
            "meetingMinutes": ["Key discussion point from call...", "Decision made regarding...", "Client asked about...", "Action agreed on..."],
            "overview": "A concise 3-sentence executive summary of the prospect's situation and goals.",
            "sentiment": "Positive",
            "tasks": [
              { "title": "...", "assignee": "Self", "dueDate": "Tomorrow", "completed": false }
            ]
          }
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-1.5-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });

        const rawText = response.text || "{}";
        const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(jsonStr);

        if (parsed.tasks && Array.isArray(parsed.tasks)) {
          parsed.tasks = parsed.tasks.map((t: any) => ({ ...t, completed: false }));
        }

        console.log("AI Results Produced:", parsed);

        await updateDoc(doc(db, 'recordings', selectedRec.id), {
          aiInsights: parsed
        });
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
    await updateDoc(doc(db, 'recordings', selectedRec.id), {
      aiInsights: deleteField()
    });
  };


  if (loading) {
    return (
      <div className="flex-1 bg-slate-50 flex items-center justify-center min-h-[100dvh]">
        <Loader2 className="animate-spin text-indigo-500 w-12 h-12" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex-1 bg-slate-50 flex items-center justify-center min-h-[100dvh] text-slate-500 font-medium text-lg">
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
      case 'INACTIVE': return 10;
      case 'DISCOVERY': return 25;
      case 'QUALIFIED': return 50;
      case 'NURTURING': return 75;
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
    doc.text("CLIENT DOSSIER", margin, y);
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
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("STRATEGIC ACTION ITEMS", margin, y);
    y += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    const tasks = Array.isArray(insights.tasks) ? insights.tasks : [];
    if (tasks.length === 0) {
       doc.text("- No open tasks detected.", margin, y);
    } else {
      tasks.forEach((t: any) => {
        if (y > 270) { doc.addPage(); y = 20; }
        const status = t.completed ? "[DONE] " : "[OPEN] ";
        const tText = `${status}${t.title} (${t.assignee} / ${t.dueDate})`;
        const tLines = doc.splitTextToSize(`• ${tText}`, 165);
        doc.text(tLines, margin, y);
        y += (tLines.length * 6) + 2;
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
    <div className="flex-1 bg-slate-50 text-slate-900 min-h-full p-4 sm:p-6 lg:p-10 font-sans">
      <div className="max-w-[1400px] mx-auto">
        <Link to="/clients" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors mb-6 group">
          <div className="p-1.5 bg-white border border-slate-200 rounded-lg group-hover:border-indigo-200 shadow-sm transition-colors"><ChevronLeft size={16} /></div> Back to Intelligence Ledger
        </Link>

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="text-[10px] font-extrabold text-blue-500 tracking-widest uppercase mb-3 flex items-center gap-2">
              <Zap size={14} className="animate-pulse" /> Automation Protocol Active
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 leading-none">
               {lead.company || lead.name} <span className="text-slate-400 font-light">Dossier</span>
            </h1>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col items-end flex-1 sm:flex-none">
              <div className="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase mb-1.5">Lead Disposition</div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border shadow-[0_0_10px_rgba(0,0,0,0.05)] ${lead.status === 'Won' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : lead.status === 'Lost' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${lead.status === 'Won' ? 'bg-emerald-500' : lead.status === 'Lost' ? 'bg-red-500' : 'bg-blue-500 animate-pulse'}`} />
                {lead.status === 'Won' ? 'Closed-Won' : lead.status === 'Lost' ? 'Dead' : 'Active Engagement'}
              </span>
            </div>
            <div className="bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col items-end flex-1 sm:flex-none">
              <div className="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase mb-1.5">Call Sentiment</div>
              <select
                value={insights.sentiment}
                onChange={handleSentimentChange}
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border shadow-[0_0_10px_rgba(0,0,0,0.05)] appearance-none cursor-pointer outline-none transition-colors ${insights.sentiment === 'Positive' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100/50' : insights.sentiment === 'Negative' ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100/50' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100/80'}`}
                disabled={!selectedRec}
              >
                <option value="Positive">Positive Vectors</option>
                <option value="Neutral">Neutral Vectors</option>
                <option value="Negative">Negative Vectors</option>
                <option value="Analyzing...">Pending Analysis</option>
              </select>
            </div>
          </motion.div>
        </header>

        {/* Intelligence Timeline */}
        <div className="bg-white rounded-3xl p-2 mb-8 flex flex-nowrap items-center gap-2 overflow-x-auto shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-slate-100 scollbar-hide">
          <div className="pl-4 pr-6 shrink-0 flex items-center gap-2 border-r border-slate-100">
             <Calendar size={16} className="text-slate-400" />
             <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Archive</span>
          </div>
          {recordings.length > 0 ? (
            <>
              {recordings.map((rec) => {
                const dateStr = rec.createdAt?.toDate ? rec.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown Date';
                const isSelected = selectedRecId === rec.id;
                return (
                  <button
                    key={rec.id}
                    onClick={() => setSelectedRecId(rec.id)}
                    className={`shrink-0 px-5 py-3 rounded-2xl text-xs font-bold transition-all shadow-sm border ${isSelected ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 hover:bg-white hover:border-slate-300 border-slate-100 hover:shadow-md'}`}
                  >
                    {dateStr}
                  </button>
                );
              })}
              {selectedRec && (
                <div className="ml-auto flex items-center gap-3 mr-4">
                  <button 
                    onClick={handleExportPDF}
                    className="shrink-0 px-6 py-3 rounded-2xl bg-white text-slate-600 hover:text-slate-900 font-black text-xs uppercase tracking-widest shadow-lg border border-slate-200 transition-all flex items-center gap-2 active:scale-95"
                  >
                    <Download size={14} /> Download Report
                  </button>
                  <button 
                    onClick={handleRegenerate}
                    disabled={generatingAI}
                    className="shrink-0 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    {generatingAI ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                    {generatingAI ? 'Processing...' : 'Regenerate Intelligence'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <span className="text-sm font-bold text-amber-500 py-3 px-4 italic">No intelligence operations logged yet.</span>
          )}
        </div>

        <AnimatePresence>
          {generatingAI && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-8">
              <div className="p-5 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl flex items-center justify-center gap-3 text-indigo-600 font-extrabold text-sm shadow-inner">
                 <Wand2 size={18} className="animate-spin" /> Cross-referencing logic parameters via DeepMind Framework...
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 4 AI Intelligence Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { id: 'painPoints', title: 'Friction Points', icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-50', hover: 'hover:border-rose-200 group-hover:shadow-rose-500/10' },
            { id: 'requirements', title: 'Core Objectives', icon: Archive, color: 'text-amber-500', bg: 'bg-amber-50', hover: 'hover:border-amber-200 group-hover:shadow-amber-500/10' },
            { id: 'nextActions', title: 'Strategic Vectors', icon: Zap, color: 'text-blue-500', bg: 'bg-blue-50', hover: 'hover:border-blue-200 group-hover:shadow-blue-500/10' },
            { id: 'improvements', title: 'Conversion Boosters', icon: Wand2, color: 'text-emerald-500', bg: 'bg-emerald-50', hover: 'hover:border-emerald-200 group-hover:shadow-emerald-500/10' }
          ].map((col, idx) => {
            const Icon = col.icon;
            const dataArr = insights[col.id] || [];
            return (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} key={col.id} className={`bg-white rounded-[2rem] border border-slate-100 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col group relative overflow-hidden transition-all duration-300 ${col.hover}`}>
                <div className={`absolute top-0 right-0 w-32 h-32 ${col.bg} rounded-bl-full -z-0 opacity-50`}></div>
                
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <h3 className="font-extrabold text-slate-800 flex items-center gap-2.5 text-base">
                    <div className={`p-2 rounded-xl ${col.bg} ${col.color}`}><Icon size={16} /></div> {col.title}
                  </h3>
                  <button
                    onClick={() => handleArrayAdd(col.id)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 bg-white shadow-sm rounded-lg transition-colors border border-slate-100 hover:border-indigo-200"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <ul className="space-y-4 text-sm text-slate-600 font-medium list-none relative z-10">
                  {dataArr.map((item: string, i: number) => {
                    const isEditingThis = editingItem?.field === col.id && editingItem?.index === i;
                    return isEditingThis ? (
                      <div key={i} className="flex flex-col gap-3">
                        <textarea
                          autoFocus
                          className="w-full text-sm font-semibold bg-slate-50 border-2 border-indigo-200 rounded-xl p-3 outline-none focus:ring-4 focus:ring-indigo-500/20 resize-y min-h-[100px] text-slate-700 shadow-inner"
                          value={editingItem.value}
                          onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                        />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditingItem(null)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-xl transition-all">Cancel</button>
                          <button onClick={handleArraySave} className="px-4 py-2 text-xs font-bold bg-slate-900 text-white hover:bg-indigo-600 transition-all flex items-center gap-1.5 rounded-xl shadow-lg active:scale-95"><Check size={14} /> Matrix Save</button>
                        </div>
                      </div>
                    ) : (
                      <li key={i} className="group/item relative pl-4 leading-relaxed bg-slate-50/50 hover:bg-white p-3 rounded-xl border border-transparent hover:border-slate-200 transition-all shadow-sm">
                        <div className={`absolute left-0 top-4 w-1.5 h-1.5 rounded-full ${col.bg.replace('bg-', 'bg-').replace('50', '400')}`}></div>
                        <span className="block pr-12">{item}</span>
                        <div className="absolute top-1/2 -translate-y-1/2 right-2 flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                          <button onClick={() => setEditingItem({ field: col.id, index: i, value: item })} className="p-1.5 text-slate-400 hover:text-indigo-600 bg-white hover:bg-indigo-50 border border-slate-100 rounded-lg shadow-sm transition-all"><Edit3 size={14} /></button>
                          <button onClick={() => handleArrayDelete(col.id, i)} className="p-1.5 text-slate-400 hover:text-rose-500 bg-white hover:bg-rose-50 border border-slate-100 rounded-lg shadow-sm transition-all"><Trash2 size={14} /></button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </motion.div>
            );
          })}
        </div>

        {/* Split View */}
        <div className="flex flex-col xl:flex-row gap-6 mb-8">
          
          {/* Executive Overview */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="xl:w-2/3 bg-[#0A0D14] rounded-[2.5rem] p-8 md:p-10 shadow-2xl text-white relative overflow-hidden group/overview border border-slate-800">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-[100px] pointer-events-none translate-x-1/3 -translate-y-1/3"></div>
            
            <div className="flex justify-between items-start mb-6 relative z-10">
              <h3 className="font-extrabold text-white flex items-center gap-3 text-lg tracking-tight">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center border border-indigo-500/30 backdrop-blur-sm"><Sparkles className="text-indigo-300" size={18} /></div> 
                AI Executive Summary
              </h3>
              {editingOverview === null && (
                <button onClick={() => setEditingOverview(insights.overview)} className="p-2 text-indigo-300 hover:text-white hover:bg-white/10 bg-white/5 border border-white/10 rounded-xl transition-all shadow-sm">
                  <Edit3 size={16} />
                </button>
              )}
            </div>

            {editingOverview !== null ? (
              <div className="flex flex-col gap-4 relative z-10">
                <textarea
                  autoFocus
                  className="w-full text-base leading-relaxed font-medium bg-white/5 border border-indigo-500/50 rounded-2xl p-6 text-white outline-none focus:ring-4 focus:ring-indigo-500/30 min-h-[160px] shadow-inner"
                  value={editingOverview}
                  onChange={e => setEditingOverview(e.target.value)}
                />
                <div className="flex justify-end gap-3">
                  <button onClick={() => setEditingOverview(null)} className="px-5 py-2.5 text-sm font-bold text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors">Abort Override</button>
                  <button onClick={handleOverviewSave} className="px-6 py-2.5 text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white flex items-center gap-2 rounded-xl shadow-lg shadow-indigo-500/25 active:scale-95 transition-all"><Check size={16} /> Inject Override</button>
                </div>
              </div>
            ) : (
              <p className="text-lg leading-relaxed font-medium text-slate-300 pr-8 relative z-10">{insights.overview}</p>
            )}
          </motion.div>

          {/* Pipeline Stage Visualizer */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="xl:w-1/3 bg-white rounded-[2.5rem] border border-slate-100 p-10 shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col justify-center relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-48 h-48 bg-slate-50 rounded-bl-[100px] -z-0 transition-colors group-hover:bg-indigo-50`}></div>
            
            <div className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase mb-8 relative z-10">Sales State Machine</div>
            
            <div className="w-full bg-slate-100 h-3 rounded-full mb-6 relative overflow-hidden shadow-inner z-10">
              <motion.div 
                initial={{ width: 0 }} 
                animate={{ width: `${getPhaseProgress(lead.phase)}%` }} 
                transition={{ duration: 1.5, type: 'spring' }}
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-slate-800 to-slate-900 rounded-full" 
              />
            </div>
            
            <div className="flex items-end justify-between relative z-10">
              <h2 className="text-4xl font-black tracking-tight uppercase bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">{lead.phase?.toLowerCase() || 'Processing'}</h2>
              <span className="text-xs font-extrabold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">{getPhaseProgress(lead.phase)}% Closed</span>
            </div>
          </motion.div>

        </div>

        {/* ── Scheduled Meetings ── */}
        {meetings.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-xl bg-violet-50 text-violet-500">
                <CalendarDays size={18} />
              </div>
              <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">Scheduled Meetings</h3>
              <span className="ml-auto text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-full">
                {meetings.length} session{meetings.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {meetings.map((m, idx) => {
                const d = m.scheduledAt?.toDate?.();
                const isPast = d && d < new Date();
                return (
                  <motion.div key={m.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                    className={`p-5 rounded-2xl border transition-all ${
                      isPast
                        ? 'bg-slate-50 border-slate-100 opacity-60'
                        : 'bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-violet-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isPast ? 'bg-slate-100' : 'bg-violet-50'
                      }`}>
                        <CalendarDays size={16} className={isPast ? 'text-slate-400' : 'text-violet-500'} />
                      </div>
                      {isPast && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-1 rounded-full">Past</span>
                      )}
                      {!isPast && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-violet-600 bg-violet-50 border border-violet-100 px-2 py-1 rounded-full animate-pulse">Upcoming</span>
                      )}
                    </div>
                    <div className="font-extrabold text-slate-800 text-sm mb-2 leading-snug">{m.title}</div>
                    {d && (
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <Clock size={11} />
                        {d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        &nbsp;·&nbsp;
                        {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </div>
                    )}
                    {m.notes && (
                      <p className="mt-2 text-[11px] text-slate-400 font-medium line-clamp-2 leading-relaxed">{m.notes}</p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Bottom Split (Tasks + MOM + Transcript) */}
        <div className="flex flex-col xl:flex-row gap-6 mb-12">
          
          {/* Actionable Steps */}
          <div className="xl:w-1/3 bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col">
            <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-4">
              <h3 className="font-extrabold text-slate-800 flex items-center gap-3 text-xl">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-500"><CheckSquare size={18} /></div> Actionable Path
              </h3>
              <button onClick={handleTaskAdd} className="p-2 bg-white text-slate-400 hover:text-indigo-600 shadow-sm rounded-xl transition-all border border-slate-200 hover:border-indigo-200">
                <Plus size={18} />
              </button>
            </div>

            <div className="space-y-4 flex-1">
              {insights.tasks.length === 0 && <div className="text-center p-8 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200"><p className="text-slate-500 text-sm font-bold">No path algorithms established.</p></div>}

              {insights.tasks.map((task: any, idx: number) => {
                const isEditingTask = editingItem?.field === 'tasks' && editingItem?.index === idx;

                return (
                  <div key={idx} className={`p-4 rounded-xl border transition-all flex items-start gap-4 group/task ${task.completed ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-100 hover:border-indigo-100 shadow-sm hover:shadow-md'}`}>

                    <button
                      onClick={() => handleTaskToggle(idx)}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border-2 transition-colors ${task.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300'}`}
                    >
                      {task.completed && <Check size={12} strokeWidth={4} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      {isEditingTask ? (
                        <div className="space-y-2">
                          <input type="text" value={JSON.parse(editingItem.value || "{}").title} onChange={e => {
                            const parsed = JSON.parse(editingItem.value || "{}");
                            parsed.title = e.target.value;
                            setEditingItem({ ...editingItem, value: JSON.stringify(parsed) });
                          }} className="w-full text-sm font-bold bg-slate-50 border border-slate-200 p-2 rounded-lg outline-none" />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingItem(null)} className="px-2 py-1 text-[10px] font-bold text-slate-500">Abort</button>
                            <button onClick={async () => {
                              const parsed = JSON.parse(editingItem.value);
                              const newArr = [...insights.tasks];
                              newArr[idx] = parsed;
                              await saveInsights({ ...insights, tasks: newArr });
                              setEditingItem(null);
                            }} className="px-2 py-1 text-[10px] font-bold bg-slate-900 text-white rounded-lg shadow-md">Commit</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <h4 className={`font-extrabold text-sm mb-1 truncate ${task.completed ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{task.title}</h4>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{task.assignee} • {task.dueDate}</span>
                        </div>
                      )}
                    </div>

                    {!isEditingTask && (
                      <div className="hidden group-hover/task:flex items-center gap-1 opacity-0 group-hover/task:opacity-100">
                        <button onClick={() => setEditingItem({ field: 'tasks', index: idx, value: JSON.stringify(task) })} className="p-1 text-slate-400 hover:text-indigo-600 transition-all">
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => handleTaskDelete(idx)} className="p-1 text-slate-400 hover:text-red-500 transition-all">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Minutes of Meeting */}
          <div className="xl:w-1/3 bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col relative overflow-hidden group">
            <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-4 relative z-10">
              <h3 className="font-extrabold text-slate-800 flex items-center gap-3 text-xl">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-500"><AlignLeft size={18} /></div> Minutes of Meeting
              </h3>
              <button 
                onClick={() => handleArrayAdd('meetingMinutes')}
                className="p-2 bg-white text-slate-400 hover:text-indigo-600 shadow-sm rounded-xl transition-all border border-slate-200 hover:border-indigo-200"
              >
                <Plus size={18} />
              </button>
            </div>
            
            <div className="space-y-4 flex-1">
              {(Array.isArray(insights.meetingMinutes) ? insights.meetingMinutes : []).map((point: string, idx: number) => {
                const isEditingThis = editingItem?.field === 'meetingMinutes' && editingItem?.index === idx;
                return (
                  <div key={idx} className="group/item relative bg-white p-4 rounded-xl border border-slate-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-[0_4px_15px_rgb(0,0,0,0.05)] transition-all">
                    {isEditingThis ? (
                      <div className="flex flex-col gap-3">
                        <textarea
                          autoFocus
                          className="w-full text-sm font-semibold bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-4 focus:ring-indigo-500/10 resize-y min-h-[80px]"
                          value={editingItem.value}
                          onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                        />
                        <div className="flex justify-end gap-2">
                           <button onClick={() => setEditingItem(null)} className="px-3 py-1.5 text-[10px] font-black text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button>
                           <button onClick={handleArraySave} className="px-3 py-1.5 text-[10px] font-black bg-slate-900 text-white hover:bg-indigo-600 rounded-lg shadow-sm flex items-center gap-1.5"><Check size={12}/> Save</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-4">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 shrink-0"></div>
                        <span className="block pr-14 text-sm font-semibold text-slate-600 leading-relaxed">{point}</span>
                        <div className="absolute top-1/2 -translate-y-1/2 right-2 flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-all">
                          <button onClick={() => setEditingItem({ field: 'meetingMinutes', index: idx, value: point })} className="p-1.5 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-white border border-slate-100 rounded-lg shadow-sm transition-all"><Edit3 size={12}/></button>
                          <button onClick={() => handleArrayDelete('meetingMinutes', idx)} className="p-1.5 text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-white border border-slate-100 rounded-lg shadow-sm transition-all"><Trash2 size={12}/></button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transcript Core */}
          <div className="xl:w-1/3 bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col relative overflow-hidden group">
            <div className="absolute top-10 right-10 text-9xl text-slate-50 font-serif leading-none italic pointer-events-none select-none z-0 rotate-12 -mr-8 -mt-8">"</div>
            <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-4 relative z-10">
              <h3 className="font-extrabold text-slate-800 flex items-center gap-3 text-xl">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-500"><AlignLeft size={18} /></div> Source Transcript
              </h3>
              {selectedRec && (
                 <Link to={`/r/${selectedRec.id}`} className="p-2 bg-white text-slate-400 hover:text-purple-600 border border-slate-200 shadow-sm rounded-xl transition-all flex items-center gap-2 text-[10px] font-black px-4 uppercase tracking-widest">
                    Open Full <ArrowUpRight size={14} />
                 </Link>
              )}
            </div>
            <div className="flex-1 bg-slate-50/80 p-6 rounded-2xl border border-slate-100 overflow-y-auto max-h-[400px] relative z-10 shadow-inner group-hover:bg-slate-50 transition-colors scollbar-hide">
              {selectedRec?.transcript ? (
                <p className="text-[14px] text-slate-600 font-medium leading-[1.8] italic select-text">
                  "{selectedRec.transcript}"
                </p>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 font-medium italic overflow-hidden">
                   <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                      <Zap size={24} className="text-slate-300" />
                   </div>
                   No dialogue payload detected.
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="bg-slate-900 rounded-[2.5rem] p-10 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[60px] pointer-events-none translate-x-1/3 -translate-y-1/3"></div>
          
          <div className="flex items-center gap-4 relative z-10">
             <div className="w-16 h-16 bg-white border-2 border-white/20 rounded-[1.25rem] flex items-center justify-center overflow-hidden">
               {lead.avatar ? <img src={lead.avatar} className="object-cover w-full h-full" /> : <div className="text-2xl font-black text-slate-300">?</div>}
             </div>
             <div>
               <div className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase mb-1">Entity Registered</div>
               <div className="font-extrabold text-white text-xl">{lead.company || lead.name}</div>
               <div className="text-sm font-semibold text-slate-400 mt-1 flex gap-3">
                  <span>{lead.email || 'No email attached'}</span>
                  <span className="text-slate-600">•</span>
                  <span>{lead.phone || 'No direct dial'}</span>
               </div>
             </div>
          </div>

          <div className="relative z-10 md:w-auto w-full">
            <Link to={`/clients/${lead.id}/edit`} className="w-full md:w-auto px-8 py-3.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-sm font-black transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
               <Edit3 size={16} /> Modify Profile
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
