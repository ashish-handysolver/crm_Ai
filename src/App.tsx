import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { Mic, Square, Play, Share2, Loader2, CheckCircle2, AlertCircle, LogIn, LogOut, History, Copy, ExternalLink, FileText, Languages, Users, Link as LinkIcon, MessageSquare, LayoutDashboard, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
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
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import Leads from './Leads';
import Sidebar from './Sidebar';
import LeadForm from './LeadForm';
import Dashboard from './Dashboard';
import Reports from './Reports';
import GuestRecord from './GuestRecord';
import Analytics from './Analytics';
import ManualUpload from './ManualUpload';
import LeadInsights from './LeadInsights';
import ImportModal from './ImportModal';

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
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Types ---
interface RecordingData {
  id: string;
  audioData: string;
  transcript: string;
  createdAt: Timestamp;
  authorUid?: string;
  meetingId?: string;
}

interface MeetingData {
  id: string;
  title: string;
  ownerUid: string;
  createdAt: Timestamp;
}

// --- Components ---

// Sidebar component has been extracted to src/Sidebar.tsx

const Navbar = ({ user }: { user: User | null }) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error.code === 'auth/popup-blocked') {
        alert("The login popup was blocked by your browser. Please allow popups for this site and try again.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        // This can happen if multiple login attempts are made rapidly, or if the popup is closed quickly.
        // We can ignore it or show a subtle message.
      } else {
        alert("Login failed. Please try again.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  return (
    <nav className="flex items-center justify-end md:justify-end p-6 border-b border-white/20 bg-white/70 backdrop-blur-xl sticky top-0 z-50">
      <Link to="/" className="flex items-center gap-2 group md:hidden mr-auto">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 shadow-lg shadow-blue-500/30 transition-all">
          <Mic className="text-white w-5 h-5" />
        </div>
        <span className="font-sans font-extrabold text-xl tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">AudioCRM</span>
      </Link>

      <div className="flex items-center gap-4">
        {user && (
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="hidden md:flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            Import Leads
          </button>
        )}
        {isImportModalOpen && <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} user={user} />}
        {installPrompt && (
          <button
            onClick={handleInstall}
            className="hidden md:flex items-center gap-2 bg-zinc-100 text-black px-4 py-2 rounded-xl text-sm font-bold hover:bg-zinc-200 transition-all"
          >
            Install App
          </button>
        )}
        {user ? (
          <div className="flex items-center gap-4">

            <div className="flex items-center gap-2 bg-white/50 backdrop-blur border border-white/60 shadow-sm px-3 py-1.5 rounded-full">
              <img src={user.photoURL || ''} alt="" className="w-7 h-7 rounded-full border border-zinc-200" referrerPolicy="no-referrer" />
              <span className="text-sm font-bold bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text text-transparent px-1">{user.displayName}</span>
            </div>
            <button onClick={handleLogout} className="p-2 bg-white/50 shadow-sm hover:shadow hover:-translate-y-0.5 border border-white/60 rounded-full transition-all text-red-500 hover:bg-red-50 hover:text-red-600">
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className={`flex items-center gap-2 bg-gradient-to-r from-slate-800 to-black text-white shadow-lg shadow-black/20 px-6 py-2.5 rounded-xl font-bold transition-all active:scale-95 ${isLoggingIn ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30'}`}
          >
            <LogIn size={18} className={isLoggingIn ? 'animate-spin' : ''} />
            {isLoggingIn ? 'Signing In...' : 'Sign In'}
          </button>
        )}
      </div>
    </nav>
  );
};

