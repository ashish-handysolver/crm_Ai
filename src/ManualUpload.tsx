import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, Timestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { uploadFileToGemini } from './utils/gemini';
import { db, storage } from './firebase';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { UploadCloud, FileAudio, FileText, Loader2, CheckCircle2, AlertCircle, Sparkles, UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useDemo } from './DemoContext';
import { Eye } from 'lucide-react';

export default function ManualUpload({ user }: { user: any }) {
  const { companyId } = useAuth();
  const { isDemoMode, demoData } = useDemo();
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcriptText, setTranscriptText] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isDemoMode) {
      setLeads(demoData.leads);
      return;
    }
    if (!companyId) return;
    const unsub = onSnapshot(
      query(collection(db, 'leads'), where('companyId', '==', companyId)),
      (snap) => setLeads(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
      (err) => console.error(err)
    );
    return () => unsub();
  }, [user, companyId, isDemoMode, demoData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId) {
      setError('Please select a client to bind this intelligence to.');
      return;
    }
    if (!audioFile && !transcriptText.trim()) {
      setError('Please upload an audio file or manually paste a transcript/prompt.');
      return;
    }
    
    setError('');
    setIsSubmitting(true);

    try {
      let audioUrl = '';
      let finalTranscript = transcriptText.trim();
      const generatedId = uuidv4().slice(0, 8);

      // Upload audio to Storage if provided
      if (audioFile) {
        const storageRef = ref(storage, `recordings/${generatedId}/audio.webm`);
        await uploadBytes(storageRef, audioFile);
        audioUrl = await getDownloadURL(storageRef);
      }

      // If audio file but NO transcript -> Gemini (using File API)
      let transcriptData = null;
      if (audioFile && !finalTranscript) {
        const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY || '';
        if (apiKey) {
          const fileUri = await uploadFileToGemini(audioFile, apiKey);
          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({
            model: "gemini-2.0-flash-lite",
            config: {
              responseMimeType: "application/json",
            },
            contents: [
              {
                role: 'user',
                parts: [
                  { text: 'Transcribe this manually uploaded recording of a sales/lead call. Return a JSON object with a \'fullText\' string and a \'segments\' array. Each segment must be an object with \'text\', \'startTime\' (float), and \'endTime\' (float). Provide ONLY the raw JSON string.' },
                  { fileData: { mimeType: audioFile.type || "audio/webm", fileUri } }
                ]
              }
            ]
          });

          // Robust parsing for unified SDK
          let rawText = "{}";
          const resAny = response as any;
          if (resAny.text && typeof resAny.text === 'string') {
            rawText = resAny.text;
          } else if (resAny.text && typeof resAny.text === 'function') {
            rawText = resAny.text();
          } else if (resAny.response?.text && typeof resAny.response.text === 'function') {
            rawText = resAny.response.text();
          } else if (resAny.response?.candidates?.[0]?.content?.parts?.[0]?.text) {
            rawText = resAny.response.candidates[0].content.parts[0].text;
          }

          const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          try {
            const parsed = JSON.parse(jsonStr);
            finalTranscript = String(parsed.fullText || 'No transcript generated.');
            transcriptData = parsed.segments || [];
          } catch (e) {
            console.error("JSON Parse Error on Transcript:", e);
            finalTranscript = String(rawText || 'No transcript generated.');
          }
        } else {
          throw new Error("Cannot transcribe audio without Gemini API key. Please type a transcript manually.");
        }
      }

      if (!finalTranscript) finalTranscript = 'No explicit transcript/prompt was captured.';

      const recordingDoc: any = {
        id: generatedId,
        audioUrl: audioUrl,
        transcript: finalTranscript,
        transcriptData,
        createdAt: Timestamp.now(),
        companyId: companyId,
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

  if (!user) return <div className="p-20 text-center text-slate-500 font-medium">Please sign in to upload intelligence.</div>;

  return (
    <div className="flex-1 bg-slate-50 p-4 md:p-8 lg:p-12 min-h-full">
      <div className="max-w-3xl mx-auto">
        
        <header className="mb-8 md:mb-12 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-100/50 text-indigo-600 text-xs font-bold uppercase tracking-widest mb-4">
            <Sparkles size={14} />
            Manual Entry
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 mb-3">Upload Intelligence</h1>
          <p className="text-slate-500 text-base leading-relaxed max-w-2xl">
            Securely upload an existing meeting audio file or paste a raw transcript limitlessly. We will process and bind it directly to the designated client.
          </p>
        </header>

        <AnimatePresence mode="wait">
          {success ? (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              className="bg-white rounded-[2.5rem] p-12 text-center border border-emerald-100 shadow-2xl shadow-emerald-900/10 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent pointer-events-none"></div>
              <motion.div 
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}
                className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-500/30"
              >
                <CheckCircle2 size={48} className="text-white" />
              </motion.div>
              <h2 className="text-3xl font-extrabold mb-3 text-slate-900">Intelligence Bound!</h2>
              <p className="text-slate-500 text-lg font-medium max-w-md mx-auto">The intelligence has been safely encrypted and stored. Redirecting you to reports...</p>
            </motion.div>
          ) : (
            <motion.form 
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleSubmit} 
              className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-6 md:p-10 shadow-2xl shadow-slate-200/50 border border-white"
            >
              {error && (
                <div className="mb-8 p-4 rounded-2xl flex items-start gap-3 text-sm font-semibold bg-red-50 text-red-600 border border-red-100">
                  <AlertCircle size={20} className="shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <div className="space-y-8">
                {/* Lead Selection */}
                <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100">
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-3 ml-1">
                    <UserCircle size={18} className="text-indigo-500" />
                    Target Client / Lead <span className="text-red-500">*</span>
                  </label>
                  <select 
                    value={selectedLeadId}
                    onChange={e => setSelectedLeadId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-base font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-700 shadow-sm appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 7l5 5 5-5'/%3e%3c/svg%3e")`, backgroundPosition: `right 1rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                  >
                    <option value="" disabled>-- Bind to a specific Lead --</option>
                    {leads.map(l => (
                      <option key={l.id} value={l.id}>{l.name} {l.company ? `— ${l.company}` : ''}</option>
                    ))}
                  </select>
                </div>

                {/* File & Text Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* File Upload Zone */}
                  <div className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-3xl transition-all group ${audioFile ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 bg-slate-50 hover:border-indigo-400 hover:bg-slate-50'}`}>
                    <input 
                      type="file" 
                      accept="audio/*" 
                      onChange={e => setAudioFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all ${audioFile ? 'bg-indigo-600 shadow-lg shadow-indigo-500/30' : 'bg-white shadow-sm group-hover:bg-indigo-50'}`}>
                      <FileAudio className={`w-8 h-8 ${audioFile ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                    </div>
                    <div className="text-center">
                      <p className={`font-bold text-lg mb-1 ${audioFile ? 'text-indigo-900' : 'text-slate-700'}`}>
                        {audioFile ? 'Audio Selected' : 'Upload Audio File'}
                      </p>
                      <p className={`text-sm font-medium ${audioFile ? 'text-indigo-600/80' : 'text-slate-400'}`}>
                        {audioFile ? audioFile.name : 'Drag & drop or browse (Optional)'}
                      </p>
                    </div>
                  </div>

                  {/* Manual Transcript Zone */}
                  <div>
                    <div className="relative h-full flex flex-col">
                      <div className="absolute top-4 left-4 text-slate-400 pointer-events-none">
                        <FileText size={20} />
                      </div>
                      <textarea 
                        value={transcriptText}
                        onChange={e => setTranscriptText(e.target.value)}
                        placeholder="Or paste the transcription/meeting notes here... (Optional)"
                        className="w-full h-full min-h-[220px] bg-slate-50 border border-slate-200 rounded-3xl pl-12 pr-6 py-4 text-sm font-medium focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none text-slate-700 placeholder:text-slate-400 leading-relaxed shadow-inner"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="mt-10 pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs font-bold text-slate-400 px-2 py-1 bg-slate-100 rounded-md">At least ONE input (Audio or Text) is required</span>
                <button
                  type="submit"
                  disabled={isSubmitting || isDemoMode}
                  className="w-full sm:w-auto relative overflow-hidden flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-10 py-4 rounded-2xl font-bold hover:shadow-lg hover:shadow-indigo-500/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 group"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                  {isSubmitting ? <Loader2 className="animate-spin relative z-10" size={20} /> : isDemoMode ? <Eye className="relative z-10" size={20} /> : <UploadCloud className="relative z-10" size={20} />}
                  <span className="relative z-10">
                    {isSubmitting ? 'Processing & Analyzing...' : isDemoMode ? 'Readonly Demo Mode' : 'Bind Intelligence'}
                  </span>
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
