import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bell, Settings, TrendingUp, Search, Filter, Mic, Square, Loader2, Edit2, CheckCircle2, AlertCircle, ChevronDown, Play, Share2, Copy, Users, ArrowUpRight, BarChart3, Plus, Eye, LayoutGrid, List, Pause, ShieldAlert, Trash2, Sparkles, UploadCloud, CalendarDays, ScanQrCode, ThumbsUp, ThumbsDown, History, MessageSquare, X, Send, MoreVertical, Mail, Phone
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { doc, setDoc, Timestamp, collection, query, where, onSnapshot, getDocs, deleteDoc, getDoc, updateDoc, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from './firebase';
import { CustomFieldDef } from './CustomFields';
import { useAuth } from './contexts/AuthContext';
import { useDemo } from './DemoContext';
import { motion, AnimatePresence } from 'motion/react';
import ImportModal from './ImportModal';
import { compressAudio } from './utils/audio-compression';
import { logActivity } from './utils/activity';
import { WHATSAPP_TEMPLATES, openWhatsApp } from './utils/whatsapp';
import SearchableSelect from './components/SearchableSelect';
import { transcribeWithGroq } from './utils/ai-service';

const DUMMY_LEADS = [
  { id: '1', name: 'Alexander Sterling', email: 'a.sterling@vanguard.io', company: 'Vanguard Systems', location: 'London, UK', source: 'LINKEDIN', health: 'HOT', score: 85, lastPulse: '2 hours ago', phase: 'QUALIFIED', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d', phone: '+44 20 7123 4567' },
  { id: '2', name: 'Elena Thorne', email: 'elena.t@atlas.corp', company: 'Atlas Global', location: 'Berlin, DE', source: 'REFERRAL', health: 'WARM', score: 62, lastPulse: 'Yesterday', phase: 'NURTURING', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704e', phone: '+49 30 1234 5678' },
  { id: '3', name: 'Julian Rossi', email: 'julian@horizon.com', company: 'Horizon Digital', location: 'Milan, IT', source: 'DIRECT', health: 'HOT', score: 92, lastPulse: '4 hours ago', phase: 'DISCOVERY', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704f', phone: '+39 02 1234 5678' },
  { id: '4', name: 'Sarah Wick', email: 's.wick@continental.dev', company: 'Continental Dev', location: 'New York, US', source: 'LINKEDIN', health: 'COLD', score: 15, lastPulse: 'Oct 12, 2023', phase: 'INACTIVE', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704g', phone: '+1 212-555-0199' },
];

const DEFAULT_LEAD_TYPES = (import.meta as any).env.VITE_LEAD_TYPES
  ? (import.meta as any).env.VITE_LEAD_TYPES.split(',').map((s: string) => s.trim().toUpperCase())
  : ['B2B', 'B2C', 'ENTERPRISE'];

import { PageLayout } from './components/layout/PageLayout';
import { PageHeader } from './components/layout/PageHeader';

export default function Leads({ user, isActiveOnlyRoute }: { user: any; isActiveOnlyRoute?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
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
  const [isDeletingLead, setIsDeletingLead] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [leadTypeFilter, setLeadTypeFilter] = useState('');
  const [activityFilter, setActivityFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>(isActiveOnlyRoute ? 'ACTIVE' : 'ALL');
  const [visibleLeadCount, setVisibleLeadCount] = useState(10);
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
      (location.state as any)?.isInterested === false ? 'NOT_INTERESTED' : 'ALL'
  );
  const [selectedLeadForHistory, setSelectedLeadForHistory] = useState<any | null>(null);
  const [openKanbanMenuId, setOpenKanbanMenuId] = useState<string | null>(null);
  const [openMobileMenuId, setOpenMobileMenuId] = useState<string | null>(null);
  const [newActivityNote, setNewActivityNote] = useState('');
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [submittingNote, setSubmittingNote] = useState(false);
  const [teamMemberFilter, setTeamMemberFilter] = useState((location.state as any)?.assignedTo || '');
  const [activeTodayFilter, setActiveTodayFilter] = useState((location.state as any)?.activeToday || false);
  const [activePhasesFilter, setActivePhasesFilter] = useState<string[]>((location.state as any)?.activePhases || []);

  const preserveScrollWhile = useCallback((update: () => void) => {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    update();
    requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
  }, []);

  const toggleKanbanMenu = useCallback((e: React.MouseEvent, leadId: string) => {
    e.preventDefault();
    e.stopPropagation();
    preserveScrollWhile(() => {
      setOpenKanbanMenuId(prev => prev === leadId ? null : leadId);
    });
  }, [preserveScrollWhile]);

  const toggleMobileMenu = useCallback((e: React.MouseEvent, leadId: string) => {
    e.preventDefault();
    e.stopPropagation();
    preserveScrollWhile(() => {
      setOpenMobileMenuId(prev => prev === leadId ? null : leadId);
    });
  }, [preserveScrollWhile]);

  // Reset visible rows on filter changes
  useEffect(() => {
    setVisibleLeadCount(10);
  }, [searchTerm, leadTypeFilter, activityFilter, selectedPhase, healthFilter, interestFilter, teamMemberFilter, activeTodayFilter, activePhasesFilter]);

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
      const storageRef = ref(storage, `recordings/${recordId}.${audioBlob.type.split('/')[1] || 'webm'}`);
      await uploadBytes(storageRef, audioBlob);
      audioUrl = await getDownloadURL(storageRef);

      let transcriptText = 'No transcript generated.';
      let transcriptData: any[] = [];
      try {
        const groqResult = await transcribeWithGroq(audioBlob);
        transcriptText = groqResult.fullText || 'No transcript generated.';
        transcriptData = groqResult.segments || [];
      } catch (e: any) {
        console.warn('Lead call transcription failed', e);
        transcriptText = 'Transcription is temporarily unavailable. The call recording is saved and ready for review.';
        transcriptData = [];
      }

      await setDoc(doc(db, 'recordings', recordId), {
        id: recordId,
        audioUrl,
        transcript: transcriptText,
        transcriptData,
        createdAt: Timestamp.now(),
        authorUid: user?.uid || '',
        companyId,
        leadId,
        fileType: 'audio'
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

      // Dynamic mimeType for cross-browser support (Safari prefers mp4, Chrome prefers webm)
      const options: any = { audioBitsPerSecond: 16000 };
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
      mediaRecorder.onstop = async () => {
        const rawBlob = new Blob(audioChunksRef.current, { type: options.mimeType });
        streamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
        if (audioContextRef.current) audioContextRef.current.close();

        // Compress audio before upload and transcription
        try {
          const compressedBlob = await compressAudio(rawBlob);
          performTranscription(compressedBlob, leadId);
        } catch (err) {
          console.error("Audio compression failed, falling back to raw recording", err);
          performTranscription(rawBlob, leadId);
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
      case 'INACTIVE': return 'bg-slate-500/10 text-[var(--crm-text-muted)] border-[var(--crm-border)]';
      default: return 'bg-[var(--crm-border)] text-[var(--crm-text-muted)] border-[var(--crm-border)]';
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

  const handleLeadTypeChange = async (leadId: string, newLeadType: string) => {
    if (isDemoMode) return;
    try {
      if (!companyId) return;
      const lead = leads.find(l => l.id === leadId);
      const oldLeadType = lead?.leadType || '';
      await updateDoc(doc(db, 'leads', leadId), { leadType: newLeadType, updatedAt: Timestamp.now() });

      await logActivity({
        leadId,
        companyId,
        type: 'FIELD_CHANGE',
        action: 'Lead Type Updated',
        authorUid: user.uid,
        authorName: user.displayName || 'System',
        details: { field: 'leadType', oldValue: oldLeadType, newValue: newLeadType }
      });
    } catch (e) {
      console.error('Failed to update lead type', e);
    }
  };

  const handleAssignChange = async (leadId: string, assignedTo: string) => {
    if (isDemoMode) return;
    try {
      if (!companyId) return;
      const lead = leads.find(l => l.id === leadId);
      const oldAssignee = lead?.assignedTo;

      await updateDoc(doc(db, 'leads', leadId), { assignedTo, updatedAt: Timestamp.now() });

      if (assignedTo && assignedTo !== oldAssignee) {
        await addDoc(collection(db, 'notifications'), {
          companyId,
          userId: assignedTo,
          title: 'Lead Assigned',
          message: `You have been assigned to lead: ${lead?.name || 'Unknown'}`,
          createdAt: Timestamp.now(),
          read: false,
          type: 'lead',
          link: `/leads`,
          leadName: lead?.name || 'Unknown',
          assignedByName: user.displayName || 'Admin'
        });
      }
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
          details: { field: 'isInterested', oldValue: !newInterest, newValue: newInterest, note: 'Bulk update' }
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

  const PHASES = (import.meta as any).env.VITE_PIPELINE_STAGES
    ? (import.meta as any).env.VITE_PIPELINE_STAGES.split(',').map((s: string) => s.trim().toUpperCase())
    : ['DISCOVERY', 'NURTURING', 'QUALIFIED', 'WON', 'LOST', 'INACTIVE'];
  const availablePhases = Array.from(new Set([...PHASES, ...customPhases]));

  const phaseCounts = leads.reduce((acc: Record<string, number>, l) => {
    const matchesSearch = !searchTerm || l.name?.toLowerCase().includes(searchTerm.toLowerCase()) || l.company?.toLowerCase().includes(searchTerm.toLowerCase()) || l.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !leadTypeFilter || l.leadType === leadTypeFilter;
    const hasActivity = recordings.some(r => r.leadId === l.id || r.meetingId === l.id);
    const matchesActivity = activityFilter === 'ALL' || (activityFilter === 'ACTIVE' && hasActivity) || (activityFilter === 'INACTIVE' && !hasActivity);
    const matchesHealth = healthFilter === 'ALL' || (l.health || 'WARM').toUpperCase() === healthFilter;
    const matchesInterest = interestFilter === 'ALL' ||
      (interestFilter === 'INTERESTED' && l.isInterested !== false) ||
      (interestFilter === 'NOT_INTERESTED' && l.isInterested === false);
    const matchesTeamMember = !teamMemberFilter || l.assignedTo === teamMemberFilter;

    let matchesToday = true;
    if (activeTodayFilter) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const leadDateObj = l.updatedAt?.toDate ? l.updatedAt.toDate() : (l.updatedAt ? new Date(l.updatedAt) : new Date(0));
      leadDateObj.setHours(0, 0, 0, 0);
      matchesToday = leadDateObj.getTime() === today.getTime();
    }

    const lPhase = (l.phase || 'NEW').toUpperCase();
    const matchesPhaseList = activePhasesFilter.length === 0 || activePhasesFilter.includes(lPhase);

    if (matchesSearch && matchesType && matchesActivity && matchesHealth && matchesInterest && matchesTeamMember && matchesToday && matchesPhaseList) {
      const phase = l.phase || 'DISCOVERY';
      acc[phase] = (acc[phase] || 0) + 1;
      acc['All'] = (acc['All'] || 0) + 1;
    }
    return acc;
  }, { All: 0 });



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

    const matchesTeamMember = !teamMemberFilter || l.assignedTo === teamMemberFilter;

    let matchesToday = true;
    if (activeTodayFilter) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const leadDateObj = l.updatedAt?.toDate ? l.updatedAt.toDate() : (l.updatedAt ? new Date(l.updatedAt) : new Date(0));
      leadDateObj.setHours(0, 0, 0, 0);
      matchesToday = leadDateObj.getTime() === today.getTime();
    }

    const lPhase = (l.phase || 'NEW').toUpperCase();
    const matchesPhaseList = activePhasesFilter.length === 0 || activePhasesFilter.includes(lPhase);

    return matchesSearch && matchesType && matchesActivity && matchesPhase && matchesHealth && matchesInterest && matchesTeamMember && matchesToday && matchesPhaseList;
  });

  // Infinite-scroll logic
  const ITEMS_PER_BATCH = 10;
  const paginatedLeads = filteredLeads.slice(0, visibleLeadCount);
  const hasMoreLeads = visibleLeadCount < filteredLeads.length;

  const availableLeadTypes = Array.from(new Set([...DEFAULT_LEAD_TYPES, ...customLeadTypes]));

  const isAllSelected = paginatedLeads.length > 0 && paginatedLeads.every(l => selectedLeads.includes(l.id));
  const hasActiveFilters = Boolean(
    searchTerm ||
    leadTypeFilter ||
    selectedPhase !== 'All' ||
    healthFilter !== 'ALL' ||
    interestFilter !== 'ALL' ||
    teamMemberFilter ||
    activeTodayFilter ||
    activePhasesFilter.length > 0 ||
    (!isActiveOnlyRoute && activityFilter !== 'ALL')
  );

  const clearFilters = () => {
    setSearchTerm('');
    setLeadTypeFilter('');
    setActivityFilter(isActiveOnlyRoute ? 'ACTIVE' : 'ALL');
    setSelectedPhase('All');
    setHealthFilter('ALL');
    setInterestFilter('ALL');
    setTeamMemberFilter('');
    setActiveTodayFilter(false);
    setActivePhasesFilter([]);
  };

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

  const InfiniteScrollLoader = () => (
    <InfiniteScrollSentinel
      hasMore={hasMoreLeads}
      total={filteredLeads.length}
      onLoadMore={() => setVisibleLeadCount(count => Math.min(count + ITEMS_PER_BATCH, filteredLeads.length))}
    />
  );

  const InfiniteScrollSentinel = ({ hasMore, total, onLoadMore }: { hasMore: boolean; total: number; onLoadMore: () => void }) => {
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      const node = sentinelRef.current;
      if (!node || !hasMore) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) onLoadMore();
        },
        { rootMargin: '420px 0px' }
      );

      observer.observe(node);
      return () => observer.disconnect();
    }, [hasMore, onLoadMore]);

    return (
      <div ref={sentinelRef} className="py-5 flex flex-col items-center justify-center gap-2 text-center">
        {hasMore ? (
          <>
            <Loader2 size={20} className="animate-spin text-indigo-400" />
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--crm-text-muted)]">
              Loading more leads
            </div>
          </>
        ) : total > 0 ? (
          <div className="text-[10px] font-black uppercase tracking-widest text-[var(--crm-text-muted)]">
            Showing all {total} leads
          </div>
        ) : null}
      </div>
    );
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
    <div className="flex gap-4 sm:gap-8 overflow-x-auto pb-10 min-h-[560px] hide-scrollbar snap-x px-4 sm:px-0">
      {availablePhases.map(phase => {
        const phaseLeads = filteredLeads.filter(l => l.phase === phase);
        return (
          <div key={phase} className="min-w-[82vw] w-[82vw] sm:min-w-[340px] sm:w-[340px] flex flex-col gap-5 sm:gap-6 snap-start relative z-10">
            <div className="flex items-center justify-between px-2 bg-[var(--crm-bg)]/20 backdrop-blur-sm p-4 rounded-2xl border border-[var(--crm-border)]">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.1)] ${getPhaseColor(phase).split(' ')[0]}`} />
                <h3 className="text-xs font-black text-[var(--crm-text)] uppercase tracking-[0.2em]">{phase}</h3>
              </div>
              <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-xl shadow-sm border border-indigo-500/30">
                {phaseLeads.length}
              </span>
            </div>

            <div className="flex-1 space-y-4">
              {loadingLeads ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="bg-[var(--crm-border)] rounded-3xl p-6 border border-[var(--crm-border)] shadow-sm animate-pulse space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[var(--crm-bg)]/40 rounded-2xl shrink-0"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-[var(--crm-bg)]/40 rounded w-3/4"></div>
                        <div className="h-3 bg-[var(--crm-bg)]/40 rounded w-1/2"></div>
                      </div>
                    </div>
                    <div className="h-12 bg-[var(--crm-bg)]/20 rounded-xl"></div>
                  </div>
                ))
              ) : phaseLeads.length === 0 ? (
                <div className="h-32 border-2 border-dashed border-[var(--crm-border)] rounded-[2rem] flex flex-col items-center justify-center text-[var(--crm-text-muted)] gap-2 bg-[var(--crm-bg)]/20">
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
                    className="glass-card !bg-[var(--crm-card-bg)] !rounded-[2.5rem] border border-[var(--crm-border)] hover:border-indigo-500/30 transition-all duration-300 p-6 group relative overflow-visible cursor-pointer"
                  >
                    <div className="relative z-10">
                      <div className="flex items-center gap-4 mb-5">
                        <input
                          type="checkbox"
                          checked={selectedLeads.includes(lead.id)}
                          onChange={() => toggleSelect(lead.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-5 h-5 rounded-lg border-[var(--crm-border)] bg-[var(--crm-bg)]/20 text-indigo-500 focus:ring-indigo-500 cursor-pointer shrink-0 transition-all checked:bg-indigo-600"
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
                          <div className="font-black text-[var(--crm-text)] text-sm break-words leading-tight mb-0.5">{lead.name}</div>
                          <div className="text-xs font-bold text-[var(--crm-text-muted)] break-words mt-0.5 leading-snug">{lead.company}</div>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-[var(--crm-border)]">
                        <div className="grid grid-cols-1 gap-2">
                          {lead.email && (
                            <a
                              href={`mailto:${lead.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="min-w-0 flex items-center gap-2 rounded-xl bg-[var(--crm-control-bg)] border border-[var(--crm-border)] px-3 py-2 text-[11px] font-bold text-[var(--crm-text-muted)] hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
                            >
                              <Mail size={13} className="shrink-0 text-indigo-400" />
                              <span className="truncate">{lead.email}</span>
                            </a>
                          )}
                          {lead.phone && (
                            <a
                              href={`tel:${lead.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="min-w-0 flex items-center gap-2 rounded-xl bg-[var(--crm-control-bg)] border border-[var(--crm-border)] px-3 py-2 text-[11px] font-bold text-[var(--crm-text-muted)] hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                            >
                              <Phone size={13} className="shrink-0 text-emerald-400" />
                              <span className="truncate">{lead.phone}</span>
                            </a>
                          )}
                        </div>

                        <div className="flex items-center gap-2 min-w-0">
                          <div className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-black uppercase shrink-0">
                            {lead.score || 0}% Match
                          </div>
                          {lead.leadType && <span className="min-w-0 truncate px-2.5 py-1 bg-[var(--crm-border)] text-[var(--crm-text-muted)] border border-[var(--crm-border)] rounded-lg text-[8px] font-black uppercase tracking-widest">{lead.leadType}</span>}
                        </div>

                        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-2xl bg-[var(--crm-control-bg)] border border-[var(--crm-border)] p-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedLeadForHistory(lead); }}
                            className="h-9 px-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all text-[10px] font-black uppercase tracking-wider"
                            title="Activity History"
                          >
                            <History size={13} />
                            <span>History</span>
                          </button>
                          <button
                            onClick={(e) => handleInterestToggle(e, lead.id, lead.isInterested !== false)}
                            className={`h-9 px-3 inline-flex items-center justify-center gap-1.5 rounded-xl border transition-all active:scale-95 text-[10px] font-black uppercase tracking-wider ${lead.isInterested === false ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20' : 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20 hover:bg-cyan-500/20'}`}
                            title={lead.isInterested === false ? "Mark as Interested" : "Mark as Not Interested"}
                          >
                            {lead.isInterested === false ? (
                              <ThumbsDown size={13} className="shrink-0" />
                            ) : (
                              <ThumbsUp size={13} className="shrink-0" />
                            )}
                            <span>{lead.isInterested === false ? 'No' : 'Yes'}</span>
                          </button>
                          <div className="relative">
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onClick={(e) => toggleKanbanMenu(e, lead.id)}
                              className="h-9 w-9 flex items-center justify-center rounded-xl bg-[var(--crm-card-bg)] border border-[var(--crm-border)] text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] hover:bg-[var(--crm-control-hover-bg)] transition-all"
                              title="More actions"
                            >
                              <MoreVertical size={16} />
                            </button>

                            <AnimatePresence>
                              {openKanbanMenuId === lead.id && (
                                <motion.div
                                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                                  transition={{ duration: 0.15 }}
                                  className="absolute right-0 bottom-full mb-2 w-44 rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-sidebar-bg)] shadow-2xl p-2 z-50"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      onShareLink(lead.id, lead.name);
                                      setOpenKanbanMenuId(null);
                                    }}
                                    disabled={isCreatingMeeting}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[11px] font-black uppercase tracking-wider text-[var(--crm-text-muted)] hover:text-emerald-400 hover:bg-emerald-500/10 transition-all disabled:opacity-50"
                                  >
                                    {isCreatingMeeting && !shareUrls[lead.id] ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />}
                                    Share Link
                                  </button>
                                  <Link
                                    to={`/analytics/${lead.id}`}
                                    onClick={() => setOpenKanbanMenuId(null)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[11px] font-black uppercase tracking-wider text-[var(--crm-text-muted)] hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
                                  >
                                    <Sparkles size={15} />
                                    Analysis
                                  </Link>
                                  <Link
                                    to={`/clients/${lead.id}/edit`}
                                    onClick={() => setOpenKanbanMenuId(null)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[11px] font-black uppercase tracking-wider text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] hover:bg-[var(--crm-control-hover-bg)] transition-all"
                                  >
                                    <Edit2 size={15} />
                                    Edit Lead
                                  </Link>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
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

  const getAssignedName = (lead: any) =>
    teamMembers.find(m => m.uid === lead.assignedTo || m.id === lead.assignedTo)?.displayName || 'Unassigned';

  const getTemperature = (health?: string) => {
    const normalized = (health || 'WARM').toUpperCase();
    if (normalized === 'HOT') return { emoji: '🔥', label: 'Hot', className: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
    if (normalized === 'COLD') return { emoji: '❄️', label: 'Cold', className: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
    return { emoji: '☀️', label: 'Warm', className: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
  };

  const MobileLeadCard = ({ lead }: { lead: any }) => {
    const temp = getTemperature(lead.health);
    const isInterested = lead.isInterested !== false;
    const canAssign = role === 'admin' || role === 'management' || role === 'super_admin';
    const fieldSelectClass = "w-full appearance-none rounded-xl border border-[var(--crm-border)] bg-[var(--crm-control-bg)] px-3 py-2 pr-8 text-[10px] font-black uppercase tracking-wider text-[var(--crm-text)] outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-70";
    const actionTileClass = "h-11 w-11 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-control-bg)] flex items-center justify-center text-[var(--crm-text)] hover:bg-[var(--crm-control-hover-bg)] transition-all disabled:opacity-40 shrink-0";
    const actionIconClass = "h-7 w-7 rounded-lg flex items-center justify-center shrink-0";
    const leadInitial = (lead.name || '?').trim().charAt(0).toUpperCase();

    return (
      <div
        onClick={() => {
          if (openMobileMenuId === lead.id) {
            setOpenMobileMenuId(null);
            return;
          }
          navigate(`/clients/${lead.id}/edit`);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (openMobileMenuId === lead.id) {
              setOpenMobileMenuId(null);
              return;
            }
            navigate(`/clients/${lead.id}/edit`);
          }
        }}
        role="button"
        tabIndex={0}
        className="glass-card !bg-[var(--crm-card-bg)] !rounded-[1.45rem] p-3.5 border border-[var(--crm-border)] hover:border-indigo-500/30 hover:-translate-y-0.5 transition-all duration-300 shadow-[0_12px_28px_rgba(15,23,42,0.10)] relative overflow-visible group cursor-pointer focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
      >
        <div className="absolute top-4 left-0 w-1 h-[calc(100%-2rem)] rounded-r-full bg-gradient-to-b from-indigo-400 to-cyan-500"></div>

        <AnimatePresence>
          {openMobileMenuId === lead.id && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-2 top-12 z-[999] w-[min(20rem,calc(100%-1rem))] rounded-[1.35rem] border border-[var(--crm-border)] bg-[var(--crm-sidebar-bg)]/95 p-2.5 shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >


              <div className="px-2 pb-1 text-[9px] font-black uppercase tracking-[0.18em] text-[var(--crm-text-muted)]">Quick actions</div>
              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                {!isDemoMode && (
                  recordingId === lead.id ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        stopRecording();
                        setOpenMobileMenuId(null);
                      }}
                      className={`${actionTileClass} text-rose-400 border-rose-500/20 bg-rose-500/10`}
                      title="Stop Recording"
                      aria-label="Stop Recording"
                    >
                      <span className={`${actionIconClass} bg-rose-500/10 text-rose-400`}><Square size={13} /></span>
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startRecording(lead.id);
                        setOpenMobileMenuId(null);
                      }}
                      disabled={!!recordingId}
                      className={`${actionTileClass} hover:text-indigo-400 hover:bg-indigo-500/10`}
                      title="Record Call"
                      aria-label="Record Call"
                    >
                      <span className={`${actionIconClass} bg-indigo-500/10 text-indigo-400`}><Mic size={13} /></span>
                    </button>
                  )
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onShareLink(lead.id, lead.name);
                    setOpenMobileMenuId(null);
                  }}
                  disabled={isCreatingMeeting}
                  className={`${actionTileClass} hover:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50`}
                  title="Share Link"
                  aria-label="Share Link"
                >
                  <span className={`${actionIconClass} bg-emerald-500/10 text-emerald-400`}>
                    {isCreatingMeeting && !shareUrls[lead.id] ? <Loader2 size={13} className="animate-spin" /> : <Share2 size={13} />}
                  </span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedLeadForHistory(lead);
                    setOpenMobileMenuId(null);
                  }}
                  className={`${actionTileClass} hover:text-cyan-400 hover:bg-cyan-500/10`}
                  title="Change Note"
                  aria-label="Change Note"
                >
                  <span className={`${actionIconClass} bg-cyan-500/10 text-cyan-400`}><MessageSquare size={13} /></span>
                </button>

                <Link
                  to={`/analytics/${lead.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMobileMenuId(null);
                  }}
                  className={`${actionTileClass} hover:text-indigo-400 hover:bg-indigo-500/10`}
                  title="Analytics"
                  aria-label="Analytics"
                >
                  <span className={`${actionIconClass} bg-indigo-500/10 text-indigo-400`}><BarChart3 size={13} /></span>
                </Link>

                <Link
                  to={`/clients/${lead.id}/edit`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMobileMenuId(null);
                  }}
                  className={actionTileClass}
                  title="Edit Lead"
                  aria-label="Edit Lead"
                >
                  <span className={`${actionIconClass} bg-[var(--crm-control-bg)] text-[var(--crm-text-muted)] border border-[var(--crm-border)]`}><Edit2 size={13} /></span>
                </Link>
              </div>

              <div className="my-2 h-px bg-[var(--crm-border)]"></div>

              {/* <div className="px-2 pb-1 text-[9px] font-black uppercase tracking-[0.18em] text-[var(--crm-text-muted)]">Update lead</div> */}
              <div className="px-3 pb-2">
                {/* <label className="block text-[9px] font-black uppercase tracking-widest text-[var(--crm-text-muted)] mb-1.5">Lead Type</label> */}
                <div className="relative">
                  <select
                    value={lead.leadType || ''}
                    onChange={(e) => handleLeadTypeChange(lead.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    disabled={isDemoMode}
                    className={fieldSelectClass}
                  >
                    <option value="">Select</option>
                    {availableLeadTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--crm-text-muted)]" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 px-3 pb-1">
                <button
                  onClick={(e) => {
                    if (!isInterested) {
                      handleInterestToggle(e, lead.id, false);
                      setOpenMobileMenuId(null);
                    }
                  }}
                  disabled={isDemoMode || isInterested}
                  className={`h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${isInterested ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30 shadow-sm shadow-cyan-500/10' : 'bg-[var(--crm-control-bg)] text-[var(--crm-text-muted)] border-[var(--crm-border)] hover:bg-cyan-500/10 hover:text-cyan-400'}`}
                >
                  Interested
                </button>
                <button
                  onClick={(e) => {
                    if (isInterested) {
                      handleInterestToggle(e, lead.id, true);
                      setOpenMobileMenuId(null);
                    }
                  }}
                  disabled={isDemoMode || !isInterested}
                  className={`h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${!isInterested ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 shadow-sm shadow-rose-500/10' : 'bg-[var(--crm-control-bg)] text-[var(--crm-text-muted)] border-[var(--crm-border)] hover:bg-rose-500/10 hover:text-rose-400'}`}
                >
                  Not Interested
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pl-1">
          <div className="grid grid-cols-[auto_auto_1fr_auto] items-start gap-2.5">
            <input
              type="checkbox"
              checked={selectedLeads.includes(lead.id)}
              onChange={() => toggleSelect(lead.id)}
              onClick={(e) => e.stopPropagation()}
              className="mt-1 w-4 h-4 rounded border-[var(--crm-border)] bg-[var(--crm-bg)]/20 text-indigo-500 focus:ring-indigo-500 cursor-pointer shrink-0"
            />
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-base font-black shadow-sm shrink-0">
              {leadInitial}
            </div>
            <div className="min-w-0 space-y-1">
              <h3 className="font-black text-base text-[var(--crm-text)] leading-snug break-words">{lead.name || 'Untitled lead'}</h3>
              <div className="text-xs font-bold text-[var(--crm-text)] truncate">{lead.company || 'No company'}</div>
              <a href={lead.phone ? `tel:${lead.phone}` : undefined} onClick={(e) => e.stopPropagation()} className="inline-flex max-w-full items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/15 px-2 py-1 text-[11px] font-bold text-[var(--crm-text-muted)] hover:text-emerald-400 transition-colors">
                <Phone size={12} className="text-emerald-400 shrink-0" />
                <span className="truncate">{lead.phone || 'No mobile number'}</span>
              </a>
            </div>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => toggleMobileMenu(e, lead.id)}
              className={`h-9 w-9 flex items-center justify-center rounded-xl border transition-all ${openMobileMenuId === lead.id ? 'bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/20' : 'bg-[var(--crm-control-bg)] border-[var(--crm-border)] text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] hover:bg-[var(--crm-control-hover-bg)]'}`}
              title="More actions"
              aria-label="More lead actions"
            >
              <MoreVertical size={17} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5 mt-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--crm-text-muted)] space-y-1.5">
              <span>Lead temperature</span>
              <div className="relative">
                <select
                  value={lead.health || 'WARM'}
                  onChange={(e) => handleHealthChange(lead.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  disabled={isDemoMode}
                  className={`${fieldSelectClass} pl-7 ${temp.className}`}
                >
                  <option value="HOT">Hot</option>
                  <option value="WARM">Warm</option>
                  <option value="COLD">Cold</option>
                </select>
                <span className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none text-xs">{temp.emoji}</span>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--crm-text-muted)]" />
              </div>
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--crm-text-muted)] space-y-1.5">
              <span>Status</span>
              <div className="relative">
                <select
                  value={lead.phase || 'DISCOVERY'}
                  onChange={(e) => handlePhaseChange(lead.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  disabled={isDemoMode}
                  className={fieldSelectClass}
                >
                  {availablePhases.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--crm-text-muted)]" />
              </div>
            </div>
          </div>

          <div className="mt-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--crm-text-muted)] space-y-1.5">
              <span>Assigned to</span>
              {canAssign ? (
                <div className="relative">
                  <select
                    value={lead.assignedTo || ''}
                    onChange={(e) => handleAssignChange(lead.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    disabled={isDemoMode}
                    className={fieldSelectClass}
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map(m => <option key={m.id} value={m.uid}>{m.displayName}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--crm-text-muted)]" />
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-control-bg)] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[var(--crm-text)]">{getAssignedName(lead)}</div>
              )}
            </div>
          </div>
          {/* <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--crm-text-muted)]">
            <ArrowUpRight size={12} className="text-indigo-400" />
            Tap card for details
          </div> */}
        </div>
      </div>
    );
  };

  return (
    <PageLayout maxWidth="1600px" className={viewMode === 'kanban' ? 'p-0 sm:p-7 lg:p-10' : ''}>
      <PageHeader
        title=""
        description="Oversee your entire sales pipeline and manage client relationships with precision."
        badge="Lead Portfolio"
        icon={Users}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {!isDemoMode ? (
              <>
                <button onClick={() => setIsImportModalOpen(true)} className="btn-secondary">
                  <UploadCloud size={18} /> <span>Import</span>
                </button>
                <Link to="/clients/new" className="btn-primary">
                  <Plus size={18} />
                  <span>New Lead</span>
                </Link>
              </>
            ) : (
              <div className="px-6 py-3 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20">
                Demo Territory
              </div>
            )}
          </div>
        }
      />

      <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} user={user} />

      <AnimatePresence>
        {(error || success) && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`mb-8 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-sm border ${error ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
            {error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
            {error || success}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toolbar - Added overflow-visible to prevent select clipping */}
      <div className="glass-card !bg-[var(--crm-card-bg)] !border-[var(--crm-border)] !rounded-[1.35rem] !overflow-visible p-3 sm:p-5 mb-4 sm:mb-7 flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-3 sm:gap-5 relative z-50 mx-2 sm:mx-0">
        <div className="relative w-full xl:max-w-md group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--crm-text-muted)] group-focus-within:text-indigo-500 transition-colors" size={18} />
          <input
            type="text"
            placeholder="Filter leads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[var(--crm-input-bg)] border border-[var(--crm-border)] rounded-xl py-3 pl-11 pr-4 text-sm font-bold text-[var(--crm-text)] placeholder:text-[var(--crm-text-muted)] focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 transition-all shadow-sm"
          />
        </div>

        <AnimatePresence mode="wait">
          {selectedLeads.length === 0 ? (
            <motion.div
              key="filters"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col xl:flex-row xl:items-center xl:justify-end gap-2.5 sm:gap-3 w-full xl:w-auto"
            >
              <div className="hidden md:flex items-center gap-1 p-1 bg-[var(--crm-control-bg)] rounded-xl border border-[var(--crm-border)] shadow-sm">
                <button onClick={() => setViewMode('list')} className={`px-4 sm:px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${viewMode === 'list' ? 'bg-indigo-500/20 text-indigo-300 shadow-sm border border-indigo-500/30' : 'text-[var(--crm-text-muted)] hover:text-[var(--crm-text)]'}`}>LIST</button>
                <button onClick={() => setViewMode('kanban')} className={`px-4 sm:px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${viewMode === 'kanban' ? 'bg-indigo-500/20 text-indigo-300 shadow-sm border border-indigo-500/30' : 'text-[var(--crm-text-muted)] hover:text-[var(--crm-text)]'}`}>Card View</button>
              </div>

              <div className="h-8 w-[1px] bg-[var(--crm-border)] mx-1 hidden lg:block"></div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:flex xl:flex-row xl:flex-wrap items-center gap-2 sm:gap-3 w-full xl:w-auto">
                <div className="w-full sm:w-auto min-w-[150px]">
                  <SearchableSelect
                    options={[
                      { id: '', name: 'Types' },
                      ...availableLeadTypes.map(t => ({ id: t, name: t }))
                    ]}
                    value={leadTypeFilter}
                    onChange={setLeadTypeFilter}
                    placeholder="Types"
                    compact={true}
                    hideSearch={availableLeadTypes.length < 5}
                  />
                </div>

                {role !== 'team_member' && (
                  <div className="w-full sm:w-auto min-w-[160px] sm:min-w-[200px]">
                    <SearchableSelect
                      options={teamMembers.map(tm => ({
                        id: tm.id,
                        name: tm.displayName || 'Untitled',
                        company: '',
                        avatar: tm.photoURL
                      }))}
                      value={teamMemberFilter}
                      onChange={setTeamMemberFilter}
                      placeholder="Team Members"
                      compact={true}
                    />
                  </div>
                )}

                <div className="w-full sm:w-auto min-w-[150px]">
                  <SearchableSelect
                    options={[
                      { id: 'ALL', name: 'Status' },
                      { id: 'HOT', name: 'Hot 🔥' },
                      { id: 'WARM', name: 'Warm ☀️' },
                      { id: 'COLD', name: 'Cold ❄️' }
                    ]}
                    value={healthFilter}
                    onChange={setHealthFilter}
                    placeholder="Status"
                    compact={true}
                    hideSearch={true}
                  />
                </div>

                {!isActiveOnlyRoute && (
                  <div className="w-full sm:w-auto min-w-[150px]">
                    <SearchableSelect
                      options={[
                        { id: 'ALL', name: 'Activity' },
                        { id: 'ACTIVE', name: 'Active (Connected)' },
                        { id: 'INACTIVE', name: 'Not Active' }
                      ]}
                      value={activityFilter}
                      onChange={(val) => setActivityFilter(val as any)}
                      placeholder="Activity"
                      compact={true}
                      hideSearch={true}
                    />
                  </div>
                )}

                <div className="w-full sm:w-auto min-w-[150px]">
                  <SearchableSelect
                    options={[
                      { id: 'ALL', name: 'All Leads' },
                      { id: 'INTERESTED', name: 'Interested 👍' },
                      { id: 'NOT_INTERESTED', name: 'Not Interested 👎' }
                    ]}
                    value={interestFilter}
                    onChange={(val) => setInterestFilter(val as any)}
                    placeholder="All Leads"
                    compact={true}
                    hideSearch={true}
                  />
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
                  className="text-[10px] font-black text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] uppercase tracking-widest transition-colors underline underline-offset-4"
                >
                  Clear
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBulkInterestUpdate(true)}
                  className="flex items-center gap-2 px-3 sm:px-6 py-2.5 sm:py-3.5 bg-cyan-500/10 text-cyan-400 rounded-2xl text-[10px] sm:text-xs font-black hover:bg-cyan-500/20 transition-all border border-cyan-500/20 shadow-sm uppercase tracking-widest"
                >
                  <ThumbsUp size={14} /> <span className="hidden sm:inline">Interested</span>
                </button>
                <button
                  onClick={() => handleBulkInterestUpdate(false)}
                  className="flex items-center gap-2 px-3 sm:px-6 py-2.5 sm:py-3.5 bg-rose-500/10 text-rose-400 rounded-2xl text-[10px] sm:text-xs font-black hover:bg-rose-500/20 transition-all border border-rose-500/20 shadow-sm uppercase tracking-widest"
                >
                  <ThumbsDown size={14} /> <span className="hidden sm:inline">Not Interested</span>
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

      {/* <div className="lg:hidden px-4 sm:px-0">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-control-bg)] p-1.5 shadow-inner">
            <button
              onClick={() => setViewMode('list')}
              className={`h-10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm' : 'text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] hover:bg-[var(--crm-control-hover-bg)]'}`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`h-10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'kanban' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm' : 'text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] hover:bg-[var(--crm-control-hover-bg)]'}`}
            >
              Card
            </button>
          </div>
        </div> */}

      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6 overflow-x-auto hide-scrollbar pb-1 px-4 sm:px-0">
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shrink-0 bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
          >
            Clear Filters
          </button>
        )}
        {['All', ...availablePhases].map((phase) => (
          <button
            key={phase}
            onClick={() => setSelectedPhase(phase)}
            className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shrink-0 ${selectedPhase === phase
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
              : 'bg-[var(--crm-control-bg)] text-[var(--crm-text-muted)] border border-[var(--crm-border)] hover:bg-[var(--crm-control-hover-bg)] hover:text-[var(--crm-text)]'
              }`}
          >
            {phase} <span className="ml-1 opacity-75">({phaseCounts[phase] || 0})</span>
          </button>
        ))}
      </div>
      <div>
        {viewMode === 'kanban' ? <KanbanView /> : (
          <>


            {/* Mobile View (Cards) */}
            <div className="lg:hidden space-y-4  sm:px-0">
              {loadingLeads ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="glass-card !bg-[var(--crm-card-bg)] !rounded-[2.5rem] p-4 sm:p-6 border border-[var(--crm-border)] shadow-sm space-y-4 animate-pulse">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[var(--crm-bg)]/40 shrink-0"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-[var(--crm-bg)]/40 rounded w-1/2"></div>
                        <div className="h-3 bg-[var(--crm-bg)]/40 rounded w-1/3"></div>
                      </div>
                    </div>
                    <div className="h-16 bg-[var(--crm-control-bg)] rounded-xl"></div>
                    <div className="h-10 bg-[var(--crm-control-bg)] rounded-xl"></div>
                  </div>
                ))
              ) : paginatedLeads.length === 0 ? (
                <div className="glass-card !bg-[var(--crm-card-bg)] !rounded-[2rem] p-8 border border-dashed border-[var(--crm-border)] text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--crm-control-bg)] border border-[var(--crm-border)] flex items-center justify-center mx-auto mb-4">
                    <Search className="text-[var(--crm-text-muted)]" size={22} />
                  </div>
                  <h3 className="text-base font-black text-[var(--crm-text)] mb-2">No leads found</h3>
                  <p className="text-sm font-medium text-[var(--crm-text-muted)]">Try changing the search or filters.</p>
                </div>
              ) : paginatedLeads.map(lead => (
                <React.Fragment key={lead.id}>
                  <MobileLeadCard lead={lead} />
                  {false && (
                    <div className="glass-card !bg-[var(--crm-card-bg)] !rounded-[2.5rem] p-4 sm:p-6 border border-[var(--crm-border)] hover:border-indigo-500/30 transition-all duration-300 shadow-sm relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-orange-400 to-orange-500"></div>
                      <div className="flex items-start justify-between mb-4 gap-4">
                        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 pr-2">
                          <input
                            type="checkbox"
                            checked={selectedLeads.includes(lead.id)}
                            onChange={() => toggleSelect(lead.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded border-[var(--crm-border)] bg-[var(--crm-bg)]/20 text-indigo-500 focus:ring-indigo-500 cursor-pointer shrink-0"
                          />
                          <div className="relative shrink-0">
                            {lead.avatar ? (
                              <img src={lead.avatar} className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-[1rem] object-cover ring-2 ring-slate-900/50" alt={lead.name} />
                            ) : (
                              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-[1rem] bg-[var(--crm-bg)]/40 flex items-center justify-center text-[var(--crm-text)] text-xs sm:text-sm font-black ring-2 ring-slate-900/50">
                                {lead.name.split(' ').map((n: string) => n[0]).join('')}
                              </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 bg-emerald-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-extrabold text-sm sm:text-base text-[var(--crm-text)] break-words leading-tight">{lead.name}</h3>
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
                                  className={`p-1.5 rounded-xl transition-all hover:bg-[var(--crm-bg)]/40 active:scale-90 ${lead.isInterested === false ? 'text-rose-500' : 'text-cyan-500'}`}
                                >
                                  {lead.isInterested === false ? (
                                    <ThumbsDown size={14} className="shrink-0" />
                                  ) : (
                                    <ThumbsUp size={14} className="shrink-0" />
                                  )}
                                </button>
                              </div>
                            </div>
                            <div className="text-[var(--crm-text-muted)] text-xs font-semibold mt-1 flex flex-wrap items-center gap-2">
                              <span className="break-words">{lead.company}</span>
                              {lead.leadType && <span className="px-2 py-0.5 bg-[var(--crm-bg)]/40 text-[var(--crm-text-muted)] rounded text-[9px] font-black uppercase tracking-widest shrink-0">{lead.leadType}</span>}
                            </div>
                            {(lead.email || lead.phone) && (
                              <div className="mt-3 grid grid-cols-1 gap-2">
                                {lead.email && (
                                  <a
                                    href={`mailto:${lead.email}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="min-w-0 flex items-center gap-2 rounded-xl bg-[var(--crm-control-bg)] border border-[var(--crm-border)] px-3 py-2 text-[11px] font-bold text-[var(--crm-text-muted)] hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
                                  >
                                    <Mail size={13} className="shrink-0 text-indigo-400" />
                                    <span className="truncate">{lead.email}</span>
                                  </a>
                                )}
                                {lead.phone && (
                                  <a
                                    href={`tel:${lead.phone}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="min-w-0 flex items-center gap-2 rounded-xl bg-[var(--crm-control-bg)] border border-[var(--crm-border)] px-3 py-2 text-[11px] font-bold text-[var(--crm-text-muted)] hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                                  >
                                    <Phone size={13} className="shrink-0 text-emerald-400" />
                                    <span className="truncate">{lead.phone}</span>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="relative shrink-0 mt-1 max-w-[120px]">
                          <select
                            value={lead.health || 'WARM'}
                            onChange={(e) => handleHealthChange(lead.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className={`w-full text-[9px] font-black uppercase tracking-widest pl-2.5 pr-6 py-1.5 rounded-lg border appearance-none cursor-pointer outline-none text-ellipsis overflow-hidden whitespace-nowrap [&>option]:bg-[var(--crm-sidebar-bg)] ${(lead.health || 'WARM') === 'HOT' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : (lead.health || 'WARM') === 'COLD' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}
                          >
                            <option value="HOT">Hot 🔥</option>
                            <option value="WARM">Warm ☀️</option>
                            <option value="COLD">Cold ❄️</option>
                          </select>
                          <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-5 p-3 sm:p-4 bg-[var(--crm-bg)]/20 rounded-xl sm:rounded-2xl border border-[var(--crm-border)]">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-[var(--crm-text-muted)] tracking-widest mb-1.5">Score</div>
                          <div className="font-extrabold text-[var(--crm-text)]">{lead.score || 0}%</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-[var(--crm-text-muted)] tracking-widest mb-1.5">Status</div>
                          <div className="relative inline-block w-full max-w-[140px]">
                            <select
                              value={lead.phase || 'DISCOVERY'}
                              onChange={(e) => handlePhaseChange(lead.id, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className={`w-full text-[10px] font-black uppercase tracking-widest pl-2.5 pr-6 py-1.5 rounded-lg border appearance-none cursor-pointer outline-none text-ellipsis overflow-hidden whitespace-nowrap [&>option]:bg-[var(--crm-sidebar-bg)] ${getPhaseColor(lead.phase || 'DISCOVERY')}`}
                            >
                              {availablePhases.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                          </div>
                        </div>
                        {(role === 'admin' || role === 'management' || role === 'super_admin') && (
                          <div className="col-span-2 border-t border-[var(--crm-border)] pt-3 mt-1">
                            <div className="text-[10px] uppercase font-bold text-[var(--crm-text-muted)] tracking-widest mb-1.5 flex items-center justify-between">
                              <span>Assigned To</span>
                            </div>
                            <div className="relative inline-block w-full">
                              <select
                                value={lead.assignedTo || ''}
                                onChange={(e) => handleAssignChange(lead.id, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className={`w-full text-xs font-bold pl-2.5 pr-6 py-2 rounded-lg border appearance-none cursor-pointer outline-none text-ellipsis overflow-hidden whitespace-nowrap [&>option]:bg-[var(--crm-sidebar-bg)] bg-[var(--crm-border)] text-[var(--crm-text-muted)] border-[var(--crm-border)]`}
                              >
                                <option value="">Unassigned</option>
                                {teamMembers.map(m => <option key={m.id} value={m.uid}>{m.displayName}</option>)}
                              </select>
                              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-[var(--crm-text-muted)]" />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-2 pt-4 border-t border-[var(--crm-border)] gap-3">
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
                                {/* {lead.phone && (
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
                            )} */}
                                {/* <button onClick={() => onCopyLink(lead.id, lead.name)} disabled={isCreatingMeeting} className={`p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all disabled:opacity-50 border border-transparent ${shareUrls[lead.id] ? 'text-indigo-300 bg-indigo-500/20 hover:bg-indigo-500/30' : 'text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] hover:bg-[var(--crm-bg)]/40'}`} title="Copy Link">
                              {isCreatingMeeting && !shareUrls[lead.id] ? <Loader2 size={16} className="animate-spin sm:w-[18px] sm:h-[18px]" /> : <Copy size={16} className="sm:w-[18px] sm:h-[18px]" />}
                            </button> */}
                                <button onClick={() => onShareLink(lead.id, lead.name)} disabled={isCreatingMeeting} className={`p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all disabled:opacity-50 border border-transparent ${shareUrls[lead.id] ? 'text-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30' : 'text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] hover:bg-[var(--crm-bg)]/40'}`} title="Share Link">
                                  {isCreatingMeeting && !shareUrls[lead.id] ? <Loader2 size={16} className="animate-spin sm:w-[18px] sm:h-[18px]" /> : <Share2 size={16} className="sm:w-[18px] sm:h-[18px]" />}
                                </button>
                              </div>
                              <Link to={`/clients/${lead.id}/edit`} className="p-2 sm:p-3 text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] hover:bg-[var(--crm-bg)]/40 rounded-lg sm:rounded-xl transition-all border border-transparent">
                                <Edit2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                              </Link>
                              {(role === 'admin' || role === 'super_admin') && (
                                <button
                                  onClick={() => handleDeleteLead(lead.id)}
                                  className="p-2 sm:p-3 text-[var(--crm-text-muted)] hover:text-rose-400 hover:bg-rose-500/10 rounded-lg sm:rounded-xl transition-all border border-transparent"
                                  title="Delete Lead"
                                >
                                  <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                                </button>
                              )}
                            </>
                          )}
                          {isDemoMode && (
                            <div className="text-[10px] font-bold text-[var(--crm-text-muted)] uppercase tracking-widest px-3 py-1 bg-[var(--crm-border)] rounded-lg">Readonly</div>
                          )}
                        </div>
                        <Link to={`/analytics/${lead.id}`} className="text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] hover:bg-[var(--crm-bg)]/40 w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-transparent hover:border-[var(--crm-border)]">
                          <BarChart3 size={14} />
                        </Link>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))}
              {!loadingLeads && filteredLeads.length > 0 && (
                <InfiniteScrollLoader />
              )}
            </div>


            {/* Desktop View (Premium Table) */}
            <div className="hidden lg:block glass-card !bg-[var(--crm-card-bg)] !p-0 !rounded-[2.5rem] border border-[var(--crm-border)] shadow-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="border-b border-[var(--crm-border)] text-[10px] font-extrabold text-[var(--crm-text-muted)] uppercase tracking-widest bg-[var(--crm-bg)]/20">
                      <th className="py-6 px-6 relative w-12 text-center">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-[var(--crm-border)] bg-[var(--crm-control-bg)] text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-[var(--crm-bg)]/40"></div>
                      </th>
                      <th className="py-6 px-8 relative">Name <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-[var(--crm-bg)]/40"></div></th>
                      <th className="py-6 px-6 relative">Company <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-[var(--crm-bg)]/40"></div></th>
                      <th className="py-6 px-6 relative w-32">Status <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-[var(--crm-bg)]/40"></div></th>
                      <th className="py-6 px-6 relative w-32">Health <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-[var(--crm-bg)]/40"></div></th>
                      <th className="py-6 px-6 relative w-32">Assigned To <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-[var(--crm-bg)]/40"></div></th>
                      <th className="py-6 px-6 relative w-32">Lead Type <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-[var(--crm-bg)]/40"></div></th>
                      <th className="py-6 px-6 relative w-32">AI Score <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-[var(--crm-bg)]/40"></div></th>
                      <th className="py-6 px-8 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {loadingLeads ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i} className="border-b border-[var(--crm-border)]">
                          <td className="py-5 px-6 text-center"><div className="w-4 h-4 rounded bg-[var(--crm-bg)]/40 animate-pulse mx-auto"></div></td>
                          <td className="py-5 px-8">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-[1rem] bg-[var(--crm-bg)]/40 animate-pulse shrink-0"></div>
                              <div className="flex-1 space-y-2">
                                <div className="h-4 bg-[var(--crm-bg)]/40 rounded animate-pulse w-3/4"></div>
                                <div className="h-3 bg-[var(--crm-bg)]/40 rounded animate-pulse w-1/2"></div>
                              </div>
                            </div>
                          </td>
                          <td className="py-5 px-6">
                            <div className="space-y-2 w-full">
                              <div className="h-4 bg-[var(--crm-bg)]/40 rounded animate-pulse w-2/3"></div>
                              <div className="h-3 bg-[var(--crm-bg)]/40 rounded animate-pulse w-1/3"></div>
                            </div>
                          </td>
                          <td className="py-5 px-6"><div className="h-8 bg-[var(--crm-bg)]/40 rounded-lg animate-pulse w-24"></div></td>
                          <td className="py-5 px-6"><div className="h-8 bg-[var(--crm-bg)]/40 rounded-lg animate-pulse w-24"></div></td>
                          <td className="py-5 px-6"><div className="h-8 bg-[var(--crm-bg)]/40 rounded-lg animate-pulse w-24"></div></td>
                          <td className="py-5 px-6"><div className="h-6 bg-[var(--crm-bg)]/40 rounded-lg animate-pulse w-16"></div></td>
                          <td className="py-5 px-6"><div className="h-6 bg-[var(--crm-bg)]/40 rounded-full animate-pulse w-full"></div></td>
                          <td className="py-5 px-8"><div className="h-8 bg-[var(--crm-bg)]/40 rounded-xl animate-pulse w-full"></div></td>
                        </tr>
                      ))
                    ) : paginatedLeads.map((lead) => {
                      const leadRecs = recordings.filter(r => r.meetingId === lead.id || r.leadId === lead.id);
                      const isExp = expandedLeadId === lead.id;

                      return (
                        <React.Fragment key={lead.id}>
                          <tr className={`border-b border-[var(--crm-border)] hover:bg-[var(--crm-border)] transition-all duration-300 group ${isExp ? 'bg-[var(--crm-bg)]/20 shadow-inner' : ''}`}>
                            <td className="py-5 px-6 text-center">
                              <input
                                type="checkbox"
                                checked={selectedLeads.includes(lead.id)}
                                onChange={() => toggleSelect(lead.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 rounded border-[var(--crm-border)] bg-[var(--crm-bg)]/20 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-5 px-8 min-w-[250px] whitespace-normal">
                              <div className="flex items-center gap-4">
                                <div className="relative shrink-0">
                                  {lead.avatar ? (
                                    <img src={lead.avatar} className="w-12 h-12 rounded-[1rem] object-cover border-2 border-slate-900 shadow-sm group-hover:shadow-md transition-shadow" alt={lead.name} />
                                  ) : (
                                    <div className="w-12 h-12 rounded-[1rem] bg-[var(--crm-bg)]/40 flex items-center justify-center text-[var(--crm-text)] text-sm font-black border-2 border-slate-900 shadow-sm">
                                      {lead.name.split(' ').map(n => n[0]).join('')}
                                    </div>
                                  )}
                                  <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 bg-emerald-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-3">
                                    <div className="font-extrabold text-[var(--crm-text)] text-base break-words leading-tight">{lead.name}</div>
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
                                      {/* {lead.phone && (
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
                                      )} */}
                                      <button
                                        onClick={(e) => handleInterestToggle(e, lead.id, lead.isInterested !== false)}
                                        className={`p-2 rounded-xl transition-all hover:bg-[var(--crm-bg)]/40 active:scale-90 ${lead.isInterested === false ? 'text-rose-500 bg-rose-500/5' : 'text-cyan-500 bg-[var(--crm-card-bg)] border border-[var(--crm-border)] hover:border-[var(--crm-border)]'}`}
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
                                  <div className="text-[var(--crm-text-muted)] font-medium text-xs mt-1 break-all">{lead.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-5 px-6 min-w-[200px] whitespace-normal">
                              <div className="font-extrabold text-[var(--crm-text)] break-words leading-tight">{lead.company}</div>
                              <div className="text-[var(--crm-text-muted)] font-semibold text-xs mt-1 flex items-start gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[var(--crm-border)] mt-1 shrink-0" /><span className="break-words">{lead.location}</span></div>
                            </td>
                            <td className="py-5 px-6 whitespace-nowrap">
                              <div className="relative inline-block w-full max-w-[140px]">
                                <select
                                  value={lead.phase || 'DISCOVERY'}
                                  onChange={(e) => handlePhaseChange(lead.id, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className={`w-full text-[10px] font-black uppercase tracking-widest pl-2.5 pr-6 py-1.5 rounded-lg border appearance-none cursor-pointer outline-none text-ellipsis overflow-hidden whitespace-nowrap [&>option]:bg-[var(--crm-sidebar-bg)] ${getPhaseColor(lead.phase || 'DISCOVERY')}`}
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
                                  className={`w-full text-[10px] font-black uppercase tracking-widest pl-2.5 pr-6 py-1.5 rounded-lg border appearance-none cursor-pointer outline-none text-ellipsis overflow-hidden whitespace-nowrap [&>option]:bg-[var(--crm-sidebar-bg)] ${(lead.health || 'WARM') === 'HOT' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : (lead.health || 'WARM') === 'COLD' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}
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
                                    className={`w-full text-[10px] font-black uppercase tracking-widest pl-2.5 pr-6 py-1.5 rounded-lg border appearance-none cursor-pointer outline-none text-ellipsis overflow-hidden whitespace-nowrap [&>option]:bg-[var(--crm-sidebar-bg)] bg-[var(--crm-border)] border-[var(--crm-border)] hover:border-[var(--crm-text)]/20`}
                                  >
                                    <option value="">Unassigned</option>
                                    {teamMembers.map(m => <option key={m.id} value={m.uid}>{m.displayName}</option>)}
                                  </select>
                                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                                </div>
                              ) : (
                                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border tracking-widest bg-[var(--crm-border)] text-[var(--crm-text-muted)] border-transparent">
                                  {teamMembers.find(m => m.uid === lead.assignedTo)?.displayName || 'Unassigned'}
                                </span>
                              )}
                            </td>
                            <td className="py-5 px-6 whitespace-nowrap">
                              {lead.leadType ? <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border tracking-widest bg-[var(--crm-border)] text-[var(--crm-text-muted)] border-[var(--crm-border)]">{lead.leadType}</span> : <span className="text-[var(--crm-text-muted)] text-xs font-bold">-</span>}
                            </td>
                            <td className="py-5 px-6 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-2.5 bg-[var(--crm-bg)]/40 rounded-full overflow-hidden shadow-inner">
                                  <div className={`h-full rounded-full transition-all duration-1000 ${lead.score >= 70 ? 'bg-emerald-500' : lead.score >= 40 ? 'bg-amber-500' : 'bg-red-400'}`} style={{ width: `${lead.score || 0}%` }} />
                                </div>
                                <span className="font-black text-sm text-[var(--crm-text)]">{lead.score || 0}</span>
                              </div>
                            </td>
                            <td className="py-5 px-8 text-right">
                              <div className="flex items-center justify-end gap-2 flex-wrap">
                                {/* <button onClick={() => onCopyLink(lead.id, lead.name)} disabled={isCreatingMeeting} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-transparent disabled:opacity-50 ${shareUrls[lead.id] ? 'text-indigo-300 bg-indigo-500/20 hover:bg-indigo-500/30' : 'text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] hover:bg-[var(--crm-bg)]/40 hover:border-[var(--crm-border)]'}`} title="Copy Link">
                                  {isCreatingMeeting && !shareUrls[lead.id] ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
                                </button> */}
                                <button onClick={() => onShareLink(lead.id, lead.name)} disabled={isCreatingMeeting} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-transparent disabled:opacity-50 ${shareUrls[lead.id] ? 'text-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30' : 'text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] hover:bg-[var(--crm-bg)]/40 hover:border-[var(--crm-border)]'}`} title="Share Link">
                                  {isCreatingMeeting && !shareUrls[lead.id] ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
                                </button>

                                <Link to={`/analytics/${lead.id}`} className="text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] hover:bg-[var(--crm-bg)]/40 w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-transparent hover:border-[var(--crm-border)]">
                                  <BarChart3 size={14} />
                                </Link>
                                <Link to={`/clients/${lead.id}/edit`} className="text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] hover:bg-[var(--crm-bg)]/40 w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-transparent hover:border-[var(--crm-border)]">
                                  <Edit2 size={16} />
                                </Link>
                                {(role === 'admin' || role === 'super_admin') && (
                                  <button
                                    onClick={() => handleDeleteLead(lead.id)}
                                    className="w-9 h-9 flex items-center justify-center text-[var(--crm-text-muted)] hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all border border-transparent hover:border-rose-500/20"
                                    title="Delete Lead"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}

                                {isTranscribing && recordingId === null ? (
                                  <div className="w-9 h-9 flex items-center justify-center bg-[var(--crm-bg)]/20 rounded-xl"><Loader2 size={16} className="animate-spin text-indigo-400" /></div>
                                ) : recordingId === lead.id ? (
                                  <div className="flex items-center gap-1 bg-[var(--crm-bg)]/20 p-1 rounded-xl border border-[var(--crm-border)]">
                                    <div className={`px-2 py-1 font-mono text-[10px] font-bold ${isPaused ? 'text-amber-400' : 'text-[var(--crm-text)]'}`}>
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
                                  <button onClick={() => startRecording(lead.id)} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-transparent ${recordingId ? 'opacity-30' : 'text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] hover:bg-[var(--crm-bg)]/40 hover:border-[var(--crm-border)]'}`} disabled={!!recordingId} title="Record Call">
                                    <Mic size={16} />
                                  </button>
                                )}

                                <button onClick={() => setExpandedLeadId(isExp ? null : lead.id)} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all border ${isExp ? 'bg-slate-50 text-indigo-600 border-slate-200' : 'text-[var(--crm-text-muted)] hover:bg-slate-100 hover:text-slate-700 border-transparent'}`}>
                                  <ChevronDown size={18} className={`transition-transform duration-300 ${isExp ? 'rotate-180 text-[var(--crm-text)]' : ''}`} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expandable Row */}
                          <AnimatePresence>
                            {isExp && (
                              <motion.tr initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-[var(--crm-bg)]/20 border-b border-[var(--crm-border)]">
                                <td colSpan={9} className="p-0">
                                  <div className="p-8 px-12">
                                    {customFieldDefs.length > 0 && (
                                      <div className="mb-8 pb-8 border-b border-[var(--crm-border)] border-dashed">
                                        <h4 className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest mb-4">Custom Data</h4>
                                        <div className="flex flex-wrap gap-4">
                                          {customFieldDefs.map(field => (
                                            <div key={field.id} className="bg-[var(--crm-border)] px-5 py-3 rounded-2xl border border-[var(--crm-border)] shadow-sm flex flex-col min-w-[120px]">
                                              <span className="text-[9px] font-bold text-[var(--crm-text-muted)] uppercase tracking-widest mb-1">{field.name}</span>
                                              <span className="text-sm font-bold text-[var(--crm-text)]">{lead[field.name] || '-'}</span>
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
                                          <div className="flex items-center gap-2 w-72 bg-[var(--crm-control-bg)] rounded-xl shadow-inner border border-[var(--crm-border)] p-1">
                                            <input readOnly value={shareUrls[lead.id]} className="flex-1 bg-transparent px-3 py-1.5 text-xs font-mono text-[var(--crm-text-muted)] outline-none text-ellipsis" />
                                            {/* <button onClick={() => onCopyLink(lead.id, lead.name)} className="p-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg transition-colors font-bold shadow-sm" title="Copy Link">
                                              <Copy size={16} />
                                            </button> */}
                                            <button onClick={() => onShareLink(lead.id, lead.name)} className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors font-bold shadow-sm" title="Share Link">
                                              <Share2 size={16} />
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            {/* <button onClick={() => onCopyLink(lead.id, lead.name)} disabled={isCreatingMeeting} className="flex justify-center items-center gap-2 text-indigo-300 bg-indigo-500/20 hover:bg-indigo-500/30 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95">
                                              {isCreatingMeeting && !shareUrls[lead.id] ? <Loader2 className="animate-spin" size={14} /> : <Copy size={14} />} Copy Link
                                            </button> */}
                                            <button onClick={() => onShareLink(lead.id, lead.name)} disabled={isCreatingMeeting} className="flex justify-center items-center gap-2 text-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95">
                                              {isCreatingMeeting && !shareUrls[lead.id] ? <Loader2 className="animate-spin" size={14} /> : <Share2 size={14} />} Share Link
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {leadRecs.length === 0 ? (
                                      <div className="text-sm text-[var(--crm-text-muted)] font-medium bg-[var(--crm-control-bg)] border-2 border-[var(--crm-border)] border-dashed rounded-[2rem] p-12 text-center flex flex-col items-center">
                                        <div className="w-16 h-16 bg-[var(--crm-border)] border border-[var(--crm-border)] rounded-2xl flex items-center justify-center mb-4 shadow-sm"><Play className="text-[var(--crm-text-muted)]" size={24} /></div>
                                        <p>No recordings yet. Click the microphone to start a new one.</p>
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {leadRecs.map(rec => (
                                          <div key={rec.id} className="bg-[var(--crm-border)] rounded-[1.5rem] border border-[var(--crm-border)] p-6 shadow-sm hover:shadow-md hover:border-indigo-500/30 hover:bg-[var(--crm-bg)]/40 transition-all flex items-start gap-4 group cursor-pointer" onClick={() => window.location.href = `/r/${rec.id}`}>
                                            <div className="w-12 h-12 rounded-xl bg-[var(--crm-control-bg)] border border-[var(--crm-border)] flex items-center justify-center shrink-0 group-hover:bg-indigo-500/20 transition-colors">
                                              <Play className="text-[var(--crm-text-muted)] group-hover:text-indigo-300 group-hover:fill-indigo-300 ml-1 transition-colors" size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="text-[10px] text-[var(--crm-text-muted)] group-hover:text-indigo-400 font-bold uppercase tracking-widest mb-1.5 transition-colors">
                                                {rec.createdAt?.toDate ? rec.createdAt.toDate().toLocaleString(undefined, { dateStyle: 'medium' }) : 'Unknown Date'}
                                              </div>
                                              <div className="text-sm font-medium text-[var(--crm-text-muted)] italic line-clamp-2 leading-relaxed">"{rec.transcript}"</div>
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
              <div className="border-t border-[var(--crm-border)] bg-[var(--crm-control-bg)]">
                <InfiniteScrollLoader />
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
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[var(--crm-overlay-bg)] backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-[var(--crm-sidebar-bg)] rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-[var(--crm-border)] text-center"
            >
              <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <ShieldAlert className="text-amber-500" size={32} />
              </div>
              <h2 className="text-xl font-black text-[var(--crm-text)] mb-2">Still there?</h2>
              <p className="text-[var(--crm-text-muted)] text-sm mb-1 font-medium">
                Recording for <span className="text-[var(--crm-text)] font-bold">{Math.floor(recordingSeconds / 60)} minutes</span>.
              </p>
              <p className="text-amber-400 text-xs font-black uppercase tracking-widest mb-8">
                Auto-submit in {autoSubmitCountdown}s...
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => { setShowSafetyAlert(false); setAutoSubmitCountdown(AUTO_SUBMIT_WINDOW); }}
                  className="w-full py-4 bg-indigo-600 text-[var(--crm-text)] rounded-2xl font-bold hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                >
                  Continue
                </button>
                <button
                  onClick={stopRecording}
                  className="w-full py-4 bg-[var(--crm-control-bg)] text-[var(--crm-text)] rounded-2xl font-bold hover:bg-[var(--crm-control-hover-bg)] transition-all"
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
              className="absolute inset-0 bg-[var(--crm-overlay-bg)] backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-xl h-full bg-[var(--crm-sidebar-bg)] border-l border-[var(--crm-border)] shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-[var(--crm-border)] bg-[var(--crm-control-bg)] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl border border-[var(--crm-border)] overflow-hidden shadow-lg bg-[var(--crm-border)]">
                    <img src={selectedLeadForHistory.avatar || `https://ui-avatars.com/api/?name=${selectedLeadForHistory.name}&background=random`} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[var(--crm-text)] leading-tight uppercase tracking-tight">{selectedLeadForHistory.name}</h3>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{selectedLeadForHistory.company}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLeadForHistory(null)}
                  className="p-2.5 rounded-xl bg-[var(--crm-border)] text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] border border-[var(--crm-border)] transition-all active:scale-95"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 scrollbar-hide space-y-8">
                {/* Manual Note Entry */}
                <div className="glass-card !bg-[var(--crm-border)] !rounded-3xl p-5 border-[var(--crm-border)] shadow-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                      <MessageSquare size={16} />
                    </div>
                    <span className="text-[10px] font-black text-[var(--crm-text)] uppercase tracking-widest">Append Intelligence</span>
                  </div>
                  <div className="relative">
                    <textarea
                      value={newActivityNote}
                      onChange={(e) => setNewActivityNote(e.target.value)}
                      placeholder="Enter a manual note or update..."
                      className="w-full bg-[var(--crm-input-bg)] border border-[var(--crm-border)] rounded-2xl p-4 text-xs font-medium text-[var(--crm-text)] placeholder:text-[var(--crm-text-muted)] focus:outline-none focus:border-indigo-500 min-h-[100px] resize-none transition-all shadow-inner"
                    />
                    <button
                      disabled={!newActivityNote.trim() || submittingNote}
                      onClick={handleAddActivityNote}
                      className="absolute bottom-4 right-4 p-2.5 bg-indigo-500 text-[var(--crm-text)] rounded-xl shadow-lg shadow-indigo-500/40 hover:bg-indigo-400 transition-all active:scale-90 disabled:opacity-50 disabled:grayscale"
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
                    <span className="text-[10px] font-black text-[var(--crm-text)] uppercase tracking-widest">Activity Stream</span>
                  </div>

                  {activityLogs.length === 0 ? (
                    <div className="py-20 text-center space-y-4 opacity-40">
                      <div className="w-12 h-12 bg-[var(--crm-border)] rounded-2xl border border-[var(--crm-border)] mx-auto flex items-center justify-center">
                        <History size={24} className="text-[var(--crm-text-muted)]" />
                      </div>
                      <p className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest italic">No interactions detected.</p>
                    </div>
                  ) : (
                    <div className="space-y-6 relative pl-4">
                      {/* Vertical center line */}
                      <div className="absolute left-7 top-4 bottom-4 w-[1px] bg-[var(--crm-border)]" />

                      {activityLogs.map((log, idx) => (
                        <motion.div
                          key={log.id}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="relative pl-10"
                        >
                          {/* Marker */}
                          <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border z-10 shadow-lg ${log.type === 'MANUAL_NOTE' ? 'bg-indigo-500 border-indigo-400 text-[var(--crm-text)]' :
                            log.type === 'INTEREST_CHANGE' ? 'bg-cyan-500 border-cyan-400 text-[var(--crm-text)]' :
                              'bg-slate-800 border-slate-700 text-[var(--crm-text-muted)]'
                            }`}>
                            {log.type === 'MANUAL_NOTE' ? <MessageSquare size={10} /> :
                              log.type === 'INTEREST_CHANGE' ? <ThumbsUp size={10} /> :
                                <Edit2 size={10} />}
                          </div>

                          <div className="bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] rounded-2xl p-4 space-y-3 hover:bg-white/[0.05] transition-all group">
                            <div className="flex justify-between items-start gap-3">
                              <div className="space-y-0.5">
                                <div className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">{log.action}</div>
                                <div className="text-[10px] font-black text-[var(--crm-text)]">{log.authorName}</div>
                              </div>
                              <div className="text-[8px] font-black text-[var(--crm-text-muted)] whitespace-nowrap bg-[var(--crm-control-bg)] px-2 py-1 rounded-md border border-[var(--crm-border)]">
                                {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                              </div>
                            </div>

                            {log.type === 'MANUAL_NOTE' ? (
                              <div className="text-[11px] text-[var(--crm-text-muted)] font-medium leading-relaxed bg-[var(--crm-control-bg)] p-3 rounded-xl border border-[var(--crm-border)] italic">
                                "{log.details?.note}"
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-[var(--crm-text-muted)]">
                                <span className="uppercase opacity-40">{log.details?.field}:</span>
                                <span className="line-through">{String(log.details?.oldValue)}</span>
                                <ArrowUpRight size={12} className="text-cyan-500" />
                                <span className="text-[var(--crm-text)] bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{String(log.details?.newValue)}</span>
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
              <div className="p-6 border-t border-[var(--crm-border)] bg-[var(--crm-control-bg)] flex items-center gap-4">
                <Link
                  to={`/clients/${selectedLeadForHistory.id}`}
                  className="flex-1 py-4 bg-white text-slate-950 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-indigo-500 hover:text-[var(--crm-text)] transition-all text-center shadow-xl shadow-white/5 active:scale-95"
                >
                  Full Intelligence View
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageLayout>
  );
}
