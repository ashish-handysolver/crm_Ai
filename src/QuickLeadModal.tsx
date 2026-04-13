import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Camera, Mic, Upload, Building2, User, Phone, Mail, 
  Sparkles, Loader2, CheckCircle2, AlertCircle, FileAudio, MapPin, Square,
  Play, Pause, Trash2, RotateCcw
} from 'lucide-react';
import { extractLeadFromCard } from './utils/ai-service';
import { 
  doc, 
  setDoc, 
  Timestamp 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { db, storage } from './firebase';
import { useAuth } from './contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { idbService } from './utils/idb-service';

interface QuickLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickLeadModal({ isOpen, onClose }: QuickLeadModalProps) {
  const { companyId, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'upload' | 'confirm'>('upload');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    address: '',
  });
  const [isScanning, setIsScanning] = useState(false);

  const [files, setFiles] = useState<{
    vCard: File | null;
    audio: File | null;
  }>({
    vCard: null,
    audio: null,
  });

  const [previews, setPreviews] = useState<{
    vCard: string | null;
  }>({
    vCard: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const [isRecordingMemo, setIsRecordingMemo] = useState(false);
  const [isPausedMemo, setIsPausedMemo] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const playbackRef = useRef<HTMLAudioElement | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startMemoRecording = async () => {
    try {
      if (previewUrl) {
         URL.revokeObjectURL(previewUrl);
         setPreviewUrl(null);
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `quick_memo_${Date.now()}.webm`, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        
        setFiles(prev => ({ ...prev, audio: audioFile }));
        setPreviewUrl(url);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecordingMemo(true);
      setIsPausedMemo(false);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Recording failed", err);
      setError("Microphone access denied. Capture aborted.");
    }
  };

  const pauseResumeRecording = () => {
    if (!mediaRecorderRef.current) return;
    
    if (isPausedMemo) {
      mediaRecorderRef.current.resume();
      setIsPausedMemo(false);
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
      setIsPausedMemo(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const stopMemoRecording = () => {
    if (mediaRecorderRef.current && isRecordingMemo) {
      mediaRecorderRef.current.stop();
      setIsRecordingMemo(false);
      setIsPausedMemo(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const togglePreviewPlayback = () => {
    if (!playbackRef.current) return;
    
    if (isPlayingPreview) {
      playbackRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      playbackRef.current.play();
      setIsPlayingPreview(true);
    }
  };

  const discardRecording = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setFiles(prev => ({ ...prev, audio: null }));
    setIsPlayingPreview(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'vCard' | 'audio') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFiles(prev => ({ ...prev, [type]: file }));

    if (type === 'vCard') {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setPreviews(prev => ({ ...prev, vCard: base64 }));
        
        // Trigger AI Scan
        setIsScanning(true);
        try {
          const cleanBase64 = base64.split(',')[1];
          const data = await extractLeadFromCard(cleanBase64);
          if (data) {
            setFormData(prev => ({
              ...prev,
              name: data.name || prev.name,
              company: data.company || prev.company,
              email: data.email || prev.email,
              phone: data.phone || prev.phone,
              address: data.address || prev.address,
            }));
          }
        } catch (err) {
          console.error("Scanning failed", err);
        } finally {
          setIsScanning(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent, closeAfter: boolean = true) => {
    e.preventDefault();
    if (!companyId) return;

    setLoading(true);
    setError('');

    const leadId = uuidv4().slice(0, 8);
    const timestamp = Date.now();

    // --- Offline Fallback Logic ---
    if (!navigator.onLine) {
        try {
            await idbService.addPendingLead({
                id: leadId,
                data: { ...formData },
                vCardBlob: files.vCard,
                audioBlob: files.audio,
                timestamp,
                status: 'PENDING'
            });
            setSuccess(true);
            setTimeout(() => {
                if (closeAfter) {
                  onClose();
                  resetForm();
                } else {
                  resetForm();
                }
            }, 2000);
            return;
        } catch (err: any) {
            setError('Local storage failure: Logic vector corrupted.');
            setLoading(false);
            return;
        }
    }

    try {
      let vCardUrl = '';
      let audioNoteUrl = '';

      // 1. Upload Visiting Card
      if (files.vCard) {
        const vCardRef = ref(storage, `companies/${companyId}/vCards/${leadId}_${Date.now()}_vcard.png`);
        await uploadBytes(vCardRef, files.vCard);
        vCardUrl = await getDownloadURL(vCardRef);
      }

      // 2. Upload Audio Note
      if (files.audio) {
        const audioRef = ref(storage, `companies/${companyId}/audioNotes/${leadId}_${Date.now()}_note.webm`);
        await uploadBytes(audioRef, files.audio);
        audioNoteUrl = await getDownloadURL(audioRef);
      }

      // 3. Save Lead Record
      await setDoc(doc(db, 'leads', leadId), {
        id: leadId,
        companyId,
        authorUid: user?.uid || '',
        name: formData.name || 'Quick Captured Lead',
        company: formData.company || 'Unknown Org',
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        vCardUrl,
        audioNoteUrl,
        captureSource: 'QUICK_CAPTURE',
        phase: String((import.meta as any).env.VITE_DEFAULT_PHASE || 'DISCOVERY').trim().toUpperCase(),
        leadType: String((import.meta as any).env.VITE_DEFAULT_LEAD_TYPE || 'B2B').trim().toUpperCase(),
        health: String((import.meta as any).env.VITE_DEFAULT_HEALTH || 'WARM').trim().toUpperCase(),
        score: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      setSuccess(true);
      setTimeout(() => {
        if (closeAfter) {
          onClose();
          resetForm();
        } else {
          resetForm();
        }
      }, 2000);

    } catch (err: any) {
      console.error("Quick Lead Error:", err);
      setError(err.message || 'Transmission failed. Logic vector disconnected.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    // Clear preview URL if it exists
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    
    setFormData({ name: '', company: '', email: '', phone: '', address: '' });
    setFiles({ vCard: null, audio: null });
    setPreviews({ vCard: null });
    setPreviewUrl(null);
    setIsRecordingMemo(false);
    setIsPausedMemo(false);
    setIsPlayingPreview(false);
    setRecordingDuration(0);
    setStep('upload');
    setSuccess(false);
    setError('');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[var(--crm-bg)]/60 backdrop-blur-md"
        />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="max-w-md w-full bg-[var(--crm-card-bg)] backdrop-blur-3xl border border-[var(--crm-border)] rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[95vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-8 pb-4 border-b border-[var(--crm-border)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                <Sparkles size={20} className="text-indigo-500" />
              </div>
              <div>
                <h2 className="text-lg font-black text-[var(--crm-text)] tracking-tight">Quick Capture</h2>
                <p className="text-[10px] text-[var(--crm-text-muted)] font-bold uppercase tracking-widest">Neural Lead Injection</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[var(--crm-bg)]/20 rounded-xl transition-all text-[var(--crm-text-muted)]">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-6 hide-scrollbar">
            {success ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/30 animate-bounce">
                  <CheckCircle2 size={40} />
                </div>
                <h3 className="text-xl font-black text-[var(--crm-text)]">
                  {navigator.onLine ? 'Target Synchronized' : 'Lead Locked Locally'}
                </h3>
                <p className="text-sm text-[var(--crm-text-muted)] font-medium">
                  {navigator.onLine 
                    ? 'Lead successfully added to your pipeline vector.' 
                    : 'System offline. Lead cached for automatic neural sync.'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* 1. Visiting Card Upload (Large, Top) */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`h-48 rounded-[2rem] border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-3 group relative overflow-hidden ${files.vCard ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-[var(--crm-border)] hover:border-indigo-500/30 hover:bg-[var(--crm-bg)]/20'}`}
                >
                  {previews.vCard ? (
                    <img src={previews.vCard} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" alt="Preview" />
                  ) : null}
                  
                  {isScanning && (
                    <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center backdrop-blur-[4px] z-10">
                      <motion.div 
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} 
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="flex flex-col items-center gap-2"
                      >
                        <Sparkles size={32} className="text-white" />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Scanning...</span>
                      </motion.div>
                    </div>
                  )}

                  {!previews.vCard && !isScanning && (
                    <>
                      <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20 group-hover:scale-110 transition-transform">
                        <Camera size={28} className="text-indigo-400" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--crm-text-muted)]">Upload Business Card</span>
                    </>
                  )}
                  <input type="file" ref={fileInputRef} onChange={e => handleFileChange(e, 'vCard')} accept="image/*" capture="environment" className="hidden" />
                </div>

                {/* 2. Manual Data Fields */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest ml-1">Full Name</label>
                      <div className="relative group">
                        <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--crm-text-muted)] group-focus-within:text-indigo-400 transition-colors" />
                        <input 
                          type="text" 
                          value={formData.name}
                          onChange={e => setFormData({...formData, name: e.target.value})}
                          placeholder="John Wick"
                          className="w-full bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] rounded-2xl py-3 pl-11 pr-4 text-xs font-bold text-[var(--crm-text)] focus:outline-none focus:border-indigo-500 transition-all placeholder:opacity-50"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest ml-1">Organization</label>
                      <div className="relative group">
                        <Building2 size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--crm-text-muted)] group-focus-within:text-indigo-400 transition-colors" />
                        <input 
                          type="text" 
                          value={formData.company}
                          onChange={e => setFormData({...formData, company: e.target.value})}
                          placeholder="Continental Corp"
                          className="w-full bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] rounded-2xl py-3 pl-11 pr-4 text-xs font-bold text-[var(--crm-text)] focus:outline-none focus:border-indigo-500 transition-all placeholder:opacity-50"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest ml-1">Email ID</label>
                      <div className="relative group">
                        <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--crm-text-muted)] group-focus-within:text-indigo-400 transition-colors" />
                        <input 
                          type="email" 
                          value={formData.email}
                          onChange={e => setFormData({...formData, email: e.target.value})}
                          placeholder="john@wick.com"
                          className="w-full bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] rounded-2xl py-3 pl-11 pr-4 text-xs font-bold text-[var(--crm-text)] focus:outline-none focus:border-indigo-500 transition-all placeholder:opacity-50"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest ml-1">Mobile Number</label>
                      <div className="relative group">
                        <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--crm-text-muted)] group-focus-within:text-indigo-400 transition-colors" />
                        <input 
                          type="tel" 
                          value={formData.phone}
                          onChange={e => setFormData({...formData, phone: e.target.value})}
                          placeholder="+1 234 567 890"
                          className="w-full bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] rounded-2xl py-3 pl-11 pr-4 text-xs font-bold text-[var(--crm-text)] focus:outline-none focus:border-indigo-500 transition-all placeholder:opacity-50"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest ml-1">Office Address</label>
                    <div className="relative group">
                      <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--crm-text-muted)] group-focus-within:text-indigo-400 transition-colors" />
                      <input 
                        type="text" 
                        value={formData.address}
                        onChange={e => setFormData({...formData, address: e.target.value})}
                        placeholder="123 Silicon Valley, CA"
                        className="w-full bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] rounded-2xl py-3 pl-11 pr-4 text-xs font-bold text-[var(--crm-text)] focus:outline-none focus:border-indigo-500 transition-all placeholder:opacity-50"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Audio Note (Above Buttons) */}
                <div 
                  className={`p-4 rounded-2xl border-2 border-dashed transition-all relative overflow-hidden ${isRecordingMemo ? 'border-red-500 bg-red-500/5' : files.audio ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-[var(--crm-border)] bg-[var(--crm-bg)]/20'}`}
                >
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl border transition-all ${isRecordingMemo ? (isPausedMemo ? 'bg-amber-500 text-white border-amber-400' : 'bg-red-500 text-white animate-pulse border-red-400') : files.audio ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-slate-500/10 text-slate-400 border-white/5'}`}>
                        <Mic size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-[var(--crm-text)] uppercase tracking-widest">
                          {isRecordingMemo ? (isPausedMemo ? 'Recording Paused' : 'Recording Active') : files.audio ? 'Voice Note Ready' : 'Audio Note'}
                        </p>
                        <p className="text-[9px] text-[var(--crm-text-muted)] font-medium">
                          {isRecordingMemo ? `${Math.floor(recordingDuration / 60)}:${(recordingDuration % 60).toString().padStart(2, '0')} elapsed` : files.audio ? 'Review your recording below' : 'Record or upload contact memo'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                       {!isRecordingMemo && !files.audio && (
                         <>
                          <button
                            type="button"
                            onClick={startMemoRecording}
                            className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/30 transition-all"
                          >
                            <Mic size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => audioInputRef.current?.click()}
                            className="p-2 bg-slate-500/10 text-slate-400 rounded-lg hover:bg-slate-500/20 transition-all"
                          >
                            <Upload size={16} />
                          </button>
                         </>
                       )}

                       {isRecordingMemo && (
                         <>
                          <button
                            type="button"
                            onClick={pauseResumeRecording}
                            className={`p-2 rounded-lg transition-all ${isPausedMemo ? 'bg-amber-500 text-white' : 'bg-slate-500/20 text-slate-400'}`}
                          >
                            {isPausedMemo ? <Play size={16} /> : <Pause size={16} />}
                          </button>
                          <button
                            type="button"
                            onClick={stopMemoRecording}
                            className="p-2 bg-red-500 text-white rounded-lg shadow-lg shadow-red-500/20"
                          >
                            <Square size={16} />
                          </button>
                         </>
                       )}

                       {files.audio && !isRecordingMemo && (
                         <>
                          <button
                            type="button"
                            onClick={togglePreviewPlayback}
                            className="p-2 bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-500/20"
                          >
                            {isPlayingPreview ? <Pause size={16} /> : <Play size={16} />}
                          </button>
                          <button
                            type="button"
                            onClick={discardRecording}
                            className="p-2 bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500/20 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                         </>
                       )}
                    </div>
                  </div>
                  
                  {isRecordingMemo && !isPausedMemo && (
                    <motion.div 
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      className="absolute bottom-0 left-0 h-1 bg-red-500 w-full origin-left"
                      transition={{ duration: 60, ease: "linear" }}
                    />
                  )}

                  {previewUrl && (
                    <audio 
                      ref={playbackRef} 
                      src={previewUrl} 
                      onEnded={() => setIsPlayingPreview(false)}
                      className="hidden" 
                    />
                  )}
                  
                  <input type="file" ref={audioInputRef} onChange={e => handleFileChange(e, 'audio')} accept="audio/*" className="hidden" />
                </div>

                {error && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-xs font-bold animate-shake">
                    <AlertCircle size={16} /> {error}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    type="button"
                    onClick={(e) => handleSubmit(e, false)}
                    disabled={loading}
                    className="h-14 bg-[var(--crm-bg)]/40 text-[var(--crm-text)] border border-[var(--crm-border)] rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[var(--crm-bg)]/60 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-indigo-400" />}
                    Save & Next
                  </button>

                  <button 
                    type="button"
                    onClick={(e) => handleSubmit(e, true)}
                    disabled={loading}
                    className="h-14 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    Final Save
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Warning */}
          {!success && (
            <div className="p-6 bg-[var(--crm-bg)]/20 text-center">
              <p className="text-[9px] font-black text-[var(--crm-text-muted)] uppercase tracking-[0.2em]">Neural Intelligence Active • End-to-End Secure</p>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
