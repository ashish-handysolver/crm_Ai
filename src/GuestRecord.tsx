import React, { useState, useRef, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Mic, Square, Loader2, CheckCircle2, AlertCircle, Copy, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

export default function GuestRecord() {
  const { meetingId } = useParams();
  const [searchParams] = useSearchParams();
  const leadParam = searchParams.get('l');
  
  const [meeting, setMeeting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [transcript, setTranscript] = useState('');
  const [recordId, setRecordId] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const fetchMeeting = async () => {
      if (!meetingId) return;
      try {
        const docSnap = await getDoc(doc(db, 'meetings', meetingId));
        if (docSnap.exists()) {
          setMeeting(docSnap.data());
        } else {
          setError("This link is invalid or has expired.");
        }
      } catch (err) {
        console.error("Error fetching link:", err);
        setError("Failed to load recording link.");
      } finally {
        setLoading(false);
      }
    };
    fetchMeeting();
  }, [meetingId]);

  const startRecording = async () => {
    try {
      setError('');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser does not support audio recording.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Could not start microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAndSave = async () => {
    if (!audioBlob || !meeting) return;
    setIsTranscribing(true);
    setError('');

    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          resolve(res.split(',')[1]);
        };
        reader.onerror = () => reject(new Error("Failed to read audio file"));
      });
      const base64Audio = await base64Promise;

      let transcriptText = "No transcript generated.";
      try {
        const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY || '';
        if (apiKey) {
          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
              {
                parts: [
                  { text: "Please transcribe this audio recording of a sales/lead call. Provide only the text." },
                  { inlineData: { mimeType: "audio/webm", data: base64Audio } }
                ]
              }
            ]
          });
          transcriptText = response.text || "No transcript generated.";
        }
      } catch (err) {
        console.warn("Transcription failed", err);
        setError("Transcription failed, but saving audio anyway...");
      }

      const generatedId = uuidv4().slice(0, 8);
      const recordingDoc: any = {
        id: generatedId,
        audioData: base64Audio,
        transcript: transcriptText,
        createdAt: Timestamp.now(),
        authorUid: meeting.ownerUid
      };
      // Only append what is available to satisfy strict schema validation on the cloud
      if (meetingId) recordingDoc.meetingId = meetingId;
      if (leadParam || meeting.leadId) recordingDoc.leadId = leadParam || meeting.leadId;

      await setDoc(doc(db, 'recordings', generatedId), recordingDoc);
      setTranscript(transcriptText);
      setRecordId(generatedId);
      setSuccess("Recording securely uploaded and dispatched to the lead owner!");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to save recording.");
    } finally {
      setIsTranscribing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-zinc-50">
        <Loader2 className="animate-spin text-zinc-300" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-50 flex items-center justify-center p-6">
      <div className="max-w-xl w-full">
        {error && !meeting && (
          <div className="bg-white rounded-3xl p-10 text-center shadow-xl border border-black/5">
            <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Invalid Link</h1>
            <p className="text-zinc-500 mb-6">{error}</p>
          </div>
        )}

        {meeting && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[2.5rem] p-10 shadow-2xl border border-black/5 text-center flex flex-col items-center"
          >
            {!recordId ? (
              <>
                <div className="w-16 h-16 bg-zinc-100/80 rounded-2xl flex items-center justify-center mb-6">
                  <Mic className="text-zinc-600" size={28} />
                </div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">
                  {meeting.title || "Guest Recording"}
                </h1>
                <p className="text-zinc-500 mb-10 w-4/5 mx-auto leading-relaxed">
                  Record your audio response. This will be securely transcribed and attached directly to your client file.
                </p>

                <div className="relative mb-10">
                  <AnimatePresence mode="wait">
                    {isRecording && (
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1.3, opacity: 0.15 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="absolute inset-0 bg-red-500 rounded-full blur-md"
                      />
                    )}
                  </AnimatePresence>
                  
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all z-10 ${
                      isRecording ? 'bg-red-500 hover:bg-red-600 scale-105 shadow-xl shadow-red-500/20' : 'bg-[#3b4256] hover:bg-slate-800 shadow-xl shadow-slate-900/10'
                    }`}
                  >
                    {isRecording ? <Square className="text-white fill-current" size={32} /> : <Mic className="text-white fill-current" size={32} />}
                  </button>
                </div>

                {isRecording && (
                  <div className="flex items-center justify-center gap-2 text-red-500 font-bold animate-pulse mb-4 tracking-widest text-sm uppercase">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    Recording
                  </div>
                )}

                {audioBlob && !isRecording && (
                  <div className="w-full flex flex-col items-center gap-6 mt-4">
                    <audio src={URL.createObjectURL(audioBlob)} controls className="w-full border border-zinc-100 rounded-xl" />
                    <button
                      onClick={transcribeAndSave}
                      disabled={isTranscribing}
                      className="w-full bg-[#3b4256] hover:bg-slate-800 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {isTranscribing ? <><Loader2 className="animate-spin" size={18} /> Processing...</> : <><CheckCircle2 size={18} /> Submit Recording</>}
                    </button>
                    <button onClick={() => setAudioBlob(null)} className="text-sm font-bold text-zinc-400 hover:text-zinc-700">
                      Retake
                    </button>
                  </div>
                )}

                {error && <div className="mt-6 text-red-500 text-sm font-medium">{error}</div>}
              </>
            ) : (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center w-full">
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 border-4 border-white shadow-xl">
                  <CheckCircle2 className="text-emerald-500" size={40} />
                </div>
                <h1 className="text-2xl font-bold mb-2 text-slate-800">Recording Delivered</h1>
                <p className="text-slate-500 mb-8 w-4/5 leading-relaxed">{success}</p>
                <button
                   onClick={() => { setRecordId(''); setAudioBlob(null); setTranscript(''); }}
                   className="font-bold text-slate-400 hover:text-slate-800 transition-colors"
                >
                  Record another
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
