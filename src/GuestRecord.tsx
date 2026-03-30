import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Mic, Square, Loader2, CheckCircle2, AlertCircle,
  Pause, Play, Clock, ShieldAlert, RotateCcw, Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import { uploadFileToGemini } from './utils/gemini';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';

const SAFETY_CHECK_SECONDS = (Number((import.meta as any).env.VITE_SAFETY_CHECK_DURATION_MINS) || 5) * 60;
const AUTO_SUBMIT_WINDOW = Number((import.meta as any).env.VITE_AUTO_SUBMIT_WINDOW_SECS) || 60;

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Animated waveform bars shown while recording
function WaveformBars({ active }: { active: boolean }) {
  const bars = [3, 5, 8, 5, 9, 4, 7, 6, 4, 8, 3, 6, 9, 5, 4];
  return (
    <div className="flex items-end gap-[3px] h-10">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full bg-gradient-to-t from-violet-500 to-fuchsia-400"
          animate={active ? {
            scaleY: [0.3, 1, 0.5, 0.9, 0.3],
            opacity: [0.5, 1, 0.7, 1, 0.5],
          } : { scaleY: 0.15, opacity: 0.2 }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.08,
            ease: 'easeInOut',
          }}
          style={{ height: `${h * 4}px`, transformOrigin: 'bottom' }}
        />
      ))}
    </div>
  );
}

