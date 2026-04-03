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
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [manualText, setManualText] = useState('');

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
      setError('Please select a client.');
      return;
    }
    if (!uploadFile && !manualText.trim()) {
      setError('Please upload a file or type some notes.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      let audioUrl = '';
      let finalTranscript = manualText.trim();
      const generatedId = uuidv4().slice(0, 8);

      // Upload to Storage if provided (Audio Only for now for playback, Docs just for AI)






      if (uploadFile && isAudio) {
        const storageRef = ref(storage, `recordings/${generatedId}/audio.webm`);
        await uploadBytes(storageRef, uploadFile);
        audioUrl = await getDownloadURL(storageRef);
      }

      let transcriptData = null;
      if (uploadFile && !finalTranscript) {
        const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY || '';
        if (apiKey) {
          const fileUri = await uploadFileToGemini(uploadFile, apiKey);
          const ai = new GoogleGenAI({ apiKey });
          let promptText = 'Transcribe this recording. Return a JSON object with a \'fullText\' string and a \'segments\' array. Each segment must be an object with \'text\', \'startTime\' (float), and \'endTime\' (float). Provide ONLY JSON.';
          if (isDoc) {
            promptText = `Read this ${isWord ? 'Word Document' : isPdf ? 'PDF' : 'Text-based Prompt'}. Extract all relevant call notes, objectives, and next steps. Return a JSON object with a 'fullText' string (the summary) and a 'segments' array (leave this empty []). Provide ONLY JSON.`;
          }

          const availableModelCandidates = [
            'gemini-2.0-mini',
            'gemini-2.0-flash',
            'gemini-2.0-flash-lite',
            'gemini-1.5-turbo',
            'gemini-1.5-flash',
            'gemini-1.0'
          ];

          const envModel = (import.meta as any).env.VITE_GEMINI_MODEL || (process.env as any).GEMINI_MODEL;
          const userModelList = envModel ? [envModel] : [];

          let listingModels: string[] = [];
          try {
            const listResult = await ai.models.list({});
            const candidateFromList = (listResult as any)?.models || (listResult as any)?.model || [];
            if (Array.isArray(candidateFromList)) {
              listingModels = candidateFromList.map((m: any) => (m?.name || m || '').toString()).filter(Boolean);
            }
          } catch (e) {
            console.warn('Could not retrieve model list from Gemini, continuing with default candidates.', e);
          }

          const modelCandidates = Array.from(new Set([
            ...userModelList,
            ...availableModelCandidates.filter(m => listingModels.length === 0 || listingModels.includes(m)),
            ...availableModelCandidates
          ]));

          let response: any = null;
          let usedModel: string | null = null;

          for (const model of modelCandidates) {
            try {
              response = await ai.models.generateContent({
                model,
                contents: [
                  {
                    role: 'user',
                    parts: [
                      { text: promptText },
                      {
                        fileData: {
                          mimeType: uploadFile.type || (isPdf ? 'application/pdf' : isWord ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : isTxt ? 'text/plain' : 'audio/webm'),
                          fileUri
                        }
                      }
                    ]
                  }
                ]
              });
              usedModel = model;
              console.log(`Transcription generated with model ${model}`);
              break;
            } catch (err: any) {
              const status = err?.status || err?.code;
              const message = (err?.message || '').toLowerCase();
              const retryConditions = [
                status === 429,
                message.includes('quota'),
                message.includes('too many requests'),
                message.includes('resource_exhausted'),
                status === 404,
                message.includes('not found'),
                message.includes('is not found')
              ];

              if (retryConditions.some(Boolean)) {
                console.warn(`Model ${model} unavailable/quota issue, trying next:`, err?.message || err);
                continue;
              }
              throw err;
            }
          }

          if (!response || !usedModel) {
            throw new Error('All Gemini models exhausted or unavailable. Please check billing/quota.');
          }

          // Robust parsing
          let rawText = "{}";
          const resAny = response as any;
          if (resAny.response?.text && typeof resAny.response.text === 'function') {
            rawText = resAny.response.text();
          } else if (resAny.text && typeof resAny.text === 'function') {
            rawText = resAny.text();
          } else if (resAny.response?.candidates?.[0]?.content?.parts?.[0]?.text) {
            rawText = resAny.response.candidates[0].content.parts[0].text;
          }

          const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          try {
            const parsed = JSON.parse(jsonStr);
            finalTranscript = String(parsed.fullText || 'No info extracted.');
            transcriptData = parsed.segments || [];
          } catch (e) {
            finalTranscript = String(rawText || 'No info extracted.');
          }
        }
      }

      if (!finalTranscript) finalTranscript = 'No notes provided.';

      const recordingDoc: any = {
        id: generatedId,
        audioUrl: audioUrl,
        transcript: finalTranscript,
        transcriptData,
        createdAt: Timestamp.now(),
        companyId: companyId,
        leadId: selectedLeadId,
        fileType: isDoc ? 'document' : 'audio'
      };

      await setDoc(doc(db, 'recordings', generatedId), recordingDoc);

      setSuccess(true);
      setTimeout(() => navigate('/history'), 2000);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save information.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAudio = uploadFile?.type.startsWith('audio/') || uploadFile?.name.match(/\.(mp3|wav|webm|ogg|m4a)$/i);
  const isPdf = uploadFile?.type === 'application/pdf' || uploadFile?.name.toLowerCase().endsWith('.pdf');
  const isWord = uploadFile?.type.includes('word') || uploadFile?.name.match(/\.(doc|docx)$/i);
  const isTxt = uploadFile?.type === 'text/plain' || uploadFile?.name.toLowerCase().endsWith('.txt');
  const isDoc = isPdf || isWord || isTxt;

  if (!user) return <div className="p-20 text-center text-slate-500 font-medium">Please sign in to add info.</div>;

  return (
    <div className="flex-1 bg-slate-50/50 p-4 md:p-8 lg:p-12 min-h-full">
      <div className="max-w-3xl mx-auto">

        <header className="mb-8 md:mb-12 text-center md:text-left space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm mb-2">
            <UploadCloud size={14} className="animate-pulse" /> Data Integration
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 leading-tight uppercase tracking-tight">Add Intelligence</h1>
          <p className="text-slate-500 font-medium max-w-2xl text-lg italic">
            Upload recordings, documents, or manual context for your leads.
          </p>
        </header>

        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-orange-50 rounded-[2.5rem] p-12 text-center border border-emerald-100 shadow-2xl shadow-emerald-900/10 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent pointer-events-none"></div>
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}
                className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-500/30"
              >
                <CheckCircle2 size={48} className="text-white" />
              </motion.div>
              <h2 className="text-3xl font-extrabold mb-3 text-black">Saved!</h2>
              <p className="text-slate-500 text-lg font-medium max-w-md mx-auto">The information has been successfully saved. Going to history...</p>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleSubmit}
              className="glass-card !rounded-[2.5rem] p-6 md:p-10 shadow-2xl border-white/40"
            >
              {error && (
                <div className="mb-8 p-4 rounded-2xl flex items-start gap-3 text-sm font-semibold bg-red-50 text-red-600 border border-red-100">
                  <AlertCircle size={20} className="shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <div className="space-y-8">
                {/* Lead Selection */}
                <div className="bg-white/50 rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">
                    <UserCircle size={18} className="text-indigo-500" />
                    Target Lead <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedLeadId}
                    onChange={e => setSelectedLeadId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-base font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-700 shadow-sm appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 7l5 5 5-5'/%3e%3c/svg%3e")`, backgroundPosition: `right 1rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                  >
                    <option value="" disabled>Select a Lead</option>
                    {leads.map(l => (
                      <option key={l.id} value={l.id}>{l.name} {l.company ? `— ${l.company}` : ''}</option>
                    ))}
                  </select>
                </div>

                {/* Upload Zones Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Audio Upload Zone */}
                  <div className={`relative flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-3xl transition-all group ${uploadFile && isAudio ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-200 bg-white/50 hover:border-indigo-400 hover:bg-white'}`}>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={e => {
                        const file = e.target.files?.[0] || null;
                        if (file) setUploadFile(file);
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all ${uploadFile && isAudio ? 'bg-indigo-600 shadow-lg shadow-indigo-500/30' : 'bg-slate-50 shadow-sm'}`}>
                      <FileAudio className={`w-7 h-7 ${uploadFile && isAudio ? 'text-white' : 'text-slate-400'}`} />
                    </div>
                    <div className="text-center">
                      <p className={`font-black text-xs uppercase tracking-widest mb-1 ${uploadFile && isAudio ? 'text-indigo-900' : 'text-slate-400'}`}>
                        {uploadFile && isAudio ? 'Audio Loaded' : 'Upload Audio'}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 tracking-tighter">
                        {uploadFile && isAudio ? uploadFile.name : 'MP3, WAV, WEBM'}
                      </p>
                    </div>
                  </div>

                  {/* Document Upload Zone */}
                  <div className={`relative flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-3xl transition-all group ${uploadFile && isDoc ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-200 bg-white/50 hover:border-indigo-400 hover:bg-white'}`}>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={e => {
                        const file = e.target.files?.[0] || null;
                        if (file) setUploadFile(file);
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all ${uploadFile && isDoc ? 'bg-indigo-600 shadow-lg shadow-indigo-500/30' : 'bg-slate-50 shadow-sm'}`}>
                      <FileText className={`w-7 h-7 ${uploadFile && isDoc ? 'text-white' : 'text-slate-400'}`} />
                    </div>
                    <div className="text-center">
                      <p className={`font-black text-xs uppercase tracking-widest mb-1 ${uploadFile && isDoc ? 'text-indigo-900' : 'text-slate-400'}`}>
                        {uploadFile && isDoc ? 'Doc Encrypted' : 'Upload File'}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 tracking-tighter">
                        {uploadFile && isDoc ? uploadFile.name : 'Word, PDF, TXT'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Manual Transcript Zone */}
                <div className="pt-4">
                  <div className="relative">
                    <div className="absolute top-5 left-5 text-slate-400 pointer-events-none">
                      <Sparkles size={18} className="text-indigo-500" />
                    </div>
                    <textarea
                      value={manualText}
                      onChange={e => setManualText(e.target.value)}
                      placeholder="Paste manual notes or context here..."
                      className="w-full min-h-[180px] bg-white border border-slate-200 rounded-[2rem] pl-14 pr-8 py-5 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none text-slate-700 placeholder:text-slate-400 leading-relaxed shadow-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="mt-10 pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-[9px] font-black text-slate-400 px-3 py-1 bg-slate-100 rounded-lg uppercase tracking-widest">Protocol validation required</span>
                <button
                  type="submit"
                  disabled={isSubmitting || isDemoMode}
                  className="w-full sm:w-auto btn-primary !px-12 !py-5"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <UploadCloud size={20} />}
                  <span>
                    {isSubmitting ? 'Integrating...' : isDemoMode ? 'Readonly Node' : 'Commit Intelligence'}
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
