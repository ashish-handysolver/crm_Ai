import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { motion } from 'motion/react';
import { Loader2, AlertTriangle, Archive, Zap, Wand2, Sparkles, CheckSquare, AlignLeft, Briefcase, ChevronLeft, Calendar, Edit3, Check, X, Plus, Trash2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

export default function LeadInsights({ user }: { user: any }) {
  const { id } = useParams();
  const [lead, setLead] = useState<any>(null);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [selectedRecId, setSelectedRecId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingAI, setGeneratingAI] = useState(false);

  // Inline editing state: which list item is currently being edited
  const [editingItem, setEditingItem] = useState<{ field: string, index: number, value: string } | null>(null);
  const [editingOverview, setEditingOverview] = useState<string | null>(null);

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

    return () => unsub();
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
        if (!apiKey) throw new Error("No Gemini API key found to generate insights.");

        const ai = new GoogleGenAI({ apiKey });
        const prompt = `
          Analyze this sales call transcript and extract actionable intelligence. 
          Respond ONLY in strict JSON format. 
          
          Transcript: "${selectedRec.transcript}"
          
          Required JSON Structure:
          {
            "painPoints": ["point 1", "point 2", "point 3"],
            "requirements": ["req 1", "req 2", "req 3"],
            "nextActions": ["action 1", "action 2"],
            "improvements": ["improvement 1", "improvement 2"],
            "overview": "A concise 3-sentence executive summary of the prospect's situation and goals.",
            "sentiment": "Positive",
            "tasks": [
              { "title": "...", "assignee": "Self", "dueDate": "Tomorrow", "completed": false }
            ]
          }
        `;

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ parts: [{ text: prompt }] }]
        });

        const rawText = response.text || "{}";
        const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(jsonStr);

        // Ensure tasks have 'completed' boolean
        if (parsed.tasks && Array.isArray(parsed.tasks)) {
          parsed.tasks = parsed.tasks.map((t: any) => ({ ...t, completed: false }));
        }

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


  if (loading) {
    return (
      <div className="flex-1 bg-[#fdfdfd] flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-slate-300 w-12 h-12" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex-1 bg-[#fdfdfd] flex items-center justify-center min-h-screen text-slate-500 font-medium">
        Lead not found.
      </div>
    );
  }

  const insights = selectedRec?.aiInsights || {
    sentiment: 'Analyzing...',
    painPoints: ['Generating insights...'],
    requirements: ['Generating insights...'],
    nextActions: ['Generating insights...'],
    improvements: ['Generating insights...'],
    overview: 'Analyzing the transcript to provide a comprehensive executive summary...',
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

  // Direct Firestore update helpers
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
    const newArr = [...insights[field], "New item"];
    await saveInsights({ ...insights, [field]: newArr });
    setEditingItem({ field, index: newArr.length - 1, value: "New item" });
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
    const newTasks = [...insights.tasks, { title: "New Task", assignee: "Self", dueDate: "Tomorrow", completed: false }];
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


  return (
    <div className="flex-1 bg-[#fdfdfd] text-slate-900 min-h-screen p-8 lg:p-12 font-sans overflow-x-hidden">
      <div className="max-w-[1200px] mx-auto">
        <Link to="/analytics" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-400 hover:text-slate-800 transition-colors mb-8">
          <ChevronLeft size={16} /> Back to Analytics
        </Link>

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="text-[10px] font-bold text-slate-400 tracking-[0.15em] uppercase mb-2">Automation Sales Command</div>
            <h1 className="text-4xl md:text-[2.75rem] font-extrabold tracking-tight text-slate-800 leading-none">
              {lead.company || lead.name} Summary
            </h1>
          </div>
          <div className="flex gap-4">
            <div>
              <div className="text-[10px] font-bold text-slate-400 tracking-[0.1em] uppercase mb-1.5 text-right">Lead Status</div>
              <span className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest text-[#00a35c]">
                ● {lead.status === 'Won' ? 'Closed' : lead.status === 'Lost' ? 'Dead' : 'Active'}
              </span>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 tracking-[0.1em] uppercase mb-1.5 text-right">Call Sentiment</div>
              <select
                value={insights.sentiment}
                onChange={handleSentimentChange}
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 appearance-none cursor-pointer outline-none border-0 ${insights.sentiment === 'Positive' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                disabled>
                <option value="Positive">Positive</option>
                <option value="Neutral">Neutral</option>
                <option value="Negative">Negative</option>
              </select>
            </div>
          </div>
        </header>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-10 pb-4 border-b border-slate-100">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest py-2 mr-2">Call Archives:</span>
            {recordings.length > 0 ? recordings.map((rec) => {
              const dateStr = rec.createdAt?.toDate ? rec.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown Date';
              const isSelected = selectedRecId === rec.id;
              return (
                <button
                  key={rec.id}
                  onClick={() => setSelectedRecId(rec.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${isSelected ? 'bg-[#5c647b] text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                >
                  <Calendar size={14} /> {dateStr}
                </button>
              );
            }) : (
              <span className="text-sm font-bold text-amber-600">No calls found.</span>
            )}
          </div>
        </div>

        {generatingAI && (
          <div className="mb-8 p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center gap-3 text-indigo-600 font-bold text-sm animate-pulse">
            <Wand2 size={16} className="animate-spin" /> Abstracting intelligence from transcript via Gemini...
          </div>
        )}

        {/* 4 AI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 group">
          {[
            { id: 'painPoints', title: 'AI Pain Points', icon: AlertTriangle },
            { id: 'requirements', title: 'AI Requirements', icon: Archive },
            { id: 'nextActions', title: 'AI Next Actions', icon: Zap },
            { id: 'improvements', title: 'AI Suggested Improvements', icon: Wand2 }
          ].map((col) => {
            const Icon = col.icon;
            const dataArr = insights[col.id] || [];
            return (
              <div key={col.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col group/card relative">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-lg">
                    <Icon className="text-slate-500" size={18} /> {col.title}
                  </h3>
                  <button
                    onClick={() => handleArrayAdd(col.id)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100 bg-slate-50"
                    title="Add item"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <ul className="space-y-4 text-sm text-slate-600 font-medium pl-4 list-disc marker:text-slate-300">
                  {dataArr.map((item: string, i: number) => {
                    const isEditingThis = editingItem?.field === col.id && editingItem?.index === i;

                    return isEditingThis ? (
                      <div key={i} className="flex flex-col gap-2 -ml-4">
                        <textarea
                          autoFocus
                          className="w-full text-sm font-medium bg-slate-50 border border-indigo-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-indigo-500/20 resize-y min-h-[80px]"
                          value={editingItem.value}
                          onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                        />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditingItem(null)} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-md">Cancel</button>
                          <button onClick={handleArraySave} className="px-3 py-1.5 text-xs font-bold bg-indigo-500 text-white hover:bg-indigo-600 flex items-center gap-1 rounded-md"><Check size={14} /> Save</button>
                        </div>
                      </div>
                    ) : (
                      <li key={i} className="group/item relative pr-16 leading-relaxed">
                        <span>{item}</span>
                        <div className="hidden group-hover/item:flex items-center gap-1 absolute right-0 top-0 -mt-1 bg-white pl-2">
                          <button onClick={() => setEditingItem({ field: col.id, index: i, value: item })} className="p-1.5 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded border border-transparent hover:border-indigo-100 transition-colors shadow-sm">
                            <Edit3 size={14} />
                          </button>
                          <button onClick={() => handleArrayDelete(col.id, i)} className="p-1.5 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 rounded border border-transparent hover:border-red-100 transition-colors shadow-sm">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Executive Overview & Stage */}
        <div className="flex flex-col lg:flex-row gap-6 mb-8">
          <div className="lg:w-2/3 bg-[#5c647b] rounded-xl p-8 shadow-md text-white group/overview relative">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-bold text-slate-200 flex items-center gap-2 text-sm uppercase tracking-widest">
                <Sparkles className="text-slate-300" size={16} /> AI Executive Overview
              </h3>
              {editingOverview === null && (
                <button onClick={() => setEditingOverview(insights.overview)} className="p-1.5 text-[#5c647b] hover:text-indigo-600 hover:bg-indigo-50 bg-white/10 hover:bg-white rounded-lg transition-colors shadow-sm">
                  <Edit3 size={14} className="text-slate-200 hover:text-indigo-600" />
                </button>
              )}
            </div>

            {editingOverview !== null ? (
              <div className="flex flex-col gap-3">
                <textarea
                  autoFocus
                  className="w-full text-[15px] leading-relaxed font-medium bg-[#4a5165] border border-emerald-400/50 rounded-lg p-4 text-white outline-none focus:ring-2 focus:ring-emerald-400 min-h-[120px]"
                  value={editingOverview}
                  onChange={e => setEditingOverview(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditingOverview(null)} className="px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10 rounded-md">Cancel</button>
                  <button onClick={handleOverviewSave} className="px-3 py-1.5 text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 flex items-center gap-1 rounded-md"><Check size={14} /> Save</button>
                </div>
              </div>
            ) : (
              <p className="text-[15px] leading-relaxed font-medium pr-8">{insights.overview}</p>
            )}
          </div>

          <div className="lg:w-1/3 bg-white rounded-xl border border-slate-200 p-8 shadow-sm flex flex-col justify-center">
            <div className="text-[10px] font-bold text-slate-400 tracking-[0.15em] uppercase mb-4">Lead Stage Progression</div>
            <div className="w-full bg-slate-100 h-2 rounded-full mb-4">
              <div className="bg-[#5c647b] h-full rounded-full transition-all duration-1000" style={{ width: `${getPhaseProgress(lead.phase)}%` }} />
            </div>
            <div className="flex items-end justify-between mb-8">
              <h2 className="text-3xl font-extrabold tracking-tight capitalize">{lead.phase?.toLowerCase() || 'Active'}</h2>
              <span className="text-xs font-bold text-slate-400">Pipeline Status</span>
            </div>
          </div>
        </div>

        {/* Tasks & Transcript */}
        <div className="flex flex-col lg:flex-row gap-6 mb-12">
          {/* Operational Tasks */}
          <div className="lg:w-1/2 bg-white rounded-xl border border-slate-200 p-8 shadow-sm group">
            <div className="flex justify-between items-start mb-6">
              <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-lg">
                <CheckSquare className="text-slate-500" size={18} /> AI Operational Tasks
              </h3>
              <button onClick={handleTaskAdd} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100 bg-slate-50">
                <Plus size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {insights.tasks.length === 0 && <p className="text-slate-400 text-sm font-medium italic">No immediate tasks identified from this call.</p>}

              {insights.tasks.map((task: any, idx: number) => {
                const isEditingTask = editingItem?.field === 'tasks' && editingItem?.index === idx;

                return (
                  <div key={idx} className={`p-4 rounded-xl border transition-all flex items-start gap-4 group/task ${task.completed ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-100 hover:border-indigo-100 shadow-sm'}`}>

                    {/* The Checkbox */}
                    <button
                      onClick={() => handleTaskToggle(idx)}
                      className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border ${task.completed ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white border-slate-300 hover:border-indigo-400'
                        }`}
                    >
                      {task.completed && <Check size={14} strokeWidth={3} />}
                    </button>

                    <div className="flex-1">
                      {isEditingTask ? (
                        <div className="space-y-2">
                          <input type="text" value={JSON.parse(editingItem.value || "{}").title} onChange={e => {
                            const parsed = JSON.parse(editingItem.value || "{}");
                            parsed.title = e.target.value;
                            setEditingItem({ ...editingItem, value: JSON.stringify(parsed) });
                          }} className="w-full text-[15px] font-bold bg-slate-50 border border-slate-200 p-2 rounded outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Task Title" />
                          <div className="flex gap-2">
                            <input type="text" value={JSON.parse(editingItem.value || "{}").assignee} onChange={e => {
                              const parsed = JSON.parse(editingItem.value || "{}");
                              parsed.assignee = e.target.value;
                              setEditingItem({ ...editingItem, value: JSON.stringify(parsed) });
                            }} className="w-1/2 text-xs bg-slate-50 border border-slate-200 p-2 rounded outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Assignee (e.g. Self)" />
                            <input type="text" value={JSON.parse(editingItem.value || "{}").dueDate} onChange={e => {
                              const parsed = JSON.parse(editingItem.value || "{}");
                              parsed.dueDate = e.target.value;
                              setEditingItem({ ...editingItem, value: JSON.stringify(parsed) });
                            }} className="w-1/2 text-xs bg-slate-50 border border-slate-200 p-2 rounded outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Due Date (e.g. Tomorrow)" />
                          </div>
                          <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => setEditingItem(null)} className="px-3 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-md">Cancel</button>
                            <button onClick={async () => {
                              const parsed = JSON.parse(editingItem.value);
                              const newArr = [...insights.tasks];
                              newArr[idx] = parsed;
                              await saveInsights({ ...insights, tasks: newArr });
                              setEditingItem(null);
                            }} className="px-3 py-1 text-xs font-bold bg-indigo-500 text-white hover:bg-indigo-600 flex items-center gap-1 rounded-md"><Check size={14} /> Save</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <h4 className={`font-bold text-[15px] mb-1 ${task.completed ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{task.title}</h4>
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            <span className="w-4 h-4 rounded bg-white text-indigo-500 flex items-center justify-center -ml-1 aspect-square border-slate-200 border">{task.assignee?.charAt(0)}</span>
                            {task.assignee} • Due {task.dueDate}
                          </span>
                        </div>
                      )}
                    </div>

                    {!isEditingTask && (
                      <div className="hidden group-hover/task:flex items-center gap-1">
                        <button onClick={() => setEditingItem({ field: 'tasks', index: idx, value: JSON.stringify(task) })} className="p-1.5 text-slate-400 hover:text-indigo-600 bg-white hover:bg-indigo-50 rounded border hover:border-indigo-100 transition-colors shadow-sm">
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => handleTaskDelete(idx)} className="p-1.5 text-slate-400 hover:text-red-500 bg-white hover:bg-red-50 rounded border hover:border-red-100 transition-colors shadow-sm">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Transcript Snippet */}
          <div className="lg:w-1/2 bg-white rounded-xl border border-slate-200 p-8 shadow-sm flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-lg">
                <AlignLeft className="text-slate-500" size={18} /> Raw Transcript Link
              </h3>
            </div>
            <div className="flex-1 bg-slate-50 p-4 rounded-xl border border-slate-100 overflow-y-auto max-h-[300px]">
              {selectedRec?.transcript ? (
                <p className="text-sm text-slate-600 font-medium leading-relaxed">
                  {selectedRec.transcript.substring(0, 500)}
                  {selectedRec.transcript.length > 500 && '...'}
                </p>
              ) : (
                <p className="text-sm text-slate-400 font-medium italic">No transcript available for this recording.</p>
              )}
            </div>
          </div>
        </div>

        {/* Client Details Footer */}
        <div className="bg-[#f8f9fa] rounded-2xl border border-slate-200 p-8 relative overflow-hidden">
          <h3 className="font-bold text-slate-700 mb-8 flex items-center gap-2 text-sm uppercase tracking-widest">
            <Briefcase className="text-slate-400" size={16} /> Client Registration Details
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="text-[10px] font-bold text-slate-400 tracking-[0.1em] uppercase mb-1">Contact Name</div>
              <div className="font-bold text-slate-800 text-[15px]">{lead.name}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 tracking-[0.1em] uppercase mb-1">Company Registered</div>
              <div className="font-bold text-slate-800 text-[15px]">{lead.company || 'Not specified'}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 tracking-[0.1em] uppercase mb-1">Source Email</div>
              <div className="font-bold text-slate-800 text-[15px]">{lead.email || 'None'}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 tracking-[0.1em] uppercase mb-1">Phone</div>
              <div className="font-bold text-slate-800 text-[15px]">{lead.phone || 'None'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
