import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bell, Settings, TrendingUp, Search, Filter, Mic, Square, Loader2, Edit2, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, ChevronDown, Play, Share2, Users, ArrowUpRight, BarChart3, Plus, Eye, LayoutGrid, List, Pause, ShieldAlert, Trash2, Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import { uploadFileToGemini } from './utils/gemini';
import { doc, setDoc, Timestamp, collection, query, where, onSnapshot, getDocs, deleteDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from './firebase';
import { CustomFieldDef } from './CustomFields';
import { useAuth } from './contexts/AuthContext';
import { useDemo } from './DemoContext';
import { motion, AnimatePresence } from 'motion/react';
import ImportModal from './ImportModal';

const DUMMY_LEADS = [
  { id: '1', name: 'Alexander Sterling', email: 'a.sterling@vanguard.io', company: 'Vanguard Systems', location: 'London, UK', source: 'LINKEDIN', health: 'HOT', score: 85, lastPulse: '2 hours ago', phase: 'QUALIFIED', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d', phone: '+44 20 7123 4567' },
  { id: '2', name: 'Elena Thorne', email: 'elena.t@atlas.corp', company: 'Atlas Global', location: 'Berlin, DE', source: 'REFERRAL', health: 'WARM', score: 62, lastPulse: 'Yesterday', phase: 'NURTURING', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704e', phone: '+49 30 1234 5678' },
  { id: '3', name: 'Julian Rossi', email: 'julian@horizon.com', company: 'Horizon Digital', location: 'Milan, IT', source: 'DIRECT', health: 'HOT', score: 92, lastPulse: '4 hours ago', phase: 'DISCOVERY', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704f', phone: '+39 02 1234 5678' },
  { id: '4', name: 'Sarah Wick', email: 's.wick@continental.dev', company: 'Continental Dev', location: 'New York, US', source: 'LINKEDIN', health: 'COLD', score: 15, lastPulse: 'Oct 12, 2023', phase: 'INACTIVE', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704g', phone: '+1 212-555-0199' },
];

const DEFAULT_LEAD_TYPES = ['B2B', 'B2C', 'ENTERPRISE'];

export default function Leads({ user }: { user: any }) {
  const { companyId, role } = useAuth();
  const { isDemoMode, demoData } = useDemo();
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [leads, setLeads] = useState<any[]>(DUMMY_LEADS);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [shareUrls, setShareUrls] = useState<Record<string, string>>({});
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDef[]>([]);
  const [customLeadTypes, setCustomLeadTypes] = useState<string[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [leadTypeFilter, setLeadTypeFilter] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showSafetyAlert, setShowSafetyAlert] = useState(false);
  const AUTO_SUBMIT_WINDOW = Number((import.meta as any).env.VITE_AUTO_SUBMIT_WINDOW_SECS) || 60;
  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState(AUTO_SUBMIT_WINDOW);
  const autoSubmitRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const SAFETY_CHECK_SECONDS = (Number((import.meta as any).env.VITE_SAFETY_CHECK_DURATION_MINS) || 5) * 60;

  useEffect(() => {
    if (isDemoMode) {
      const formattedLeads = demoData.leads.map(l => ({
        ...l,
        updatedAt: { toMillis: () => l.updatedAt.seconds * 1000 }
      }));
      setLeads(formattedLeads);
      const formattedRecs = demoData.recordings.map(r => ({
        ...r,
        createdAt: { toMillis: () => r.createdAt.seconds * 1000 }
      }));
      setRecordings(formattedRecs);
      setLoadingLeads(false);
      return;
    }

    if (!companyId) {
      setLeads(demoData.leads);
      setLoadingLeads(false);
      return;
    }
    const qLeads = query(collection(db, 'leads'), where('companyId', '==', companyId));
    const unsubLeads = onSnapshot(qLeads, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as any);
      data.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
      setLeads(data.length > 0 ? data : demoData.leads);
      setLoadingLeads(false);
    }, (error) => {
      console.error("Leads Error:", error);
      setLoadingLeads(false);
    });

    const qRecs = query(collection(db, 'recordings'), where('companyId', '==', companyId));
    const unsubRecs = onSnapshot(qRecs, (snapshot) => {
      const allRecs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as any);
      setRecordings(allRecs);
    });

    return () => { unsubLeads(); unsubRecs(); };
  }, [companyId, isDemoMode, demoData]);

  useEffect(() => {
    if (!companyId) return;
    const q = query(collection(db, 'custom_fields'), where('companyId', '==', companyId));
    getDocs(q).then(snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomFieldDef));
      setCustomFieldDefs(data);
    }).catch(console.error);

    getDoc(doc(db, 'companies', companyId)).then(snap => {
      if (snap.exists()) {
        setCustomLeadTypes(snap.data().customLeadTypes || []);
      }
    }).catch(console.error);
  }, [companyId]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setRecordingId(null);
      setIsPaused(false);
      stopTimer();
      setShowSafetyAlert(false);
    }
  }, [stopTimer]);

  const performTranscription = useCallback(async (audioBlob: Blob, leadId: string) => {
    setIsTranscribing(true);
    try {
      const recordId = uuidv4().slice(0, 8);
      let audioUrl = '';

      // 1. Upload to Firebase Storage
      const storageRef = ref(storage, `recordings/${recordId}.webm`);
      await uploadBytes(storageRef, audioBlob);
      audioUrl = await getDownloadURL(storageRef);

      // 2. Transcription logic via Gemini File API
      let transcriptText = "No info generated.";
      let transcriptData = null;
      try {
        const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY || '';
        if (apiKey) {
          const fileUri = await uploadFileToGemini(audioBlob, apiKey);
          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            config: {
              responseMimeType: "application/json",
            },
            contents: [
              {
                role: 'user',
                parts: [
                  { text: "Transcribe this audio recording of a sales/lead call. Return a JSON object with a 'fullText' string and a 'segments' array. Each segment must be an object with 'text' (the word or short phrase), 'startTime' (in seconds as a float), and 'endTime' (in seconds as a float). Provide ONLY the raw JSON string." },
                  { fileData: { mimeType: audioBlob.type || "audio/webm", fileUri } }
                ]
              }
            ]
          });

          // Robust parsing for unified SDK
          let rawText = "{}";
          const resAny = response as any;
          if (resAny.text && typeof resAny.text === 'string') {
            rawText = resAny.text;
          } else if (resAny.text && typeof resAny.text === 'function') {
            rawText = resAny.text();
          } else if (resAny.response?.text && typeof resAny.response.text === 'function') {
            rawText = resAny.response.text();
          } else if (resAny.response?.candidates?.[0]?.content?.parts?.[0]?.text) {
            rawText = resAny.response.candidates[0].content.parts[0].text;
          }

          const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

          try {
            const parsed = JSON.parse(jsonStr);
            transcriptText = String(parsed.fullText || "No transcript generated.");
            transcriptData = parsed.segments || [];
          } catch (e) {
            console.error("JSON Parse Error on Transcript:", e);
            transcriptText = String(rawText || "No transcript generated."); // Fallback
          }
        }
      } catch (e: any) {
        console.warn("Transcription failed", e);
      }

      await setDoc(doc(db, 'recordings', recordId), {
        id: recordId,
        audioUrl,
        transcript: transcriptText,
        transcriptData,
        createdAt: Timestamp.now(),
        authorUid: user?.uid || '',
        companyId,
        leadId
      });
      setSuccess("Call recorded safely!");
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error(err);
      setError("Failed to save recording.");
    } finally {
      setIsTranscribing(false);
      autoSubmitRef.current = false;
    }
  }, [companyId, user?.uid]);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRecordingSeconds(prev => {
        const next = prev + 1;
        if (next > 0 && next % SAFETY_CHECK_SECONDS === 0) {
          setShowSafetyAlert(true);
          setAutoSubmitCountdown(AUTO_SUBMIT_WINDOW);
        }
        return next;
      });

      setShowSafetyAlert(currentShow => {
        if (currentShow) {
          setAutoSubmitCountdown(prevCountdown => {
            if (prevCountdown <= 1) {
              autoSubmitRef.current = true;
              stopRecording();
              return 0;
            }
            return prevCountdown - 1;
          });
        }
        return currentShow;
      });
    }, 1000);
  }, [stopRecording]);

  const startRecording = async (leadId: string) => {
    try {
      setError(''); setSuccess('');
      setRecordingSeconds(0);
      setIsPaused(false);
      autoSubmitRef.current = false;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("Browser doesn't support recording");

      const streams: MediaStream[] = [];
      const isChromium = !!(window as any).chrome;

      let micStream: MediaStream;
      let sysStream: MediaStream | null = null;

      try {
        if (navigator.mediaDevices.getDisplayMedia) {
          const displayConstraints: any = {
            video: true,
            audio: isChromium
              ? {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                systemAudio: 'include',
              }
              : true,
          };

          sysStream = await navigator.mediaDevices.getDisplayMedia(displayConstraints);
        }
      } catch (e) {
        console.warn("System audio omitted or cancelled", e);
      }

      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      streams.push(micStream);
      let finalStream = micStream;

      if (sysStream && sysStream.getAudioTracks().length > 0) {
        streams.push(sysStream);
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        const ctx = new AudioContextClass(); audioContextRef.current = ctx;
        if (ctx.state === 'suspended') await ctx.resume();
        const dest = ctx.createMediaStreamDestination();
        ctx.createMediaStreamSource(micStream).connect(dest);
        ctx.createMediaStreamSource(sysStream).connect(dest);
        finalStream = dest.stream;
      } else if (sysStream) {
        alert("System Audio Note: You shared a screen/tab but didn't check the 'Also share audio' box. Only your microphone will be recorded.");
        sysStream.getTracks().forEach(t => t.stop());
      }

      streamsRef.current = streams;

      // Dynanamic mimeType for cross-browser support (Safari prefers mp4, Chrome prefers webm)
      const options: any = { audioBitsPerSecond: 64000 };
      const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mpeg'];
      for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
          options.mimeType = type;
          break;
        }
      }

      const mediaRecorder = new MediaRecorder(finalStream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        streamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
        if (audioContextRef.current) audioContextRef.current.close();

        if (autoSubmitRef.current) {
          performTranscription(blob, leadId);
        } else {
          performTranscription(blob, leadId);
        }
      };

      mediaRecorder.start();
      setRecordingId(leadId);
      startTimer();
    } catch (err: any) {
      setError(err.message || "Could not start recording.");
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && recordingId && !isPaused) {
      try {
        if (typeof mediaRecorderRef.current.pause === 'function') {
          mediaRecorderRef.current.pause();
          setIsPaused(true);
          stopTimer();
        } else {
          setError('Pause is not supported in this browser.');
        }
      } catch (err: any) {
        setError((err && err.message) || 'Could not pause recording.');
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && recordingId && isPaused) {
      try {
        if (typeof mediaRecorderRef.current.resume === 'function') {
          mediaRecorderRef.current.resume();
          setIsPaused(false);
          startTimer();
        } else {
          setError('Resume is not supported in this browser.');
        }
      } catch (err: any) {
        setError((err && err.message) || 'Could not resume recording.');
      }
    }
  };

  const createMeeting = async (leadId: string, leadName: string) => {
    if (!companyId) return;
    setIsCreatingMeeting(true);
    try {
      const id = uuidv4().slice(0, 8);
      await setDoc(doc(db, 'meetings', id), {
        id,
        title: `Call with ${leadName}`,
        ownerUid: user.uid,
        companyId,
        createdAt: Timestamp.now()
      });
      const origin = window.location.hostname === 'localhost' ? 'https://handydashcrmai.vercel.app' : window.location.origin;
      setShareUrls(prev => ({ ...prev, [leadId]: `${origin}/m/${id}?l=${leadId}` }));
    } catch (err) {
      console.error(err);
      setError("Failed to create shareable link.");
    } finally {
      setIsCreatingMeeting(false);
    }
  };

  const handleShare = async (leadId: string, url: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join AudioCRM Meeting',
          text: 'Please join my AudioCRM meeting:',
          url: url,
        });
        return; // Successfully shared via native app
      } catch (error: any) {
        if (error.name === 'AbortError') return; // User closed the share sheet
      }
    }
    navigator.clipboard.writeText(url);
    setSuccess("Copied to clipboard!");
    setTimeout(() => setSuccess(""), 2000);
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!window.confirm("Are you sure you want to delete this lead? This will also remove all associated recordings and meetings.")) return;

    try {
      setLoadingLeads(true);
      const qRecs = query(collection(db, 'recordings'), where('leadId', '==', leadId));
      const recSnap = await getDocs(qRecs);
      for (const d of recSnap.docs) {
        await deleteDoc(doc(db, 'recordings', d.id));
      }

      const qMtgs = query(collection(db, 'meetings'), where('leadId', '==', leadId));
      const mtgSnap = await getDocs(qMtgs);
      for (const d of mtgSnap.docs) {
        await deleteDoc(doc(db, 'meetings', d.id));
      }

      await deleteDoc(doc(db, 'leads', leadId));

      setSuccess("Lead and all associated data successfully deleted.");
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to delete lead.");
    } finally {
      setLoadingLeads(false);
    }
  };

  const handleImport = () => {
    setIsImportModalOpen(true);
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'WON': return 'bg-emerald-100/80 text-emerald-700 border-emerald-200';
      case 'LOST': return 'bg-rose-100/80 text-rose-700 border-rose-200';
      case 'QUALIFIED': return 'bg-orange-100/80 text-orange-700 border-orange-200';
      case 'NURTURING': return 'bg-orange-100/80 text-orange-700 border-orange-200';
      case 'DISCOVERY': return 'bg-blue-100/80 text-blue-700 border-blue-200';
      case 'INACTIVE': return 'bg-orange-100/80 text-slate-700 border-orange-200';
      default: return 'bg-orange-100/80 text-slate-700 border-orange-200';
    }
  };

  const filteredLeads = leads.filter(l => {
    const matchesSearch = !searchTerm || l.name?.toLowerCase().includes(searchTerm.toLowerCase()) || l.company?.toLowerCase().includes(searchTerm.toLowerCase()) || l.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = !leadTypeFilter || l.leadType === leadTypeFilter;

    return matchesSearch && matchesType;
  });

  const availableLeadTypes = Array.from(new Set([...DEFAULT_LEAD_TYPES, ...customLeadTypes, ...leads.map(l => l.leadType).filter(Boolean)]));

  const PHASES = ['DISCOVERY', 'NURTURING', 'QUALIFIED', 'WON', 'LOST', 'INACTIVE'];

  const isAllSelected = filteredLeads.length > 0 && selectedLeads.length === filteredLeads.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredLeads.map(l => l.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedLeads(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulkDelete = async () => {
    if (!selectedLeads.length) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedLeads.length} leads? This will also remove all associated recordings and meetings.`)) return;

    try {
      setLoadingLeads(true);
      for (const leadId of selectedLeads) {
        const recSnap = await getDocs(query(collection(db, 'recordings'), where('leadId', '==', leadId)));
        for (const d of recSnap.docs) await deleteDoc(doc(db, 'recordings', d.id));
        const mtgSnap = await getDocs(query(collection(db, 'meetings'), where('leadId', '==', leadId)));
        for (const d of mtgSnap.docs) await deleteDoc(doc(db, 'meetings', d.id));
        await deleteDoc(doc(db, 'leads', leadId));
      }
      setSuccess(`Successfully deleted ${selectedLeads.length} leads.`);
      setSelectedLeads([]);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to delete selected leads.");
    } finally {
      setLoadingLeads(false);
    }
  };

  const KanbanView = () => (
    <div className="flex gap-6 overflow-x-auto pb-8 min-h-[600px] snap-x">
      {PHASES.map(phase => {
        const phaseLeads = filteredLeads.filter(l => l.phase === phase);
        return (
          <div key={phase} className="min-w-[320px] w-[320px] flex flex-col gap-5 snap-start">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${getPhaseColor(phase).split(' ')[0]}`} />
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">{phase}</h3>
              </div>
              <span className="text-[10px] font-black bg-orange-100 text-slate-500 px-2 py-0.5 rounded-full border border-orange-200/50">
                {phaseLeads.length}
              </span>
            </div>

            <div className="flex-1 space-y-4">
              {phaseLeads.length === 0 ? (
                <div className="h-24 border-2 border-dashed border-orange-100 rounded-[2rem] flex items-center justify-center text-[10px] font-bold text-slate-300 uppercase tracking-widest bg-orange-50/30">
                  Empty Partition
                </div>
              ) : (
                phaseLeads.map(lead => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={lead.id}
                    className="bg-orange-50 p-5 rounded-[2rem] border border-orange-100 shadow-sm hover:shadow-xl hover:shadow-orange-500/5 transition-all group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50/50 rounded-bl-full -z-0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-4">
                        <input
                          type="checkbox"
                          checked={selectedLeads.includes(lead.id)}
                          onChange={() => toggleSelect(lead.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-orange-300 text-orange-600 focus:ring-orange-600 cursor-pointer shrink-0"
                        />
                        {lead.avatar ? (
                          <img src={lead.avatar} className="w-10 h-10 rounded-xl object-cover border border-orange-50 shadow-sm" alt={lead.name} />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-slate-400 text-xs font-black border border-orange-50 shadow-sm">
                            {lead.name.split(' ').map(n => n[0]).join('')}
                          </div>
                        )}
                        <div>
                          <div className="font-extrabold text-black text-sm">{lead.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="text-[10px] font-bold text-slate-400 truncate max-w-[100px]">{lead.company}</div>
                            {lead.leadType && <span className="px-1.5 py-0.5 bg-orange-100 text-slate-500 rounded flex-shrink-0 text-[8px] font-black uppercase tracking-widest">{lead.leadType}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-orange-50">
                        <div className="flex items-center gap-1.5 font-black text-[10px] text-slate-700">
                          <div className={`w-1.5 h-1.5 rounded-full ${lead.score >= 70 ? 'bg-emerald-400' : lead.score >= 40 ? 'bg-amber-400' : 'bg-red-400'}`} />
                          {lead.score || 0} AI
                        </div>

                        <div className="flex items-center gap-1">
                          {(role === 'admin' || role === 'super_admin') && (
                            <button
                              onClick={() => handleDeleteLead(lead.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                              title="Delete Lead"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                          <Link to={`/analytics/${lead.id}`} className="text-[10px] font-black text-orange-500 hover:text-orange-700 bg-orange-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                            <Sparkles size={12} />
                            Details
                          </Link>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex-1 text-black p-4 sm:p-6 lg:p-10 min-h-[calc(100vh-88px)] bg-orange-50">
      <div className="max-w-[1400px] mx-auto">

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100/50 text-orange-600 text-[10px] font-bold uppercase tracking-widest mb-3 border border-orange-200/50">
              <TrendingUp size={14} className="animate-pulse" /> Clients
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-black">Clients</h1>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-wrap items-center gap-3">
            <div className="flex gap-3">
              {!isDemoMode && (
                <>
                  <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 px-5 py-3 bg-orange-50 border border-orange-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-orange-50 transition-all shadow-sm">
                    <ArrowUpRight size={18} /> Import
                  </button>
                  <Link to="/clients/new" className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-orange-500/30 transition-all active:scale-[0.98]">
                    <Plus size={18} /> New Client
                  </Link>
                </>
              )}
              {isDemoMode && (
                <div className="px-5 py-3 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <Eye size={16} /> Demo View Readonly
                </div>
              )}
            </div>
          </motion.div>
        </header>

        <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} user={user} />

        <AnimatePresence>
          {(error || success) && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`mb-8 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-sm border ${error ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
              {error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
              {error || success}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toolbar */}
        <div className="bg-orange-50 rounded-3xl border border-orange-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] p-4 sm:p-6 mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full max-w-md group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors">
              <Search size={22} strokeWidth={2.5} />
            </div>
            <input
              type="text"
              placeholder="Search by name, company, or info..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-orange-50 border-2 border-orange-100 rounded-3xl py-5 pl-14 pr-6 text-base font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-8 focus:ring-orange-500/5 transition-all shadow-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <AnimatePresence>
              {selectedLeads.length > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9, width: 0 }} animate={{ opacity: 1, scale: 1, width: 'auto' }} exit={{ opacity: 0, scale: 0.9, width: 0 }}
                  onClick={handleBulkDelete}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-xs font-black hover:bg-rose-100 transition-all shadow-sm border border-rose-200 uppercase tracking-widest mr-1 whitespace-nowrap overflow-hidden"
                >
                  <Trash2 size={14} /> Delete ({selectedLeads.length})
                </motion.button>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-1.5 p-1 bg-orange-50 rounded-xl border border-orange-100 shadow-inner">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${viewMode === 'list' ? 'bg-orange-50 text-orange-600 shadow-sm border border-orange-200/50' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <List size={14} /> LIST
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${viewMode === 'kanban' ? 'bg-orange-50 text-orange-600 shadow-sm border border-orange-200/50' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <LayoutGrid size={14} /> KANBAN
              </button>
            </div>

            <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 border border-orange-200 bg-orange-50 rounded-xl text-sm font-bold text-slate-600 hover:bg-orange-50 hover:border-orange-300 transition-all shadow-sm">
              <Filter size={16} /> Filters
            </button>
            <div className="relative flex-1 md:flex-none">
              <select
                value={leadTypeFilter}
                onChange={(e) => setLeadTypeFilter(e.target.value)}
                className="w-full px-5 py-3 border border-orange-200 bg-orange-50 rounded-xl text-sm font-bold text-slate-600 outline-none hover:bg-orange-50 hover:border-orange-300 transition-all shadow-sm appearance-none cursor-pointer pr-10"
              >
                <option value="">All Lead Types</option>
                {availableLeadTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <div className="relative flex-1 md:flex-none">
              <select className="w-full px-5 py-3 border border-orange-200 bg-orange-50 rounded-xl text-sm font-bold text-slate-600 outline-none hover:bg-orange-50 hover:border-orange-300 transition-all shadow-sm appearance-none cursor-pointer pr-10">
                <option>Sort: Recent Activity</option>
                <option>Sort: Score</option>
                <option>Sort: Name</option>
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {viewMode === 'kanban' ? <KanbanView /> : (
          <>
            {/* Mobile View (Cards) */}
            <div className="lg:hidden space-y-4">
              {filteredLeads.map(lead => (
                <div key={lead.id} className="bg-orange-50 rounded-[2rem] p-6 border border-orange-100 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-orange-400 to-orange-500"></div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={selectedLeads.includes(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-orange-300 text-orange-600 focus:ring-orange-600 cursor-pointer shrink-0"
                      />
                      <div className="relative">
                        {lead.avatar ? (
                          <img src={lead.avatar} className="w-12 h-12 rounded-[1rem] object-cover ring-2 ring-slate-50" alt={lead.name} />
                        ) : (
                          <div className="w-12 h-12 rounded-[1rem] bg-orange-100 flex items-center justify-center text-slate-400 text-sm font-black ring-2 ring-slate-50">
                            {lead.name.split(' ').map(n => n[0]).join('')}
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-orange-50 bg-emerald-400" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base text-black">{lead.name}</h3>
                        <div className="text-slate-500 text-xs font-semibold mt-0.5 flex items-center gap-2">
                          <span className="truncate max-w-[140px]">{lead.company}</span>
                          {lead.leadType && <span className="px-2 py-0.5 bg-orange-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-widest">{lead.leadType}</span>}
                        </div>
                      </div>
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg border ${getPhaseColor(lead.phase)}`}>{lead.phase}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-5 p-4 bg-orange-50 rounded-2xl border border-orange-100">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1.5">Score</div>
                      <div className="font-extrabold text-orange-600">{lead.score || 0}%</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1.5">Pulse</div>
                      <div className="text-sm font-medium text-slate-600 truncate">{lead.lastPulse}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-4 border-t border-orange-100">
                    <div className="flex items-center gap-2">
                      {!isDemoMode && (
                        <>
                          {recordingId === lead.id ? (
                            <div className="flex items-center gap-2">
                              <div className="bg-black text-white px-3 py-2 rounded-xl flex items-center gap-2 font-mono text-xs">
                                <div className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-red-500 animate-pulse'}`} />
                                {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                              </div>
                              <button onClick={isPaused ? resumeRecording : pauseRecording} className="p-3 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100">
                                {isPaused ? <Play size={16} /> : <Pause size={16} />}
                              </button>
                              <button onClick={stopRecording} className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100">
                                <Square size={16} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startRecording(lead.id)}
                              className="p-3 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100 transition-all flex items-center gap-2 font-bold text-xs"
                              title="Start Session"
                              disabled={!!recordingId}
                            >
                              <Mic size={16} /> Record
                            </button>
                          )}
                          {shareUrls[lead.id] ? (
                            <button onClick={() => handleShare(lead.id, shareUrls[lead.id])} className="p-3 text-emerald-600 bg-emerald-50 rounded-xl transition-all" title="Share Link">
                              <Share2 size={18} />
                            </button>
                          ) : (
                            <button onClick={() => createMeeting(lead.id, lead.name)} disabled={isCreatingMeeting} className="p-3 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all disabled:opacity-50" title="Create Guest Link">
                              {isCreatingMeeting ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
                            </button>
                          )}
                          <Link to={`/clients/${lead.id}/edit`} className="p-3 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all">
                            <Edit2 size={18} />
                          </Link>
                          {(role === 'admin' || role === 'super_admin') && (
                            <button
                              onClick={() => handleDeleteLead(lead.id)}
                              className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                              title="Delete Lead"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </>
                      )}
                      {isDemoMode && (
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-1 bg-orange-50 rounded-lg">Readonly</div>
                      )}
                    </div>
                    <Link to={`/analytics/${lead.id}`} className="flex items-center gap-1.5 text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 px-4 py-2.5 rounded-xl transition-colors">
                      View Details <ArrowUpRight size={14} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View (Premium Table) */}
            <div className="hidden lg:block bg-orange-50 rounded-[2.5rem] border border-orange-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="border-b border-orange-100 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-orange-50/50">
                      <th className="py-6 px-6 relative w-12 text-center">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-orange-300 text-orange-600 focus:ring-orange-600 cursor-pointer"
                        />
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-slate-200"></div>
                      </th>
                      <th className="py-6 px-8 relative">Name <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-slate-200"></div></th>
                      <th className="py-6 px-6 relative">Company <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-slate-200"></div></th>
                      <th className="py-6 px-6 relative w-32">Lead Type <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-slate-200"></div></th>
                      <th className="py-6 px-6 relative w-32">AI Score <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-slate-200"></div></th>
                      <th className="py-6 px-8 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {loadingLeads ? (
                      <tr>
                        <td colSpan={6} className="py-24 text-center">
                          <Loader2 size={32} className="animate-spin text-orange-500 mx-auto" />
                        </td>
                      </tr>
                    ) : filteredLeads.map((lead) => {
                      const leadRecs = recordings.filter(r => r.meetingId === lead.id || r.leadId === lead.id);
                      const isExp = expandedLeadId === lead.id;

                      return (
                        <React.Fragment key={lead.id}>
                          <tr className={`border-b border-orange-50 hover:bg-orange-50/80 transition-all duration-300 group ${isExp ? 'bg-orange-50/30 shadow-inner' : ''}`}>
                            <td className="py-5 px-6 text-center">
                              <input
                                type="checkbox"
                                checked={selectedLeads.includes(lead.id)}
                                onChange={() => toggleSelect(lead.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 rounded border-orange-300 text-orange-600 focus:ring-orange-600 cursor-pointer"
                              />
                            </td>
                            <td className="py-5 px-8 whitespace-nowrap">
                              <div className="flex items-center gap-4">
                                <div className="relative shrink-0">
                                  {lead.avatar ? (
                                    <img src={lead.avatar} className="w-12 h-12 rounded-[1rem] object-cover border-2 border-orange-50 shadow-sm group-hover:shadow-md transition-shadow" alt={lead.name} />
                                  ) : (
                                    <div className="w-12 h-12 rounded-[1rem] bg-orange-100 flex items-center justify-center text-slate-400 text-sm font-black border-2 border-orange-50 shadow-sm">
                                      {lead.name.split(' ').map(n => n[0]).join('')}
                                    </div>
                                  )}
                                  <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-orange-50 bg-emerald-400" />
                                </div>
                                <div>
                                  <div className="font-extrabold text-black text-base">{lead.name}</div>
                                  <div className="text-slate-500 font-medium text-xs mt-0.5">{lead.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-5 px-6 whitespace-nowrap">
                              <div className="font-extrabold text-slate-700">{lead.company}</div>
                              <div className="text-slate-400 font-semibold text-xs mt-0.5 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-300" />{lead.location}</div>
                            </td>
                            <td className="py-5 px-6 whitespace-nowrap">
                              {lead.leadType ? <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border tracking-widest bg-orange-50 text-slate-600 border-orange-200">{lead.leadType}</span> : <span className="text-slate-300 text-xs font-bold">-</span>}
                            </td>
                            <td className="py-5 px-6 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-2.5 bg-orange-100 rounded-full overflow-hidden shadow-inner">
                                  <div className={`h-full rounded-full transition-all duration-1000 ${lead.score >= 70 ? 'bg-emerald-500' : lead.score >= 40 ? 'bg-amber-500' : 'bg-red-400'}`} style={{ width: `${lead.score || 0}%` }} />
                                </div>
                                <span className="font-black text-sm text-slate-700">{lead.score || 0}</span>
                              </div>
                            </td>
                            <td className="py-5 px-8 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Link to={`/analytics/${lead.id}`} className="text-slate-400 hover:text-orange-600 hover:bg-orange-50 w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-transparent hover:border-orange-100">
                                  <BarChart3 size={14} />
                                </Link>
                                <Link to={`/clients/${lead.id}/edit`} className="text-slate-400 hover:text-orange-600 hover:bg-orange-50 w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-transparent hover:border-orange-100">
                                  <Edit2 size={16} />
                                </Link>
                                {(role === 'admin' || role === 'super_admin') && (
                                  <button
                                    onClick={() => handleDeleteLead(lead.id)}
                                    className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100"
                                    title="Delete Lead"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}

                                {isTranscribing && recordingId === null ? (
                                  <div className="w-9 h-9 flex items-center justify-center bg-orange-50 rounded-xl"><Loader2 size={16} className="animate-spin text-orange-500" /></div>
                                ) : recordingId === lead.id ? (
                                  <div className="flex items-center gap-1 bg-orange-50 p-1 rounded-xl border border-orange-100">
                                    <div className={`px-2 py-1 font-mono text-[10px] font-bold ${isPaused ? 'text-amber-500' : 'text-slate-700'}`}>
                                      {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                                    </div>
                                    <button onClick={isPaused ? resumeRecording : pauseRecording} className="w-7 h-7 flex items-center justify-center rounded-lg text-amber-600 hover:bg-amber-50">
                                      {isPaused ? <Play size={14} /> : <Pause size={14} />}
                                    </button>
                                    <button onClick={stopRecording} className="w-7 h-7 flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50">
                                      <Square size={14} />
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => startRecording(lead.id)} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-transparent ${recordingId ? 'opacity-30' : 'text-slate-400 hover:text-orange-600 hover:bg-orange-50 hover:border-blue-100'}`} disabled={!!recordingId} title="Record Call">
                                    <Mic size={16} />
                                  </button>
                                )}

                                <button onClick={() => setExpandedLeadId(isExp ? null : lead.id)} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all border ${isExp ? 'bg-orange-50 text-orange-600 border-orange-100' : 'text-slate-400 hover:bg-orange-100 hover:text-slate-700 border-transparent'}`}>
                                  <ChevronDown size={18} className={`transition-transform duration-300 ${isExp ? 'rotate-180' : ''}`} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expandable Row */}
                          <AnimatePresence>
                            {isExp && (
                              <motion.tr initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-gradient-to-b from-orange-50/30 to-white/50 border-b border-orange-50">
                                <td colSpan={6} className="p-0">
                                  <div className="p-8 px-12">
                                    {customFieldDefs.length > 0 && (
                                      <div className="mb-8 pb-8 border-b border-orange-100 border-dashed">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Custom Fields</h4>
                                        <div className="flex flex-wrap gap-4">
                                          {customFieldDefs.map(field => (
                                            <div key={field.id} className="bg-orange-50 px-5 py-3 rounded-2xl border border-orange-100 shadow-sm flex flex-col min-w-[120px]">
                                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{field.name}</span>
                                              <span className="text-sm font-bold text-slate-800">{lead[field.name] || '-'}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    <div className="flex items-center justify-between mb-6">
                                      <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-2">
                                        History <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-md border border-orange-200">{leadRecs.length}</span>
                                      </h4>

                                      <div className="flex items-center gap-3">

                                        {shareUrls[lead.id] ? (
                                          <div className="flex items-center gap-2 w-64 bg-orange-50 rounded-xl shadow-inner border border-orange-200 p-1">
                                            <input readOnly value={shareUrls[lead.id]} className="flex-1 bg-transparent px-3 py-1.5 text-xs font-mono text-slate-600 outline-none" />
                                            <button onClick={() => handleShare(lead.id, shareUrls[lead.id])} className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors font-bold shadow-sm" title="Share Link">
                                              <Share2 size={16} />
                                            </button>
                                          </div>
                                        ) : (
                                          <button onClick={() => createMeeting(lead.id, lead.name)} disabled={isCreatingMeeting} className="flex justify-center items-center gap-2 text-white bg-black hover:bg-orange-600 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95">
                                            {isCreatingMeeting ? <Loader2 className="animate-spin" size={14} /> : <Share2 size={14} />} Share Link
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {leadRecs.length === 0 ? (
                                      <div className="text-sm text-slate-400 font-medium bg-orange-50/50 border-2 border-orange-200 border-dashed rounded-[2rem] p-12 text-center flex flex-col items-center">
                                        <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mb-4"><Play className="text-slate-300" size={24} /></div>
                                        <p>No recordings yet. Click the microphone to start a new one.</p>
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {leadRecs.map(rec => (
                                          <div key={rec.id} className="bg-orange-50 rounded-[1.5rem] border border-orange-100 p-6 shadow-sm hover:shadow-md hover:border-orange-100 transition-all flex items-start gap-4 group cursor-pointer" onClick={() => window.location.href = `/r/${rec.id}`}>
                                            <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0 group-hover:bg-orange-50 group-hover:border-orange-100 transition-colors">
                                              <Play className="text-slate-400 group-hover:text-orange-600 group-hover:fill-orange-600 ml-1 transition-colors" size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="text-[10px] text-slate-400 group-hover:text-orange-500 font-bold uppercase tracking-widest mb-1.5 transition-colors">
                                                {rec.createdAt?.toDate ? rec.createdAt.toDate().toLocaleString(undefined, { dateStyle: 'medium' }) : 'Unknown Date'}
                                              </div>
                                              <div className="text-sm font-medium text-slate-700 italic line-clamp-2 leading-relaxed">"{rec.transcript}"</div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </motion.tr>
                            )}
                          </AnimatePresence>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-5 border-t border-orange-100 bg-orange-50/50 flex flex-col md:flex-row items-center justify-between text-sm text-slate-500 gap-4">
                <div className="font-medium">Showing <span className="font-extrabold text-black">{filteredLeads.length}</span> active leads</div>
                <div className="flex items-center gap-1.5">
                  <button className="p-2 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-orange-50 shadow-sm transition-all"><ChevronLeft size={16} /></button>
                  <button className="px-4 py-2 font-black shadow-md bg-orange-600 text-white rounded-xl text-xs transition-all">1</button>
                  <button className="px-4 py-2 font-bold text-slate-600 hover:bg-orange-50 shadow-sm border border-transparent hover:border-orange-200 rounded-xl text-xs transition-all">2</button>
                  <button className="px-4 py-2 font-bold text-slate-600 hover:bg-orange-50 shadow-sm border border-transparent hover:border-orange-200 rounded-xl text-xs transition-all">3</button>
                  <button className="p-2 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-orange-50 shadow-sm transition-all"><ChevronRight size={16} /></button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Safety Alert Modal ── */}
      <AnimatePresence>
        {showSafetyAlert && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-orange-50 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-orange-100 text-center"
            >
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <ShieldAlert className="text-amber-500" size={32} />
              </div>
              <h2 className="text-xl font-black text-black mb-2">Still there?</h2>
              <p className="text-slate-500 text-sm mb-1 font-medium">
                Recording for <span className="text-black font-bold">{Math.floor(recordingSeconds / 60)} minutes</span>.
              </p>
              <p className="text-amber-500 text-xs font-black uppercase tracking-widest mb-8">
                Auto-submit in {autoSubmitCountdown}s...
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => { setShowSafetyAlert(false); setAutoSubmitCountdown(AUTO_SUBMIT_WINDOW); }}
                  className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-700 shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
                >
                  Continue
                </button>
                <button
                  onClick={stopRecording}
                  className="w-full py-4 bg-orange-50 text-slate-500 rounded-2xl font-bold hover:bg-orange-100 transition-all"
                >
                  Stop
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
