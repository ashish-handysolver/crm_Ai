import React, { useState, useRef, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { v4 as uuidv4 } from 'uuid';
import { motion } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { UploadCloud, FileAudio, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ManualUpload({ user }: { user: any }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcriptText, setTranscriptText] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      query(collection(db, 'leads'), where('ownerUid', '==', user.uid)),
      (snap) => setLeads(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
      (err) => console.error(err)
    );
    return () => unsub();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId) {
      setError('Please select a client.');
      return;
    }
    if (!audioFile && !transcriptText.trim()) {
      setError('Please upload an audio file or manually paste a transcript.');
      return;
    }
    
    setError('');
    setIsSubmitting(true);

    try {
      let base64Audio = 'Tk9fQVVESU8='; // "NO_AUDIO" safely in base64
      let finalTranscript = transcriptText.trim();

      // Read audio file if provided
      if (audioFile) {
        const reader = new FileReader();
        reader.readAsDataURL(audioFile);
        base64Audio = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = () => reject(new Error('Failed to read audio file'));
        });
      }

      // If audio file but NO transcript -> Gemini
      if (audioFile && !finalTranscript) {
        const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY || '';
        if (apiKey) {
          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
              {
                parts: [
                  { text: 'Please transcribe this manually uploaded recording of a sales/lead call. Provide only the text.' },
                  { inlineData: { mimeType: audioFile.type || "audio/webm", data: base64Audio } }
                ]
              }
            ]
          });
          finalTranscript = response.text || 'No transcript generated.';
        } else {
          throw new Error("Cannot transcribe audio without Gemini API key. Please type a transcript manually.");
        }
      }

      if (!finalTranscript) finalTranscript = 'No explicit transcript/prompt was captured.';

      const generatedId = uuidv4().slice(0, 8);
      const recordingDoc: any = {
        id: generatedId,
        audioData: base64Audio,
        transcript: finalTranscript,
        createdAt: Timestamp.now(),
        authorUid: user.uid,
        leadId: selectedLeadId
      };

      await setDoc(doc(db, 'recordings', generatedId), recordingDoc);
      
      setSuccess(true);
      setTimeout(() => navigate('/reports'), 2000);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to upload and attach recording.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return <div className="p-20 text-center text-slate-500">Please sign in to upload recordings.</div>;

  return (
    <div className="flex-1 bg-[#f8fafc] p-8 md:p-12 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <header className="mb-10 text-center md:text-left">
          <div className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-1">Manual Entry</div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Upload Intelligence</h1>
          <p className="text-slate-500 mt-2 text-sm leading-relaxed">
            Upload an existing meeting audio file, manually paste a transcript/prompt, or both. We will process and attach it to your client's file.
          </p>
        </header>

        {success ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl p-12 text-center border border-emerald-100 shadow-xl shadow-emerald-900/5">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} className="text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-slate-800">Uploaded Successfully!</h2>
            <p className="text-slate-500">The intelligence has been safely stored. Redirecting to your reports...</p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-slate-900/5 border border-slate-100">
            {error && (
              <div className="mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-medium bg-red-50 text-red-700">
                <AlertCircle size={18} /> {error}
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Select Client/Lead *</label>
                <select 
                  value={selectedLeadId}
                  onChange={e => setSelectedLeadId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3b4256]/30 transition-all text-slate-700"
                >
                  <option value="" disabled>-- Choose a Lead --</option>
                  {leads.map(l => (
                    <option key={l.id} value={l.id}>{l.name} {l.company ? `(${l.company})` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Upload Audio <span className="text-slate-400 font-normal">(Optional)</span></label>
                  <div className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all ${audioFile ? 'border-[#3b4256] bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <input 
                      type="file" 
                      accept="audio/*" 
                      onChange={e => setAudioFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <FileAudio size={28} className={`mx-auto mb-2 ${audioFile ? 'text-[#3b4256]' : 'text-slate-300'}`} />
                    <span className={`text-sm font-semibold ${audioFile ? 'text-slate-700' : 'text-slate-500'}`}>
                      {audioFile ? audioFile.name : 'Click to bind file'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Manual Transcript / Prompt <span className="text-slate-400 font-normal">(Optional)</span></label>
                  <textarea 
                    value={transcriptText}
                    onChange={e => setTranscriptText(e.target.value)}
                    placeholder="Paste the transcription or type meeting notes here..."
                    className="w-full h-32 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3b4256]/30 transition-all resize-none text-slate-700 placeholder:text-slate-400 leading-relaxed"
                  />
                </div>
              </div>
            </div>

            <div className="mt-10 pt-8 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">* Requires at least one (Audio or Text)</span>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#3b4256] text-white px-8 py-3.5 rounded-xl font-bold hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:scale-100 shadow-xl shadow-slate-900/10"
              >
                {isSubmitting ? <><Loader2 className="animate-spin" size={18} /> Processing...</> : <><UploadCloud size={18} /> Upload Now</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
