import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bell, Settings, TrendingUp, Search, Filter, Mic, Square, Loader2, Edit2, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, ChevronDown, Play, Share2, Copy, Users, ArrowUpRight, BarChart3, Plus, Eye, LayoutGrid, List, Pause, ShieldAlert, Trash2, Sparkles, UploadCloud, CalendarDays, ScanQrCode, ThumbsUp, ThumbsDown, History, MessageSquare, X, Send
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
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
import { logActivity } from './utils/activity';
import { WHATSAPP_TEMPLATES, openWhatsApp } from './utils/whatsapp';

const DUMMY_LEADS = [
  { id: '1', name: 'Alexander Sterling', email: 'a.sterling@vanguard.io', company: 'Vanguard Systems', location: 'London, UK', source: 'LINKEDIN', health: 'HOT', score: 85, lastPulse: '2 hours ago', phase: 'QUALIFIED', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d', phone: '+44 20 7123 4567' },
  { id: '2', name: 'Elena Thorne', email: 'elena.t@atlas.corp', company: 'Atlas Global', location: 'Berlin, DE', source: 'REFERRAL', health: 'WARM', score: 62, lastPulse: 'Yesterday', phase: 'NURTURING', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704e', phone: '+49 30 1234 5678' },
  { id: '3', name: 'Julian Rossi', email: 'julian@horizon.com', company: 'Horizon Digital', location: 'Milan, IT', source: 'DIRECT', health: 'HOT', score: 92, lastPulse: '4 hours ago', phase: 'DISCOVERY', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704f', phone: '+39 02 1234 5678' },
  { id: '4', name: 'Sarah Wick', email: 's.wick@continental.dev', company: 'Continental Dev', location: 'New York, US', source: 'LINKEDIN', health: 'COLD', score: 15, lastPulse: 'Oct 12, 2023', phase: 'INACTIVE', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704g', phone: '+1 212-555-0199' },
];

const DEFAULT_LEAD_TYPES = ['B2B', 'B2C', 'ENTERPRISE'];

export default function Leads({ user, isActiveOnlyRoute }: { user: any; isActiveOnlyRoute?: boolean }) {
  const location = useLocation();
  const { companyId, role } = useAuth();
  const { isDemoMode, demoData } = useDemo();
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [leads, setLeads] = useState<any[]>(DUMMY_LEADS);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
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
  const [selectedPhase, setSelectedPhase] = useState((location.state as any)?.phase || 'All');
  const [healthFilter, setHealthFilter] = useState((location.state as any)?.health || 'ALL');
  const [interestFilter, setInterestFilter] = useState<'ALL' | 'INTERESTED' | 'NOT_INTERESTED'>(
    (location.state as any)?.isInterested === true ? 'INTERESTED' : 
    (location.state as any)?.isInterested === false ? 'NOT_INTERESTED' : 'INTERESTED'
  );
  const [selectedLeadForHistory, setSelectedLeadForHistory] = useState<any | null>(null);
  const [newActivityNote, setNewActivityNote] = useState('');
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [submittingNote, setSubmittingNote] = useState(false);

  // Reset page on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, leadTypeFilter, activityFilter, selectedPhase, healthFilter, interestFilter]);

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
      
      // Role-based filtering
      const filtered = role === 'team_member' 
        ? data.filter(l => l.assignedTo === user.uid || l.authorUid === user.uid)
        : data;

      setLeads(filtered.length > 0 ? filtered : (role === 'team_member' ? [] : demoData.leads));
      setLoadingLeads(false);
    }, (error) => {
      console.error("Leads Error:", error);
      setLoadingLeads(false);
    });

    const qRecs = query(collection(db, 'recordings'), where('companyId', '==', companyId));
    const unsubRecs = onSnapshot(qRecs, (snapshot) => {
      const allRecs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as any);
      
      // Role-based filtering for recordings
      const filteredRecs = role === 'team_member'
        ? allRecs.filter(r => r.authorUid === user.uid || leads.some(l => l.id === r.leadId))
        : allRecs;

      setRecordings(filteredRecs);
    });

    const qUsers = query(collection(db, 'users'), where('companyId', '==', companyId));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setTeamMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubLeads(); unsubRecs(); unsubUsers(); };
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

  // Activity Logs Subscription
  useEffect(() => {
    if (!selectedLeadForHistory || isDemoMode) {
      setActivityLogs([]);
      return;
    }
    const q = query(
      collection(db, 'activity_logs'),
      where('leadId', '==', selectedLeadForHistory.id),
      where('companyId', '==', companyId)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      logs.sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setActivityLogs(logs);
    });
    return () => unsub();
  }, [selectedLeadForHistory, companyId, isDemoMode]);

  const handleAddActivityNote = async () => {
    if (!newActivityNote.trim() || !selectedLeadForHistory || !companyId || isDemoMode) return;
    setSubmittingNote(true);
    try {
      await logActivity({
        leadId: selectedLeadForHistory.id,
        companyId,
        type: 'MANUAL_NOTE',
        action: 'Manual Intelligence Entry',
        authorUid: user.uid,
        authorName: user.displayName || 'System',
        details: { note: newActivityNote.trim() }
      });
      setNewActivityNote('');
    } catch (err) {
      console.error('Failed to add note', err);
    } finally {
      setSubmittingNote(false);
    }
  };

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

  const getOrCreateMeetingUrl = (leadId: string, leadName: string) => {
    if (!companyId) return null;
    if (shareUrls[leadId]) return shareUrls[leadId];

    setIsCreatingMeeting(true);
    const id = uuidv4().slice(0, 8);
    const origin = window.location.hostname === 'localhost' ? 'https://handydashcrmai.vercel.app' : window.location.origin;
    const url = `${origin}/m/${id}?l=${leadId}`;

    setShareUrls(prev => ({ ...prev, [leadId]: url }));

    setDoc(doc(db, 'meetings', id), {
      id,
      title: `Call with ${leadName}`,
      ownerUid: user.uid,
      companyId,
      createdAt: Timestamp.now()
    }).then(() => setIsCreatingMeeting(false)).catch(err => {
      console.error(err);
      setError("Failed to create shareable link.");
      setIsCreatingMeeting(false);
    });

    return url;
  };

  const copyTextToClipboard = (text: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try { document.execCommand('copy'); } catch (err) { }
      textArea.remove();
    }
  };

  const onCopyLink = (leadId: string, leadName: string) => {
    const url = getOrCreateMeetingUrl(leadId, leadName);
    if (url) {
      copyTextToClipboard(url);
      setSuccess("Copied to clipboard!");
      setTimeout(() => setSuccess(""), 2000);
    }
  };

  const onShareLink = (leadId: string, leadName: string) => {
    const url = getOrCreateMeetingUrl(leadId, leadName);
    if (url) {
      handleShare(leadId, url);
    }
  };

  const handleShare = (leadId: string, url: string) => {
    if (navigator.share && window.isSecureContext) {
      navigator.share({
        title: 'Join AudioCRM Meeting',
        text: 'Please join my AudioCRM meeting:',
        url: url,
      }).catch((error: any) => {
        if (error.name === 'AbortError') return;
        copyTextToClipboard(url);
        setSuccess("Copied to clipboard!");
        setTimeout(() => setSuccess(""), 2000);
      });
      return;
    }
    copyTextToClipboard(url);
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
      case 'WON': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'LOST': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'QUALIFIED': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'NURTURING': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'DISCOVERY': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'INACTIVE': return 'bg-slate-500/10 text-slate-400 border-white/10';
      default: return 'bg-white/5 text-slate-400 border-white/10';
    }
  };

  const handlePhaseChange = async (leadId: string, newPhase: string) => {
    if (isDemoMode) return;
    try {
      if (!companyId) return;
      const lead = leads.find(l => l.id === leadId);
      const oldPhase = lead?.phase || 'DISCOVERY';
      await updateDoc(doc(db, 'leads', leadId), { phase: newPhase, updatedAt: Timestamp.now() });

      await logActivity({
        leadId,
        companyId,
        type: 'FIELD_CHANGE',
        action: 'Pipeline Phase Transition',
        authorUid: user.uid,
        authorName: user.displayName || 'System',
        details: { field: 'phase', oldValue: oldPhase, newValue: newPhase }
      });
    } catch (e) {
      console.error('Failed to update phase', e);
    }
  };

  const handleHealthChange = async (leadId: string, newHealth: string) => {
    if (isDemoMode) return;
    try {
      if (!companyId) return;
      const lead = leads.find(l => l.id === leadId);
      const oldHealth = lead?.health || 'WARM';
      await updateDoc(doc(db, 'leads', leadId), { health: newHealth, updatedAt: Timestamp.now() });

      await logActivity({
        leadId,
        companyId,
        type: 'FIELD_CHANGE',
        action: 'Health Status Synchronization',
        authorUid: user.uid,
        authorName: user.displayName || 'System',
        details: { field: 'health', oldValue: oldHealth, newValue: newHealth }
      });
    } catch (e) {
      console.error('Failed to update health', e);
    }
  };

  const handleAssignChange = async (leadId: string, assignedTo: string) => {
    if (isDemoMode) return;
    try {
      await updateDoc(doc(db, 'leads', leadId), { assignedTo, updatedAt: Timestamp.now() });
    } catch (e) {
      console.error('Failed to update assignment', e);
    }
  };

  const handleInterestToggle = async (e: React.MouseEvent, leadId: string, currentInterest: boolean) => {
    e.stopPropagation();
    e.preventDefault();
    if (isDemoMode) return;
    try {
      if (!companyId) return;
      const newVal = !currentInterest;
      await updateDoc(doc(db, 'leads', leadId), { isInterested: newVal, updatedAt: Timestamp.now() });

      await logActivity({
        leadId,
        companyId,
        type: 'INTEREST_CHANGE',
        action: newVal ? 'Interest Synchronized' : 'Interest Deprioritized',
        authorUid: user.uid,
        authorName: user.displayName || 'System',
        details: { field: 'isInterested', oldValue: currentInterest, newValue: newVal }
      });
    } catch (e) {
      console.error('Failed to toggle interest', e);
    }
  };

  const handleBulkInterestUpdate = async (newInterest: boolean) => {
    if (isDemoMode) return;
    setLoadingLeads(true);
    try {
      if (!companyId) return;
      for (const leadId of selectedLeads) {
        await updateDoc(doc(db, 'leads', leadId), { isInterested: newInterest, updatedAt: Timestamp.now() });
        
        await logActivity({
          leadId,
          companyId,
          type: 'INTEREST_CHANGE',
          action: newInterest ? 'Bulk Interest Recovery' : 'Bulk Interest Deprecation',
          authorUid: user.uid,
          authorName: user.displayName || 'System',
          details: { field: 'isInterested', oldValue: !newInterest, newValue: newInterest, bulk: true }
        });
      }
      setSuccess(`Successfully updated ${selectedLeads.length} leads.`);
      setSelectedLeads([]);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to update selected leads.");
    } finally {
      setLoadingLeads(false);
    }
  };

  const PHASES = ['DISCOVERY', 'NURTURING', 'QUALIFIED', 'WON', 'LOST', 'INACTIVE'];
  const availablePhases = Array.from(new Set([...PHASES, ...customPhases]));

  const phaseCounts = leads.reduce((acc: Record<string, number>, lead) => {
    const phase = lead.phase || 'DISCOVERY';
    acc[phase] = (acc[phase] || 0) + 1;
    return acc;
  }, { All: leads.length });



  const filteredLeads = leads.filter(l => {

    const matchesSearch = !searchTerm || l.name?.toLowerCase().includes(searchTerm.toLowerCase()) || l.company?.toLowerCase().includes(searchTerm.toLowerCase()) || l.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = !leadTypeFilter || l.leadType === leadTypeFilter;

    const hasActivity = recordings.some(r => r.leadId === l.id || r.meetingId === l.id);
    const matchesActivity = activityFilter === 'ALL' || (activityFilter === 'ACTIVE' && hasActivity) || (activityFilter === 'INACTIVE' && !hasActivity);

    const matchesPhase = selectedPhase === 'All' || (l.phase || 'DISCOVERY') === selectedPhase;
    const matchesHealth = healthFilter === 'ALL' || (l.health || 'WARM').toUpperCase() === healthFilter;
    const matchesInterest = interestFilter === 'ALL' || 
      (interestFilter === 'INTERESTED' && l.isInterested !== false) || 
      (interestFilter === 'NOT_INTERESTED' && l.isInterested === false);

    return matchesSearch && matchesType && matchesActivity && matchesPhase && matchesHealth && matchesInterest;
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
          <div key={phase} className="min-w-[340px] w-[340px] flex flex-col gap-6 snap-start relative z-10">
            <div className="flex items-center justify-between px-2 bg-black/20 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.1)] ${getPhaseColor(phase).split(' ')[0]}`} />
                <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">{phase}</h3>
              </div>
              <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-xl shadow-sm border border-indigo-500/30">
                {phaseLeads.length}
              </span>
            </div>

            <div className="flex-1 space-y-4">
              {loadingLeads ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white/5 rounded-3xl p-6 border border-white/10 shadow-sm animate-pulse space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/10 rounded-2xl shrink-0"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-white/10 rounded w-3/4"></div>
                        <div className="h-3 bg-white/10 rounded w-1/2"></div>
                      </div>
                    </div>
                    <div className="h-12 bg-black/20 rounded-xl"></div>
                  </div>
                ))
              ) : phaseLeads.length === 0 ? (
                <div className="h-32 border-2 border-dashed border-white/10 rounded-[2rem] flex flex-col items-center justify-center text-slate-500 gap-2 bg-black/20">
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
                    className="glass-card !bg-slate-900/40 !rounded-[2.5rem] border border-white/10 hover:border-indigo-500/30 transition-all duration-300 p-6 group relative overflow-hidden cursor-pointer"
                  >
                    <div className="relative z-10">
                      <div className="flex items-center gap-4 mb-5">
                        <input
                          type="checkbox"
                          checked={selectedLeads.includes(lead.id)}
                          onChange={() => toggleSelect(lead.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-5 h-5 rounded-lg border-white/20 bg-black/20 text-indigo-500 focus:ring-indigo-500 cursor-pointer shrink-0 transition-all checked:bg-indigo-600"
                        />
                        <div className="relative">
                          {lead.avatar ? (
                            <img src={lead.avatar} className="w-12 h-12 rounded-2xl object-cover border-2 border-slate-800 shadow-sm" alt={lead.name} />
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-300 text-sm font-black border-2 border-slate-800 shadow-sm">
                              {lead.name.split(' ').map((n: string) => n[0]).join('')}
                            </div>
                          )}
                          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-800 shadow-sm ${lead.health === 'HOT' ? 'bg-rose-500' : lead.health === 'WARM' ? 'bg-amber-400' : 'bg-slate-400'}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <div className="font-black text-white text-sm break-words leading-tight">{lead.name}</div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLeadForHistory(lead);
                                }}
                                className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
                                title="Activity History"
                              >
                                <History size={12} />
                              </button>
                              <button
                                onClick={(e) => handleInterestToggle(e, lead.id, lead.isInterested !== false)}
                                className={`p-1.5 rounded-lg transition-all hover:bg-white/10 active:scale-95 ${lead.isInterested === false ? 'text-rose-500' : 'text-cyan-500'}`}
                                title={lead.isInterested === false ? "Mark as Interested" : "Mark as Not Interested"}
                              >
                                {lead.isInterested === false ? (
                                  <ThumbsDown size={14} className="shrink-0" />
                                ) : (
                                  <ThumbsUp size={14} className="shrink-0" />
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="text-xs font-bold text-slate-400 break-words mt-0.5 leading-snug">{lead.company}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-5 border-t border-white/10">
                        <div className="flex items-center gap-2">
                          <div className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-black uppercase">
                            {lead.score || 0}% Match
                          </div>
                          {lead.leadType && <span className="px-2.5 py-1 bg-white/5 text-slate-400 border border-white/10 rounded-lg text-[8px] font-black uppercase tracking-widest shrink-0">{lead.leadType}</span>}
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedLeadForHistory(lead); }}
                            className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all"
                            title="Activity History"
                          >
                            <History size={16} />
                          </button>
                          {lead.phone && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                const intro = WHATSAPP_TEMPLATES.find(t => t.id === 'intro-followup');
                                if (intro) openWhatsApp(lead.phone, intro.generate({ leadName: lead.name, company: lead.company }));
                              }}
                              className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all"
                              title="WhatsApp Intro"
                            >
                              <MessageSquare size={16} />
                            </button>
                          )}
                          <button onClick={(e) => { e.preventDefault(); onCopyLink(lead.id, lead.name); }} disabled={isCreatingMeeting} className={`p-2 rounded-xl transition-all disabled:opacity-50 ${shareUrls[lead.id] ? 'text-indigo-300 bg-indigo-500/20 hover:bg-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-white/10'}`} title="Copy Link">
                            {isCreatingMeeting && !shareUrls[lead.id] ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
                          </button>
                          <button onClick={(e) => { e.preventDefault(); onShareLink(lead.id, lead.name); }} disabled={isCreatingMeeting} className={`p-2 rounded-xl transition-all disabled:opacity-50 ${shareUrls[lead.id] ? 'text-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30' : 'text-slate-400 hover:text-white hover:bg-white/10'}`} title="Share Link">
                            {isCreatingMeeting && !shareUrls[lead.id] ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
                          </button>
                          <Link to={`/analytics/${lead.id}`} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                            <Sparkles size={16} />
                          </Link>
                          <Link to={`/clients/${lead.id}/edit`} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all">
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
    <div className={`flex-1 bg-transparent min-h-full ${viewMode === 'kanban' ? 'overflow-x-hidden' : ''}`}>
      <div className={`max-w-[1600px] mx-auto ${viewMode === 'kanban' ? 'p-0 sm:p-8 lg:p-12' : 'p-4 sm:p-8 lg:p-12'} space-y-6 sm:space-y-10`}>

        {/* Header Section */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 sm:gap-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">
              <Users size={14} /> Lead Management Protocol
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-none">{isActiveOnlyRoute ? 'Active Leads' : 'All Leads'}</h1>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-wrap items-center gap-3 sm:gap-4">
            {!isDemoMode ? (
              <>
                <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 px-6 py-3.5 bg-white/5 border border-white/10 text-white rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all shadow-sm">
                  <UploadCloud size={18} /> <span className="hidden sm:inline">Import Excel</span>
                </button>
                <Link to="/clients/new" className="flex items-center gap-3 px-6 py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-500/20">
                  <Plus size={18} />
                  <span>New Lead</span>
                </Link>
              </>
            ) : (
              <div className="px-6 py-3 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20">
                Demo Territory
              </div>
            )}
          </motion.div>
        </header>

        <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} user={user} />

        <AnimatePresence>
          {(error || success) && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`mb-8 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-sm border ${error ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
              {error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
              {error || success}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toolbar */}
        <div className="glass-card !bg-slate-900/40 !border-white/10 p-4 sm:p-6 mb-8 flex flex-col md:flex-row justify-between items-center gap-4 sm:gap-6">
          <div className="relative w-full max-w-md group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Filter leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-2xl py-3 sm:py-4 pl-14 pr-6 text-sm font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all shadow-inner"
            />
          </div>

            <AnimatePresence mode="wait">
              {selectedLeads.length === 0 ? (
                <motion.div
                  key="filters"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-wrap items-center justify-between md:justify-end gap-3 sm:gap-4 w-full md:w-auto"
                >
                  <div className="hidden md:flex items-center gap-1.5 p-1.5 bg-black/20 rounded-2xl border border-white/10 shadow-inner">
                    <button onClick={() => setViewMode('list')} className={`px-4 sm:px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${viewMode === 'list' ? 'bg-indigo-500/20 text-indigo-300 shadow-sm border border-indigo-500/30' : 'text-slate-400 hover:text-white'}`}>LIST</button>
                    <button onClick={() => setViewMode('kanban')} className={`px-4 sm:px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${viewMode === 'kanban' ? 'bg-indigo-500/20 text-indigo-300 shadow-sm border border-indigo-500/30' : 'text-slate-400 hover:text-white'}`}>Card View</button>
                  </div>

                  <div className="h-8 w-[1px] bg-white/10 mx-1 hidden lg:block"></div>

                  <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-none">
                      <select
                        value={leadTypeFilter}
                        onChange={(e) => setLeadTypeFilter(e.target.value)}
                        className="w-full pl-3 sm:pl-5 pr-8 sm:pr-10 py-3 border border-white/10 bg-black/20 rounded-2xl text-[10px] sm:text-xs font-bold text-white outline-none hover:bg-white/5 transition-all appearance-none cursor-pointer shadow-sm sm:min-w-[140px] [&>option]:bg-slate-900"
                      >
                        <option value="">All Types</option>
                        {availableLeadTypes.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    <div className="relative flex-1 sm:flex-none">
                      <select
                        value={healthFilter}
                        onChange={(e) => setHealthFilter(e.target.value)}
                        className="w-full pl-3 sm:pl-5 pr-8 sm:pr-10 py-3 border border-white/10 bg-black/20 rounded-2xl text-[10px] sm:text-xs font-bold text-white outline-none hover:bg-white/5 transition-all appearance-none cursor-pointer shadow-sm sm:min-w-[140px] [&>option]:bg-slate-900"
                      >
                        <option value="ALL">All Status</option>
                        <option value="HOT">Hot 🔥</option>
                        <option value="WARM">Warm ☀️</option>
                        <option value="COLD">Cold ❄️</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    {!isActiveOnlyRoute && (
                      <div className="relative flex-1 sm:flex-none">
                        <select
                          value={activityFilter}
                          onChange={(e) => setActivityFilter(e.target.value as any)}
                          className="w-full pl-3 sm:pl-5 pr-8 sm:pr-10 py-3 border border-white/10 bg-black/20 rounded-2xl text-[10px] sm:text-xs font-bold text-white outline-none hover:bg-white/5 transition-all appearance-none cursor-pointer shadow-sm sm:min-w-[140px] [&>option]:bg-slate-900"
                        >
                          <option value="ALL">All Activity</option>
                          <option value="ACTIVE">Active (Connected)</option>
                          <option value="INACTIVE">No Activity</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    )}

                    <div className="relative flex-1 sm:flex-none">
                      <select
                        value={interestFilter}
                        onChange={(e) => setInterestFilter(e.target.value as any)}
                        className="w-full pl-3 sm:pl-5 pr-8 sm:pr-10 py-3 border border-white/10 bg-black/20 rounded-2xl text-[10px] sm:text-xs font-bold text-white outline-none hover:bg-white/5 transition-all appearance-none cursor-pointer shadow-sm sm:min-w-[140px] [&>option]:bg-slate-900"
                      >
                        <option value="ALL">All Interest</option>
                        <option value="INTERESTED">Interested 👍</option>
                        <option value="NOT_INTERESTED">Not Interested 👎</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="actions"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex flex-wrap items-center justify-between md:justify-end gap-3 sm:gap-4 w-full md:w-auto"
                >
                  <div className="flex items-center gap-3 mr-2 sm:mr-4">
                    <span className="text-[10px] sm:text-xs font-black text-indigo-400 uppercase tracking-tighter">
                      {selectedLeads.length} Selected
                    </span>
                    <button
                      onClick={() => setSelectedLeads([])}
                      className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors underline underline-offset-4"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleBulkInterestUpdate(true)}
                      className="flex items-center gap-2 px-3 sm:px-6 py-2.5 sm:py-3.5 bg-cyan-500/10 text-cyan-400 rounded-2xl text-[10px] sm:text-xs font-black hover:bg-cyan-500/20 transition-all border border-cyan-500/20 shadow-sm uppercase tracking-widest"
                    >
                      <ThumbsUp size={14} /> <span className="hidden xs:inline">Interested</span>
                    </button>
                    <button
                      onClick={() => handleBulkInterestUpdate(false)}
                      className="flex items-center gap-2 px-3 sm:px-6 py-2.5 sm:py-3.5 bg-rose-500/10 text-rose-400 rounded-2xl text-[10px] sm:text-xs font-black hover:bg-rose-500/20 transition-all border border-rose-500/20 shadow-sm uppercase tracking-widest"
                    >
                      <ThumbsDown size={14} /> <span className="hidden xs:inline">Not Interested</span>
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3.5 bg-rose-600 text-white rounded-2xl text-[10px] sm:text-xs font-black hover:bg-rose-500 transition-all shadow-xl shadow-rose-500/20 uppercase tracking-widest"
                    >
                      <Trash2 size={14} /> <span className="hidden sm:inline">Delete</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          {['All', ...availablePhases].map((phase) => (
            <button
              key={phase}
              onClick={() => setSelectedPhase(phase)}
              className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${selectedPhase === phase
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                : 'bg-white/5 text-slate-400 border border-white/10 hover:border-white/20 hover:text-white'
                }`}
            >
              {phase} <span className="ml-1 opacity-75">({phaseCounts[phase] || 0})</span>
            </button>
          ))}
        </div>
        {viewMode === 'kanban' ? <KanbanView /> : (
          <>


            {/* Mobile View (Cards) */}
            <div className="lg:hidden space-y-4">
              {loadingLeads ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="glass-card !bg-slate-900/40 !rounded-[2.5rem] p-4 sm:p-6 border border-white/10 shadow-sm space-y-4 animate-pulse">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/10 shrink-0"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-white/10 rounded w-1/2"></div>
                        <div className="h-3 bg-white/10 rounded w-1/3"></div>
                      </div>
                    </div>
                    <div className="h-16 bg-black/20 rounded-xl"></div>
                    <div className="h-10 bg-black/20 rounded-xl"></div>
                  </div>
                ))
              ) : paginatedLeads.map(lead => (
                <div key={lead.id} className="glass-card !bg-slate-900/40 !rounded-[2.5rem] p-4 sm:p-6 border border-white/10 hover:border-indigo-500/30 transition-all duration-300 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-orange-400 to-orange-500"></div>
                  <div className="flex items-start justify-between mb-4 gap-4">
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 pr-2">
                      <input
                        type="checkbox"
                        checked={selectedLeads.includes(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-white/20 bg-black/20 text-indigo-500 focus:ring-indigo-500 cursor-pointer shrink-0"
                      />
                      <div className="relative shrink-0">
                        {lead.avatar ? (
                          <img src={lead.avatar} className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-[1rem] object-cover ring-2 ring-slate-900/50" alt={lead.name} />
                        ) : (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-[1rem] bg-white/10 flex items-center justify-center text-white text-xs sm:text-sm font-black ring-2 ring-slate-900/50">
                            {lead.name.split(' ').map((n: string) => n[0]).join('')}
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 bg-emerald-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-extrabold text-sm sm:text-base text-white break-words leading-tight">{lead.name}</h3>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLeadForHistory(lead);
                              }}
                              className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
                            >
                              <History size={12} />
                            </button>
                            <button
                              onClick={(e) => handleInterestToggle(e, lead.id, lead.isInterested !== false)}
                              className={`p-1.5 rounded-xl transition-all hover:bg-white/10 active:scale-90 ${lead.isInterested === false ? 'text-rose-500' : 'text-cyan-500'}`}
                            >
                              {lead.isInterested === false ? (
                                <ThumbsDown size={14} className="shrink-0" />
                              ) : (
                                <ThumbsUp size={14} className="shrink-0" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="text-slate-400 text-xs font-semibold mt-1 flex flex-wrap items-center gap-2">
                          <span className="break-words">{lead.company}</span>
                          {lead.leadType && <span className="px-2 py-0.5 bg-white/10 text-slate-300 rounded text-[9px] font-black uppercase tracking-widest shrink-0">{lead.leadType}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="relative shrink-0 mt-1 max-w-[120px]">
                      <select
                        value={lead.health || 'WARM'}
                        onChange={(e) => handleHealthChange(lead.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className={`w-full text-[9px] font-black uppercase tracking-widest pl-2.5 pr-6 py-1.5 rounded-lg border appearance-none cursor-pointer outline-none text-ellipsis overflow-hidden whitespace-nowrap [&>option]:bg-slate-900 ${(lead.health || 'WARM') === 'HOT' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : (lead.health || 'WARM') === 'COLD' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}
                      >
                        <option value="HOT">Hot 🔥</option>
                        <option value="WARM">Warm ☀️</option>
                        <option value="COLD">Cold ❄️</option>
                      </select>
                      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-5 p-3 sm:p-4 bg-black/20 rounded-xl sm:rounded-2xl border border-white/5">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1.5">Score</div>
                      <div className="font-extrabold text-white">{lead.score || 0}%</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1.5">Status</div>
                      <div className="relative inline-block w-full max-w-[140px]">
                        <select
                          value={lead.phase || 'DISCOVERY'}
                          onChange={(e) => handlePhaseChange(lead.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className={`w-full text-[10px] font-black uppercase tracking-widest pl-2.5 pr-6 py-1.5 rounded-lg border appearance-none cursor-pointer outline-none text-ellipsis overflow-hidden whitespace-nowrap [&>option]:bg-slate-900 ${getPhaseColor(lead.phase || 'DISCOVERY')}`}
                        >
                          {availablePhases.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                      </div>
                    </div>
                    {(role === 'admin' || role === 'management' || role === 'super_admin') && (
                      <div className="col-span-2 border-t border-white/5 pt-3 mt-1">
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1.5 flex items-center justify-between">
                          <span>Assigned To</span>
                        </div>
                        <div className="relative inline-block w-full">
                          <select
                            value={lead.assignedTo || ''}
                            onChange={(e) => handleAssignChange(lead.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className={`w-full text-xs font-bold pl-2.5 pr-6 py-2 rounded-lg border appearance-none cursor-pointer outline-none text-ellipsis overflow-hidden whitespace-nowrap [&>option]:bg-slate-900 bg-white/5 text-slate-300 border-white/10`}
                          >
                            <option value="">Unassigned</option>
                            {teamMembers.map(m => <option key={m.id} value={m.uid}>{m.displayName}</option>)}
                          </select>
                          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-slate-400" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between mt-2 pt-4 border-t border-white/10 gap-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!isDemoMode && (
                        <>
                          {recordingId === lead.id ? (
                            <div className="flex items-center gap-2">
                              <div className="bg-rose-500/20 border border-rose-500/30 text-rose-300 px-2.5 sm:px-3 py-2 rounded-lg sm:rounded-xl flex items-center gap-1.5 sm:gap-2 font-mono text-[10px] sm:text-xs">
                                <div className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-red-500 animate-pulse'}`} />
                                {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                              </div>
                              <button onClick={isPaused ? resumeRecording : pauseRecording} className="p-2 sm:p-3 bg-amber-500/20 text-amber-300 rounded-lg sm:rounded-xl hover:bg-amber-500/30">
                                {isPaused ? <Play size={16} /> : <Pause size={16} />}
                              </button>
                              <button onClick={stopRecording} className="p-2 sm:p-3 bg-rose-500/20 text-rose-300 rounded-lg sm:rounded-xl hover:bg-rose-500/30">
                                <Square size={16} />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => startRecording(lead.id)} className="p-2 sm:p-3 bg-indigo-500/20 text-indigo-300 rounded-lg sm:rounded-xl hover:bg-indigo-500/30 transition-all flex items-center gap-1.5 sm:gap-2 font-bold text-[10px] sm:text-xs border border-indigo-500/30" title="Start Session" disabled={!!recordingId}>
                              <Mic size={16} /> Record
                            </button>
                          )}
                          <div className="flex items-center gap-1">
                            {lead.phone && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const intro = WHATSAPP_TEMPLATES.find(t => t.id === 'intro-followup');
                                  if (intro) openWhatsApp(lead.phone, intro.generate({ leadName: lead.name, company: lead.company }));
                                }}
                                className="p-2 sm:p-3 bg-emerald-500/10 text-emerald-400 rounded-lg sm:rounded-xl hover:bg-emerald-500/20 transition-all border border-emerald-500/30"
                                title="WhatsApp Intro"
                              >
                                <MessageSquare size={16} className="sm:w-[18px] sm:h-[18px]" />
                              </button>
                            )}
                            <button onClick={() => onCopyLink(lead.id, lead.name)} disabled={isCreatingMeeting} className={`p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all disabled:opacity-50 border border-transparent ${shareUrls[lead.id] ? 'text-indigo-300 bg-indigo-500/20 hover:bg-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-white/10'}`} title="Copy Link">
                              {isCreatingMeeting && !shareUrls[lead.id] ? <Loader2 size={16} className="animate-spin sm:w-[18px] sm:h-[18px]" /> : <Copy size={16} className="sm:w-[18px] sm:h-[18px]" />}
                            </button>
                            <button onClick={() => onShareLink(lead.id, lead.name)} disabled={isCreatingMeeting} className={`p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all disabled:opacity-50 border border-transparent ${shareUrls[lead.id] ? 'text-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30' : 'text-slate-400 hover:text-white hover:bg-white/10'}`} title="Share Link">
                              {isCreatingMeeting && !shareUrls[lead.id] ? <Loader2 size={16} className="animate-spin sm:w-[18px] sm:h-[18px]" /> : <Share2 size={16} className="sm:w-[18px] sm:h-[18px]" />}
                            </button>
                          </div>
                          <Link to={`/clients/${lead.id}/edit`} className="p-2 sm:p-3 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg sm:rounded-xl transition-all border border-transparent">
                            <Edit2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                          </Link>
                          {(role === 'admin' || role === 'super_admin') && (
                            <button
                              onClick={() => handleDeleteLead(lead.id)}
                              className="p-2 sm:p-3 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg sm:rounded-xl transition-all border border-transparent"
                              title="Delete Lead"
                            >
                              <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                            </button>
                          )}
                        </>
                      )}
                      {isDemoMode && (
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-1 bg-white/5 rounded-lg">Readonly</div>
                      )}
                    </div>
                    <Link to={`/analytics/${lead.id}`} className="text-slate-400 hover:text-white hover:bg-white/10 w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-transparent hover:border-white/10">
                      <BarChart3 size={14} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>


            {/* Desktop View (Premium Table) */}
            <div className="hidden lg:block glass-card !bg-slate-900/40 !p-0 !rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-black/20">
                      <th className="py-6 px-6 relative w-12 text-center">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-white/20 bg-black/20 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-white/10"></div>
                      </th>
                      <th className="py-6 px-8 relative">Name <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-white/10"></div></th>
                      <th className="py-6 px-6 relative">Company <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-white/10"></div></th>
                      <th className="py-6 px-6 relative w-32">Status <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-white/10"></div></th>
                      <th className="py-6 px-6 relative w-32">Health <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-white/10"></div></th>
                      <th className="py-6 px-6 relative w-32">Assigned To <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-white/10"></div></th>
                      <th className="py-6 px-6 relative w-32">Lead Type <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-white/10"></div></th>
                      <th className="py-6 px-6 relative w-32">AI Score <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-white/10"></div></th>
                      <th className="py-6 px-8 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {loadingLeads ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i} className="border-b border-white/5">
                          <td className="py-5 px-6 text-center"><div className="w-4 h-4 rounded bg-white/10 animate-pulse mx-auto"></div></td>
                          <td className="py-5 px-8">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-[1rem] bg-white/10 animate-pulse shrink-0"></div>
                              <div className="flex-1 space-y-2">
                                <div className="h-4 bg-white/10 rounded animate-pulse w-3/4"></div>
                                <div className="h-3 bg-white/10 rounded animate-pulse w-1/2"></div>
                              </div>
                            </div>
                          </td>
                          <td className="py-5 px-6">
                            <div className="space-y-2 w-full">
                              <div className="h-4 bg-white/10 rounded animate-pulse w-2/3"></div>
                              <div className="h-3 bg-white/10 rounded animate-pulse w-1/3"></div>
                            </div>
                          </td>
                          <td className="py-5 px-6"><div className="h-8 bg-white/10 rounded-lg animate-pulse w-24"></div></td>
                          <td className="py-5 px-6"><div className="h-8 bg-white/10 rounded-lg animate-pulse w-24"></div></td>
                          <td className="py-5 px-6"><div className="h-8 bg-white/10 rounded-lg animate-pulse w-24"></div></td>
                          <td className="py-5 px-6"><div className="h-6 bg-white/10 rounded-lg animate-pulse w-16"></div></td>
                          <td className="py-5 px-6"><div className="h-6 bg-white/10 rounded-full animate-pulse w-full"></div></td>
                          <td className="py-5 px-8"><div className="h-8 bg-white/10 rounded-xl animate-pulse w-full"></div></td>
                        </tr>
                      ))
                    ) : paginatedLeads.map((lead) => {
                      const leadRecs = recordings.filter(r => r.meetingId === lead.id || r.leadId === lead.id);
                      const isExp = expandedLeadId === lead.id;

                      return (
                        <React.Fragment key={lead.id}>
                          <tr className={`border-b border-white/5 hover:bg-white/5 transition-all duration-300 group ${isExp ? 'bg-black/20 shadow-inner' : ''}`}>
                            <td className="py-5 px-6 text-center">
                              <input
                                type="checkbox"
                                checked={selectedLeads.includes(lead.id)}
                                onChange={() => toggleSelect(lead.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 rounded border-white/20 bg-black/20 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-5 px-8 min-w-[250px] whitespace-normal">
                              <div className="flex items-center gap-4">
                                <div className="relative shrink-0">
                                  {lead.avatar ? (
                                    <img src={lead.avatar} className="w-12 h-12 rounded-[1rem] object-cover border-2 border-slate-900 shadow-sm group-hover:shadow-md transition-shadow" alt={lead.name} />
                                  ) : (
                                    <div className="w-12 h-12 rounded-[1rem] bg-white/10 flex items-center justify-center text-white text-sm font-black border-2 border-slate-900 shadow-sm">
                                      {lead.name.split(' ').map(n => n[0]).join('')}
                                    </div>
                                  )}
                                  <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 bg-emerald-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-3">
                                    <div className="font-extrabold text-white text-base break-words leading-tight">{lead.name}</div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedLeadForHistory(lead);
                                        }}
                                        className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
                                      >
                                        <History size={14} />
                                      </button>
                                      {lead.phone && (
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const intro = WHATSAPP_TEMPLATES.find(t => t.id === 'intro-followup');
                                            if (intro) openWhatsApp(lead.phone, intro.generate({ leadName: lead.name, company: lead.company }));
                                          }}
                                          className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                                          title="WhatsApp Intro"
                                        >
                                          <MessageSquare size={16} />
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => handleInterestToggle(e, lead.id, lead.isInterested !== false)}
                                        className={`p-2 rounded-xl transition-all hover:bg-white/10 active:scale-90 ${lead.isInterested === false ? 'text-rose-500 bg-rose-500/5' : 'text-cyan-500 bg-cyan-500/5'} border border-white/5 hover:border-white/10`}
                                        title={lead.isInterested === false ? "Mark as Interested" : "Mark as Not Interested"}
                                      >
                                        {lead.isInterested === false ? (
                                          <ThumbsDown size={16} className="shrink-0" />
                                        ) : (
                                          <ThumbsUp size={16} className="shrink-0" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                  <div className="text-slate-400 font-medium text-xs mt-1 break-all">{lead.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-5 px-6 min-w-[200px] whitespace-normal">
                              <div className="font-extrabold text-slate-300 break-words leading-tight">{lead.company}</div>
                              <div className="text-slate-500 font-semibold text-xs mt-1 flex items-start gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-1 shrink-0" /><span className="break-words">{lead.location}</span></div>
                            </td>
                            <td className="py-5 px-6 whitespace-nowrap">
                              <div className="relative inline-block w-full max-w-[140px]">
                                <select
                                  value={lead.phase || 'DISCOVERY'}
                                  onChange={(e) => handlePhaseChange(lead.id, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className={`w-full text-[10px] font-black uppercase tracking-widest pl-2.5 pr-6 py-1.5 rounded-lg border appearance-none cursor-pointer outline-none text-ellipsis overflow-hidden whitespace-nowrap [&>option]:bg-slate-900 ${getPhaseColor(lead.phase || 'DISCOVERY')}`}
                                >
                                  {availablePhases.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                              </div>
                            </td>
                            <td className="py-5 px-6 whitespace-nowrap">
                              <div className="relative inline-block w-full max-w-[140px]">
                                <select
                                  value={lead.health || 'WARM'}
                                  onChange={(e) => handleHealthChange(lead.id, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className={`w-full text-[10px] font-black uppercase tracking-widest pl-2.5 pr-6 py-1.5 rounded-lg border appearance-none cursor-pointer outline-none text-ellipsis overflow-hidden whitespace-nowrap [&>option]:bg-slate-900 ${(lead.health || 'WARM') === 'HOT' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : (lead.health || 'WARM') === 'COLD' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}
                                >
                                  <option value="HOT">HOT</option>
                                  <option value="WARM">WARM</option>
                                  <option value="COLD">COLD</option>
                                </select>
                                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                              </div>
                            </td>
                            <td className="py-5 px-6 whitespace-nowrap">
                              {(role === 'admin' || role === 'management' || role === 'super_admin') ? (
                                <div className="relative inline-block w-full max-w-[140px]">
                                  <select
                                    value={lead.assignedTo || ''}
                                    onChange={(e) => handleAssignChange(lead.id, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className={`w-full text-[10px] font-black uppercase tracking-widest pl-2.5 pr-6 py-1.5 rounded-lg border appearance-none cursor-pointer outline-none text-ellipsis overflow-hidden whitespace-nowrap [&>option]:bg-slate-900 bg-white/5 border-white/10 hover:border-white/20`}
                                  >
                                    <option value="">Unassigned</option>
                                    {teamMembers.map(m => <option key={m.id} value={m.uid}>{m.displayName}</option>)}
                                  </select>
                                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                                </div>
                              ) : (
                                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border tracking-widest bg-white/5 text-slate-300 border-transparent">
                                  {teamMembers.find(m => m.uid === lead.assignedTo)?.displayName || 'Unassigned'}
                                </span>
                              )}
                            </td>
                            <td className="py-5 px-6 whitespace-nowrap">
                              {lead.leadType ? <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border tracking-widest bg-white/5 text-slate-300 border-white/10">{lead.leadType}</span> : <span className="text-slate-500 text-xs font-bold">-</span>}
                            </td>
                            <td className="py-5 px-6 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-2.5 bg-white/10 rounded-full overflow-hidden shadow-inner">
                                  <div className={`h-full rounded-full transition-all duration-1000 ${lead.score >= 70 ? 'bg-emerald-500' : lead.score >= 40 ? 'bg-amber-500' : 'bg-red-400'}`} style={{ width: `${lead.score || 0}%` }} />
                                </div>
                                <span className="font-black text-sm text-white">{lead.score || 0}</span>
                              </div>
                            </td>
                            <td className="py-5 px-8 text-right">
                              <div className="flex items-center justify-end gap-2 flex-wrap">
                                <button onClick={() => onCopyLink(lead.id, lead.name)} disabled={isCreatingMeeting} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-transparent disabled:opacity-50 ${shareUrls[lead.id] ? 'text-indigo-300 bg-indigo-500/20 hover:bg-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/10'}`} title="Copy Link">
                                  {isCreatingMeeting && !shareUrls[lead.id] ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
                                </button>
                                <button onClick={() => onShareLink(lead.id, lead.name)} disabled={isCreatingMeeting} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-transparent disabled:opacity-50 ${shareUrls[lead.id] ? 'text-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30' : 'text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/10'}`} title="Share Link">
                                  {isCreatingMeeting && !shareUrls[lead.id] ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
                                </button>

                                <Link to={`/analytics/${lead.id}`} className="text-slate-400 hover:text-white hover:bg-white/10 w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-transparent hover:border-white/10">
                                  <BarChart3 size={14} />
                                </Link>
                                <Link to={`/clients/${lead.id}/edit`} className="text-slate-400 hover:text-white hover:bg-white/10 w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-transparent hover:border-white/10">
                                  <Edit2 size={16} />
                                </Link>
                                {(role === 'admin' || role === 'super_admin') && (
                                  <button
                                    onClick={() => handleDeleteLead(lead.id)}
                                    className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all border border-transparent hover:border-rose-500/20"
                                    title="Delete Lead"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}

                                {isTranscribing && recordingId === null ? (
                                  <div className="w-9 h-9 flex items-center justify-center bg-black/20 rounded-xl"><Loader2 size={16} className="animate-spin text-indigo-400" /></div>
                                ) : recordingId === lead.id ? (
                                  <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/10">
                                    <div className={`px-2 py-1 font-mono text-[10px] font-bold ${isPaused ? 'text-amber-400' : 'text-white'}`}>
                                      {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                                    </div>
                                    <button onClick={isPaused ? resumeRecording : pauseRecording} className="w-7 h-7 flex items-center justify-center rounded-lg text-amber-400 hover:bg-amber-500/20">
                                      {isPaused ? <Play size={14} /> : <Pause size={14} />}
                                    </button>
                                    <button onClick={stopRecording} className="w-7 h-7 flex items-center justify-center rounded-lg text-rose-400 hover:bg-rose-500/20">
                                      <Square size={14} />
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => startRecording(lead.id)} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-transparent ${recordingId ? 'opacity-30' : 'text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/10'}`} disabled={!!recordingId} title="Record Call">
                                    <Mic size={16} />
                                  </button>
                                )}

                                <button onClick={() => setExpandedLeadId(isExp ? null : lead.id)} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all border ${isExp ? 'bg-slate-50 text-indigo-600 border-slate-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 border-transparent'}`}>
                                  <ChevronDown size={18} className={`transition-transform duration-300 ${isExp ? 'rotate-180 text-white' : ''}`} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expandable Row */}
                          <AnimatePresence>
                            {isExp && (
                              <motion.tr initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-black/20 border-b border-white/5">
                                <td colSpan={9} className="p-0">
                                  <div className="p-8 px-12">
                                    {customFieldDefs.length > 0 && (
                                      <div className="mb-8 pb-8 border-b border-white/10 border-dashed">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Custom Data</h4>
                                        <div className="flex flex-wrap gap-4">
                                          {customFieldDefs.map(field => (
                                            <div key={field.id} className="bg-white/5 px-5 py-3 rounded-2xl border border-white/10 shadow-sm flex flex-col min-w-[120px]">
                                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{field.name}</span>
                                              <span className="text-sm font-bold text-white">{lead[field.name] || '-'}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    <div className="flex items-center justify-between mb-6">
                                      <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                        History <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-500/30">{leadRecs.length}</span>
                                      </h4>

                                      <div className="flex items-center gap-3">

                                        {shareUrls[lead.id] ? (
                                          <div className="flex items-center gap-2 w-72 bg-black/20 rounded-xl shadow-inner border border-white/10 p-1">
                                            <input readOnly value={shareUrls[lead.id]} className="flex-1 bg-transparent px-3 py-1.5 text-xs font-mono text-slate-300 outline-none text-ellipsis" />
                                            <button onClick={() => onCopyLink(lead.id, lead.name)} className="p-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg transition-colors font-bold shadow-sm" title="Copy Link">
                                              <Copy size={16} />
                                            </button>
                                            <button onClick={() => onShareLink(lead.id, lead.name)} className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors font-bold shadow-sm" title="Share Link">
                                              <Share2 size={16} />
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            <button onClick={() => onCopyLink(lead.id, lead.name)} disabled={isCreatingMeeting} className="flex justify-center items-center gap-2 text-indigo-300 bg-indigo-500/20 hover:bg-indigo-500/30 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95">
                                              {isCreatingMeeting && !shareUrls[lead.id] ? <Loader2 className="animate-spin" size={14} /> : <Copy size={14} />} Copy Link
                                            </button>
                                            <button onClick={() => onShareLink(lead.id, lead.name)} disabled={isCreatingMeeting} className="flex justify-center items-center gap-2 text-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95">
                                              {isCreatingMeeting && !shareUrls[lead.id] ? <Loader2 className="animate-spin" size={14} /> : <Share2 size={14} />} Share Link
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {leadRecs.length === 0 ? (
                                      <div className="text-sm text-slate-400 font-medium bg-black/20 border-2 border-white/10 border-dashed rounded-[2rem] p-12 text-center flex flex-col items-center">
                                        <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-4 shadow-sm"><Play className="text-slate-500" size={24} /></div>
                                        <p>No recordings yet. Click the microphone to start a new one.</p>
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {leadRecs.map(rec => (
                                          <div key={rec.id} className="bg-white/5 rounded-[1.5rem] border border-white/10 p-6 shadow-sm hover:shadow-md hover:border-indigo-500/30 hover:bg-white/10 transition-all flex items-start gap-4 group cursor-pointer" onClick={() => window.location.href = `/r/${rec.id}`}>
                                            <div className="w-12 h-12 rounded-xl bg-black/20 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-indigo-500/20 transition-colors">
                                              <Play className="text-slate-400 group-hover:text-indigo-300 group-hover:fill-indigo-300 ml-1 transition-colors" size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="text-[10px] text-slate-400 group-hover:text-indigo-400 font-bold uppercase tracking-widest mb-1.5 transition-colors">
                                                {rec.createdAt?.toDate ? rec.createdAt.toDate().toLocaleString(undefined, { dateStyle: 'medium' }) : 'Unknown Date'}
                                              </div>
                                              <div className="text-sm font-medium text-slate-300 italic line-clamp-2 leading-relaxed">"{rec.transcript}"</div>
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
              <div className="p-5 border-t border-white/10 bg-black/40 flex flex-col md:flex-row items-center justify-between text-sm text-slate-400 gap-4">
                <div className="font-medium">Showing <span className="font-extrabold text-white">{paginatedLeads.length}</span> of <span className="font-extrabold text-white">{filteredLeads.length}</span> results</div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 shadow-sm transition-all disabled:opacity-50">
                      <ChevronLeft size={16} />
                    </button>
                    {getPageNumbers().map(pageNum => (
                      <button
                        key={pageNum} onClick={() => setCurrentPage(pageNum)}
                        className={`px-4 py-2 font-bold shadow-sm border rounded-xl text-xs transition-all ${currentPage === pageNum ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'text-slate-300 bg-white/5 border-white/10 hover:bg-white/10'}`}
                      >
                        {pageNum}
                      </button>
                    ))}
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 shadow-sm transition-all disabled:opacity-50">
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
              className="bg-slate-900 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-slate-800 text-center"
            >
              <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <ShieldAlert className="text-amber-500" size={32} />
              </div>
              <h2 className="text-xl font-black text-white mb-2">Still there?</h2>
              <p className="text-slate-400 text-sm mb-1 font-medium">
                Recording for <span className="text-white font-bold">{Math.floor(recordingSeconds / 60)} minutes</span>.
              </p>
              <p className="text-amber-400 text-xs font-black uppercase tracking-widest mb-8">
                Auto-submit in {autoSubmitCountdown}s...
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => { setShowSafetyAlert(false); setAutoSubmitCountdown(AUTO_SUBMIT_WINDOW); }}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                >
                  Continue
                </button>
                <button
                  onClick={stopRecording}
                  className="w-full py-4 bg-white/5 text-slate-300 rounded-2xl font-bold hover:bg-white/10 transition-all"
                >
                  Stop
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Lead History Sidebar ── */}
      <AnimatePresence>
        {selectedLeadForHistory && (
          <div className="fixed inset-0 z-[200] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLeadForHistory(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-xl h-full bg-slate-900 border-l border-white/10 shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl border border-white/10 overflow-hidden shadow-lg bg-white/5">
                    <img src={selectedLeadForHistory.avatar || `https://ui-avatars.com/api/?name=${selectedLeadForHistory.name}&background=random`} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white leading-tight uppercase tracking-tight">{selectedLeadForHistory.name}</h3>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{selectedLeadForHistory.company}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedLeadForHistory(null)}
                  className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white border border-white/10 transition-all active:scale-95"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 scrollbar-hide space-y-8">
                {/* Manual Note Entry */}
                <div className="glass-card !bg-white/5 !rounded-3xl p-5 border-white/10 shadow-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                      <MessageSquare size={16} />
                    </div>
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Append Intelligence</span>
                  </div>
                  <div className="relative">
                    <textarea
                      value={newActivityNote}
                      onChange={(e) => setNewActivityNote(e.target.value)}
                      placeholder="Enter a manual note or update..."
                      className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-xs font-medium text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 min-h-[100px] resize-none transition-all shadow-inner"
                    />
                    <button
                      disabled={!newActivityNote.trim() || submittingNote}
                      onClick={handleAddActivityNote}
                      className="absolute bottom-4 right-4 p-2.5 bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/40 hover:bg-indigo-400 transition-all active:scale-90 disabled:opacity-50 disabled:grayscale"
                    >
                      {submittingNote ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                </div>

                {/* Timeline */}
                <div className="space-y-6 relative">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                      <History size={16} />
                    </div>
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Activity Stream</span>
                  </div>

                  {activityLogs.length === 0 ? (
                    <div className="py-20 text-center space-y-4 opacity-40">
                      <div className="w-12 h-12 bg-white/5 rounded-2xl border border-white/10 mx-auto flex items-center justify-center">
                        <History size={24} className="text-slate-500" />
                      </div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">No interactions detected.</p>
                    </div>
                  ) : (
                    <div className="space-y-6 relative pl-4">
                      {/* Vertical center line */}
                      <div className="absolute left-7 top-4 bottom-4 w-[1px] bg-white/5" />

                      {activityLogs.map((log, idx) => (
                        <motion.div 
                          key={log.id}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="relative pl-10"
                        >
                          {/* Marker */}
                          <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border z-10 shadow-lg ${
                            log.type === 'MANUAL_NOTE' ? 'bg-indigo-500 border-indigo-400 text-white' :
                            log.type === 'INTEREST_CHANGE' ? 'bg-cyan-500 border-cyan-400 text-white' :
                            'bg-slate-800 border-slate-700 text-slate-400'
                          }`}>
                            {log.type === 'MANUAL_NOTE' ? <MessageSquare size={10} /> :
                             log.type === 'INTEREST_CHANGE' ? <ThumbsUp size={10} /> :
                             <Edit2 size={10} />}
                          </div>

                          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 space-y-3 hover:bg-white/[0.05] transition-all group">
                            <div className="flex justify-between items-start gap-3">
                              <div className="space-y-0.5">
                                <div className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">{log.action}</div>
                                <div className="text-[10px] font-black text-white">{log.authorName}</div>
                              </div>
                              <div className="text-[8px] font-black text-slate-500 whitespace-nowrap bg-black/20 px-2 py-1 rounded-md border border-white/5">
                                {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleDateString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : 'Just now'}
                              </div>
                            </div>

                            {log.type === 'MANUAL_NOTE' ? (
                              <div className="text-[11px] text-slate-400 font-medium leading-relaxed bg-black/20 p-3 rounded-xl border border-white/5 italic">
                                "{log.details?.note}"
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-500">
                                <span className="uppercase opacity-40">{log.details?.field}:</span>
                                <span className="line-through">{String(log.details?.oldValue)}</span>
                                <ArrowUpRight size={12} className="text-cyan-500" />
                                <span className="text-white bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{String(log.details?.newValue)}</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-6 border-t border-white/5 bg-white/[0.02] flex items-center gap-4">
                <Link 
                  to={`/clients/${selectedLeadForHistory.id}`}
                  className="flex-1 py-4 bg-white text-slate-950 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-indigo-500 hover:text-white transition-all text-center shadow-xl shadow-white/5 active:scale-95"
                >
                  Full Intelligence View
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
