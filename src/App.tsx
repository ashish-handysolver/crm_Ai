import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { Mic, Square, Play, Share2, Loader2, CheckCircle2, AlertCircle, LogIn, LogOut, History, Copy, ExternalLink, FileText, Languages, Users, Link as LinkIcon, MessageSquare, LayoutDashboard, Calendar, Share2 as ShareIcon, Download, RotateCcw } from 'lucide-react';
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

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DemoProvider } from './DemoContext';


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

const Navbar = ({ user, onMenuClick, onInstall, showInstallButton }: { user: User, onMenuClick: () => void, onInstall: () => void, showInstallButton: boolean }) => {
  const { companyName } = useAuth();
  
  return (
    <nav className="sticky top-0 z-40 w-full bg-white/70 backdrop-blur-md border-b border-slate-100 px-4 py-3 sm:px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-xl transition-colors">
          <MessageSquare size={20} />
        </button>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-slate-900">{companyName || 'Handysolver'}</span>
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Workspace</span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {showInstallButton && (
          <button 
            onClick={onInstall}
            className="hidden md:flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all border border-indigo-100"
          >
            <Download size={14} /> Install App
          </button>
        )}
        <div className="hidden sm:flex flex-col items-end mr-2">
          <span className="text-xs font-bold text-slate-900">{user.displayName || 'User'}</span>
          <span className="text-[10px] font-medium text-slate-400">{user.email}</span>
        </div>
        <Link to="/profile">
           <img 
            src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=random`} 
            alt="Profile" 
            className="w-10 h-10 rounded-xl object-cover border-2 border-white shadow-sm hover:scale-105 transition-transform"
          />
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
        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Interaction Logs</h1>
        <p className="text-slate-500 font-medium">Comprehensive history of all generated transcripts and insights.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recordings.map((rec) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={rec.id} 
            className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group"
          >
            <div className="flex items-center gap-4 mb-6">
               <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-bold shadow-inner">
                 <History size={24} />
               </div>
               <div>
                  <h3 className="font-extrabold text-slate-900">Transcript Node</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{rec.id.slice(0, 8)}</p>
               </div>
            </div>

            <div className="space-y-4 mb-8">
               <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                  <Calendar size={14} className="text-indigo-400" />
                  {rec.createdAt?.toDate?.().toLocaleString() || 'Recent'}
               </div>
               <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed font-medium bg-slate-50 p-4 rounded-2xl border border-slate-100/50">
                  {rec.transcript || 'No transcript version recorded.'}
               </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
               <div className="flex gap-2">
                 <Link 
                    to={`/r/${rec.id}`} 
                    className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
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
        <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
           <History size={48} className="mx-auto text-slate-200 mb-4" />
           <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No historical logs available</p>
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

  const handleSync = async () => {
    if (!recording || !recording.audioUrl || isSyncing || !id) return;
    setIsSyncing(true);
    try {
      const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY || '';
      if (!apiKey) return;
      
      const storageRef = ref(storage, recording.audioUrl);
      const buffer = await getBytes(storageRef);
      const blob = new Blob([buffer], { type: 'audio/webm' });

      const fileUri = await uploadFileToGemini(blob, apiKey);

      const ai = new GoogleGenAI({ apiKey });

      const genResult = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        config: {
          responseMimeType: "application/json",
        },
        contents: [{ role: 'user', parts: [
          { text: "Transcribe this audio recording of a sales/lead call. Return a JSON object with a 'fullText' string and a 'segments' array. Each segment must be an object with 'text' (the word or short phrase), 'startTime' (in seconds as a float), and 'endTime' (in seconds as a float). Provide ONLY JSON." },
          { fileData: { mimeType: blob.type || "audio/webm", fileUri } }
        ]}]
      });

      // Robust parsing for unified SDK
      let rawContent = "{}";
      const resAny = genResult as any;
      if (resAny.text && typeof resAny.text === 'string') {
        rawContent = resAny.text;
      } else if (resAny.text && typeof resAny.text === 'function') {
        rawContent = resAny.text();
      } else if (resAny.response?.text && typeof resAny.response.text === 'function') {
        rawContent = resAny.response.text();
      } else if (resAny.response?.candidates?.[0]?.content?.parts?.[0]?.text) {
        rawContent = resAny.response.candidates[0].content.parts[0].text;
      }

      const jsonStr = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonStr);

      await updateDoc(doc(db, 'recordings', id), {
        transcript: String(parsed.fullText || recording.transcript || ''),
        transcriptData: parsed.segments || []
      });

      setRecording((prev: any) => ({
        ...prev,
        transcript: String(parsed.fullText || prev.transcript || ''),
        transcriptData: parsed.segments || []
      }));
    } catch (err) {
      console.error("Transcription sync failed:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const fetchRec = async () => {
      if (!id) return;
      const snap = await getDoc(doc(db, 'recordings', id));
      if (snap.exists()) setRecording(snap.data());
      setLoading(false);
    };
    fetchRec();
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center p-20">
      <Loader2 className="animate-spin text-indigo-500" size={32} />
    </div>
  );

  if (!recording) return (
    <div className="p-8 text-center text-slate-500 font-bold">Log not found.</div>
  );

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 sm:p-12 rounded-[3rem] shadow-xl shadow-slate-200/60 border border-slate-100">
        <header className="mb-12 border-b border-slate-100 pb-8 flex flex-col md:flex-row justify-between items-start gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest mb-4">
               Secure Intelligence Node
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Interaction Transcript</h1>
            <p className="text-slate-500 font-medium mt-1">Generated: {recording.createdAt?.toDate?.().toLocaleString()}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
               onClick={handleSync}
               disabled={isSyncing}
               className="px-6 py-3 bg-white text-indigo-600 border border-slate-200 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-lg shadow-slate-200/5 disabled:opacity-50"
            >
               {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
               {isSyncing ? 'Processing...' : 'Regenerate Transcript'}
            </button>
            <button 
               onClick={() => window.print()}
               className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
            >
               <FileText size={18} /> Export PDF
            </button>
          </div>
        </header>

        <section className="space-y-10">
          <div>
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Original Dialogue</h2>
            <div className="bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100/50 text-slate-700 leading-[1.8] font-medium text-lg whitespace-pre-wrap">
              {recording.transcript ? (
                <TranscriptPlayer 
                  audioUrl={recording.audioUrl}
                  transcriptData={recording.transcriptData}
                  fallbackText={recording.transcript}
                />
              ) : (
                "No transcript version encoded for this entry."
              )}
            </div>
          </div>

          <div className="p-8 bg-indigo-50/50 rounded-[2rem] border border-indigo-100/50 border-dashed">
            <h2 className="text-indigo-600 font-black text-lg mb-2 flex items-center gap-2">
               <Languages size={20} /> AI Post-Processing
            </h2>
            <p className="text-indigo-400 font-bold text-sm uppercase tracking-widest">Immutable Analysis Metadata</p>
          </div>
        </section>
      </motion.div>
    </div>
  );
};

const AppContent = () => {
  const { user, companyId, role, onboardingComplete, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

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

  useEffect(() => {
    if (!loading) {
      const isAuthPath = location.pathname === '/login' || location.pathname === '/register-company' || location.pathname === '/super-login';
      const isSuperPath = location.pathname.startsWith('/super-admin-console');
      const isOnboardingPath = location.pathname === '/onboarding';
      const isGuestPath = location.pathname.startsWith('/m/');

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
  }, [user, companyId, onboardingComplete, loading, navigate, location.pathname]);

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
    <div className="flex min-h-[100dvh] bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white flex-row w-full overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 relative h-[100dvh] overflow-y-auto w-full scroll-smooth">
        <Navbar 
          user={user} 
          onMenuClick={() => setIsSidebarOpen(true)} 
          onInstall={handleInstall}
          showInstallButton={!!deferredPrompt}
        />
        <main className="flex-1 w-full max-w-full overflow-x-hidden relative pb-12">
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/r/:id" element={<RecordingView />} />
            <Route path="/history" element={<HistoryView user={user} />} />
            <Route path="/clients" element={<Leads user={user} />} />
            <Route path="/clients/new" element={<LeadForm user={user} />} />
            <Route path="/clients/:id/edit" element={<LeadForm user={user} />} />
            <Route path="/upload" element={<ManualUpload user={user} />} />
            <Route path="/analytics/:id" element={<LeadInsights user={user} />} />
            <Route path="/settings" element={<Settings user={user} />} />
            <Route path="/calendar" element={<CalendarPage user={user} />} />
            <Route path="/profile" element={<Profile />} />
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
