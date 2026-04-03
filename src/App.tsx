import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { Mic, Square, Play, Share2, Loader2, CheckCircle2, AlertCircle, LogIn, LogOut, History, Copy, ExternalLink, FileText, Languages, Users, Link as LinkIcon, MessageSquare, LayoutDashboard, Calendar, Share2 as ShareIcon, Download, RotateCcw, Bell, Clock, Menu, Sparkles } from 'lucide-react';
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
  getBytes
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
        className={`relative p-2.5 rounded-xl transition-all active:scale-95 ${showDropdown ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-100'}`}
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
            className="absolute right-0 mt-4 w-80 glass-card !p-0 border-slate-200 shadow-2xl shadow-slate-400/20 z-[100] overflow-hidden"
          >
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em]">Notifications</h3>
              <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase tracking-widest">{meetings.length} Upcoming</span>
            </div>
            
            <div className="max-h-[400px] overflow-y-auto scrollbar-hide py-2">
              {!pushEnabled && (
                <div className="p-4 mx-2 mb-2 rounded-2xl bg-rose-50/50 border border-rose-100 hover:bg-rose-50 transition-all cursor-pointer group" onClick={handleRequestPush}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white text-rose-500 shadow-sm border border-rose-100"><Bell size={14} /></div>
                    <div className="flex-1">
                      <div className="font-black text-slate-900 text-[11px] uppercase tracking-wider mb-0.5">Enable Notifications</div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight opacity-70">Get alerted for upcoming meetings</div>
                    </div>
                  </div>
                </div>
              )}
              
              {meetings.length > 0 ? meetings.map((m, idx) => (
                <div key={m.id} className="px-4 py-4 hover:bg-slate-50 transition-all cursor-pointer border-b border-slate-50 last:border-0 group">
                  <div className="font-bold text-slate-900 text-sm mb-1 group-hover:text-indigo-600 transition-colors">{m.title}</div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-wider">
                    <Clock size={10} className="text-indigo-500/50" />
                    {m.scheduledAt?.toDate?.().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', hour12: false })}
                  </div>
                  {m.leadName && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-widest">
                      <Users size={10} /> {m.leadName}
                    </div>
                  )}
                </div>
              )) : (
                <div className="p-12 text-center space-y-4">
                  <div className="p-4 bg-slate-50 rounded-full w-fit mx-auto text-slate-200">
                    <History size={32} />
                  </div>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] italic">No notifications yet.</p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-center">
              <Link to="/calendar" className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 transition-all">View Calendar &rarr;</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Navbar = ({ user, onMenuClick, onInstall, showInstallButton }: { user: User, onMenuClick: () => void, onInstall: () => void, showInstallButton: boolean }) => {
  const { companyName } = useAuth();

  return (
    <nav className="glass-nav z-[90] px-4 py-4 sm:px-12 flex items-center justify-between border-b border-slate-200/50">
      <div className="flex items-center gap-6">
        <button onClick={onMenuClick} className="lg:hidden p-3 text-slate-500 hover:bg-slate-100 rounded-2xl transition-all shadow-sm active:scale-95 border border-slate-100">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center p-1.5 shadow-sm border border-slate-100 overflow-hidden">
             <img src="/logo.png" className="w-full h-full object-contain" alt="logo" />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.3em] leading-none mb-1 shadow-sm">Workspace</span>
            <span className="text-sm font-black text-slate-900 tracking-tight uppercase tracking-[0.05em]">{companyName || 'handycrm.ai'}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {showInstallButton && (
          <button
            onClick={onInstall}
            className="hidden md:flex items-center gap-2.5 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-indigo-200 hover:text-indigo-600 transition-all shadow-xl shadow-slate-200/50 active:scale-95 shadow-sm"
          >
            <Download size={14} /> Install
          </button>
        )}
        <NotificationBell />
        <div className="h-8 w-[1px] bg-slate-200 mx-2 hidden sm:block"></div>
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-xs font-black text-slate-900 leading-none mb-1 uppercase tracking-widest">{user.displayName || 'Unknown Terminal'}</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{user.email?.split('@')[0]}</span>
        </div>
        <Link to="/profile" className="relative group p-1 bg-white border border-slate-100 rounded-[1.25rem] shadow-xl shadow-slate-200/50 hover:border-indigo-200 transition-all">
          <img
            src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=6366f1&color=fff`}
            alt="Profile"
            className="w-10 h-10 rounded-[1rem] object-cover border border-white group-hover:scale-105 transition-all group-active:scale-95"
          />
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-4 border-white shadow-sm ring-2 ring-emerald-500/20"></div>
        </Link>
      </div>
    </nav>
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
                    const origin = window.location.hostname === 'localhost' ? 'https://handydashcrmai.vercel.app' : window.location.origin;
                    navigator.clipboard.writeText(`${origin}/r/${rec.id}`);
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
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
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
      const validModels = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.0-pro-exp'];
      let success = false;
      let finalTranscriptData = null;
      for (const modelName of validModels) {
        try {
          const prompt = "Transcribe this audio recording into English with timestamps. Return a JSON object with a 'fullText' string and a 'segments' array ({text: string, startTime: float, endTime: float}). Provide ONLY the raw JSON.";
          const response = await ai.models.generateContent({
            model: modelName,
            config: { maxOutputTokens: 25000, responseMimeType: "application/json" },
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
          throw err;
        }
      }
      if (!success) throw new Error("Intelligence services temporarily unavailable.");
      await updateDoc(doc(db, 'recordings', id), {
        transcript: String(finalTranscriptData.fullText || recording.transcript || ''),
        transcriptData: finalTranscriptData.segments || [],
        updatedAt: Timestamp.now()
      });
      setRecording((prev: any) => ({ ...prev, transcript: finalTranscriptData.fullText, transcriptData: finalTranscriptData.segments }));
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

  if (loading) return (
    <div className="flex-1 bg-slate-50 min-h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-indigo-500 w-12 h-12" />
    </div>
  );

  if (!recording) return (
    <div className="flex-1 bg-slate-50 min-h-screen flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest text-sm">
      Logic Payload Missing
    </div>
  );

  return (
    <div className="flex-1 bg-slate-50/50 min-h-screen overflow-y-auto">
      <div className="max-w-4xl mx-auto p-4 sm:p-12 space-y-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card !p-10 sm:!p-16 border-slate-200 shadow-[0_32px_120px_rgba(0,0,0,0.06)] relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-50 rounded-full blur-[100px] pointer-events-none translate-x-1/2 -translate-y-1/2 opacity-60"></div>
          
          <header className="mb-16 border-b border-slate-100 pb-10 flex flex-col md:flex-row justify-between items-start gap-10 relative z-10">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">
                <FileText size={14} /> Transcript
              </div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none uppercase tracking-[0.05em]">Recording Details</h1>
              <div className="flex items-center gap-2 text-slate-400 font-black uppercase tracking-widest text-[9px]">
                <Calendar size={12} className="text-indigo-500/50" />
                {recording.createdAt?.toDate?.().toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short', hour12: false }) || 'RECENT'}
              </div>
            </div>

            <div className="flex flex-wrap gap-4 shrink-0">
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="px-6 py-3.5 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-slate-200/50 active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                {isSyncing ? 'Synchronizing' : 'Recalibrate'}
              </button>
              <button
                onClick={() => window.print()}
                className="px-8 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-400/20 active:scale-95 flex items-center gap-2"
              >
                <Download size={16} /> Export Core
              </button>
            </div>
          </header>

          <section className="space-y-12 relative z-10">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-50 text-slate-400 rounded-lg border border-slate-100 shadow-sm"><Languages size={14} /></div>
                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Dialect Decoding</h2>
              </div>
              <div className="bg-slate-50/50 p-10 rounded-[2.5rem] border border-slate-200/50 shadow-inner group-hover:bg-white transition-all duration-700">
                {recording.transcript ? (
                  <TranscriptPlayer
                    audioUrl={recording.audioUrl}
                    transcriptData={recording.transcriptData}
                    fallbackText={recording.transcript}
                  />
                ) : (
                  <div className="text-center py-12 text-slate-400 italic">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Initializing logic stream retrieval...</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-10 bg-indigo-50/30 rounded-[2.5rem] border border-indigo-100 border-dashed relative group/ai overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-100 rounded-full blur-[40px] opacity-20 group-hover/ai:opacity-40 transition-all duration-1000"></div>
                <div className="flex items-center gap-4 relative z-10">
                    <div className="p-4 bg-white rounded-2xl text-indigo-600 shadow-xl shadow-indigo-200/50 border border-indigo-100"><Sparkles size={24} className="animate-pulse" /></div>
                    <div className="space-y-1">
                        <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest">AI Analysis Summary</h3>
                        <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em] opacity-80">Autonomous analysis generated via Gemini AI</p>
                    </div>
                </div>
            </div>
          </section>
        </motion.div>
        
        <div className="text-center">
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.4em]">Handydash CRM AI &bull; Handysolver Systems</p>
        </div>
      </div>
    </div>
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
      const isSuperPath = location.pathname.startsWith('/super-admin-console');
      const isOnboardingPath = location.pathname === '/onboarding';
      const isGuestPath = location.pathname.startsWith('/m/');

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

  const isGuestRoute = location.pathname.startsWith('/m/');
  const isSuperRoute = location.pathname.startsWith('/super-admin-console');
  const isAuthRoute = location.pathname === '/login' || location.pathname === '/register-company' || location.pathname === '/super-login';
  const isOnboardingRoute = location.pathname === '/onboarding';

  if (isGuestRoute) {
    return (
      <div className="flex min-h-screen bg-zinc-50 text-zinc-900 font-sans w-full">
        <Routes>
          <Route path="/m/:meetingId" element={<GuestRecord />} />
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
          <Route path="/super-admin-console" element={<SuperAdmin />} />
        </Routes>
      </div>
    );
  }

  if (!user || !companyId) return null;

  return (
    <div className="flex min-h-[100dvh] bg-slate-50/50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white flex-row w-full overflow-hidden">
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