const Home = ({ user }: { user: User | null }) => {
  const { meetingId: urlMeetingId } = useParams();
  const [meeting, setMeeting] = useState<MeetingData | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [includeSystemAudio, setIncludeSystemAudio] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [error, setError] = useState('');
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);

  useEffect(() => {
    const fetchMeeting = async () => {
      if (!urlMeetingId) return;
      try {
        const docSnap = await getDoc(doc(db, 'meetings', urlMeetingId));
        if (docSnap.exists()) {
          setMeeting(docSnap.data() as MeetingData);
        }
      } catch (err) {
        console.error("Error fetching meeting:", err);
      }
    };
    fetchMeeting();
  }, [urlMeetingId]);

  const createMeeting = async () => {
    if (!user) return;
    setIsCreatingMeeting(true);
    try {
      const id = uuidv4().slice(0, 8);
      const meetingData: MeetingData = {
        id,
        title: `Meeting ${new Date().toLocaleDateString()}`,
        ownerUid: user.uid,
        createdAt: Timestamp.now()
      };
      await setDoc(doc(db, 'meetings', id), meetingData);
      const url = `${window.location.origin}/m/${id}`;
      setShareUrl(url);
    } catch (err) {
      console.error("Error creating meeting:", err);
      setError("Failed to create meeting link.");
    } finally {
      setIsCreatingMeeting(false);
    }
  };

};

const RecordingView = () => {
  const { id } = useParams();
  const [recording, setRecording] = useState<RecordingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchRecording = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'recordings', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setRecording(docSnap.data() as RecordingData);
        } else {
          setError("Recording not found.");
        }
      } catch (err) {
        console.error("Fetch error:", err);
        setError("Failed to load recording.");
      } finally {
        setLoading(false);
      }
    };

    fetchRecording();
  }, [id]);

  const [isTranslating, setIsTranslating] = useState(false);

  const translateToEnglish = async () => {
    if (!recording || !id) return;
    setIsTranslating(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Gemini API key is missing.");
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: `Please translate the following transcript into English. Provide only the translated text.\n\nTranscript: ${recording.transcript}` }
            ]
          }
        ]
      });

      const translatedText = response.text || recording.transcript;

      // Update local state and Firestore
      const updatedRecording = { ...recording, transcript: translatedText };
      setRecording(updatedRecording);

      await updateDoc(doc(db, 'recordings', id), {
        transcript: translatedText
      });

    } catch (err) {
      console.error("Translation error:", err);
      setError("Failed to translate transcript.");
    } finally {
      setIsTranslating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-zinc-300" size={48} />
        <p className="mt-4 text-zinc-500 font-medium">Loading recording...</p>
      </div>
    );
  }

  if (error || !recording) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="text-red-500" size={40} />
        </div>
        <h2 className="text-3xl font-bold mb-2">Oops!</h2>
        <p className="text-zinc-500 mb-8">{error || "Something went wrong."}</p>
        <Link to="/" className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-zinc-800 transition-all">
          Go Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] border border-black/5 shadow-2xl overflow-hidden"
      >
        <div className="p-8 md:p-12 border-b border-zinc-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2">
              <Share2 size={14} />
              Shared Recording
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Transcript & Audio</h1>
            <p className="text-zinc-400 text-sm mt-1">
              Recorded on {recording.createdAt?.toDate ? recording.createdAt.toDate().toLocaleDateString() : 'Unknown Date'} at {recording.createdAt?.toDate ? recording.createdAt.toDate().toLocaleTimeString() : 'Unknown Time'}
            </p>
          </div>

          <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
            <audio
              src={recording.audioUrl ? recording.audioUrl : (recording.audioData ? `data:audio/webm;base64,${recording.audioData}` : '')}
              controls
              className="w-full md:w-64"
            />
          </div>
        </div>

        <div className="p-8 md:p-12 bg-zinc-50/50">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                <FileText className="text-white" size={16} />
              </div>
              <h3 className="font-bold text-lg">Transcription</h3>
            </div>

            <button
              onClick={translateToEnglish}
              disabled={isTranslating}
              className="text-xs font-bold bg-zinc-100 hover:bg-black hover:text-white px-4 py-2 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isTranslating ? <Loader2 className="animate-spin" size={12} /> : <Languages size={12} />}
              {isTranslating ? 'Translating...' : 'Translate to English'}
            </button>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm min-h-[200px]">
            <p className="text-zinc-700 leading-relaxed text-lg whitespace-pre-wrap italic">
              "{recording.transcript}"
            </p>
          </div>
        </div>

        <div className="p-8 bg-zinc-100/50 flex justify-center">
          <Link to="/" className="text-zinc-500 hover:text-black font-medium flex items-center gap-2 transition-colors">
            <Mic size={18} />
            Create your own recording
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

