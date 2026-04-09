import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { Mic, Square, Play, Pause, Share2, Loader2, CheckCircle2, AlertCircle, LogIn, LogOut, History, Copy, ExternalLink, FileText, Languages, Users, Link as LinkIcon, MessageSquare, Building2, BarChart3, Search, Filter, ArrowUpRight, ShieldCheck, Globe, Activity, Mail, Calendar, MoreVertical, Trash2, ArrowLeft, Clock, Sparkles, ArrowUp, Bell, Menu, RotateCcw, Download, Share2 as ShareIcon, LayoutDashboard, ScanQrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import { uploadFileToGemini } from './utils/gemini';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  Timestamp
} from 'firebase/firestore';
import {
  ref,
  getBytes,
  uploadBytes,
  getDownloadURL
} from 'firebase/storage';
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User
} from 'firebase/auth';
import { db, auth, storage } from './firebase';
import Leads from './Leads';
import Sidebar from './Sidebar';
import LeadForm from './LeadForm';
import Dashboard from './Dashboard';
import CustomFields from './CustomFields';
import Reports from './Reports';
import GuestRecord from './GuestRecord';
import Analytics from './Analytics';
import ManualUpload from './ManualUpload';
import LeadInsights from './LeadInsights';
import LeadCapture from './LeadCapture';
import CalendarPage from './Calendar';
import ImportModal from './ImportModal';
import Login from './Login';
import RegisterCompany from './RegisterCompany';
import Team from './Team';
import Onboarding from './Onboarding';
import Profile from './Profile';
import SuperAdmin from './SuperAdmin';
import SuperLogin from './SuperLogin';
import Settings from './Settings';
import TranscriptPlayer from './TranscriptPlayer';
import DownloadApp from './DownloadApp';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DemoProvider, useDemo } from './DemoContext';


// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  collectionName?: string;
}

