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
        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">History</h1>
        <p className="text-slate-500 font-medium">List of all your calls and notes.</p>
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
                <h3 className="font-extrabold text-slate-900">Call Info</h3>
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

  const getStoragePathFromUrl = (audioUrl: string): string | null => {
    if (!audioUrl) return null;

    // If already a storage path
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
    // 1. Get API Key from Environment Variables
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API Key is missing in environment variables (VITE_GEMINI_API_KEY).");
    }

    let audioBlob: Blob | null = null;

    // --- Start Audio Retrieval Logic ---
    try {
      const storagePath = getStoragePathFromUrl(recording.audioUrl);
      if (storagePath) {
        const storageRef = ref(storage, storagePath);
        const buffer = await getBytes(storageRef);
        audioBlob = new Blob([buffer], { type: 'audio/webm' });
        console.log("Audio acquired from Firebase Storage:", audioBlob.size);
      }
    } catch (readErr) {
      console.warn("Firebase getBytes failed, trying direct fetch:", readErr);
    }

    if (!audioBlob) {
      try {
        const response = await fetch(recording.audioUrl);
        if (!response.ok) throw new Error(`Direct fetch failed (${response.status})`);
        audioBlob = await response.blob();
      } catch (directErr) {
        console.warn("Direct fetch failed, trying corsproxy:", directErr);
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(recording.audioUrl)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`Failed to fetch via proxy (${response.status})`);
        audioBlob = await response.blob();
      }
    }

    if (!audioBlob) throw new Error("Unable to retrieve audio blob for transcription.");
    // --- End Audio Retrieval Logic ---

    // 2. Upload to Gemini File API
    const fileUri = await uploadFileToGemini(audioBlob, apiKey);
    
    // 3. Initialize AI with correct Model List
    const ai = new GoogleGenAI({ apiKey });
    
    // Only use models that actually exist in the Gemini API
    const validModels = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-2.0-pro-exp'
    ];

    let success = false;
    let finalTranscriptData = null;

    for (const modelName of validModels) {
      try {
        console.log(`Attempting transcription with model: ${modelName}`);
        
        const prompt = "Transcribe this audio recording. ALL generated text MUST be translated to English, regardless of the language spoken in the audio. Return a JSON object with a 'fullText' string and a 'segments' array. Each segment must be an object with 'text' (in English), 'startTime' (float), and 'endTime' (float). Provide ONLY the raw JSON.";

        const response = await ai.models.generateContent({
          model: modelName,
          config: {
            // CRITICAL for 25-minute audio:
            maxOutputTokens: 8192, 
            responseMimeType: "application/json",
          },
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                { fileData: { mimeType: audioBlob.type || "audio/webm", fileUri } }
              ]
            }
          ]
        });
        
        const rawText = response.text || "{}";

        // Clean markdown backticks if the model ignores responseMimeType
        const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

        const parseTranscript = (text: string) => {
          try {
            return JSON.parse(text);
          } catch (e) {
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace >= 0 && lastBrace > firstBrace) {
              const candidate = text.slice(firstBrace, lastBrace + 1);
              try {
                return JSON.parse(candidate);
              } catch (innerErr) {
                console.warn('Failed to parse extracted JSON candidate:', innerErr);
              }
            }
            throw e;
          }
        };

        try {
          finalTranscriptData = parseTranscript(jsonStr);
        } catch (parseError) {
          console.warn('Failed to parse transcription JSON from model response; using raw text fallback.', parseError, jsonStr);
          finalTranscriptData = { fullText: rawText, segments: [] };
        }

        success = true;
        console.log(`Successfully transcribed with ${modelName}`);
        break; // Exit loop on success

      } catch (err: any) {
        const status = err?.status || err?.code;
        if (status === 429) {
          console.error(`Model ${modelName} hit rate limit (429). Waiting 3 seconds before fallback...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue; // Try the next model in the list
        } else if (status === 404) {
          console.error(`Model ${modelName} not found (404).`);
          continue;
        }
        throw err; // Stop if it's a different kind of error (e.g., auth)
      }
    }

    if (!success || !finalTranscriptData) {
      throw new Error("All Gemini models are busy (Quota 429) or unavailable. Please wait 60 seconds and try again.");
    }

    // 4. Update Database
    await updateDoc(doc(db, 'recordings', id), {
      transcript: String(finalTranscriptData.fullText || recording.transcript || ''),
      transcriptData: finalTranscriptData.segments || [],
      updatedAt: Timestamp.now()
    });

    // 5. Update local state
    setRecording((prev: any) => ({
      ...prev,
      transcript: String(finalTranscriptData.fullText || prev.transcript || ''),
      transcriptData: finalTranscriptData.segments || []
    }));

    alert("Transcription updated successfully!");

  } catch (err: any) {
    console.error("Transcription sync failed:", err);
    alert(err.message || "An error occurred during transcription.");
  } finally {
    setIsSyncing(false);
  }
};

  useEffect(() => {
    const fetchRec = async () => {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, 'recordings', id));
        if (snap.exists()) setRecording(snap.data());
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 sm:p-12 rounded-[3rem] shadow-xl shadow-slate-200/60 border border-slate-100"
      >
        <header className="mb-12 border-b border-slate-100 pb-8 flex flex-col md:flex-row justify-between items-start gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest mb-4">
              AI Report
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Transcript</h1>
            <p className="text-slate-500 font-medium mt-1">
              {recording.createdAt?.toDate?.().toLocaleString() || 'Recent'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="px-6 py-3 bg-white text-indigo-600 border border-slate-200 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-lg shadow-slate-200/5 disabled:opacity-50"
            >
              {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
              {isSyncing ? 'Updating...' : 'Update'}
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
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Call Text</h2>
            <div className="bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100/50 text-slate-700 leading-[1.8] font-medium text-lg whitespace-pre-wrap">
              {recording.transcript ? (
                <TranscriptPlayer
                  audioUrl={recording.audioUrl}
                  transcriptData={recording.transcriptData}
                  fallbackText={recording.transcript}
                />
              ) : (
                <div className="text-center py-6 text-slate-400 italic">
                  No transcript found. Click "Regenerate Transcript" to begin.
                </div>
              )}
            </div>
          </div>

          <div className="p-8 bg-indigo-50/50 rounded-[2rem] border border-indigo-100/50 border-dashed">
            <h2 className="text-indigo-600 font-black text-lg mb-2 flex items-center gap-2">
              <Languages size={20} /> AI Analysis
            </h2>
            <p className="text-indigo-400 font-bold text-sm uppercase tracking-widest">AI Info</p>
          </div>
        </section>
      </motion.div>
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