const HistoryView = ({ user }: { user: User | null }) => {
  const [recordings, setRecordings] = useState<RecordingData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'recordings'),
      where('authorUid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({ ...doc.data() } as RecordingData));
      // Client-side filtering and sorting to prevent Firestore index/permission drops
      data = data.filter(d => d.authorUid === user.uid || !d.authorUid);
      data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setRecordings(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'recordings');
    });

    return () => unsubscribe();
  }, [user]);

  if (!user) return <div className="p-20 text-center">Please sign in to view history.</div>;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-4xl font-bold tracking-tight">Your Recordings</h1>
        <div className="text-zinc-400 font-medium">{recordings.length} items</div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-zinc-200" size={40} />
        </div>
      ) : recordings.length === 0 ? (
        <div className="bg-zinc-50 rounded-3xl border border-dashed border-zinc-200 p-20 text-center">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Mic className="text-zinc-300" size={32} />
          </div>
          <h3 className="text-xl font-bold mb-2 text-zinc-400">No recordings yet</h3>
          <Link to="/" className="text-black font-bold hover:underline">Start your first one</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {recordings.map((rec) => (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white border border-zinc-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-zinc-400" />
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                      {rec.createdAt?.toDate ? rec.createdAt.toDate().toLocaleDateString() : 'Unknown Date'}
                    </span>
                  </div>
                  {rec.meetingId && (
                    <span className="w-fit bg-zinc-100 text-zinc-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">
                      Meeting
                    </span>
                  )}
                </div>
                <Link to={`/r/${rec.id}`} className="p-2 bg-zinc-50 rounded-lg hover:bg-black hover:text-white transition-colors">
                  <ExternalLink size={16} />
                </Link>
              </div>
              <p className="text-zinc-600 line-clamp-3 mb-6 italic">"{rec.transcript}"</p>
              <div className="flex items-center gap-3">
                <Link
                  to={`/r/${rec.id}`}
                  className="flex-1 bg-zinc-50 py-2 rounded-xl text-xs font-bold text-zinc-500 flex items-center justify-center gap-2 hover:bg-zinc-100 transition-colors"
                >
                  <Play size={14} />
                  View
                </Link>
                <button
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/r/${rec.id}`)}
                  className="p-2 text-zinc-400 hover:text-black transition-colors"
                >
                  <Share2 size={18} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

const AppLayout = ({ user }: { user: User | null }) => {
  const location = useLocation();
  const isGuestRoute = location.pathname.startsWith('/m/');

  if (isGuestRoute) {
    return (
      <div className="flex min-h-screen bg-zinc-50 text-zinc-900 font-sans w-full">
        <Routes>
          <Route path="/m/:meetingId" element={<GuestRecord />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-indigo-50 via-slate-50 to-purple-50 text-slate-900 font-sans selection:bg-blue-500 selection:text-white flex-row w-full">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 relative">
        <Navbar user={user} />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/r/:id" element={<RecordingView />} />
            <Route path="/history" element={<HistoryView user={user} />} />
            <Route path="/clients" element={<Leads user={user} />} />
            <Route path="/clients/new" element={<LeadForm user={user} />} />
            <Route path="/clients/:id/edit" element={<LeadForm user={user} />} />
            <Route path="/upload" element={<ManualUpload user={user} />} />
            <Route path="/reports" element={<Reports user={user} />} />
            <Route path="/analytics" element={<Analytics user={user} />} />
            <Route path="/analytics/:id" element={<LeadInsights user={user} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-zinc-200" size={48} />
      </div>
    );
  }

  return (
    <Router>
      <AppLayout user={user} />
    </Router>
  );
}
