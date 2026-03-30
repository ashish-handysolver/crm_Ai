import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate, Link } from 'react-router-dom';
import { Mic, Square, Play, Share2, Loader2, CheckCircle2, AlertCircle, LogIn, LogOut, History, Copy, ExternalLink, FileText, Languages } from 'lucide-react';
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

const Navbar = ({ user }: { user: User | null }) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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
    <nav className="flex items-center justify-between p-6 border-b border-black/5 bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <Link to="/" className="flex items-center gap-2 group">
        <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
          <Mic className="text-white w-5 h-5" />
        </div>
        <span className="font-sans font-bold text-xl tracking-tight">AudioCRM</span>
      </Link>
      
      <div className="flex items-center gap-4">
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
            <Link to="/history" className="text-sm font-medium text-zinc-600 hover:text-black flex items-center gap-1.5">
              <History size={16} />
              History
            </Link>
            <div className="flex items-center gap-2 bg-zinc-100 px-3 py-1.5 rounded-full">
              <img src={user.photoURL || ''} alt="" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
              <span className="text-xs font-medium">{user.displayName}</span>
            </div>
            <button onClick={handleLogout} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-500">
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <button 
            onClick={handleLogin}
            disabled={isLoggingIn}
            className={`flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl font-medium transition-all active:scale-95 ${isLoggingIn ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-800'}`}
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

  const startRecording = async () => {
    try {
      setError('');
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser does not support audio recording.");
      }

      const streams: MediaStream[] = [];
      
      // 1. Get Microphone Stream
      let micStream: MediaStream;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (micErr: any) {
        console.error("Microphone access error:", micErr);
        if (micErr.name === 'NotFoundError' || micErr.name === 'DevicesNotFoundError' || micErr.message?.includes('device not found')) {
          throw new Error("No microphone found. Please connect a microphone and try again.");
        }
        if (micErr.name === 'NotAllowedError' || micErr.name === 'PermissionDeniedError') {
          throw new Error("Microphone permission denied. Please allow access in your browser settings.");
        }
        throw new Error(micErr.message || "Could not access microphone.");
      }
      
      streams.push(micStream);
      let finalStream = micStream;

      // 2. Optional: Get System Audio Stream
      if (includeSystemAudio) {
        if (!navigator.mediaDevices.getDisplayMedia) {
          micStream.getTracks().forEach(t => t.stop());
          throw new Error("System audio recording is not supported in this browser.");
        }

        try {
          // getDisplayMedia usually requires video: true to show the audio toggle in many browsers
          const systemStream = await navigator.mediaDevices.getDisplayMedia({ 
            video: { width: 1, height: 1 }, 
            audio: true 
          });
          
          if (systemStream.getAudioTracks().length === 0) {
            systemStream.getTracks().forEach(t => t.stop());
            throw new Error("No system audio track found. Did you check 'Share audio' in the popup?");
          }
          
          streams.push(systemStream);

          // Mix streams
          const audioContext = new AudioContext();
          audioContextRef.current = audioContext;
          const dest = audioContext.createMediaStreamDestination();
          
          const micSource = audioContext.createMediaStreamSource(micStream);
          micSource.connect(dest);
          
          const systemSource = audioContext.createMediaStreamSource(systemStream);
          systemSource.connect(dest);
          
          finalStream = dest.stream;
        } catch (err: any) {
          micStream.getTracks().forEach(t => t.stop());
          if (err.name === 'NotAllowedError') {
            setError("System audio capture was cancelled.");
          } else if (err.name === 'NotFoundError') {
            setError("No screen/window found to capture system audio.");
          } else {
            setError(err.message || "Failed to capture system audio.");
          }
          return;
        }
      }

      streamsRef.current = streams;
      const mediaRecorder = new MediaRecorder(finalStream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        
        // Cleanup all tracks
        streamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error("Error starting recording:", err);
      setError(err.message || "Could not start recording. Please check permissions and hardware.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAndSave = async () => {
    if (!audioBlob) return;
    if (!user && !meeting) return;

    setIsTranscribing(true);
    setError('');

    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64String = reader.result as string;
          resolve(base64String.split(',')[1]); // Remove data:audio/webm;base64,
        };
        reader.onerror = () => reject(new Error("Failed to read audio file."));
      });

      const base64Audio = await base64Promise;

      // Transcription with Gemini
      let transcriptText = "No transcript generated.";
      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error("Gemini API key is missing. Please check your environment variables.");
        }
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            {
              parts: [
                { text: "Please transcribe this audio recording accurately and translate it into English if it's in another language. Provide only the English transcript text." },
                { inlineData: { mimeType: "audio/webm", data: base64Audio } }
              ]
            }
          ]
        });

        transcriptText = response.text || "No transcript generated.";
      } catch (transcribeErr: any) {
        console.error("Transcription error:", transcribeErr);
        // We still want to save the recording even if transcription fails, 
        // but we should notify the user.
        setError("Transcription failed, but we are still saving your recording...");
      }
      
      setTranscript(transcriptText);

      // Save to Firestore
      const recordingId = uuidv4().slice(0, 8);
      const recordingDoc: RecordingData = {
        id: recordingId,
        audioData: base64Audio,
        transcript: transcriptText,
        createdAt: Timestamp.now(),
        // If guest recording in a meeting, attribute to meeting owner so it shows in their history
        authorUid: user ? user.uid : (meeting?.ownerUid || ''),
      };

      if (urlMeetingId) {
        recordingDoc.meetingId = urlMeetingId;
      }

      // Check size (Firestore limit is 1MB per document)
      const estimatedSize = JSON.stringify(recordingDoc).length;
      if (estimatedSize > 1000000) {
        throw new Error("Recording is too large to save. Please try a shorter recording (under 5-10 minutes).");
      }

      try {
        await setDoc(doc(db, 'recordings', recordingId), recordingDoc);
        const url = `${window.location.origin}/r/${recordingId}`;
        setShareUrl(url);
      } catch (saveErr: any) {
        handleFirestoreError(saveErr, OperationType.WRITE, `recordings/${recordingId}`);
      }
      
    } catch (err: any) {
      console.error("Transcription/Save error:", err);
      // If it's a JSON string from handleFirestoreError, we can parse it for better UI
      try {
        const errInfo = JSON.parse(err.message);
        if (errInfo.error.includes('insufficient permissions')) {
          setError("You don't have permission to save this recording. Please sign in.");
        } else {
          setError(`Failed to save recording: ${errInfo.error}`);
        }
      } catch {
        setError(err.message || "Failed to transcribe or save recording. Please try again.");
      }
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="text-center mb-12">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl font-sans font-bold tracking-tight mb-4"
        >
          {meeting ? meeting.title : "Capture your thoughts."}
        </motion.h1>
        <p className="text-zinc-500 text-lg">
          {meeting 
            ? "Anyone with this link can record into this meeting room." 
            : "Record audio and get instant transcripts with shareable links."}
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-black/5 shadow-xl p-10 flex flex-col items-center">
        {!user && !meeting ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="text-zinc-400" size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">Sign in to start recording</h3>
            <p className="text-zinc-500 mb-6">You need to be logged in to save and transcribe recordings.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-10 bg-zinc-50 p-2 rounded-2xl border border-zinc-100">
              <button 
                onClick={() => setIncludeSystemAudio(false)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${!includeSystemAudio ? 'bg-white shadow-sm text-black' : 'text-zinc-400'}`}
              >
                Mic Only
              </button>
              <button 
                onClick={() => setIncludeSystemAudio(true)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${includeSystemAudio ? 'bg-white shadow-sm text-black' : 'text-zinc-400'}`}
              >
                <Share2 size={14} />
                Mic + System
              </button>
            </div>

            <div className="relative mb-12">
              <AnimatePresence mode="wait">
                {isRecording && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.2, opacity: 0.2 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="absolute inset-0 bg-red-500 rounded-full"
                  />
                )}
              </AnimatePresence>
              
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                  isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-black hover:bg-zinc-800'
                }`}
              >
                {isRecording ? (
                  <Square className="text-white fill-white" size={32} />
                ) : (
                  <Mic className="text-white" size={32} />
                )}
              </button>
            </div>

            {isRecording && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-red-500 font-medium mb-8"
              >
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                Recording in progress...
              </motion.div>
            )}

            {audioBlob && !isRecording && !shareUrl && (
              <div className="flex flex-col items-center gap-6 w-full">
                <audio src={URL.createObjectURL(audioBlob)} controls className="w-full max-w-sm" />
                <button
                  onClick={transcribeAndSave}
                  disabled={isTranscribing}
                  className="w-full max-w-sm bg-black text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 disabled:bg-zinc-300 transition-all"
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Transcribing...
                    </>
                  ) : (
                    <>
                      <FileText size={20} />
                      Transcribe & Save
                    </>
                  )}
                </button>
              </div>
            )}

            {shareUrl && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full space-y-6"
              >
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3 text-emerald-700">
                  <CheckCircle2 size={20} />
                  <span className="font-medium">
                    {shareUrl.includes('/m/') ? "Meeting Link Created!" : "Recording saved successfully!"}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    {shareUrl.includes('/m/') ? "Meeting Room Link" : "Shareable Link"}
                  </label>
                  <div className="flex gap-2">
                    <input 
                      readOnly 
                      value={shareUrl} 
                      className="flex-1 bg-zinc-50 border border-zinc-200 px-4 py-3 rounded-xl text-sm font-mono"
                    />
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(shareUrl);
                      }}
                      className="p-3 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors"
                    >
                      <Copy size={20} />
                    </button>
                    <Link 
                      to={shareUrl.includes('/m/') ? `/m/${shareUrl.split('/').pop()}` : `/r/${shareUrl.split('/').pop()}`}
                      className="p-3 bg-black text-white hover:bg-zinc-800 rounded-xl transition-colors"
                    >
                      <ExternalLink size={20} />
                    </Link>
                  </div>
                </div>

                {!shareUrl.includes('/m/') && (
                  <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <h4 className="font-bold mb-2 flex items-center gap-2">
                      <FileText size={16} />
                      Transcript Preview
                    </h4>
                    <p className="text-zinc-600 text-sm leading-relaxed line-clamp-4 italic">
                      "{transcript}"
                    </p>
                  </div>
                )}

                <button 
                  onClick={() => {
                    setAudioBlob(null);
                    setShareUrl('');
                    setTranscript('');
                  }}
                  className="w-full text-zinc-400 text-sm hover:text-zinc-600 transition-colors"
                >
                  {shareUrl.includes('/m/') ? "Back to dashboard" : "Record another one"}
                </button>
              </motion.div>
            )}

            {!isRecording && !audioBlob && !shareUrl && user && !meeting && (
              <div className="mt-8 pt-8 border-t border-zinc-100 w-full flex flex-col items-center">
                <p className="text-zinc-400 text-sm mb-4">Want someone else to record for you?</p>
                <button
                  onClick={createMeeting}
                  disabled={isCreatingMeeting}
                  className="flex items-center gap-2 text-black font-bold hover:underline disabled:text-zinc-300"
                >
                  {isCreatingMeeting ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Share2 size={18} />
                  )}
                  Create a Meeting Link
                </button>
              </div>
            )}

            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 text-sm">
                <AlertCircle size={18} />
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
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
              Recorded on {recording.createdAt.toDate().toLocaleDateString()} at {recording.createdAt.toDate().toLocaleTimeString()}
            </p>
          </div>
          
          <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
            <audio 
              src={`data:audio/webm;base64,${recording.audioData}`} 
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
      where('authorUid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data() } as RecordingData));
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
                <div className="flex items-center gap-2">
                  <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    {rec.createdAt.toDate().toLocaleDateString()}
                  </div>
                  {rec.meetingId && (
                    <span className="bg-zinc-100 text-zinc-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">
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
      <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-black selection:text-white">
        <Navbar user={user} />
        <main>
          <Routes>
            <Route path="/" element={<Home user={user} />} />
            <Route path="/m/:meetingId" element={<Home user={user} />} />
            <Route path="/r/:id" element={<RecordingView />} />
            <Route path="/history" element={<HistoryView user={user} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
