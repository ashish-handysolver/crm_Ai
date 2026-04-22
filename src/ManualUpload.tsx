import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, Timestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { motion, AnimatePresence } from 'motion/react';
import { transcribeDocumentWithGroq, transcribeWithGroq } from './utils/ai-service';
import { UploadCloud, FileAudio, FileText, Loader2, CheckCircle2, AlertCircle, Sparkles, UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useDemo } from './DemoContext';
import { Eye } from 'lucide-react';
import SearchableSelect from './components/SearchableSelect';

import { PageLayout } from './components/layout/PageLayout';
import { PageHeader } from './components/layout/PageHeader';

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
        if (isAudio) {
          try {
            const groqResult = await transcribeWithGroq(uploadFile);
            finalTranscript = groqResult.fullText;
            transcriptData = groqResult.segments;
          } catch (e) {
            console.error('Groq Transcription failed', e);
            finalTranscript = 'Intelligence services temporarily unavailable. Please try re-syncing this record later.';
          }
        } else if (isDoc) {
          const groqResult = await transcribeDocumentWithGroq(uploadFile);
          finalTranscript = groqResult.fullText || 'No info extracted.';
          transcriptData = groqResult.segments || [];
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

  if (!user) return (
    <PageLayout>
      <div className="p-20 text-center text-[var(--crm-text-muted)] font-black uppercase tracking-widest text-sm">
        Please sign in to add info.
      </div>
    </PageLayout>
  );

  return (
    <PageLayout>
      <PageHeader 
        title="Intelligence Injection"
        description="Manually upload conversation recordings, documents, or strategic notes to the neural archive."
        badge="Manual Upload"
        icon={UploadCloud}
      />

      <div className="max-w-3xl mx-auto space-y-12">
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
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}
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
                    placeholder="Search lead..."
                  />
                </div>

                {/* Upload Zones Grid */}
                <div className="grid grid-cols-2 gap-3 sm:gap-6">
                  {/* Audio Upload Zone */}
                  <div className={`relative flex flex-col items-center justify-center p-4 sm:p-10 border-2 border-dashed rounded-[1.5rem] sm:rounded-3xl transition-all group ${uploadFile && isAudio ? 'border-indigo-500 bg-indigo-500/20' : 'border-[var(--crm-border)] bg-[var(--crm-bg)]/20 hover:border-indigo-500 hover:bg-indigo-500/10'}`}>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={e => {
                        const file = e.target.files?.[0] || null;
                        if (file) setUploadFile(file);
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4 transition-all ${uploadFile && isAudio ? 'bg-indigo-600 shadow-lg shadow-indigo-500/30' : 'bg-[var(--crm-border)] shadow-inner'}`}>
                      <FileAudio className={`w-5 h-5 sm:w-7 sm:h-7 ${uploadFile && isAudio ? 'text-white' : 'text-[var(--crm-text-muted)]'}`} />
                    </div>
                    <div className="text-center">
                      <p className={`font-black text-[10px] sm:text-xs uppercase tracking-widest mb-1 ${uploadFile && isAudio ? 'text-indigo-300' : 'text-[var(--crm-text-muted)]'}`}>
                        {uploadFile && isAudio ? 'Audio Loaded' : 'Upload Audio'}
                      </p>
                      <p className="text-[8px] sm:text-[9px] font-bold text-[var(--crm-text-muted)] tracking-tighter hidden sm:block">
                        {uploadFile && isAudio ? uploadFile.name : 'MP3, WAV, WEBM'}
                      </p>
                    </div>
                  </div>

                  {/* Document Upload Zone */}
                  <div className={`relative flex flex-col items-center justify-center p-4 sm:p-10 border-2 border-dashed rounded-[1.5rem] sm:rounded-3xl transition-all group ${uploadFile && isDoc ? 'border-indigo-500 bg-indigo-500/20' : 'border-[var(--crm-border)] bg-[var(--crm-bg)]/20 hover:border-indigo-500 hover:bg-indigo-500/10'}`}>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={e => {
                        const file = e.target.files?.[0] || null;
                        if (file) setUploadFile(file);
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4 transition-all ${uploadFile && isDoc ? 'bg-indigo-600 shadow-lg shadow-indigo-500/30' : 'bg-[var(--crm-border)] shadow-inner'}`}>
                      <FileText className={`w-5 h-5 sm:w-7 sm:h-7 ${uploadFile && isDoc ? 'text-white' : 'text-[var(--crm-text-muted)]'}`} />
                    </div>
                    <div className="text-center">
                      <p className={`font-black text-[10px] sm:text-xs uppercase tracking-widest mb-1 ${uploadFile && isDoc ? 'text-indigo-300' : 'text-[var(--crm-text-muted)]'}`}>
                        {uploadFile && isDoc ? 'Doc Encrypted' : 'Upload File'}
                      </p>
                      <p className="text-[8px] sm:text-[9px] font-bold text-[var(--crm-text-muted)] tracking-tighter hidden sm:block">
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
                      placeholder="Add Strategic Notes..."
                      className="w-full min-h-[180px] bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] rounded-[2rem] pl-14 pr-8 py-5 text-sm font-bold focus:bg-[var(--crm-bg)]/40 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none text-[var(--crm-text)] placeholder:text-[var(--crm-text-muted)] leading-relaxed shadow-inner"
                    />
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="mt-10 pt-8 border-t border-[var(--crm-border)] flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                  type="submit"
                  disabled={isSubmitting || isDemoMode}
                  className="w-full sm:w-auto btn-primary !px-12 !py-5"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <UploadCloud size={20} />}
                  <span>
                    {isSubmitting ? 'Injecting...' : isDemoMode ? 'Demo Mode ' : 'Inject Intelligence'}
                  </span>
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </PageLayout>
  );
}
