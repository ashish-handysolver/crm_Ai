import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bell, Settings, TrendingUp, Search, Filter, Mic, Square, Loader2, Edit2, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, ChevronDown, Play, Share2, Copy, Users, ArrowUpRight, BarChart3, Plus, Eye, LayoutGrid, List, Pause, ShieldAlert, Trash2, Sparkles, UploadCloud, CalendarDays, ScanQrCode
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import { uploadFileToGemini } from './utils/gemini';
import { doc, setDoc, Timestamp, collection, query, where, onSnapshot, getDocs, deleteDoc, getDoc, updateDoc } from 'firebase/firestore';
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

export default function Leads({ user, isActiveOnlyRoute }: { user: any; isActiveOnlyRoute?: boolean }) {
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
  const [customPhases, setCustomPhases] = useState<string[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [leadTypeFilter, setLeadTypeFilter] = useState('');
  const [activityFilter, setActivityFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>(isActiveOnlyRoute ? 'ACTIVE' : 'ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
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

  // Reset page on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, leadTypeFilter, activityFilter]);

  // Keep filter in sync if route changes
  useEffect(() => {
    setActivityFilter(isActiveOnlyRoute ? 'ACTIVE' : 'ALL');
  }, [isActiveOnlyRoute]);

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
        setCustomPhases(snap.data().customPhases || []);
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
    if (!companyId) return null;
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
      const url = `${origin}/m/${id}?l=${leadId}`;
      setShareUrls(prev => ({ ...prev, [leadId]: url }));
      return url;
    } catch (err) {
      console.error(err);
      setError("Failed to create shareable link.");
      return null;
    } finally {
      setIsCreatingMeeting(false);
    }
  };

  const onCopyLink = async (leadId: string, leadName: string) => {
    let url = shareUrls[leadId];
    if (!url) {
      url = await createMeeting(leadId, leadName);
    }
    if (url) {
      navigator.clipboard.writeText(url);
      setSuccess("Copied to clipboard!");
      setTimeout(() => setSuccess(""), 2000);
    }
  };

  const onShareLink = async (leadId: string, leadName: string) => {
    let url = shareUrls[leadId];
    if (!url) {
      url = await createMeeting(leadId, leadName);
    }
    if (url) {
      handleShare(leadId, url);
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
      case 'WON': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'LOST': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'QUALIFIED': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'NURTURING': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'DISCOVERY': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'INACTIVE': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-slate-50 text-slate-500 border-slate-200';
    }
  };

  const handlePhaseChange = async (leadId: string, newPhase: string) => {
    if (isDemoMode) return;
    try {
      await updateDoc(doc(db, 'leads', leadId), { phase: newPhase, updatedAt: Timestamp.now() });
    } catch (e) {
      console.error('Failed to update phase', e);
    }
  };

  const filteredLeads = leads.filter(l => {
    const matchesSearch = !searchTerm || l.name?.toLowerCase().includes(searchTerm.toLowerCase()) || l.company?.toLowerCase().includes(searchTerm.toLowerCase()) || l.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = !leadTypeFilter || l.leadType === leadTypeFilter;

    const hasActivity = recordings.some(r => r.leadId === l.id || r.meetingId === l.id);
    const matchesActivity = activityFilter === 'ALL' || (activityFilter === 'ACTIVE' && hasActivity) || (activityFilter === 'INACTIVE' && !hasActivity);

    return matchesSearch && matchesType && matchesActivity;
  });

  // Pagination logic
  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE);
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const availableLeadTypes = Array.from(new Set([...DEFAULT_LEAD_TYPES, ...customLeadTypes]));

  const PHASES = ['DISCOVERY', 'NURTURING', 'QUALIFIED', 'WON', 'LOST', 'INACTIVE'];
  const availablePhases = Array.from(new Set([...PHASES, ...customPhases]));

  const isAllSelected = paginatedLeads.length > 0 && paginatedLeads.every(l => selectedLeads.includes(l.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedLeads(prev => prev.filter(id => !paginatedLeads.find(l => l.id === id)));
    } else {
      const newIds = paginatedLeads.map(l => l.id).filter(id => !selectedLeads.includes(id));
      setSelectedLeads(prev => [...prev, ...newIds]);
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
    <div className="flex gap-8 overflow-x-auto pb-10 min-h-[600px] hide-scrollbar snap-x">
      {availablePhases.map(phase => {
        const phaseLeads = filteredLeads.filter(l => l.phase === phase);
        return (
          <div key={phase} className="min-w-[340px] w-[340px] flex flex-col gap-6 snap-start">
            <div className="flex items-center justify-between px-2 bg-white/40 backdrop-blur-sm p-4 rounded-2xl border border-white/50">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.1)] ${getPhaseColor(phase).split(' ')[0]}`} />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">{phase}</h3>
              </div>
              <span className="text-[10px] font-black bg-white text-indigo-600 px-3 py-1 rounded-xl shadow-sm border border-slate-100">
                {phaseLeads.length}
              </span>
            </div>

            <div className="flex-1 space-y-4">
              {loadingLeads ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm animate-pulse space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-200 rounded-2xl shrink-0"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                        <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                      </div>
                    </div>
                    <div className="h-12 bg-slate-50 rounded-xl"></div>
                  </div>
                ))
              ) : phaseLeads.length === 0 ? (
                <div className="h-32 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center text-slate-300 gap-2 bg-white/20">
                  <ShieldAlert size={20} className="opacity-20" />
                  <span className="text-[10px] font-black uppercase tracking-widest">No leads</span>
                </div>
              ) : (
                phaseLeads.map(lead => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={lead.id}
                    className="glass-card !rounded-3xl p-6 group relative overflow-hidden hover:scale-[1.02] transition-all cursor-pointer"
                  >
                    <div className="relative z-10">
                      <div className="flex items-center gap-4 mb-5">
                        <input
                          type="checkbox"
                          checked={selectedLeads.includes(lead.id)}
                          onChange={() => toggleSelect(lead.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-5 h-5 rounded-lg border-slate-200 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0 transition-all checked:bg-indigo-600"
                        />
                        <div className="relative">
                          {lead.avatar ? (
                            <img src={lead.avatar} className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow-sm" alt={lead.name} />
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-400 text-sm font-black border-2 border-white shadow-sm">
                              {lead.name.split(' ').map((n: string) => n[0]).join('')}
                            </div>
                          )}
                          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow-sm ${lead.health === 'HOT' ? 'bg-rose-500' : lead.health === 'WARM' ? 'bg-amber-400' : 'bg-slate-400'}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-black text-slate-900 text-sm break-words leading-tight">{lead.name}</div>
                          <div className="text-xs font-bold text-slate-400 break-words mt-0.5 leading-snug">{lead.company}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-5 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="px-2.5 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-[10px] font-black uppercase">
                            {lead.score || 0}% Match
                          </div>
                          {lead.leadType && <span className="px-2.5 py-1 bg-slate-50 text-slate-500 border border-slate-100 rounded-lg text-[8px] font-black uppercase tracking-widest shrink-0">{lead.leadType}</span>}
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                          <button onClick={(e) => { e.preventDefault(); onCopyLink(lead.id, lead.name); }} disabled={isCreatingMeeting} className={`p-2 rounded-xl transition-all disabled:opacity-50 ${shareUrls[lead.id] ? 'text-indigo-600 hover:bg-indigo-100 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50'}`} title="Copy Link">
                            {isCreatingMeeting && !shareUrls[lead.id] ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
                          </button>
                          <button onClick={(e) => { e.preventDefault(); onShareLink(lead.id, lead.name); }} disabled={isCreatingMeeting} className={`p-2 rounded-xl transition-all disabled:opacity-50 ${shareUrls[lead.id] ? 'text-emerald-600 hover:bg-emerald-100 bg-emerald-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-50'}`} title="Share Link">
                            {isCreatingMeeting && !shareUrls[lead.id] ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
                          </button>
                          <Link to={`/analytics/${lead.id}`} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                            <Sparkles size={16} />
                          </Link>
                          <Link to={`/clients/${lead.id}/edit`} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all">
                            <Edit2 size={16} />
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
    <div className={`flex-1 bg-slate-50/30 min-h-full ${viewMode === 'kanban' ? 'overflow-x-hidden' : ''}`}>
      <div className={`max-w-[1600px] mx-auto ${viewMode === 'kanban' ? 'p-0 sm:p-8 lg:p-12' : 'p-4 sm:p-8 lg:p-12'} space-y-6 sm:space-y-10`}>

        {/* Header Section */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 sm:gap-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-[0.2em]">
              <Users size={14} /> Lead Management Protocol
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 leading-none">{isActiveOnlyRoute ? 'Active Leads' : 'All Leads'}</h1>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-wrap items-center gap-3 sm:gap-4">
            {!isDemoMode ? (
              <>
                <button onClick={() => setShowQrModal(true)} className="flex items-center gap-2 px-5 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
                  <ScanQrCode size={18} /> <span className="hidden sm:inline">QR Capture</span>
                </button>
                <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 px-6 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
                  <UploadCloud size={18} /> <span className="hidden sm:inline">Import Excel</span>
                </button>
                <Link to="/clients/new" className="flex items-center gap-3 px-6 py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200">
                  <Plus size={18} />
                  <span>New Lead</span>
                </Link>
              </>
            ) : (
              <div className="px-6 py-3 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-200">
                Demo Territory
              </div>
            )}
          </motion.div>
        </header>

        <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} user={user} />

        <AnimatePresence>
          {showQrModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowQrModal(false)}>
              <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-slate-200 text-center relative overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-orange-500"></div>
                <div className="flex items-center justify-center gap-2 mb-6">
                  <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg"><Sparkles size={16} className="text-white" /></div>
                  <span className="text-lg font-black tracking-tight text-slate-900">Handysolver<span className="text-indigo-600">.AI</span></span>
                </div>
                <h2 className="text-2xl font-black mb-2 text-slate-900 tracking-tight">Lead Capture QR</h2>
                <p className="text-sm text-slate-500 mb-6 font-medium">Prospects can scan this to automatically join your pipeline.</p>
                <div className="bg-slate-50 p-4 rounded-[2rem] border border-slate-200 inline-block mb-6 shadow-inner">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${window.location.origin}/capture/${companyId}`)}`} alt="QR Code" className="w-48 h-48 rounded-xl mix-blend-multiply" />
                </div>
                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/capture/${companyId}`); setSuccess("Capture link copied!"); setTimeout(() => setSuccess(''), 3000); }} className="w-full py-3.5 bg-slate-50 border border-slate-200 text-indigo-600 font-black text-xs uppercase tracking-widest rounded-xl mb-3 hover:bg-indigo-50 hover:border-indigo-200 transition-all active:scale-95 shadow-sm">Copy Direct Link</button>
                <button onClick={() => setShowQrModal(false)} className="w-full py-3.5 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 active:scale-95">Close Window</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {(error || success) && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`mb-8 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-sm border ${error ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
              {error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
              {error || success}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toolbar */}
        <div className="glass-card p-4 sm:p-6 mb-8 flex flex-col md:flex-row justify-between items-center gap-4 sm:gap-6">
          <div className="relative w-full max-w-md group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Filter leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 sm:py-4 pl-14 pr-6 text-sm font-bold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-inner"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 sm:gap-4 w-full md:w-auto">
            <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 shadow-inner">
              <button onClick={() => setViewMode('list')} className={`px-4 sm:px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}>LIST</button>
              <button onClick={() => setViewMode('kanban')} className={`px-4 sm:px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${viewMode === 'kanban' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}>KANBAN</button>
            </div>

            <div className="h-8 w-[1px] bg-slate-200 mx-1 hidden lg:block"></div>

            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <select
                  value={leadTypeFilter}
                  onChange={(e) => setLeadTypeFilter(e.target.value)}
                  className="w-full pl-3 sm:pl-5 pr-8 sm:pr-10 py-3 border border-slate-200 bg-white rounded-2xl text-[10px] sm:text-xs font-bold text-slate-600 outline-none hover:bg-slate-50 transition-all appearance-none cursor-pointer shadow-sm sm:min-w-[140px]"
                >
                  <option value="">All Types</option>
                  {availableLeadTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {!isActiveOnlyRoute && (
                <div className="relative flex-1 sm:flex-none">
                  <select
                    value={activityFilter}
                    onChange={(e) => setActivityFilter(e.target.value as any)}
                    className="w-full pl-3 sm:pl-5 pr-8 sm:pr-10 py-3 border border-slate-200 bg-white rounded-2xl text-[10px] sm:text-xs font-bold text-slate-600 outline-none hover:bg-slate-50 transition-all appearance-none cursor-pointer shadow-sm sm:min-w-[140px]"
                  >
                    <option value="ALL">All Activity</option>
                    <option value="ACTIVE">Active (Connected)</option>
                    <option value="INACTIVE">Inactive (No Recs)</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              )}

              <AnimatePresence>
                {selectedLeads.length > 0 && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9, x: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: 20 }}
                    onClick={handleBulkDelete}
                    className="flex items-center gap-2 px-5 py-3 bg-rose-50 text-rose-600 rounded-2xl text-xs font-black hover:bg-rose-100 transition-all border border-rose-200 shadow-sm uppercase tracking-widest"
                  >
                    <Trash2 size={14} /> Delete ({selectedLeads.length})
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {viewMode === 'kanban' ? <KanbanView /> : (
          <>


            {/* Mobile View (Cards) */}
            <div className="lg:hidden space-y-4">
              {loadingLeads ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white rounded-3xl sm:rounded-[2rem] p-4 sm:p-6 border border-slate-200 shadow-sm space-y-4 animate-pulse">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-slate-200 shrink-0"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                        <div className="h-3 bg-slate-200 rounded w-1/3"></div>
                      </div>
                    </div>
                    <div className="h-16 bg-slate-100 rounded-xl"></div>
                    <div className="h-10 bg-slate-100 rounded-xl"></div>
                  </div>
                ))
              ) : paginatedLeads.map(lead => (
                <div key={lead.id} className="bg-white rounded-3xl sm:rounded-[2rem] p-4 sm:p-6 border border-slate-200 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-orange-400 to-orange-500"></div>
                  <div className="flex items-start justify-between mb-4 gap-4">
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 pr-2">
                      <input
                        type="checkbox"
                        checked={selectedLeads.includes(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-orange-300 text-orange-600 focus:ring-orange-600 cursor-pointer shrink-0"
                      />
                      <div className="relative shrink-0">
                        {lead.avatar ? (
                          <img src={lead.avatar} className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-[1rem] object-cover ring-2 ring-slate-50" alt={lead.name} />
                        ) : (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-[1rem] bg-slate-100 flex items-center justify-center text-slate-400 text-xs sm:text-sm font-black ring-2 ring-slate-50">
                            {lead.name.split(' ').map((n: string) => n[0]).join('')}
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-orange-50 bg-emerald-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-extrabold text-sm sm:text-base text-black break-words leading-tight">{lead.name}</h3>
                        <div className="text-slate-500 text-xs font-semibold mt-1 flex flex-wrap items-center gap-2">
                          <span className="break-words">{lead.company}</span>
                          {lead.leadType && <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-widest shrink-0">{lead.leadType}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="relative shrink-0 mt-1 max-w-[120px]">
                      <select
                        value={lead.phase || 'DISCOVERY'}
                        onChange={(e) => handlePhaseChange(lead.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className={`w-full text-[9px] font-black uppercase tracking-widest pl-2.5 pr-6 py-1.5 rounded-lg border appearance-none cursor-pointer outline-none text-ellipsis overflow-hidden whitespace-nowrap ${getPhaseColor(lead.phase || 'DISCOVERY')}`}
                      >
                        {availablePhases.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-5 p-3 sm:p-4 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-200">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1.5">Score</div>
                      <div className="font-extrabold text-orange-600">{lead.score || 0}%</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1.5">Pulse</div>
                      <div className="text-sm font-medium text-slate-600 truncate">{lead.lastPulse}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between mt-2 pt-4 border-t border-slate-200 gap-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!isDemoMode && (
                        <>
                          {recordingId === lead.id ? (
                            <div className="flex items-center gap-2">
                              <div className="bg-black text-white px-2.5 sm:px-3 py-2 rounded-lg sm:rounded-xl flex items-center gap-1.5 sm:gap-2 font-mono text-[10px] sm:text-xs">
                                <div className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-red-500 animate-pulse'}`} />
                                {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                              </div>
                              <button onClick={isPaused ? resumeRecording : pauseRecording} className="p-2 sm:p-3 bg-amber-50 text-amber-600 rounded-lg sm:rounded-xl hover:bg-amber-100">
                                {isPaused ? <Play size={16} /> : <Pause size={16} />}
                              </button>
                              <button onClick={stopRecording} className="p-2 sm:p-3 bg-red-50 text-red-600 rounded-lg sm:rounded-xl hover:bg-red-100">
                                <Square size={16} />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => startRecording(lead.id)} className="p-2 sm:p-3 bg-slate-50 text-indigo-600 rounded-lg sm:rounded-xl hover:bg-slate-100 transition-all flex items-center gap-1.5 sm:gap-2 font-bold text-[10px] sm:text-xs border border-slate-200" title="Start Session" disabled={!!recordingId}>
                              <Mic size={16} /> Record
                            </button>
                          )}
                          <div className="flex items-center gap-1">
                            <button onClick={() => onCopyLink(lead.id, lead.name)} disabled={isCreatingMeeting} className={`p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all disabled:opacity-50 border border-transparent ${shareUrls[lead.id] ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50'}`} title="Copy Link">
                              {isCreatingMeeting && !shareUrls[lead.id] ? <Loader2 size={16} className="animate-spin sm:w-[18px] sm:h-[18px]" /> : <Copy size={16} className="sm:w-[18px] sm:h-[18px]" />}
                            </button>
                            <button onClick={() => onShareLink(lead.id, lead.name)} disabled={isCreatingMeeting} className={`p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all disabled:opacity-50 border border-transparent ${shareUrls[lead.id] ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-50'}`} title="Share Link">
                              {isCreatingMeeting && !shareUrls[lead.id] ? <Loader2 size={16} className="animate-spin sm:w-[18px] sm:h-[18px]" /> : <Share2 size={16} className="sm:w-[18px] sm:h-[18px]" />}
                            </button>
                          </div>
                          <Link to={`/clients/${lead.id}/edit`} className="p-2 sm:p-3 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg sm:rounded-xl transition-all border border-transparent">
                            <Edit2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                          </Link>
                          {(role === 'admin' || role === 'super_admin') && (
                            <button
                              onClick={() => handleDeleteLead(lead.id)}
                              className="p-2 sm:p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg sm:rounded-xl transition-all border border-transparent"
                              title="Delete Lead"
                            >
                              <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                            </button>
                          )}
                        </>
                      )}
                      {isDemoMode && (
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-1 bg-slate-50 rounded-lg">Readonly</div>
                      )}
                    </div>
                    <Link to={`/analytics/${lead.id}`} className="text-slate-400 hover:text-indigo-600 hover:bg-slate-50 w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-transparent hover:border-slate-200">
                      <BarChart3 size={14} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View (Premium Table) */}
            <div className="hidden lg:block bg-white rounded-[2.5rem] border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-slate-50/50">
                      <th className="py-6 px-6 relative w-12 text-center">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-orange-300 text-orange-600 focus:ring-orange-600 cursor-pointer"
                        />
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-slate-300"></div>
                      </th>
                      <th className="py-6 px-8 relative">Name <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-slate-300"></div></th>
                      <th className="py-6 px-6 relative">Company <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-slate-300"></div></th>
                      <th className="py-6 px-6 relative w-32">Status <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-slate-300"></div></th>
                      <th className="py-6 px-6 relative w-32">Lead Type <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-slate-300"></div></th>
                      <th className="py-6 px-6 relative w-32">AI Score <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-slate-300"></div></th>
                      <th className="py-6 px-8 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {loadingLeads ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-5 px-6 text-center"><div className="w-4 h-4 rounded bg-slate-200 animate-pulse mx-auto"></div></td>
                          <td className="py-5 px-8">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-[1rem] bg-slate-200 animate-pulse shrink-0"></div>
                              <div className="flex-1 space-y-2">
                                <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4"></div>
                                <div className="h-3 bg-slate-200 rounded animate-pulse w-1/2"></div>
                              </div>
                            </div>
                          </td>
                          <td className="py-5 px-6">
                            <div className="space-y-2 w-full">
                              <div className="h-4 bg-slate-200 rounded animate-pulse w-2/3"></div>
                              <div className="h-3 bg-slate-200 rounded animate-pulse w-1/3"></div>
                            </div>
                          </td>
                          <td className="py-5 px-6"><div className="h-8 bg-slate-200 rounded-lg animate-pulse w-24"></div></td>
                          <td className="py-5 px-6"><div className="h-6 bg-slate-200 rounded-lg animate-pulse w-16"></div></td>
                          <td className="py-5 px-6"><div className="h-6 bg-slate-200 rounded-full animate-pulse w-full"></div></td>
                          <td className="py-5 px-8"><div className="h-8 bg-slate-200 rounded-xl animate-pulse w-full"></div></td>
                        </tr>
                      ))
                    ) : paginatedLeads.map((lead) => {
                      const leadRecs = recordings.filter(r => r.meetingId === lead.id || r.leadId === lead.id);
                      const isExp = expandedLeadId === lead.id;

                      return (
                        <React.Fragment key={lead.id}>
                          <tr className={`border-b border-slate-100 hover:bg-slate-50/80 transition-all duration-300 group ${isExp ? 'bg-slate-50/50 shadow-inner' : ''}`}>
                            <td className="py-5 px-6 text-center">
                              <input
                                type="checkbox"
                                checked={selectedLeads.includes(lead.id)}
                                onChange={() => toggleSelect(lead.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 rounded border-orange-300 text-orange-600 focus:ring-orange-600 cursor-pointer"
                              />
                            </td>
                            <td className="py-5 px-8 min-w-[250px] whitespace-normal">
                              <div className="flex items-center gap-4">
                                <div className="relative shrink-0">
                                  {lead.avatar ? (
                                    <img src={lead.avatar} className="w-12 h-12 rounded-[1rem] object-cover border-2 border-orange-50 shadow-sm group-hover:shadow-md transition-shadow" alt={lead.name} />
                                  ) : (
                                    <div className="w-12 h-12 rounded-[1rem] bg-slate-100 flex items-center justify-center text-slate-400 text-sm font-black border-2 border-white shadow-sm">
                                      {lead.name.split(' ').map(n => n[0]).join('')}
                                    </div>
                                  )}
                                  <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-orange-50 bg-emerald-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-extrabold text-black text-base break-words leading-tight">{lead.name}</div>
                                  <div className="text-slate-500 font-medium text-xs mt-1 break-all">{lead.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-5 px-6 min-w-[200px] whitespace-normal">
                              <div className="font-extrabold text-slate-700 break-words leading-tight">{lead.company}</div>
                              <div className="text-slate-400 font-semibold text-xs mt-1 flex items-start gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1 shrink-0" /><span className="break-words">{lead.location}</span></div>
                            </td>
                            <td className="py-5 px-6 whitespace-nowrap">
                              <div className="relative inline-block w-full max-w-[140px]">
                                <select
                                  value={lead.phase || 'DISCOVERY'}
                                  onChange={(e) => handlePhaseChange(lead.id, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className={`w-full text-[10px] font-black uppercase tracking-widest pl-2.5 pr-6 py-1.5 rounded-lg border appearance-none cursor-pointer outline-none text-ellipsis overflow-hidden whitespace-nowrap ${getPhaseColor(lead.phase || 'DISCOVERY')}`}
                                >
                                  {availablePhases.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                              </div>
                            </td>
                            <td className="py-5 px-6 whitespace-nowrap">
                              {lead.leadType ? <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border tracking-widest bg-slate-50 text-slate-600 border-slate-200">{lead.leadType}</span> : <span className="text-slate-300 text-xs font-bold">-</span>}
                            </td>
                            <td className="py-5 px-6 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-2.5 bg-orange-100 rounded-full overflow-hidden shadow-inner">
                                  <div className={`h-full rounded-full transition-all duration-1000 ${lead.score >= 70 ? 'bg-emerald-500' : lead.score >= 40 ? 'bg-amber-500' : 'bg-red-400'}`} style={{ width: `${lead.score || 0}%` }} />
                                </div>
                                <span className="font-black text-sm text-slate-700">{lead.score || 0}</span>
                              </div>
                            </td>
                            <td className="py-5 px-8 text-right">
                              <div className="flex items-center justify-end gap-2 flex-wrap">
                                <button onClick={() => onCopyLink(lead.id, lead.name)} disabled={isCreatingMeeting} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-transparent disabled:opacity-50 ${shareUrls[lead.id] ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50 hover:border-slate-200'}`} title="Copy Link">
                                  {isCreatingMeeting && !shareUrls[lead.id] ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
                                </button>
                                <button onClick={() => onShareLink(lead.id, lead.name)} disabled={isCreatingMeeting} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-transparent disabled:opacity-50 ${shareUrls[lead.id] ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-50 hover:border-slate-200'}`} title="Share Link">
                                  {isCreatingMeeting && !shareUrls[lead.id] ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
                                </button>
                                
                                <Link to={`/analytics/${lead.id}`} className="text-slate-400 hover:text-indigo-600 hover:bg-slate-50 w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-transparent hover:border-slate-200">
                                  <BarChart3 size={14} />
                                </Link>
                                <Link to={`/clients/${lead.id}/edit`} className="text-slate-400 hover:text-indigo-600 hover:bg-slate-50 w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-transparent hover:border-slate-200">
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
                                  <div className="w-9 h-9 flex items-center justify-center bg-slate-50 rounded-xl"><Loader2 size={16} className="animate-spin text-indigo-500" /></div>
                                ) : recordingId === lead.id ? (
                                  <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
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
                                  <button onClick={() => startRecording(lead.id)} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-transparent ${recordingId ? 'opacity-30' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50 hover:border-slate-200'}`} disabled={!!recordingId} title="Record Call">
                                    <Mic size={16} />
                                  </button>
                                )}

                                <button onClick={() => setExpandedLeadId(isExp ? null : lead.id)} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all border ${isExp ? 'bg-slate-50 text-indigo-600 border-slate-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 border-transparent'}`}>
                                  <ChevronDown size={18} className={`transition-transform duration-300 ${isExp ? 'rotate-180' : ''}`} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expandable Row */}
                          <AnimatePresence>
                            {isExp && (
                              <motion.tr initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-gradient-to-b from-slate-50/30 to-white/50 border-b border-slate-100">
                                <td colSpan={7} className="p-0">
                                  <div className="p-8 px-12">
                                    {customFieldDefs.length > 0 && (
                                      <div className="mb-8 pb-8 border-b border-orange-100 border-dashed">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Custom Data</h4>
                                        <div className="flex flex-wrap gap-4">
                                          {customFieldDefs.map(field => (
                                            <div key={field.id} className="bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col min-w-[120px]">
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
                                          <div className="flex items-center gap-2 w-72 bg-slate-50 rounded-xl shadow-inner border border-slate-200 p-1">
                                            <input readOnly value={shareUrls[lead.id]} className="flex-1 bg-transparent px-3 py-1.5 text-xs font-mono text-slate-600 outline-none text-ellipsis" />
                                            <button onClick={() => onCopyLink(lead.id, lead.name)} className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors font-bold shadow-sm" title="Copy Link">
                                              <Copy size={16} />
                                            </button>
                                            <button onClick={() => onShareLink(lead.id, lead.name)} className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors font-bold shadow-sm" title="Share Link">
                                              <Share2 size={16} />
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            <button onClick={() => onCopyLink(lead.id, lead.name)} disabled={isCreatingMeeting} className="flex justify-center items-center gap-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95">
                                              {isCreatingMeeting && !shareUrls[lead.id] ? <Loader2 className="animate-spin" size={14} /> : <Copy size={14} />} Copy Link
                                            </button>
                                            <button onClick={() => onShareLink(lead.id, lead.name)} disabled={isCreatingMeeting} className="flex justify-center items-center gap-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95">
                                              {isCreatingMeeting && !shareUrls[lead.id] ? <Loader2 className="animate-spin" size={14} /> : <Share2 size={14} />} Share Link
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {leadRecs.length === 0 ? (
                                      <div className="text-sm text-slate-400 font-medium bg-slate-50/50 border-2 border-slate-200 border-dashed rounded-[2rem] p-12 text-center flex flex-col items-center">
                                        <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mb-4 shadow-sm"><Play className="text-slate-300" size={24} /></div>
                                        <p>No recordings yet. Click the microphone to start a new one.</p>
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {leadRecs.map(rec => (
                                          <div key={rec.id} className="bg-white rounded-[1.5rem] border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex items-start gap-4 group cursor-pointer" onClick={() => window.location.href = `/r/${rec.id}`}>
                                            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 group-hover:bg-white transition-colors">
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
              <div className="p-5 border-t border-slate-200 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between text-sm text-slate-500 gap-4">
                <div className="font-medium">Showing <span className="font-extrabold text-black">{paginatedLeads.length}</span> of <span className="font-extrabold text-black">{filteredLeads.length}</span> results</div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-orange-50 shadow-sm transition-all disabled:opacity-50">
                      <ChevronLeft size={16} />
                    </button>
                    {getPageNumbers().map(pageNum => (
                      <button
                        key={pageNum} onClick={() => setCurrentPage(pageNum)}
                        className={`px-4 py-2 font-bold shadow-sm border rounded-xl text-xs transition-all ${currentPage === pageNum ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'text-slate-600 bg-white border-transparent hover:border-slate-200'}`}
                      >
                        {pageNum}
                      </button>
                    ))}
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-white shadow-sm transition-all disabled:opacity-50">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
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
              className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-slate-200 text-center"
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
