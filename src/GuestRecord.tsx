import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Mic, Square, Loader2, CheckCircle2, AlertCircle,
  Pause, Play, Clock, ShieldAlert, RotateCcw, Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import { uploadFileToGemini, getGeminiApiKey, GEMINI_FALLBACK_MESSAGE } from './utils/gemini';
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [includeSystemAudio, setIncludeSystemAudio] = useState(true);
  const [systemAudioStatus, setSystemAudioStatus] = useState('');

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
      let transcriptData = null;
      try {
        const apiKey = getGeminiApiKey();
        if (apiKey) {
          const fileUri = await uploadFileToGemini(blob, apiKey);
          const genAI = new GoogleGenAI({ apiKey });
          const validModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];

          let success = false;
          for (const modelName of validModels) {
            try {
              console.log(`Attempting transcription with model: ${modelName}`);

              const model = genAI.getGenerativeModel({ 
                model: modelName,
                generationConfig: {
                  maxOutputTokens: 250000,
                  responseMimeType: "application/json"
                }
              });

              const prompt = "Transcribe this audio recording. Return a JSON object with a 'fullText' string and a 'segments' array. Each segment must be an object with 'text', 'startTime' (float), and 'endTime' (float). Provide ONLY the raw JSON.";

              const result = await model.generateContent([
                { text: prompt },
                { fileData: { mimeType: blob.type || "audio/webm", fileUri } }
              ]);

              const response = await result.response;
              const rawText = response.text() || "{}";
              const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
              try {
                const parsed = JSON.parse(jsonStr);
                transcriptText = parsed.fullText || 'No transcript generated.';
                transcriptData = parsed.segments || [];
              } catch (e) {
                console.error("JSON Parse Error on Transcript:", e);
                transcriptText = rawText;
              }
              success = true;
              break;
            } catch (err: any) {
              const status = err?.status || err?.code;
              if (status === 429) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                continue;
              } else if (status === 404) {
                continue;
              }
              console.warn(`Model ${modelName} failed, trying next…`, err);
            }
          }
          if (!success) {
            console.warn("Guest transcription models exhausted.");
            alert(GEMINI_FALLBACK_MESSAGE);
            transcriptText = "Intelligence services temporarily unavailable. The recording is saved and ready for review.";
          }
        }
      } catch (err: any) {
        console.warn("Guest processing failed", err);
        if (err?.status === 429 || err?.message?.toLowerCase().includes('quota')) {
          alert(GEMINI_FALLBACK_MESSAGE);
        }
      }

      const recordingDoc: any = {
        id: generatedId, audioUrl, transcript: transcriptText, transcriptData,
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
      setSystemAudioStatus('');
      setRecordingSeconds(0);
      autoSubmitRef.current = false;
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error('Your browser does not support audio recording.');

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let finalStream: MediaStream = micStream;
      const streams: MediaStream[] = [micStream];

      if (includeSystemAudio && navigator.mediaDevices?.getDisplayMedia) {
        try {
          const isChromium = !!(window as any).chrome || /chrom(e|ium)/.test(navigator.userAgent.toLowerCase());
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

          const sysStream = await navigator.mediaDevices.getDisplayMedia(displayConstraints);

          if (sysStream && sysStream.getAudioTracks().length > 0) {
            streams.push(sysStream);
            const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;
            if (ctx.state === 'suspended') await ctx.resume();
            const dest = ctx.createMediaStreamDestination();
            ctx.createMediaStreamSource(micStream).connect(dest);
            ctx.createMediaStreamSource(sysStream).connect(dest);
            finalStream = dest.stream;
            setSystemAudioStatus('System audio enabled via screen capture.');
          } else {
            if (sysStream) sysStream.getTracks().forEach(t => t.stop());
            setSystemAudioStatus('System audio not shared. Recording microphone only.');
          }
        } catch (err: any) {
          setSystemAudioStatus(`System audio capture failed: ${(err && err.message) || 'likely denied by user'}`);
        }
      }

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
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        streams.forEach(s => s.getTracks().forEach(t => t.stop()));
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        if (autoSubmitRef.current) {
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
    if (mediaRecorderRef.current && isRecording && isPaused) {
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


  /* ─── Loading ─── */
  if (loading) return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[var(--crm-bg)]">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
        <Loader2 className="text-indigo-500" size={40} />
      </motion.div>
    </div>
  );

  /* ─── Invalid link ─── */
  if (error && !meeting) return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[var(--crm-bg)] p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--crm-card-bg)] border border-[var(--crm-border)] rounded-[2.5rem] p-12 text-center max-w-sm w-full backdrop-blur-xl">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="text-red-400" size={32} />
        </div>
        <h1 className="text-2xl font-black text-[var(--crm-text)] mb-3 tracking-tight">Invalid Link</h1>
        <p className="text-[var(--crm-text-muted)] font-medium leading-relaxed">{error}</p>
      </motion.div>
    </div>
  );

  if (!meeting) return null;

  /* ─── Main ─── */
  return (
    <div className="min-h-[100dvh] bg-[var(--crm-bg)] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">

      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px]" />
        <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <AnimatePresence mode="wait">

          {/* ── Success State ── */}
          {recordId ? (
            <motion.div key="success"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[var(--crm-card-bg)] border border-[var(--crm-border)] rounded-[2.5rem] p-10 sm:p-12 text-center backdrop-blur-xl"
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

              <h1 className="text-3xl font-black text-[var(--crm-text)] tracking-tight mb-3">Delivered! 🎉</h1>
              <p className="text-[var(--crm-text-muted)] leading-relaxed mb-10 font-medium">{success}</p>

              <button onClick={resetAll}
                className="flex items-center gap-2 mx-auto px-6 py-3 rounded-2xl bg-[var(--crm-bg)]/20 hover:bg-[var(--crm-bg)]/40 border border-[var(--crm-border)] text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] font-bold text-sm transition-all active:scale-95">
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
              <motion.div className="w-full bg-[var(--crm-card-bg)] border border-[var(--crm-border)] rounded-[2.5rem] p-8 sm:p-10 mb-5 backdrop-blur-xl text-center shadow-xl">

                {/* Brand pill */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/15 border border-indigo-500/20 mb-7">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em]">AudioCRM · Secure Recording</span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-[var(--crm-text)] tracking-tight mb-3 leading-tight">
                  {meeting.title || 'Guest Recording'}
                </h1>
                <p className="text-[var(--crm-text-muted)] text-sm font-medium leading-relaxed max-w-xs mx-auto">
                  Your response will be securely transcribed and attached to the client file.
                </p>
                <div className="mt-4 mb-2 flex items-center justify-center gap-2 text-xs text-[var(--crm-text-muted)]">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeSystemAudio}
                      onChange={(e) => setIncludeSystemAudio(e.target.checked)}
                      className="accent-indigo-500"
                    />
                    Include system audio (screen share)
                  </label>
                </div>
                {systemAudioStatus && (
                  <div className="text-xs text-slate-400 mb-3">{systemAudioStatus}</div>
                )}
              </motion.div>

              {/* Recording card */}
              <div className="w-full bg-[var(--crm-card-bg)] border border-[var(--crm-border)] rounded-[2.5rem] p-8 sm:p-10 backdrop-blur-xl flex flex-col items-center shadow-xl">

                {/* Timer */}
                <AnimatePresence>
                  {isRecording && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                      className="mb-8 flex flex-col items-center gap-3"
                    >
                      <span className={`font-mono text-5xl font-black tracking-tighter tabular-nums ${isPaused ? 'text-amber-400' : 'text-[var(--crm-text)]'}`}>
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
                              className="absolute inset-0 rounded-full border border-indigo-500/30"
                              initial={{ scale: 1, opacity: 0.6 }}
                              animate={{ scale: 1.6 + i * 0.4, opacity: 0 }}
                              transition={{ duration: 2, repeat: Infinity, delay: i * 0.5, ease: 'easeOut' }}
                            />
                          ))}
                        </>
                      )}
                    </AnimatePresence>

                    <motion.button
                      onClick={isPaused ? resumeRecording : isRecording ? stopRecording : startRecording}
                      whileTap={{ scale: 0.93 }}
                      className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all z-10 shadow-2xl ${isRecording
                        ? 'bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-500/30 hover:shadow-rose-500/50'
                        : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/30 hover:shadow-indigo-500/50'
                        } ${isPaused ? 'opacity-70' : ''}`}
                    >
                      {isPaused
                        ? <Play className="text-white fill-white" size={36} />
                        : isRecording
                          ? <Square className="text-white fill-white" size={36} />
                          : <Mic className="text-white fill-white" size={36} />
                      }
                    </motion.button>
                  </div>
                )}

                {/* Idle label */}
                {!isRecording && !audioBlob && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-[var(--crm-text-muted)] text-xs font-bold uppercase tracking-[0.2em] mb-2">
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
                        <Clock size={13} className="text-indigo-400" />
                        <span className="text-xs font-black text-[var(--crm-text-muted)] uppercase tracking-widest">
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
                        className="w-full py-4 rounded-2xl font-black text-white bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 text-sm tracking-wide"
                      >
                        {isTranscribing
                          ? <><Loader2 className="animate-spin" size={18} /> Transcribing…</>
                          : <><Upload size={18} /> Submit Recording</>
                        }
                      </motion.button>

                      <button onClick={resetAll}
                        className="flex items-center justify-center gap-2 text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] font-bold text-sm transition-colors py-1">
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
              <p className="mt-6 text-[var(--crm-text-muted)] text-[11px] font-medium text-center">
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
              className="bg-[var(--crm-card-bg)] border border-[var(--crm-border)] rounded-[2rem] p-8 sm:p-10 w-full max-w-sm text-center shadow-2xl"
            >
              <motion.div
                animate={{ rotate: [0, -8, 8, -8, 0] }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="w-16 h-16 bg-amber-500/15 rounded-2xl flex items-center justify-center mx-auto mb-6"
              >
                <ShieldAlert className="text-amber-400" size={30} />
              </motion.div>

              <h2 className="text-xl font-black text-[var(--crm-text)] mb-2 tracking-tight">Safety Check-In</h2>
              <p className="text-[var(--crm-text-muted)] text-sm leading-relaxed mb-2">
                You've been recording for <span className="text-[var(--crm-text)] font-bold">{Math.floor(recordingSeconds / 60)} minutes</span>.
              </p>
              <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-8">
                Auto-submitting in {autoSubmitCountdown}s...
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSafetyAlert(false)}
                  className="flex-1 py-3.5 rounded-2xl font-black text-sm bg-[var(--crm-bg)]/20 hover:bg-[var(--crm-bg)]/40 border border-[var(--crm-border)] text-[var(--crm-text)] transition-all active:scale-95"
                >
                  Keep Going
                </button>
                <button
                  onClick={() => { stopRecording(); setShowSafetyAlert(false); }}
                  className="flex-1 py-3.5 rounded-2xl font-black text-sm bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/20 transition-all active:scale-95"
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
