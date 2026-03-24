import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { motion } from 'motion/react';
import { Loader2, AlertTriangle, Archive, Zap, Wand2, Sparkles, CheckSquare, AlignLeft, Briefcase, ChevronLeft, Calendar } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

export default function LeadInsights({ user }: { user: any }) {
  const { id } = useParams();
  const [lead, setLead] = useState<any>(null);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [selectedRecId, setSelectedRecId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingAI, setGeneratingAI] = useState(false);

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
        return tB - tA; // Newest first
      });
      setRecordings(data);
      if (data.length > 0 && !selectedRecId) {
        setSelectedRecId(data[0].id);
      }
      if (lead === null) {
        setLoading(false); // only set false once we have data or definitively tried
      }
    });

    return () => unsub();
  }, [id, lead, selectedRecId]);

  useEffect(() => {
    if (lead !== null) setLoading(false);
  }, [lead]);

  const selectedRec = recordings.find(r => r.id === selectedRecId);

  // Auto-generate AI Insights if missing for the selected recording
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
          Do not include markdown blocks, just raw JSON.
          
          Transcript: "${selectedRec.transcript}"
          
          Required JSON Structure:
          {
            "painPoints": ["point 1", "point 2", "point 3"],
            "requirements": ["req 1", "req 2", "req 3"],
            "nextActions": ["action 1", "action 2"],
            "improvements": ["improvement 1", "improvement 2"],
            "overview": "A concise 3-sentence executive summary of the prospect's situation and goals.",
            "sentiment": "Positive", // either Positive, Neutral, or Negative
            "tasks": [
              { "title": "...", "assignee": "Self", "dueDate": "Tomorrow" }
            ]
          }
        `;

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ parts: [{ text: prompt }] }]
        });
        
        // Very basic sanitization to extract just the JSON
        const rawText = response.text || "{}";
        const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(jsonStr);

        // Update Firestore
        await updateDoc(doc(db, 'recordings', selectedRec.id), {
          aiInsights: parsed
        });
        console.log("Cached AI Insights for call", selectedRec.id);
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

  // Determine fallback or actual data
  const insights = selectedRec?.aiInsights || {
    sentiment: 'Analyzing...',
    painPoints: ['Generating insights...'],
    requirements: ['Generating insights...'],
    nextActions: ['Generating insights...'],
    improvements: ['Generating insights...'],
    overview: 'Analyzing the transcript to provide a comprehensive executive summary...',
    tasks: []
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
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 ${insights.sentiment === 'Positive' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
               <span className={`w-1.5 h-1.5 rounded-full ${insights.sentiment === 'Positive' ? 'bg-emerald-500' : 'bg-slate-400'}`} /> {insights.sentiment}
              </span>
            </div>
          </div>
        </header>

        {/* Call Selection Tabs */}
        {recordings.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-10 pb-4 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest py-2 mr-2">Call Archives:</span>
            {recordings.map((rec) => {
              const dateStr = rec.createdAt?.toDate ? rec.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' }) : 'Unknown Date';
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
            })}
          </div>
        ) : (
          <div className="mb-10 text-sm font-bold text-amber-600 bg-amber-50 px-4 py-3 rounded-xl inline-flex">
            No call recordings found for this lead yet.
          </div>
        )}

        {/* Dynamic Loading Indicator */}
        {generatingAI && (
          <div className="mb-8 p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center gap-3 text-indigo-600 font-bold text-sm animate-pulse">
            <Wand2 size={16} className="animate-spin" /> Abstracting intelligence from transcript via Gemini...
          </div>
        )}

        {/* 4 AI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-extrabold text-slate-800 mb-4 flex items-center gap-2 text-lg">
              <AlertTriangle className="text-slate-500" size={18} /> AI Pain Points
            </h3>
            <ul className="space-y-4 text-sm text-slate-600 font-medium pl-4 list-disc marker:text-slate-300">
              {insights.painPoints.map((pt: string, i: number) => <li key={i}>{pt}</li>)}
            </ul>
          </div>
          
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-extrabold text-slate-800 mb-4 flex items-center gap-2 text-lg">
              <Archive className="text-slate-500" size={18} /> AI Requirements
            </h3>
            <ul className="space-y-4 text-sm text-slate-600 font-medium pl-4 list-disc marker:text-slate-300">
              {insights.requirements.map((req: string, i: number) => <li key={i}>{req}</li>)}
            </ul>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-extrabold text-slate-800 mb-4 flex items-center gap-2 text-lg">
              <Zap className="text-slate-500" size={18} /> AI Next Actions
            </h3>
            <ul className="space-y-4 text-sm text-slate-600 font-medium pl-4 list-disc marker:text-slate-300">
              {insights.nextActions.map((act: string, i: number) => <li key={i}>{act}</li>)}
            </ul>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-extrabold text-slate-800 mb-4 flex items-center gap-2 text-lg">
              <Wand2 className="text-slate-500" size={18} /> AI Suggested Improvements
            </h3>
            <ul className="space-y-4 text-sm text-slate-600 font-medium pl-4 list-disc marker:text-slate-300">
              {insights.improvements.map((imp: string, i: number) => <li key={i}>{imp}</li>)}
            </ul>
          </div>
        </div>

        {/* Executive Overview & Stage */}
        <div className="flex flex-col lg:flex-row gap-6 mb-8">
          <div className="lg:w-2/3 bg-[#5c647b] rounded-xl p-8 shadow-md text-white">
            <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2 text-sm uppercase tracking-widest">
              <Sparkles className="text-slate-300" size={16} /> AI Executive Overview
            </h3>
            <p className="text-[15px] leading-relaxed font-medium">
              {insights.overview}
            </p>
          </div>
          
          <div className="lg:w-1/3 bg-white rounded-xl border border-slate-200 p-8 shadow-sm flex flex-col justify-center">
            <div className="text-[10px] font-bold text-slate-400 tracking-[0.15em] uppercase mb-4">Lead Stage Progression</div>
            <div className="w-full bg-slate-100 h-2 rounded-full mb-4">
              <div className="w-[60%] bg-[#5c647b] h-full rounded-full" />
            </div>
            <div className="flex items-end justify-between mb-8">
              <h2 className="text-3xl font-extrabold tracking-tight">Active</h2>
              <span className="text-xs font-bold text-slate-400">Engaged Phase</span>
            </div>
          </div>
        </div>

        {/* Tasks & Transcript */}
        <div className="flex flex-col lg:flex-row gap-6 mb-12">
          {/* Operational Tasks */}
          <div className="lg:w-1/2 bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
            <h3 className="font-extrabold text-slate-800 mb-6 flex items-center gap-2 text-lg">
              <CheckSquare className="text-slate-500" size={18} /> AI Operational Tasks
            </h3>
            <div className="space-y-6">
              {insights.tasks.length === 0 && <p className="text-slate-400 text-sm font-medium italic">No immediate tasks identified from this call.</p>}
              {insights.tasks.map((task: any, idx: number) => (
                <div key={idx} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-indigo-600 font-bold text-sm tracking-tighter w-full text-center px-1 overflow-hidden">{task.assignee?.substring(0,3).toUpperCase() || 'SYS'}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-[15px] mb-0.5">{task.title}</h4>
                    <p className="text-xs font-semibold text-slate-400">Due {task.dueDate}</p>
                  </div>
                </div>
              ))}
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