export default function GuestRecord() {
  const { meetingId } = useParams();
  const [searchParams] = useSearchParams();
  const leadParam = searchParams.get('l');

  const [meeting, setMeeting] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [transcript, setTranscript] = useState('');
  const [recordId, setRecordId] = useState('');

  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showSafetyAlert, setShowSafetyAlert] = useState(false);
  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState(60);
  const autoSubmitRef = useRef(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const fetchMeeting = async () => {
      if (!meetingId) return;
      try {
        const docSnap = await getDoc(doc(db, 'meetings', meetingId));
        if (docSnap.exists()) setMeeting(docSnap.data());
        else setError('This link is invalid or has expired.');
      } catch {
        setError('Failed to load recording link.');
      } finally {
        setLoading(false);
      }
    };
    fetchMeeting();
  }, [meetingId]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      stopTimer();
      setShowSafetyAlert(false);
    }
  }, [stopTimer]);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRecordingSeconds(prev => {
        const next = prev + 1;
        // Trigger alert every 5 minutes (300, 600, 900...)
        if (next > 0 && next % SAFETY_CHECK_SECONDS === 0) {
          setShowSafetyAlert(true);
          setAutoSubmitCountdown(60);
        }
        return next;
      });

      // Handle auto-submit countdown if alert is shown
      setShowSafetyAlert(currentShow => {
        if (currentShow) {
          setAutoSubmitCountdown(prevCountdown => {
            if (prevCountdown <= 1) {
              // Time's up! Auto-submit
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

  // Re-usable transcription logic
  const performTranscription = useCallback(async (blob: Blob) => {
    if (!blob || !meeting) return;
    setIsTranscribing(true);
    setError('');
    try {
      const generatedId = uuidv4().slice(0, 8);
      const storageRef = ref(storage, `recordings/${generatedId}/audio.webm`);
      await uploadBytes(storageRef, blob);
      const audioUrl = await getDownloadURL(storageRef);

      let transcriptText = 'No transcript generated.';
      try {
        const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || '';
        if (apiKey) {
          const fileUri = await uploadFileToGemini(blob, apiKey);
          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ role: 'user', parts: [
              { text: 'Please transcribe this audio recording of a sales/lead call. Provide only the text.' },
              { fileData: { mimeType: blob.type || 'audio/webm', fileUri } },
            ]}],
          });
          transcriptText = response.text || 'No transcript generated.';
        }
      } catch (err: any) {
        setError('Transcription failed: ' + (err.message || 'Unknown error') + '. Saving audio anyway…');
      }

      const recordingDoc: any = {
        id: generatedId, audioUrl, transcript: transcriptText,
        createdAt: Timestamp.now(), companyId: meeting.companyId,
      };
      if (meetingId) recordingDoc.meetingId = meetingId;
      if (leadParam || meeting.leadId) recordingDoc.leadId = leadParam || meeting.leadId;

      await setDoc(doc(db, 'recordings', generatedId), recordingDoc);
      setTranscript(transcriptText);
      setRecordId(generatedId);
      setSuccess('Recording securely uploaded and dispatched to the lead owner!');
    } catch (err: any) {
      setError(err.message || 'Failed to save recording.');
    } finally {
      setIsTranscribing(false);
      autoSubmitRef.current = false;
    }
  }, [meeting, meetingId, leadParam]);

  const transcribeAndSave = () => {
    if (audioBlob) performTranscription(audioBlob);
  };

  const resetAll = () => {
    setRecordId(''); setAudioBlob(null); setTranscript('');
    setRecordingSeconds(0); setError('');
  };

  const startRecording = async () => {
    try {
      setError('');
      setRecordingSeconds(0);
      autoSubmitRef.current = false;
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error('Your browser does not support audio recording.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { audioBitsPerSecond: 64000 });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(t => t.stop());
        
        // If auto-submit was triggered, wait a tiny bit for state to settle then transcribe
        if (autoSubmitRef.current) {
          // Wrap in a function to ensure it uses the latest blob
          setTimeout(() => {
            performTranscription(blob);
          }, 100);
        }
      };
      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      startTimer();
    } catch (err: any) {
      setError(err.message || 'Could not start microphone.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      stopTimer();
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      startTimer();
    }
  };


  /* ─── Loading ─── */
  if (loading) return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#08090e]">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
        <Loader2 className="text-violet-500" size={40} />
      </motion.div>
    </div>
  );

  /* ─── Invalid link ─── */
  if (error && !meeting) return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#08090e] p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 border border-white/10 rounded-[2.5rem] p-12 text-center max-w-sm w-full backdrop-blur-xl">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="text-red-400" size={32} />
        </div>
        <h1 className="text-2xl font-black text-white mb-3 tracking-tight">Invalid Link</h1>
        <p className="text-white/40 font-medium leading-relaxed">{error}</p>
      </motion.div>
    </div>
  );

  if (!meeting) return null;

  /* ─── Main ─── */
  return (
    <div className="min-h-[100dvh] bg-[#08090e] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">

      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-fuchsia-600/8 rounded-full blur-[100px]" />
        <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-600/8 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <AnimatePresence mode="wait">

          {/* ── Success State ── */}
          {recordId ? (
            <motion.div key="success"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10 sm:p-12 text-center backdrop-blur-xl"
            >
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
                className="w-24 h-24 mx-auto mb-8 relative"
              >
                <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />
                <div className="relative w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/30">
                  <CheckCircle2 className="text-white" size={44} strokeWidth={2.5} />
                </div>
              </motion.div>

              <h1 className="text-3xl font-black text-white tracking-tight mb-3">Delivered! 🎉</h1>
              <p className="text-white/40 leading-relaxed mb-10 font-medium">{success}</p>

              <button onClick={resetAll}
                className="flex items-center gap-2 mx-auto px-6 py-3 rounded-2xl bg-white/8 hover:bg-white/12 border border-white/10 text-white/60 hover:text-white font-bold text-sm transition-all active:scale-95">
                <RotateCcw size={15} /> Record Another
              </button>
            </motion.div>

          ) : (
            /* ── Recording State ── */
            <motion.div key="record"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center"
            >
              {/* Header card */}
              <motion.div className="w-full bg-white/5 border border-white/8 rounded-[2.5rem] p-8 sm:p-10 mb-5 backdrop-blur-xl text-center">
                
                {/* Brand pill */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/15 border border-violet-500/20 mb-7">
                  <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                  <span className="text-[10px] font-black text-violet-300 uppercase tracking-[0.2em]">AudioCRM · Secure Recording</span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-3 leading-tight">
                  {meeting.title || 'Guest Recording'}
                </h1>
                <p className="text-white/35 text-sm font-medium leading-relaxed max-w-xs mx-auto">
                  Your response will be securely transcribed and attached to the client file.
                </p>
              </motion.div>

              {/* Recording card */}
              <div className="w-full bg-white/5 border border-white/8 rounded-[2.5rem] p-8 sm:p-10 backdrop-blur-xl flex flex-col items-center">

                {/* Timer */}
                <AnimatePresence>
                  {isRecording && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                      className="mb-8 flex flex-col items-center gap-3"
                    >
                      <span className={`font-mono text-5xl font-black tracking-tighter tabular-nums ${isPaused ? 'text-amber-400' : 'text-white'}`}>
                        {formatTime(recordingSeconds)}
                      </span>
                      {isPaused
                        ? <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-400/80 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Paused</span>
                        : <WaveformBars active={isRecording && !isPaused} />
                      }
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Big mic / stop button */}
                {!audioBlob && (
                  <div className="relative mb-8">
                    {/* Pulse rings */}
                    <AnimatePresence>
                      {isRecording && !isPaused && (
                        <>
                          {[1, 2, 3].map(i => (
                            <motion.div key={i}
                              className="absolute inset-0 rounded-full border border-violet-500/30"
                              initial={{ scale: 1, opacity: 0.6 }}
                              animate={{ scale: 1.6 + i * 0.4, opacity: 0 }}
                              transition={{ duration: 2, repeat: Infinity, delay: i * 0.5, ease: 'easeOut' }}
                            />
                          ))}
                        </>
                      )}
                    </AnimatePresence>

                    <motion.button
                      onClick={isRecording ? stopRecording : startRecording}
                      whileTap={{ scale: 0.93 }}
                      className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all z-10 shadow-2xl ${
                        isRecording
                          ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-600/30'
                          : 'bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-violet-600/30 hover:shadow-violet-600/50'
                      } ${isPaused ? 'opacity-70' : ''}`}
                    >
                      {isRecording
                        ? <Square className="text-white fill-white" size={36} />
                        : <Mic className="text-white fill-white" size={36} />
                      }
                    </motion.button>
                  </div>
                )}

                {/* Idle label */}
                {!isRecording && !audioBlob && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-white/25 text-xs font-bold uppercase tracking-[0.2em] mb-2">
                    Tap to begin
                  </motion.p>
                )}

                {/* Pause / Resume row */}
                <AnimatePresence>
                  {isRecording && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                      className="flex items-center gap-3"
                    >
                      {isPaused ? (
                        <button onClick={resumeRecording}
                          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-sm shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all active:scale-95">
                          <Play size={15} className="fill-white" /> Resume
                        </button>
                      ) : (
                        <button onClick={pauseRecording}
                          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-amber-300 font-black text-sm transition-all active:scale-95">
                          <Pause size={15} className="fill-current" /> Pause
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Audio preview + submit */}
                <AnimatePresence>
                  {audioBlob && !isRecording && (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="w-full flex flex-col gap-4"
                    >
                      {/* Duration badge */}
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Clock size={13} className="text-violet-400" />
                        <span className="text-xs font-black text-white/50 uppercase tracking-widest">
                          Duration: {formatTime(recordingSeconds)}
                        </span>
                      </div>

                      <audio
                        src={URL.createObjectURL(audioBlob)}
                        controls
                        className="w-full rounded-2xl overflow-hidden"
                        style={{ filter: 'invert(1) hue-rotate(180deg)' }}
                      />

                      <motion.button
                        onClick={transcribeAndSave}
                        disabled={isTranscribing}
                        whileTap={{ scale: 0.97 }}
                        className="w-full py-4 rounded-2xl font-black text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 shadow-xl shadow-violet-600/25 flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 text-sm tracking-wide"
                      >
                        {isTranscribing
                          ? <><Loader2 className="animate-spin" size={18} /> Transcribing…</>
                          : <><Upload size={18} /> Submit Recording</>
                        }
                      </motion.button>

                      <button onClick={resetAll}
                        className="flex items-center justify-center gap-2 text-white/25 hover:text-white/60 font-bold text-sm transition-colors py-1">
                        <RotateCcw size={14} /> Retake
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-6 w-full p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-red-400 text-sm font-medium">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer note */}
              <p className="mt-6 text-white/15 text-[11px] font-medium text-center">
                Powered by AudioCRM · End-to-end encrypted
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── 5-Minute Safety Alert ── */}
      <AnimatePresence>
        {showSafetyAlert && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md"
          >
            <motion.div
              initial={{ y: 60, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              className="bg-[#12141f] border border-white/10 rounded-[2rem] p-8 sm:p-10 w-full max-w-sm text-center shadow-2xl"
            >
              <motion.div
                animate={{ rotate: [0, -8, 8, -8, 0] }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="w-16 h-16 bg-amber-500/15 rounded-2xl flex items-center justify-center mx-auto mb-6"
              >
                <ShieldAlert className="text-amber-400" size={30} />
              </motion.div>

              <h2 className="text-xl font-black text-white mb-2 tracking-tight">Safety Check-In</h2>
              <p className="text-white/40 text-sm leading-relaxed mb-2">
                You've been recording for <span className="text-white font-bold">{Math.floor(recordingSeconds / 60)} minutes</span>.
              </p>
              <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-8">
                Auto-submitting in {autoSubmitCountdown}s...
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSafetyAlert(false)}
                  className="flex-1 py-3.5 rounded-2xl font-black text-sm bg-white/8 hover:bg-white/12 border border-white/10 text-white transition-all active:scale-95"
                >
                  Keep Going
                </button>
                <button
                  onClick={() => { stopRecording(); setShowSafetyAlert(false); }}
                  className="flex-1 py-3.5 rounded-2xl font-black text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition-all active:scale-95"
                >
                  Stop Now
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
