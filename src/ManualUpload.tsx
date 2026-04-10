import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, Timestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { uploadFileToGemini, getGeminiApiKey } from './utils/gemini';
import { db, storage } from './firebase';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { UploadCloud, FileAudio, FileText, Loader2, CheckCircle2, AlertCircle, Sparkles, UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useDemo } from './DemoContext';
import { Eye } from 'lucide-react';
import SearchableSelect from './components/SearchableSelect';

export default function ManualUpload({ user }: { user: any }) {
  const { companyId, role } = useAuth();
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
      (snap) => {
        const allLeads = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const filtered = role === 'team_member'
          ? allLeads.filter((l: any) => l.assignedTo === user.uid || l.authorUid === user.uid)
          : allLeads;
        setLeads(filtered);
      },
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

      const isAudio = uploadFile?.type.startsWith('audio/') || uploadFile?.name.match(/\.(mp3|wav|m4a|webm|ogg)$/i);
      const isPdf = uploadFile?.type === 'application/pdf' || uploadFile?.name.endsWith('.pdf');
      const isWord = uploadFile?.type.includes('word') || uploadFile?.name.match(/\.(doc|docx)$/i);
      const isTxt = uploadFile?.type === 'text/plain' || uploadFile?.name.endsWith('.txt');
      const isDoc = isPdf || isWord || isTxt;

      if (uploadFile && isAudio) {
        const storageRef = ref(storage, `recordings/${generatedId}/audio.webm`);
        await uploadBytes(storageRef, uploadFile);
        audioUrl = await getDownloadURL(storageRef);
      }

      let transcriptData = null;
      if (uploadFile && !finalTranscript) {
        const apiKey = getGeminiApiKey();

        if (!apiKey) {
          throw new Error("Gemini API Key is missing. Please set VITE_GEMINI_API_KEY in your Vercel environment variables.");
        }

        if (apiKey) {
          const fileUri = await uploadFileToGemini(uploadFile, apiKey);
          const genAI = new GoogleGenAI({ apiKey });
          let promptText = 'Transcribe this recording. Return a JSON object with a \'fullText\' string and a \'segments\' array. Each segment must be an object with \'text\', \'startTime\' (float), and \'endTime\' (float). Provide ONLY JSON.';
          if (isDoc) {
            promptText = `Read this ${isWord ? 'Word Document' : isPdf ? 'PDF' : 'Text-based Prompt'}. Extract all relevant call notes, objectives, and next steps. Return a JSON object with a 'fullText' string (the summary) and a 'segments' array (leave this empty []). Provide ONLY JSON.`;
          }

          const validModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];

          let success = false;
          let rawText = "{}";

          for (const modelName of validModels) {
            try {
              console.log(`Attempting extraction with model: ${modelName}`);
              const model = genAI.getGenerativeModel({ 
                model: modelName,
                generationConfig: {
                  maxOutputTokens: 8192,
                  responseMimeType: "application/json"
                }
              });

              const result = await model.generateContent([
                { text: promptText },
                {
                  fileData: {
                    mimeType: uploadFile.type || (isPdf ? 'application/pdf' : isWord ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : isTxt ? 'text/plain' : 'audio/webm'),
                    fileUri
                  }
                }
              ]);
              const res = await result.response;
              rawText = res.text() || "{}";
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
            throw new Error('All Gemini models exhausted or unavailable.');
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
    <div className="flex-1 bg-transparent p-4 md:p-8 lg:p-12 min-h-full">
      <div className="max-w-3xl mx-auto">

        <header className="mb-8 md:mb-12 text-center md:text-left space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm mb-2">
            <UploadCloud size={14} className="animate-pulse" /> Data Integration
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[var(--crm-text)] leading-tight uppercase tracking-tight">Add Audio / Docs / Text</h1>
          <p className="text-[var(--crm-text-muted)] font-medium max-w-2xl text-lg italic">
            Upload recordings, documents, or manual context for your leads.
          </p>
        </header>

        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="glass-card !bg-[var(--crm-card-bg)] !border-[var(--crm-border)] rounded-[2.5rem] p-12 text-center shadow-2xl relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/5 to-transparent pointer-events-none"></div>
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}
                className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-500/20"
              >
                <CheckCircle2 size={48} className="text-white" />
              </motion.div>
              <h2 className="text-3xl font-extrabold mb-3 text-[var(--crm-text)]">Saved!</h2>
              <p className="text-[var(--crm-text-muted)] text-lg font-medium max-w-md mx-auto">The information has been successfully saved. Going to history...</p>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleSubmit}
              className="glass-card !bg-[var(--crm-card-bg)] !border-[var(--crm-border)] !rounded-[2.5rem] p-6 md:p-10 shadow-2xl relative overflow-hidden"
            >
              {error && (
                <div className="mb-8 p-4 rounded-2xl flex items-start gap-3 text-sm font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <AlertCircle size={20} className="shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <div className="space-y-8">
                {/* Lead Selection */}
                <div className="bg-black/20 rounded-3xl p-6 border border-white/10 shadow-inner">
                  <SearchableSelect
                    options={leads}
                    value={selectedLeadId}
                    onChange={setSelectedLeadId}
                    label="Target Lead"
                    placeholder="Search and select a lead..."
                  />
                </div>

                {/* Upload Zones Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Audio Upload Zone */}
                  <div className={`relative flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-3xl transition-all group ${uploadFile && isAudio ? 'border-indigo-500 bg-indigo-500/20' : 'border-[var(--crm-border)] bg-[var(--crm-bg)]/20 hover:border-indigo-500 hover:bg-indigo-500/10'}`}>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={e => {
                        const file = e.target.files?.[0] || null;
                        if (file) setUploadFile(file);
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all ${uploadFile && isAudio ? 'bg-indigo-600 shadow-lg shadow-indigo-500/30' : 'bg-[var(--crm-border)] shadow-inner'}`}>
                      <FileAudio className={`w-7 h-7 ${uploadFile && isAudio ? 'text-white' : 'text-[var(--crm-text-muted)]'}`} />
                    </div>
                    <div className="text-center">
                      <p className={`font-black text-xs uppercase tracking-widest mb-1 ${uploadFile && isAudio ? 'text-indigo-300' : 'text-[var(--crm-text-muted)]'}`}>
                        {uploadFile && isAudio ? 'Audio Loaded' : 'Upload Audio'}
                      </p>
                      <p className="text-[9px] font-bold text-[var(--crm-text-muted)] tracking-tighter">
                        {uploadFile && isAudio ? uploadFile.name : 'MP3, WAV, WEBM'}
                      </p>
                    </div>
                  </div>

                  {/* Document Upload Zone */}
                  <div className={`relative flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-3xl transition-all group ${uploadFile && isDoc ? 'border-indigo-500 bg-indigo-500/20' : 'border-[var(--crm-border)] bg-[var(--crm-bg)]/20 hover:border-indigo-500 hover:bg-indigo-500/10'}`}>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={e => {
                        const file = e.target.files?.[0] || null;
                        if (file) setUploadFile(file);
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all ${uploadFile && isDoc ? 'bg-indigo-600 shadow-lg shadow-indigo-500/30' : 'bg-[var(--crm-border)] shadow-inner'}`}>
                      <FileText className={`w-7 h-7 ${uploadFile && isDoc ? 'text-white' : 'text-[var(--crm-text-muted)]'}`} />
                    </div>
                    <div className="text-center">
                      <p className={`font-black text-xs uppercase tracking-widest mb-1 ${uploadFile && isDoc ? 'text-indigo-300' : 'text-[var(--crm-text-muted)]'}`}>
                        {uploadFile && isDoc ? 'Doc Encrypted' : 'Upload File'}
                      </p>
                      <p className="text-[9px] font-bold text-[var(--crm-text-muted)] tracking-tighter">
                        {uploadFile && isDoc ? uploadFile.name : 'Word, PDF, TXT'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Manual Transcript Zone */}
                <div className="pt-4">
                  <div className="relative">
                    <div className="absolute top-5 left-5 text-[var(--crm-text-muted)] pointer-events-none">
                      <FileText className="text-indigo-500" />
                    </div>
                    <textarea
                      value={manualText}
                      onChange={e => setManualText(e.target.value)}
                      placeholder="Paste manual notes or context here..."
                      className="w-full min-h-[180px] bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] rounded-[2rem] pl-14 pr-8 py-5 text-sm font-bold focus:bg-[var(--crm-bg)]/40 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none text-[var(--crm-text)] placeholder:text-[var(--crm-text-muted)] leading-relaxed shadow-inner"
                    />
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="mt-10 pt-8 border-t border-[var(--crm-border)] flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-[9px] font-black text-[var(--crm-text-muted)] px-3 py-1 bg-[var(--crm-border)] rounded-lg uppercase tracking-widest">Protocol validation required</span>
                <button
                  type="submit"
                  disabled={isSubmitting || isDemoMode}
                  className="w-full sm:w-auto btn-primary !px-12 !py-5"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <UploadCloud size={20} />}
                  <span>
                    {isSubmitting ? 'Saving...' : isDemoMode ? 'Demo Mode ' : 'Save'}
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