const NotificationBell = () => {
  const { companyId } = useAuth();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(
    typeof Notification !== 'undefined' ? Notification.permission === 'granted' : true
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!companyId) return;
    const q = query(collection(db, 'meetings'), where('companyId', '==', companyId));
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const now = new Date();
      const upcoming = data.filter((m: any) => m.scheduledAt?.toDate?.() > now)
        .sort((a: any, b: any) => a.scheduledAt.toMillis() - b.scheduledAt.toMillis());
      setMeetings(upcoming);
    });
    return unsub;
  }, [companyId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRequestPush = () => {
    if (typeof Notification !== 'undefined') {
      Notification.requestPermission().then(permission => {
        setPushEnabled(permission === 'granted');
      });
    }
  };

  const hasNotifications = meetings.length > 0 || !pushEnabled;

  return (
    <div className="relative" ref={dropdownRef}>

      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`relative p-2.5 rounded-xl transition-all active:scale-95 ${showDropdown ? 'bg-indigo-900 text-indigo-400' : 'text-slate-300 hover:bg-slate-800'}`}
      >
        <Bell size={20} />
        {hasNotifications && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white shadow-sm ring-2 ring-rose-500/20 animate-pulse"></span>
        )}
      </button>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute right-0 mt-4 w-80 bg-slate-900 rounded-2xl !p-0 border border-slate-800 shadow-2xl shadow-black/50 z-[100] overflow-hidden"
          >
            <div className="p-5 border-b border-slate-800 bg-slate-800 flex justify-between items-center">
              <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Notifications</h3>
              <span className="px-2 py-0.5 rounded-lg bg-indigo-900 text-indigo-300 text-[8px] font-black uppercase tracking-widest">{meetings.length} Upcoming</span>
            </div>

            <div className="max-h-[400px] overflow-y-auto scrollbar-hide py-2">
              {!pushEnabled && (
                <div className="p-4 mx-2 mb-2 rounded-2xl bg-rose-950 border border-rose-900 hover:bg-rose-900 transition-all cursor-pointer group" onClick={handleRequestPush}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-rose-900 text-rose-400 shadow-sm"><Bell size={14} /></div>
                    <div className="flex-1">
                      <div className="font-black text-white text-[11px] uppercase tracking-wider mb-0.5">Enable Notifications</div>
                      <div className="text-[10px] text-slate-300 font-bold uppercase tracking-tight opacity-70">Get alerted for upcoming meetings</div>
                    </div>
                  </div>
                </div>
              )}

              {meetings.length > 0 ? meetings.map((m, idx) => (
                <div key={m.id} className="px-4 py-4 hover:bg-slate-800 transition-all cursor-pointer border-b border-slate-800 last:border-0 group">
                  <div className="font-bold text-white text-sm mb-1 group-hover:text-indigo-400 transition-colors">{m.title}</div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-wider">
                    <Clock size={10} className="text-indigo-500/50" />
                    {m.scheduledAt?.toDate?.().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', hour12: false })}
                  </div>
                  {m.leadName && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-900 text-indigo-300 text-[9px] font-black uppercase tracking-widest">
                      <Users size={10} /> {m.leadName}
                    </div>
                  )}
                </div>
              )) : (
                <div className="p-12 text-center space-y-4">
                  <div className="p-4 bg-slate-800 rounded-full w-fit mx-auto text-slate-400">
                    <History size={32} />
                  </div>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] italic">No notifications yet.</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-800 text-center">
              <Link to="/calendar" className="text-[9px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-all">View Calendar &rarr;</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Navbar = ({ user, onMenuClick, onInstall, showInstallButton }: { user: User, onMenuClick: () => void, onInstall: () => void, showInstallButton: boolean }) => {
  const { companyName, companyId } = useAuth();
  const [showQrModal, setShowQrModal] = useState(false);
  const [success, setSuccess] = useState('');

  return (
    <>
      <nav className="glass-nav z-[90] px-4 sm:px-12 py-3.5 sm:py-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3 sm:gap-6">
          <button onClick={onMenuClick} className="lg:hidden p-2.5 text-slate-400 hover:bg-white/10 rounded-xl transition-all shadow-sm active:scale-95 border border-white/10">
            <Menu size={20} />
          </button>

        </div>

        <div className="flex items-center gap-3 sm:gap-6">
          {showInstallButton && (
            <button
              onClick={onInstall}
              className="hidden lg:flex items-center gap-2.5 px-5 py-2.5 bg-white/5 border border-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-indigo-400 hover:text-indigo-400 transition-all shadow-xl shadow-black/20 active:scale-95"
            >
              <Download size={14} /> Install
            </button>
          )}
          <button
            onClick={() => setShowQrModal(true)}
            title="Lead Capture QR"
            className="relative p-2.5 rounded-xl transition-all active:scale-95 text-slate-300 hover:bg-slate-800"
          >
            <ScanQrCode size={20} />
          </button>
          <NotificationBell />
          <div className="h-8 w-[1px] bg-white/10 mx-1 hidden md:block"></div>
          <div className="hidden md:flex flex-col items-end">
            <span className="text-xs font-black text-white leading-none mb-1 uppercase tracking-widest">{user.displayName || 'Entity'}</span>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{user.email?.split('@')[0]}</span>
          </div>
          <Link to="/profile" className="relative group p-1 bg-white/5 border border-white/10 rounded-xl sm:rounded-[1.25rem] shadow-xl shadow-black/20 hover:border-indigo-400 transition-all">
            <img
              src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=6366f1&color=fff`}
              alt="Profile"
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-[1rem] object-cover border border-white group-hover:scale-105 transition-all group-active:scale-95"
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-[3px] border-white shadow-sm ring-1 ring-emerald-500/20"></div>
          </Link>
        </div>
      </nav>

      <AnimatePresence>
        {showQrModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" onClick={() => setShowQrModal(false)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-[#0f111a]/80 backdrop-blur-xl rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-white/10 text-center relative overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-orange-500"></div>
              <div className="flex items-center justify-center gap-2 mb-6">
                <div className="w-8 h-8 bg-indigo-500/20 border border-indigo-500/30 rounded-xl flex items-center justify-center shadow-lg"><Sparkles size={16} className="text-indigo-400" /></div>
                <span className="text-lg font-black tracking-tight text-white">Handysolver<span className="text-indigo-400">.AI</span></span>
              </div>
              <h2 className="text-2xl font-black mb-2 text-white tracking-tight">Lead Capture QR</h2>
              <p className="text-sm text-slate-400 mb-6 font-medium">Prospects can scan this to automatically join your pipeline.</p>
              <div className="bg-white p-4 rounded-[2rem] border border-white/10 inline-block mb-6 shadow-inner">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${window.location.origin}/capture/${companyId}`)}`} alt="QR Code" className="w-48 h-48 rounded-xl mix-blend-multiply" />
              </div>
              <button onClick={() => {
                const url = `${window.location.origin}/capture/${companyId}`;
                if (navigator.clipboard && window.isSecureContext) {
                  navigator.clipboard.writeText(url);
                } else {
                  const textArea = document.createElement("textarea");
                  textArea.value = url;
                  textArea.style.position = "fixed";
                  textArea.style.left = "-999999px";
                  textArea.style.top = "-999999px";
                  document.body.appendChild(textArea);
                  textArea.focus();
                  textArea.select();
                  try { document.execCommand('copy'); } catch (err) { }
                  textArea.remove();
                }
                setSuccess("Capture link copied!");
                setTimeout(() => setSuccess(''), 3000);
              }} className="w-full py-3.5 bg-white/5 border border-white/10 text-indigo-300 font-black text-xs uppercase tracking-widest rounded-xl mb-3 hover:bg-white/10 hover:border-white/20 transition-all active:scale-95 shadow-sm flex items-center justify-center gap-2">
                {success ? <><CheckCircle2 size={16} /> Copied!</> : 'Copy Direct Link'}
              </button>
              <button onClick={() => setShowQrModal(false)} className="w-full py-3.5 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-indigo-500 transition-all shadow-md shadow-indigo-500/20 active:scale-95">Close Window</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const HistoryView = ({ user }: { user: User }) => {
  const [recordings, setRecordings] = useState<any[]>([]);
  const { companyId } = useAuth();

  useEffect(() => {
    if (!companyId) return;
    const q = query(
      collection(db, 'recordings'),
      where('companyId', '==', companyId)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      data.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setRecordings(data);
    });
    return unsub;
  }, [companyId]);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-black text-black tracking-tight mb-2">All Recordings</h1>
        <p className="text-slate-500 font-medium">A list of all recordings and notes.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recordings.map((rec) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={rec.id}
            className="bg-orange-50 p-6 rounded-[2rem] border border-orange-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center font-bold shadow-inner">
                <History size={24} />
              </div>
              <div>
                <h3 className="font-extrabold text-black">Recording</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{rec.id.slice(0, 8)}</p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                <Calendar size={14} className="text-orange-400" />
                {rec.createdAt?.toDate?.().toLocaleString() || 'Recent'}
              </div>
              <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed font-medium bg-orange-50 p-4 rounded-2xl border border-orange-100/50">
                {rec.transcript || 'No transcript version recorded.'}
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-orange-50">
              <div className="flex gap-2">
                <Link
                  to={`/r/${rec.id}`}
                  className="p-2.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all"
                >
                  <ExternalLink size={20} />
                </Link>
                <button
                  onClick={() => {
                    const url = `${window.location.hostname === 'localhost' ? 'https://handydashcrmai.vercel.app' : window.location.origin}/r/${rec.id}`;
                    if (navigator.clipboard && window.isSecureContext) {
                      navigator.clipboard.writeText(url);
                    } else {
                      const textArea = document.createElement("textarea");
                      textArea.value = url;
                      textArea.style.position = "fixed";
                      textArea.style.left = "-999999px";
                      textArea.style.top = "-999999px";
                      document.body.appendChild(textArea);
                      textArea.focus();
                      textArea.select();
                      try { document.execCommand('copy'); } catch (err) { }
                      textArea.remove();
                    }
                  }}
                  className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                >
                  <Copy size={20} />
                </button>
              </div>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">AudioCRM v2</span>
            </div>
          </motion.div>
        ))}
      </div>

      {recordings.length === 0 && (
        <div className="text-center py-20 bg-orange-50 rounded-[3rem] border-2 border-dashed border-orange-100">
          <History size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No recordings found</p>
        </div>
      )}
    </div>
  );
};








const RecordingView = () => {
  const { id } = useParams();
  const [recording, setRecording] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const getStoragePathFromUrl = (audioUrl: string): string | null => {
    if (!audioUrl) return null;
    if (!audioUrl.startsWith('http://') && !audioUrl.startsWith('https://') && !audioUrl.startsWith('gs://')) {
      return audioUrl;
    }
    try {
      if (audioUrl.startsWith('gs://')) {
        const withoutPrefix = audioUrl.replace(/^gs:\/\//, '');
        const slash = withoutPrefix.indexOf('/');
        return slash >= 0 ? withoutPrefix.substring(slash + 1) : null;
      }
      const parsed = new URL(audioUrl);
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      const oIndex = pathParts.indexOf('o');
      if (oIndex >= 0 && pathParts.length > oIndex + 1) {
        return decodeURIComponent(pathParts[oIndex + 1]);
      }
      return null;
    } catch (urlErr) {
      console.warn('Invalid audio URL:', urlErr);
      return null;
    }
  };

  const handleSync = async () => {
    if (!recording || !recording.audioUrl || isSyncing || !id) return;
    setIsSyncing(true);
    try {
      const apiKey = [
        (process.env as any).GEMINI_API_KEY,
        (import.meta as any).env.VITE_GEMINI_API_KEY,
        (import.meta as any).env.GEMINI_API_KEY
      ].find(k => k && k !== 'undefined' && k !== 'null') || '';
      if (!apiKey) throw new Error("Gemini API Key is missing (VITE_GEMINI_API_KEY).");
      let audioBlob: Blob | null = null;
      try {
        const storagePath = getStoragePathFromUrl(recording.audioUrl);
        if (storagePath) {
          const storageRef = ref(storage, storagePath);
          const buffer = await getBytes(storageRef);
          audioBlob = new Blob([buffer], { type: 'audio/webm' });
        }
      } catch (readErr) { console.warn("Firebase Storage failed, trying direct fetch."); }
      if (!audioBlob) {
        try {
          const response = await fetch(recording.audioUrl);
          if (!response.ok) throw new Error(`Direct fetch failed (${response.status})`);
          audioBlob = await response.blob();
        } catch (directErr) {
          const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(recording.audioUrl)}`;
          const response = await fetch(proxyUrl);
          if (!response.ok) throw new Error(`Proxy fetch failed (${response.status})`);
          audioBlob = await response.blob();
        }
      }
      if (!audioBlob) throw new Error("Unable to retrieve audio stream.");
      const fileUri = await uploadFileToGemini(audioBlob, apiKey);
      const ai = new GoogleGenAI({ apiKey });
      const validModels = ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.0-flash'];
      let success = false;
      let finalTranscriptData = null;
      for (const modelName of validModels) {
        try {
          const prompt = "Transcribe this audio recording into English with timestamps. Return a JSON object with a 'fullText' string and a 'segments' array ({text: string, startTime: float, endTime: float}). Provide ONLY the raw JSON.";
          const response = await ai.models.generateContent({
            model: modelName,
            config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
            contents: [{ role: 'user', parts: [{ text: prompt }, { fileData: { mimeType: audioBlob.type || "audio/webm", fileUri } }] }]
          });
          const rawText = response.text || "{}";
          const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          finalTranscriptData = JSON.parse(jsonStr);
          success = true;
          break;
        } catch (err: any) {
          if (err?.status === 429) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            continue;
          }
          console.warn(`Model ${modelName} failed:`, err);
        }
      }
      if (!success) throw new Error("Intelligence services temporarily unavailable or quota exceeded.");

      let aiInsights = null;
      for (const modelName of validModels) {
        try {
          const prompt2 = `Analyze this meeting transcript and extract actionable intelligence. Respond ONLY in strict JSON format.\nTranscript: "${finalTranscriptData?.fullText || ''}"\nRequired JSON Structure:\n{\n"overview": "Concise executive summary of the meeting.",\n"meetingMinutes": ["Key discussion point...", "Decision made..."],\n"tasks": [\n{ "title": "...", "assignee": "Owner", "dueDate": "TBD", "completed": false }\n]\n}`;
          const res2 = await ai.models.generateContent({
            model: modelName,
            config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
            contents: [{ role: 'user', parts: [{ text: prompt2 }] }]
          });
          const rawText2 = res2.text || "{}";
          const jsonStr2 = rawText2.replace(/```json/g, '').replace(/```/g, '').trim();
          aiInsights = JSON.parse(jsonStr2);
          break;
        } catch (e: any) {
          if (e?.status === 429) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            continue;
          }
          console.warn(`Analytics failed on ${modelName}`, e);
        }
      }
      await updateDoc(doc(db, 'recordings', id), {
        transcript: String(finalTranscriptData.fullText || recording.transcript || ''),
        transcriptData: finalTranscriptData.segments || [],
        ...(aiInsights ? { aiInsights } : {}),
        updatedAt: Timestamp.now()
      });
      setRecording((prev: any) => ({ ...prev, transcript: finalTranscriptData.fullText, transcriptData: finalTranscriptData.segments, ...(aiInsights ? { aiInsights } : {}) }));
    } catch (err: any) { alert(err.message || "Protocol transmission failed."); } finally { setIsSyncing(false); }
  };

  useEffect(() => {
    const fetchRec = async () => {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, 'recordings', id));
        if (snap.exists()) setRecording(snap.data());
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchRec();
  }, [id]);

  const handleShareWhatsApp = () => {
    if (!recording) return;

    let text = `🚀 *Meeting Intelligence Report* 🚀\n\n`;
    
    const insights = recording.aiInsights;
    if (insights) {
      if (insights.overview) {
        text += `📝 *Executive Summary:*\n${insights.overview}\n\n`;
      }
      
      if (insights.meetingMinutes && insights.meetingMinutes.length > 0) {
        text += `💡 *Key Discussion Points:*\n`;
        insights.meetingMinutes.forEach((p: string) => text += `• ${p}\n`);
        text += `\n`;
      }
      
      if (insights.tasks && insights.tasks.length > 0) {
        text += `✅ *Action Items:*\n`;
        insights.tasks.forEach((t: any) => text += `• [${t.completed ? 'DONE' : 'OPEN'}] ${t.title} (${t.assignee || 'Unassigned'})\n`);
        text += `\n`;
      }
    } else {
      text += `📄 *Transcript Snippet:*\n${recording.transcript?.substring(0, 500)}...\n\n`;
    }

    text += `🔗 *Full Protocol & Audio:* ${window.location.origin}/r/${recording.id}\n\n`;
    text += `--- \n`;
    text += `Sent via *handycrm.ai* | Next-Gen Sales Intelligence`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }; if (loading) return (
    <div className="flex-1 bg-[#030014] min-h-screen flex items-center justify-center">
      <div className="relative">
        <Loader2 className="animate-spin text-indigo-500 w-16 h-16" />
        <div className="absolute inset-0 bg-indigo-500/20 blur-3xl animate-pulse"></div>
      </div>
    </div>
  );

  if (!recording) return (
    <div className="flex-1 bg-[#030014] min-h-screen flex items-center justify-center">
      <div className="text-slate-500 font-black uppercase tracking-[0.4em] text-xs flex items-center gap-4">
        <Sparkles size={20} className="text-slate-700" /> Logic Vector Depleted
      </div>
    </div>
  );

  return (
    <div className="flex-1 bg-[#030014] min-h-screen overflow-y-auto selection:bg-indigo-500 selection:text-white font-sans">
      <div className="absolute top-0 right-0 w-[60rem] h-[60rem] bg-indigo-600/5 rounded-full blur-[160px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

      <div className="max-w-5xl mx-auto p-4 sm:p-12 lg:p-20 space-y-20 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card !bg-white/[0.02] !backdrop-blur-3xl !border-white/5 !p-12 sm:!p-20 !rounded-[4rem] relative overflow-hidden shadow-3xl"
        >
          {/* Top Decorative bar */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>

          <header className="mb-20 pb-12 border-b border-white/5 flex flex-col xl:flex-row justify-between items-start gap-12">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] shadow-lg">
                <Sparkles size={14} className="animate-pulse" /> Intelligence Hub
              </div>
              <h1 className="text-5xl sm:text-7xl font-black text-white tracking-tightest leading-[0.9] uppercase">
                Interaction <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Metadata</span>
              </h1>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-slate-500 font-black uppercase tracking-widest text-[10px]">
                  <Calendar size={14} className="text-indigo-500/50" />
                  {recording.createdAt?.toDate?.().toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short', hour12: false }) || 'RECENT'}
                </div>
                <div className="h-4 w-px bg-white/10"></div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Activity size={14} className="text-cyan-500/50" /> Sync Active
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full xl:w-auto">
              <button
                onClick={handleShareWhatsApp}
                className="px-8 py-5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-2xl shadow-emerald-500/10 active:scale-95 flex items-center justify-center gap-3 group"
              >
                <div className="p-1.5 bg-white/20 rounded-lg group-hover:rotate-12 transition-transform"><MessageSquare size={16} /></div>
                WhatsApp
              </button>
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="px-8 py-5 bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-indigo-400 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {isSyncing ? <Loader2 size={16} className="animate-spin text-cyan-400" /> : <RotateCcw size={16} className="text-indigo-400" />}
                {isSyncing ? 'Synchronizing' : 'Recalibrate Logic'}
              </button>
              <button
                onClick={() => window.print()}
                className="col-span-1 sm:col-span-2 px-8 py-5 bg-white text-black rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-cyan-400 transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-3"
              >
                <Download size={16} /> Export Core Signal
              </button>
            </div>
          </header>

          <section className="space-y-20">
            {/* Transcript Area */}
            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center border border-indigo-500/20 shadow-2xl"><Languages size={24} /></div>
                <div>
                  <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Dialect Decomposition</h2>
                  <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mt-1">Multi-vector neural transcript</p>
                </div>
              </div>
              <div className="bg-black/40 p-1 bg-gradient-to-b from-white/5 to-transparent rounded-[3.5rem] border border-white/5 shadow-inner">
                <div className="bg-transparent p-10 sm:p-14">
                  {recording.transcript ? (
                    <TranscriptPlayer
                      audioUrl={recording.audioUrl}
                      transcriptData={recording.transcriptData}
                      fallbackText={recording.transcript}
                    />
                  ) : (
                    <div className="text-center py-20">
                      <Loader2 className="animate-spin text-slate-800 mx-auto mb-6" size={40} />
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.5em] animate-pulse">Retrieving logic stream...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* AI Insights Area */}
            {recording.aiInsights ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="lg:col-span-2 bg-gradient-to-br from-indigo-500/10 to-transparent p-12 rounded-[3.5rem] border border-indigo-500/20 shadow-2xl relative overflow-hidden group/insight"
                >
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-400/5 rounded-full blur-[40px] group-hover/insight:scale-150 transition-transform duration-1000"></div>
                  <div className="flex items-center gap-3 mb-8">
                    <Sparkles size={18} className="text-indigo-400" />
                    <h4 className="font-black text-white uppercase tracking-[0.4em] text-[11px]">Executive Matrix Summary</h4>
                  </div>
                  <p className="text-slate-300 text-xl leading-[1.8] font-medium tracking-tight italic">
                    <span className="text-4xl text-indigo-500/30">"</span>
                    {recording.aiInsights.overview}
                    <span className="text-4xl text-indigo-500/30">"</span>
                  </p>
                </motion.div>

                <div className="bg-white/[0.02] p-10 rounded-[3rem] border border-white/5 shadow-2xl space-y-8">
                  <h4 className="font-black text-slate-500 uppercase tracking-[0.3em] text-[10px] flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_#6366f1]"></div>
                    Meeting Minutes Protocol
                  </h4>
                  <ul className="space-y-6">
                    {(recording.aiInsights.meetingMinutes || []).map((pt: string, i: number) => (
                      <li key={i} className="flex items-start gap-5 text-base text-slate-400 font-medium group/item">
                        <div className="p-1 px-2.5 bg-white/5 rounded-lg text-[10px] font-black text-slate-600 uppercase tracking-tighter mt-1 group-hover/item:text-indigo-400 transition-colors">0{i + 1}</div>
                        <span className="group-hover/item:text-slate-200 transition-colors">{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white/[0.02] p-10 rounded-[3rem] border border-white/5 shadow-2xl space-y-8">
                  <h4 className="font-black text-slate-500 uppercase tracking-[0.3em] text-[10px] flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_10px_#06b6d4]"></div>
                    Action Item Vectors
                  </h4>
                  <ul className="space-y-6">
                    {(recording.aiInsights.tasks || []).map((t: any, i: number) => (
                      <li key={i} className="flex items-start gap-5 text-base text-slate-400 font-medium group/task">
                        <div className={`p-2 rounded-xl transition-all ${t.completed ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-white/5 text-slate-700 border border-white/5"}`}>
                          <CheckCircle2 size={18} />
                        </div>
                        <div className="space-y-1">
                          <span className={t.completed ? "line-through text-slate-600" : "group-hover/task:text-slate-200 transition-colors"}>{t.title}</span>
                          <div className="text-[9px] font-black uppercase text-indigo-400 tracking-[0.2em]">{t.assignee}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="p-16 bg-indigo-500/5 rounded-[4rem] border border-indigo-500/10 border-dashed relative group/ai overflow-hidden">
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-indigo-500/5 rounded-full blur-[60px] group-hover/ai:scale-110 transition-transform duration-1000"></div>
                <div className="flex flex-col md:flex-row items-center gap-10 relative z-10 text-center md:text-left">
                  <div className="p-8 bg-black/40 rounded-[2.5rem] text-indigo-400 shadow-3xl border border-white/5"><Sparkles size={48} className="animate-pulse" /></div>
                  <div className="space-y-4">
                    <h3 className="font-black text-white text-2xl uppercase tracking-[0.3em]">AI Synthesis Pending</h3>
                    <p className="text-[11px] font-black text-indigo-500/70 uppercase tracking-[0.4em] leading-relaxed max-w-lg">Initiate the 'Recalibrate Logic' protocol to synthesize interaction intelligence and behavioral metrics.</p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </motion.div>

        <footer className="text-center py-10 opacity-20 hover:opacity-100 transition-opacity duration-1000">
          <p className="text-[10px] font-black text-white uppercase tracking-[0.8em]">Handydash CRM AI &bull; Intelligence Framework v9.4</p>
        </footer>
      </div>
    </div>
  );
};



const GlobalRecorder = () => {
  const { user, companyId } = useAuth();
  const { isDemoMode } = useDemo();
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  const timerRef = useRef<any>(null);

  const startRecording = async () => {
    if (isDemoMode) return alert("Demo mode active");
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Browser audio API not available. If testing on a mobile phone via local network IP, you must use HTTPS (e.g., via ngrok or Vite basic-ssl).");
      }

      const streams: MediaStream[] = [];
      const isChromium = !!(window as any).chrome;
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile && !sessionStorage.getItem('mobile_audio_warned')) {
        alert("📱 Mobile Browser Limitation\n\nTo record the other person on a call, please put your phone on SPEAKERPHONE.\n\nMobile web browsers are blocked by Apple/Google from capturing internal system audio directly.");
        sessionStorage.setItem('mobile_audio_warned', 'true');
      }

      let sysStream: MediaStream | null = null;
      if (!isMobile) {
        try {
          if (navigator.mediaDevices.getDisplayMedia) {
            sysStream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: isChromium ? {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                systemAudio: 'include',
              } as any : true,
            });
          }
        } catch (e) {
          console.warn("System audio omitted or cancelled", e);
        }
      }

      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streams.push(micStream);
      let finalStream = micStream;

      if (sysStream && sysStream.getAudioTracks().length > 0) {
        streams.push(sysStream);
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;
        if (ctx.state === 'suspended') await ctx.resume();
        const dest = ctx.createMediaStreamDestination();
        ctx.createMediaStreamSource(micStream).connect(dest);

        const sysAudioStream = new MediaStream(sysStream.getAudioTracks());
        ctx.createMediaStreamSource(sysAudioStream).connect(dest);

        finalStream = dest.stream;
      } else if (sysStream) {
        alert("System Audio Missing: You didn't check the 'Also share tab audio' box. Only your microphone will be recorded.\n\nTip for YouTube/Music: Select 'Chrome Tab' in the popup and ensure 'Share tab audio' is toggled ON.");
        sysStream.getTracks().forEach(t => t.stop());
      }

      streamsRef.current = streams;

      let mimeType = 'audio/webm';
      const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mpeg'];
      for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }
      const recorder = new MediaRecorder(finalStream, { mimeType, audioBitsPerSecond: 64000 });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        streamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        await processAudio(blob);
      };

      recorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch (e: any) {
      console.error(e);
      alert(`Microphone access failed: ${e.message || "Denied or unavailable."}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    clearInterval(timerRef.current);
  };

  const pauseRecording = () => {
    mediaRecorderRef.current?.pause();
    setIsPaused(true);
    clearInterval(timerRef.current);
  };

  const resumeRecording = () => {
    mediaRecorderRef.current?.resume();
    setIsPaused(false);
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
  };

  const processAudio = async (blob: Blob) => {
    setIsProcessing(true);
    setStatusText('Uploading audio...');
    try {
      const recordId = uuidv4().slice(0, 8);
      const storageRef = ref(storage, `recordings/${recordId}/audio.webm`);
      await uploadBytes(storageRef, blob);
      const audioUrl = await getDownloadURL(storageRef);

      setStatusText('Transcribing & Analyzing...');
      const apiKey = [
        (process.env as any).GEMINI_API_KEY,
        (import.meta as any).env.VITE_GEMINI_API_KEY,
        (import.meta as any).env.GEMINI_API_KEY
      ].find(k => k && k !== 'undefined' && k !== 'null') || '';
      
      if (!apiKey) {
        console.error("CRITICAL_ERROR: Gemini API Key is missing. Transcription aborted.");
        alert("Transcription Failed: Gemini API Key is not configured. Please check your environment variables.");
        setIsProcessing(false);
        setStatusText('');
        return;
      }
      let transcript = "No transcript generated.";
      let transcriptData = null;
      let aiInsights = null;

      if (apiKey) {
        const ai = new GoogleGenAI({ apiKey });
        const fileUri = await uploadFileToGemini(blob, apiKey);
        const validModels = ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.0-flash'];

        // 1. Transcribe
        const prompt1 = "Transcribe this audio recording. Return a JSON object with a 'fullText' string and a 'segments' array. Each segment must be an object with 'text', 'startTime' (float), and 'endTime' (float). Provide ONLY the raw JSON.";

        let text1 = "{}";
        for (const model of validModels) {
          try {
            const res1 = await ai.models.generateContent({
              model: model,
              config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
              contents: [{ role: 'user', parts: [{ text: prompt1 }, { fileData: { mimeType: blob.type || "audio/webm", fileUri } }] }]
            });
            text1 = res1.text || "{}";
            break;
          } catch (e: any) {
            if (e?.status === 429) {
              await new Promise(r => setTimeout(r, 3000));
              continue;
            }
            console.warn(`Transcription failed on ${model}`, e);
          }
        }

        try {
          const p1 = JSON.parse(text1.replace(/```json/g, '').replace(/```/g, '').trim() || '{}');
          transcript = p1.fullText || transcript;
          transcriptData = p1.segments || [];
        } catch (e) {
          transcript = text1;
        }

        // 2. Analytics
        setStatusText('Generating Analytics Report...');
        const prompt2 = `Analyze this meeting transcript and extract actionable intelligence. Respond ONLY in strict JSON format.\nTranscript: "${transcript}"\nRequired JSON Structure:\n{\n"overview": "Concise executive summary of the meeting.",\n"meetingMinutes": ["Key discussion point...", "Decision made..."],\n"tasks": [\n{ "title": "...", "assignee": "Owner", "dueDate": "TBD", "completed": false }\n]\n}`;

        for (const model of validModels) {
          try {
            const res2 = await ai.models.generateContent({
              model: model,
              config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
              contents: [{ role: 'user', parts: [{ text: prompt2 }] }]
            });
            aiInsights = JSON.parse((res2.text || "{}").replace(/```json/g, '').replace(/```/g, '').trim());
            break;
          } catch (e: any) {
            if (e?.status === 429) {
              await new Promise(r => setTimeout(r, 3000));
              continue;
            }
            console.warn(`Analytics failed on ${model}`, e);
          }
        }
      }

      setStatusText('Saving...');
      await setDoc(doc(db, 'recordings', recordId), {
        id: recordId,
        audioUrl,
        transcript,
        transcriptData,
        aiInsights,
        createdAt: Timestamp.now(),
        authorUid: user?.uid || '',
        companyId: companyId || '',
        leadId: 'general' // No specific lead associated
      });

      navigate(`/r/${recordId}`);
    } catch (e) {
      console.error(e);
      alert("Failed to process recording.");
    } finally {
      setIsProcessing(false);
      setStatusText('');
    }
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99]">
        {!isRecording && !isProcessing && (
          <button onClick={startRecording} title="Record Meeting" className="flex items-center justify-center w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl shadow-indigo-600/30 hover:scale-105 active:scale-95 transition-all group border border-indigo-500">
            <Mic size={24} className="group-hover:animate-pulse" />
          </button>
        )}
        {isRecording && !isProcessing && (
          <div className="flex items-center gap-3 bg-slate-900 p-2.5 rounded-full shadow-2xl border border-slate-700">
            <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 animate-pulse">
              <Mic size={20} />
            </div>
            <div className="text-white font-mono text-xs font-bold px-2">
              {Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}
            </div>
            <button onClick={isPaused ? resumeRecording : pauseRecording} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-amber-400 hover:bg-white/20 transition-colors">
              {isPaused ? <Play size={16} className="ml-0.5" /> : <Pause size={16} />}
            </button>
            <button onClick={stopRecording} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-red-400 hover:bg-white/20 transition-colors">
              <Square size={16} />
            </button>
          </div>
        )}
      </div>
      <AnimatePresence>
        {isProcessing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md text-white text-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-indigo-400 w-12 h-12" />
              <div className="text-lg font-black">{statusText}</div>
              <div className="text-sm text-slate-400 font-medium">Please wait while we generate your meeting analytics...</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const AppContent = () => {
  const { user, companyId, role, active, onboardingComplete, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Global deactivation check
  useEffect(() => {
    if (user && active === false && !loading) {
      signOut(auth).then(() => {
        navigate('/login', { state: { error: "Contact admin: your account is deactivated." } });
      });
    }
  }, [user, active, loading, navigate]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Close sidebar on route change automatically
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const { isDemoMode } = useDemo();

  useEffect(() => {
    if (!loading) {
      const isAuthPath = location.pathname === '/login' || location.pathname === '/register-company' || location.pathname === '/super-login';
      const isSuperPath = location.pathname.startsWith('/super-admin');
      const isOnboardingPath = location.pathname === '/onboarding';
      const isGuestPath = location.pathname.startsWith('/m/') || location.pathname.startsWith('/capture/');

      // In Demo Mode, we bypass auth checks for main app paths
      if (isDemoMode) {
        if (isAuthPath || isOnboardingPath) {
          navigate('/');
        }
        return;
      }

      if (!isGuestPath && !isSuperPath) {
        if (!user && !isAuthPath) {
          navigate('/login');
        } else if (user && !companyId && location.pathname !== '/register-company') {
          navigate('/register-company');
        } else if (user && companyId && !onboardingComplete && !isOnboardingPath) {
          navigate('/onboarding');
        } else if (user && companyId && onboardingComplete && (isAuthPath || isOnboardingPath)) {
          navigate('/');
        }
      }
    }
  }, [user, companyId, onboardingComplete, loading, navigate, location.pathname, isDemoMode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-zinc-300" size={48} />
      </div>
    );
  }

  const isGuestRoute = location.pathname.startsWith('/m/') || location.pathname.startsWith('/capture/');
  const isSuperRoute = location.pathname.startsWith('/super-admin');
  const isAuthRoute = location.pathname === '/login' || location.pathname === '/register-company' || location.pathname === '/super-login';
  const isOnboardingRoute = location.pathname === '/onboarding';

  if (isGuestRoute) {
    return (
      <div className="flex min-h-screen bg-[#0A0D14] text-white font-sans w-full">
        <Routes>
          <Route path="/m/:meetingId" element={<GuestRecord />} />
          <Route path="/capture/:companyId" element={<LeadCapture />} />
        </Routes>
      </div>
    );
  }

  if (isAuthRoute || isOnboardingRoute || isSuperRoute) {
    return (
      <div className="flex min-h-screen bg-zinc-50 text-zinc-900 font-sans w-full">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register-company" element={<RegisterCompany />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/super-login" element={<SuperLogin />} />
          <Route path="/super-admin" element={<SuperAdmin />} />
        </Routes>
      </div>
    );
  }

  if (!user || !companyId) return null;

  return (
    <div className="flex min-h-[100dvh] bg-transparent text-slate-100 font-sans selection:bg-indigo-500 selection:text-white flex-row w-full overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 relative h-[100dvh] overflow-hidden w-full">
        <Navbar
          user={user}
          onMenuClick={() => setIsSidebarOpen(true)}
          onInstall={handleInstall}
          showInstallButton={!!deferredPrompt}
        />
        <main className="flex-1 w-full max-w-full overflow-y-auto scroll-smooth relative pb-12">
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/r/:id" element={<RecordingView />} />
            {/* <Route path="/history" element={<HistoryView user={user} />} /> */}
            <Route path="/history" element={<Reports user={user} />} />
            <Route path="/clients" element={<Leads user={user} />} />
            <Route path="/active-clients" element={<Leads user={user} isActiveOnlyRoute={true} />} />
            <Route path="/clients/new" element={<LeadForm user={user} />} />
            <Route path="/clients/:id/edit" element={<LeadForm user={user} />} />
            <Route path="/upload" element={<ManualUpload user={user} />} />
            <Route path="/analytics/:id" element={<LeadInsights user={user} />} />
            <Route path="/settings" element={<Settings user={user} />} />
            <Route path="/calendar" element={<CalendarPage user={user} />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/download-app" element={<DownloadApp />} />
          </Routes>
        </main>
        <GlobalRecorder />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <DemoProvider>
          <AppContent />
        </DemoProvider>
      </AuthProvider>
    </Router>
  );
}
