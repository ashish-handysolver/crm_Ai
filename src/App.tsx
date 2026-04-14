import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate, Link, useLocation, Navigate } from 'react-router-dom';
import { Mic, Square, Play, Pause, Share2, Loader2, CheckCircle2, AlertCircle, LogIn, LogOut, History, Copy, ExternalLink, FileText, Languages, Users, Link as LinkIcon, MessageSquare, Building2, BarChart3, Search, Filter, ArrowUpRight, ShieldCheck, Globe, Activity, Mail, Calendar, MoreVertical, Trash2, ArrowLeft, Clock, Sparkles, ArrowUp, Bell, Menu, RotateCcw, Download, LayoutDashboard, QrCode, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';
import { uploadFileToGemini, getGeminiApiKey, GEMINI_FALLBACK_MESSAGE } from './utils/gemini';
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
  ref,
  getBytes,
  uploadBytes,
  getDownloadURL
} from 'firebase/storage';
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User
} from 'firebase/auth';
import { db, auth, storage } from './firebase';
import Leads from './Leads';
import Sidebar from './Sidebar';
import LeadForm from './LeadForm';
import Dashboard from './Dashboard';
import CustomFields from './CustomFields';
import Reports from './Reports';
import GuestRecord from './GuestRecord';
import Analytics from './Analytics';
import ManualUpload from './ManualUpload';
import LeadInsights from './LeadInsights';
import LeadCapture from './LeadCapture';
import CalendarPage from './Calendar';
import ImportModal from './ImportModal';
import Login from './Login';
import RegisterCompany from './RegisterCompany';
import Team from './Team';
import Onboarding from './Onboarding';
import Profile from './Profile';
import SuperAdmin from './SuperAdmin';
import SuperLogin from './SuperLogin';
import Settings from './Settings';
import TranscriptPlayer from './TranscriptPlayer';
import DownloadApp from './DownloadApp';
import ThemeToggle from './components/ThemeToggle';
import { NotificationWatcher } from './components/NotificationWatcher';
import QuickLeadModal from './QuickLeadModal';
import { SyncManager } from './components/SyncManager';
import { Plus } from 'lucide-react';
import { analyzeWithGroq, transcribeWithGroq } from './utils/ai-service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DemoProvider, useDemo } from './DemoContext';
import { useTheme } from './contexts/ThemeContext';
import { WHATSAPP_TEMPLATES, openWhatsApp } from './utils/whatsapp';


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
  collectionName?: string;
}

const NotificationBell = () => {
  const { companyId, role, user } = useAuth();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(
    typeof Notification !== 'undefined' ? Notification.permission === 'granted' : true
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!companyId || !user) return;
    const q = query(collection(db, 'meetings'), where('companyId', '==', companyId));

    // Track seen meetings to avoid duplicate alerts upon initial load
    const seenMeetings = new Set<string>();
    let isInitialLoad = true;

    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const now = new Date();

      const filtered = (role === 'admin' || role === 'super_admin' || role === 'management')
        ? data
        : data.filter((m: any) => m.ownerUid === user.uid || (m.assignedTo || []).includes(user.uid));

      const upcoming = filtered.filter((m: any) => m.scheduledAt?.toDate?.() > now)
        .sort((a: any, b: any) => a.scheduledAt.toMillis() - b.scheduledAt.toMillis());

      setMeetings(upcoming);

      // --- Push Notification Engine ---
      snap.docChanges().forEach(change => {
        if (change.type === 'added' || change.type === 'modified') {
          const m = { id: change.doc.id, ...change.doc.data() } as any;
          const isAssigned = (m.assignedTo || []).includes(user.uid);

          if (!isInitialLoad && isAssigned && !seenMeetings.has(m.id)) {
            seenMeetings.add(m.id);
            // Trigger native notification
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('📅 New Meeting Assigned', {
                body: `"${m.title}" has been added to your logic vector.`,
                icon: '/logo.png',
                tag: m.id
              });
            }
          } else if (isAssigned) {
            seenMeetings.add(m.id);
          }
        }
      });
      isInitialLoad = false;
    });
    return unsub;
  }, [companyId, role, user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRequestPush = () => {
    if (typeof Notification !== 'undefined') {
      Notification.requestPermission().then(permission => {
        setPushEnabled(permission === 'granted');
      });
    }
  };

  const hasNotifications = meetings.length > 0 || !pushEnabled;

  return (
    <div className="relative" ref={dropdownRef}>

      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`relative p-2.5 rounded-xl transition-all active:scale-95 ${showDropdown ? 'bg-indigo-500/20 text-indigo-500 shadow-sm' : 'text-[var(--crm-text-muted)] hover:bg-[var(--crm-border)]'}`}
      >
        <Bell size={20} />
        {hasNotifications && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white shadow-sm ring-2 ring-rose-500/20 animate-pulse"></span>
        )}
      </button>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute right-0 mt-4 w-80 bg-[var(--crm-glass-bg)] backdrop-blur-3xl rounded-2xl !p-0 border border-[var(--crm-border)] shadow-2xl z-[100] overflow-hidden"
          >
            <div className="p-5 border-b border-[var(--crm-border)] bg-[var(--crm-bg)]/20 flex justify-between items-center">
              <h3 className="text-[10px] font-black text-[var(--crm-text)] uppercase tracking-[0.2em]">Notifications</h3>
              <span className="px-2 py-0.5 rounded-lg bg-indigo-900 text-indigo-300 text-[8px] font-black uppercase tracking-widest">{meetings.length} Upcoming</span>
            </div>

            <div className="max-h-[400px] overflow-y-auto scrollbar-hide py-2">
              {!pushEnabled && (
                <div className="p-4 mx-2 mb-2 rounded-2xl bg-rose-950 border border-rose-900 hover:bg-rose-900 transition-all cursor-pointer group" onClick={handleRequestPush}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 shadow-sm"><Bell size={14} /></div>
                    <div className="flex-1">
                      <div className="font-black text-[var(--crm-text)] text-[11px] uppercase tracking-wider mb-0.5">Enable Notifications</div>
                      <div className="text-[10px] text-slate-300 font-bold uppercase tracking-tight opacity-70">Get alerted for upcoming meetings</div>
                    </div>
                  </div>
                </div>
              )}

              {meetings.length > 0 ? meetings.map((m, idx) => (
                <div key={m.id} className="px-4 py-4 hover:bg-[var(--crm-bg)]/20 transition-all cursor-pointer border-b border-[var(--crm-border)] last:border-0 group">
                  <div className="font-bold text-[var(--crm-text)] text-sm mb-1 group-hover:text-indigo-500 transition-colors">{m.title}</div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-wider">
                    <Clock size={10} className="text-indigo-500/50" />
                    {m.scheduledAt?.toDate?.().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', hour12: false })}
                  </div>
                  {m.leadName && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-900 text-indigo-300 text-[9px] font-black uppercase tracking-widest">
                      <Users size={10} /> {m.leadName}
                    </div>
                  )}
                </div>
              )) : (
                <div className="p-12 text-center space-y-4">
                  <div className="p-4 bg-slate-800 rounded-full w-fit mx-auto text-slate-400">
                    <History size={32} />
                  </div>
                  <p className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-[0.2em] italic">No notifications yet.</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[var(--crm-border)] bg-[var(--crm-bg)]/20 text-center">
              <Link to="/calendar" className="text-[9px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-all">View Calendar &rarr;</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Navbar = ({ user, onMenuClick, onInstall, showInstallButton, onQuickLead }: { user: User, onMenuClick: () => void, onInstall: () => void, showInstallButton: boolean, onQuickLead: () => void }) => {
  const { companyName, companyId } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showQrModal, setShowQrModal] = useState(false);
  const [success, setSuccess] = useState('');

  return (
    <>
      <nav className="glass-nav z-[90] px-4 sm:px-12 py-3.5 sm:py-4 flex items-center justify-between border-b border-[var(--crm-border)]">
        <div className="flex items-center gap-3 sm:gap-6">
          <button onClick={onMenuClick} className="lg:hidden p-2.5 text-[var(--crm-text-muted)] hover:bg-[var(--crm-border)] rounded-xl transition-all shadow-sm active:scale-95 border border-[var(--crm-border)]">
            <Menu size={20} />
          </button>

          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[var(--crm-text)] rounded-xl flex items-center justify-center shadow-lg border border-[var(--crm-border)] p-1.5 overflow-hidden">
              <img src="/logo.png" className="w-full h-full object-contain" alt="handycrm.ai" />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-base sm:text-lg font-black tracking-tighter text-[var(--crm-text)] lowercase leading-none">handydash.ai</span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3 sm:gap-6">
          {showInstallButton && (
            <button
              onClick={onInstall}
              className="hidden lg:flex items-center gap-2.5 px-5 py-2.5 bg-[var(--crm-border)] border border-[var(--crm-border)] text-[var(--crm-text)] rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-indigo-400 hover:text-indigo-400 transition-all shadow-xl shadow-black/5 active:scale-95"
            >
              <Download size={14} /> Install
            </button>
          )}
          <div className="flex items-center gap-3 pl-2 border-l border-[var(--crm-border)]">
            <ThemeToggle />
            <button
              onClick={onQuickLead}
              title="Quick Capture"
              className="relative p-2.5 rounded-xl transition-all active:scale-95 text-indigo-500 hover:bg-indigo-500/10"
            >
              <Camera size={20} />
            </button>
            <button
              onClick={() => setShowQrModal(true)}
              title="Lead Capture QR"
              className="relative p-2.5 rounded-xl transition-all active:scale-95 text-[var(--crm-text-muted)] hover:bg-[var(--crm-border)]"
            >
              <QrCode size={20} />
            </button>
          </div>
          <NotificationBell />
          <div className="h-8 w-[1px] bg-[var(--crm-border)] mx-1 hidden md:block"></div>
          <div className="hidden md:flex flex-col items-end">
            <span className="text-xs font-black text-[var(--crm-text)] leading-none mb-1 uppercase tracking-widest">{user.displayName || 'Entity'}</span>
            <span className="text-[9px] font-black text-[var(--crm-text-muted)] uppercase tracking-[0.2em]">{user.email?.split('@')[0]}</span>
          </div>
          <Link to="/profile" className="relative group p-1 bg-[var(--crm-bg)]/5 border border-[var(--crm-border)] rounded-xl sm:rounded-[1.25rem] shadow-xl shadow-black/5 hover:border-indigo-500 transition-all">
            <img
              src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=6366f1&color=fff`}
              alt="Profile"
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-[1rem] object-cover border border-[var(--crm-border)] group-hover:scale-105 transition-all group-active:scale-95"
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-[3px] border-[var(--crm-bg)] shadow-sm ring-1 ring-emerald-500/20"></div>
          </Link>
        </div>
      </nav>

      <AnimatePresence>
        {showQrModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-[var(--crm-bg)]/40 backdrop-blur-sm" onClick={() => setShowQrModal(false)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-[var(--crm-glass-bg)] backdrop-blur-xl rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-[var(--crm-border)] text-center relative overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-orange-500"></div>
              <div className="flex items-center justify-center gap-2 mb-6">
                <div className="w-8 h-8 bg-indigo-500/20 border border-indigo-500/30 rounded-xl flex items-center justify-center shadow-lg"><Sparkles size={16} className="text-indigo-500" /></div>
                <span className="text-lg font-black tracking-tight text-[var(--crm-text)]">Handysolver<span className="text-indigo-500">.AI</span></span>
              </div>
              <h2 className="text-2xl font-black mb-2 text-[var(--crm-text)] tracking-tight">Lead Capture QR</h2>
              <p className="text-sm text-[var(--crm-text-muted)] mb-6 font-medium">Prospects can scan this to automatically join your pipeline.</p>
              <div className="bg-white p-4 rounded-[2rem] border border-[var(--crm-border)] inline-block mb-6 shadow-inner">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${window.location.origin}/capture/${companyId}`)}`} alt="QR Code" className="w-48 h-48 rounded-xl mix-blend-multiply" />
              </div>
              <button onClick={() => {
                const url = `${window.location.origin}/capture/${companyId}`;
                if (navigator.clipboard && window.isSecureContext) {
                  navigator.clipboard.writeText(url);
                } else {
                  const textArea = document.createElement("textarea");
                  textArea.value = url;
                  textArea.style.position = "fixed";
                  textArea.style.left = "-999999px";
                  textArea.style.top = "-999999px";
                  document.body.appendChild(textArea);
                  textArea.focus();
                  textArea.select();
                  try { document.execCommand('copy'); } catch (err) { }
                  textArea.remove();
                }
                setSuccess("Capture link copied!");
                setTimeout(() => setSuccess(''), 3000);
              }} className="w-full py-3.5 bg-[var(--crm-bg)]/5 border border-[var(--crm-border)] text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-widest rounded-xl mb-3 hover:bg-[var(--crm-bg)]/10 transition-all active:scale-95 shadow-sm flex items-center justify-center gap-2">
                {success ? <><CheckCircle2 size={16} /> Copied!</> : 'Copy Direct Link'}
              </button>
              <button onClick={() => setShowQrModal(false)} className="w-full py-3.5 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-indigo-500 transition-all shadow-md shadow-indigo-500/20 active:scale-95">Close Window</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const HistoryView = ({ user }: { user: User }) => {
  const [recordings, setRecordings] = useState<any[]>([]);
  const { companyId } = useAuth();

  useEffect(() => {
    if (!companyId) return;
    const q = query(
      collection(db, 'recordings'),
      where('companyId', '==', companyId)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      data.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setRecordings(data);
    });
    return unsub;
  }, [companyId]);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-black text-[var(--crm-text)] tracking-tight mb-2">All Recordings</h1>
        <p className="text-[var(--crm-text-muted)] font-medium">A list of all recordings and notes.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recordings.map((rec) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={rec.id}
            className="bg-[var(--crm-card-bg)] p-6 rounded-[2rem] border border-[var(--crm-border)] shadow-sm hover:shadow-xl hover:shadow-[var(--crm-border)] transition-all group"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-orange-500/10 text-orange-600 rounded-2xl flex items-center justify-center font-bold shadow-inner">
                <History size={24} />
              </div>
              <div>
                <h3 className="font-extrabold text-[var(--crm-text)]">Recording</h3>
                <p className="text-xs font-bold text-[var(--crm-text-muted)] uppercase tracking-widest">{rec.id.slice(0, 8)}</p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-2 text-sm text-[var(--crm-text-muted)] font-medium">
                <Calendar size={14} className="text-orange-400" />
                {rec.createdAt?.toDate?.().toLocaleString() || 'Recent'}
              </div>
              <p className="text-sm text-[var(--crm-text-muted)] line-clamp-3 leading-relaxed font-medium bg-[var(--crm-bg)]/20 p-4 rounded-2xl border border-[var(--crm-border)]">
                {rec.transcript || 'No transcript version recorded.'}
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[var(--crm-border)]">
              <div className="flex gap-2">
                <Link
                  to={`/r/${rec.id}`}
                  className="p-2.5 text-[var(--crm-text-muted)] hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all"
                >
                  <ExternalLink size={20} />
                </Link>
                <button
                  onClick={() => {
                    const url = `${window.location.hostname === 'localhost' ? 'https://handydashcrmai.vercel.app' : window.location.origin}/r/${rec.id}`;
                    if (navigator.clipboard && window.isSecureContext) {
                      navigator.clipboard.writeText(url);
                    } else {
                      const textArea = document.createElement("textarea");
                      textArea.value = url;
                      textArea.style.position = "fixed";
                      textArea.style.left = "-999999px";
                      textArea.style.top = "-999999px";
                      document.body.appendChild(textArea);
                      textArea.focus();
                      textArea.select();
                      try { document.execCommand('copy'); } catch (err) { }
                      textArea.remove();
                    }
                  }}
                  className="p-2.5 text-[var(--crm-text-muted)] hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                >
                  <Copy size={20} />
                </button>
              </div>
              <span className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest">AudioCRM v2</span>
            </div>
          </motion.div>
        ))}
      </div>

      {recordings.length === 0 && (
        <div className="text-center py-20 bg-[var(--crm-card-bg)] rounded-[3rem] border-2 border-dashed border-[var(--crm-border)]">
          <History size={48} className="mx-auto text-[var(--crm-text-muted)] mb-4" />
          <p className="text-[var(--crm-text-muted)] font-bold uppercase tracking-widest text-sm">No recordings found</p>
        </div>
      )}
    </div>
  );
};

const RecordingView = () => {
  const { id } = useParams();
  const { user, role } = useAuth();
  const [recording, setRecording] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id || !user) return;
    const docRef = doc(db, 'recordings', id);
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (!docSnap.exists()) {
        setRecording(null);
      } else {
        const data = docSnap.data();
        if (role === 'team_member' && data.authorUid !== user.uid) {
          setRecording('UNAUTHORIZED');
        } else {
          setRecording({ id: docSnap.id, ...data });
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, [id, user, role]);

  const performSync = async (transcriptToAnalyze?: string) => {
    if (!recording) return;
    const text = transcriptToAnalyze || recording.transcript;
    if (!text) throw new Error("No transcript available to analyze.");
    const aiInsights = await analyzeWithGroq(text);
    await updateDoc(doc(db, 'recordings', recording.id), {
      aiInsights,
      updatedAt: Timestamp.now()
    });
    return aiInsights;
  };

  const handleExportPDF = async () => {
    if (!recording || isSyncing) return;
    setIsSyncing(true);
    try {
      // Auto-regenerate before export
      await performSync();

      // Brief pause to allow React to flush the update to the DOM
      await new Promise(r => setTimeout(r, 500));

      const element = contentRef.current;
      if (!element) return;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#030014',
        logging: false,
        onclone: (clonedDoc) => {
          const styleTags = clonedDoc.getElementsByTagName('style');
          for (let i = 0; i < styleTags.length; i++) {
            styleTags[i].innerHTML = styleTags[i].innerHTML
              .replace(/oklch\([^)]+\)/g, '#6366f1')
              .replace(/oklab\([^)]+\)/g, '#6366f1');
          }

          const safeStyle = clonedDoc.createElement('style');
          safeStyle.innerHTML = `
            * { color-interpolation: sRGB !important; }
            body { background: #030014 !important; }
            .glass-card { background: rgba(255, 255, 255, 0.05) !important; border: none !important; }
          `;
          clonedDoc.head.appendChild(safeStyle);
        }
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Intelligence_${recording.id.slice(0, 8)}.pdf`);
    } catch (err) {
      console.error("PDF Export failed", err);
      alert("PDF Export failed. Check console for details.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRegenerateAnalytics = async () => {
    if (!recording || isSyncing) return;
    setIsSyncing(true);
    try {
      await performSync();
    } catch (err: any) {
      alert("Analytics regeneration failed: " + (err.message || "Unknown error"));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRegenerateTranscriptAndAnalytics = async () => {
    if (!recording || !recording.audioUrl || isSyncing) return;
    setIsSyncing(true);
    try {
      const storageRef = ref(storage, recording.audioUrl);
      const buffer = await getBytes(storageRef);
      const blob = new Blob([buffer], { type: 'audio/webm' });

      const parsed = await transcribeWithGroq(blob);
      const newTranscript = parsed.fullText || recording.transcript;
      const newTranscriptData = parsed.segments || recording.transcriptData;

      await updateDoc(doc(db, 'recordings', recording.id), {
        transcript: newTranscript,
        transcriptData: newTranscriptData,
        updatedAt: Timestamp.now()
      });

      await performSync(newTranscript);
    } catch (err: any) {
      alert("Transcription regeneration failed: " + (err.message || "Unknown error"));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleShareWhatsApp = () => {
    if (!recording) return;
    const template = WHATSAPP_TEMPLATES[0];
    const text = template.generate({
      leadName: recording.leadName || recording.lead?.name,
      company: recording.company || recording.lead?.company,
      aiInsights: recording.aiInsights,
      meetingUrl: `${window.location.origin}/r/${recording.id}`
    });
    const phone = recording.lead?.phone || '';
    openWhatsApp(phone, text);
  };

  if (loading) return (
    <div className="flex-1 bg-[var(--crm-bg)] min-h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-indigo-500 w-12 h-12" />
    </div>
  );

  if (recording === 'UNAUTHORIZED') return (
    <div className="flex-1 bg-[var(--crm-bg)] min-h-screen flex items-center justify-center text-rose-500 font-bold uppercase tracking-widest text-xs flex flex-col items-center gap-4">
      <ShieldCheck size={32} /> Access Forbidden
    </div>
  );

  if (!recording) return (
    <div className="flex-1 bg-[var(--crm-bg)] min-h-screen flex items-center justify-center text-[var(--crm-text-muted)] font-bold uppercase tracking-widest text-xs">
      Recording Not Found
    </div>
  );

  return (
    <div className="flex-1 bg-[var(--crm-bg)] min-h-screen overflow-y-auto overflow-x-hidden pt-8 pb-32 font-sans hide-scrollbar">
      <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-indigo-500/10 blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-12 relative z-10" ref={contentRef}>

        <header className="flex flex-col lg:flex-row justify-between items-start gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-indigo-500/10 text-indigo-400 rounded-[1.5rem] flex items-center justify-center border-none shadow-2xl backdrop-blur-xl">
                <History size={28} />
              </div>
              <div className="space-y-1">
                <h1 className="text-4xl font-black text-[var(--crm-text)] tracking-tightest leading-none uppercase">
                  Interaction <span className="text-indigo-500">Intelligence</span>
                </h1>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-[0.2em]">
                    ID: {recording.id.slice(0, 8)}
                  </span>
                  <div className="w-1 h-1 rounded-full bg-[var(--crm-border)]"></div>
                  <span className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-[0.2em]">
                    {recording.createdAt?.toDate?.().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={handleShareWhatsApp} className="px-6 py-4 bg-[#25D366] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-2xl shadow-emerald-500/10 flex items-center gap-2.5">
              Send
            </button>
            <button onClick={handleRegenerateTranscriptAndAnalytics} disabled={isSyncing} className="px-6 py-4 glass-card border-none text-[var(--crm-text)] rounded-2xl text-[10px] font-black uppercase transition-all disabled:opacity-50 flex items-center gap-2.5 shadow-2xl backdrop-blur-2xl">
              <RotateCcw size={14} className={isSyncing ? "animate-spin text-cyan-500" : "text-indigo-500"} />
              {isSyncing ? 'Processing...' : 'Regen All'}
            </button>
            <button onClick={handleRegenerateAnalytics} disabled={isSyncing} className="px-6 py-4 glass-card border-none text-[var(--crm-text)] rounded-2xl text-[10px] font-black uppercase transition-all disabled:opacity-50 flex items-center gap-2.5 shadow-2xl backdrop-blur-2xl">
              <Sparkles size={14} className={isSyncing ? "animate-pulse text-purple-500" : "text-purple-500"} />
              {isSyncing ? 'Thinking...' : 'Regen Analytics'}
            </button>
            <button onClick={handleExportPDF} className="px-6 py-4 bg-white text-black rounded-2xl text-[10px] font-black uppercase shadow-2xl flex items-center gap-2.5">
              <Download size={14} /> PDF
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-12 xl:col-span-7 space-y-8">
            <div className="glass-card border-none rounded-[3rem] p-6 sm:p-10 shadow-2xl backdrop-blur-3xl relative overflow-hidden h-fit">
              <div className="flex items-center gap-3 mb-10">
                <div className="w-10 h-10 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-500/10"><Languages size={18} /></div>
                <h2 className="text-xs font-black text-[var(--crm-text)] uppercase tracking-widest">Protocol Transcript</h2>
              </div>
              <div className="bg-black/20 rounded-[2.5rem] p-6 sm:p-8 border-none min-h-[400px] backdrop-blur-xl">
                {recording.transcript ? (
                  <TranscriptPlayer audioUrl={recording.audioUrl} transcriptData={recording.transcriptData} fallbackText={recording.transcript} />
                ) : (
                  <div className="py-24 text-center opacity-30 flex flex-col items-center gap-6">
                    <Sparkles size={48} className="animate-pulse text-indigo-500" />
                    <p className="text-[11px] font-black uppercase tracking-[0.4em]">Neural Synthesis Pending</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-12 xl:col-span-5 space-y-6">
            {recording.aiInsights ? (
              <>
                <div className="glass-card border-none rounded-[2.5rem] p-8 space-y-6 shadow-2xl backdrop-blur-3xl relative overflow-hidden">
                  <div className="flex items-center gap-3">
                    <Sparkles size={16} className="text-indigo-400" />
                    <h4 className="text-xs font-black text-[var(--crm-text)] uppercase tracking-widest">Executive Summary</h4>
                  </div>
                  <p className="text-[var(--crm-text-muted)] text-[15px] leading-relaxed font-medium italic relative z-10">"{recording.aiInsights.overview}"</p>
                </div>
                <div className="glass-card border-none rounded-[2.5rem] p-8 space-y-8 shadow-2xl backdrop-blur-3xl">
                  <div className="flex items-center gap-3 font-black text-[var(--crm-text)] uppercase tracking-widest text-[11px]">
                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div> Meeting Protocol
                  </div>
                  <div className="space-y-4">
                    {(recording.aiInsights.meetingMinutes || []).map((pt: string, i: number) => (
                      <div key={i} className="flex gap-4 p-5 bg-white/5 rounded-2xl shadow-lg transition-all hover:bg-white/10 group">
                        <span className="text-[11px] font-black text-indigo-500/50 mt-1 group-hover:text-indigo-400 transition-colors">{String(i + 1).padStart(2, '0')}</span>
                        <span className="text-[14px] text-[var(--crm-text-muted)] group-hover:text-[var(--crm-text)] transition-colors font-medium leading-snug">{pt}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="glass-card border-none rounded-[2.5rem] p-8 space-y-8 shadow-2xl backdrop-blur-3xl">
                  <div className="flex items-center gap-3 font-black text-[var(--crm-text)] uppercase tracking-widest text-[11px]">
                    <div className="w-2 h-2 rounded-full bg-cyan-500"></div> Action Items
                  </div>
                  <div className="space-y-4">
                    {(recording.aiInsights.tasks || []).map((t: any, i: number) => (
                      <div key={i} className={`flex items-start gap-5 p-5 rounded-3xl border-none transition-all ${t.completed ? "bg-emerald-500/5" : "bg-white/5"} backdrop-blur-md shadow-lg`}>
                        <div className={`p-1.5 rounded-xl ${t.completed ? "bg-emerald-500/20 text-emerald-500" : "bg-white/5 text-white/10"}`}>
                          <CheckCircle2 size={18} />
                        </div>
                        <div className="flex-1">
                          <p className={`text-[15px] font-bold ${t.completed ? "line-through opacity-40 text-[var(--crm-text-muted)]" : "text-[var(--crm-text)]"}`}>{t.title}</p>
                          <div className="flex justify-between items-center text-[10px] font-black uppercase text-indigo-400 mt-3">
                            <span>{t.assignee}</span>
                            <span>{t.dueDate}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="glass-card border-none rounded-[3rem] p-12 text-center space-y-8 shadow-2xl backdrop-blur-3xl">
                <Sparkles size={32} className="text-indigo-500 mx-auto animate-pulse" />
                <p className="text-[10px] font-bold text-[var(--crm-text-muted)] uppercase tracking-widest">Synthesis Pending</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};





const GlobalRecorder = ({ onQuickLead }: { onQuickLead: () => void }) => {
  const { user, companyId } = useAuth();
  const { isDemoMode } = useDemo();
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  const timerRef = useRef<any>(null);

  const startRecording = async () => {
    if (isDemoMode) return alert("Demo mode active");
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Browser audio API not available. If testing on a mobile phone via local network IP, you must use HTTPS (e.g., via ngrok or Vite basic-ssl).");
      }

      const streams: MediaStream[] = [];
      const isChromium = !!(window as any).chrome;
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile && !sessionStorage.getItem('mobile_audio_warned')) {
        alert("📱 Mobile Browser Limitation\n\nTo record the other person on a call, please put your phone on SPEAKERPHONE.\n\nMobile web browsers are blocked by Apple/Google from capturing internal system audio directly.");
        sessionStorage.setItem('mobile_audio_warned', 'true');
      }

      let sysStream: MediaStream | null = null;
      if (!isMobile) {
        try {
          if (navigator.mediaDevices.getDisplayMedia) {
            sysStream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: isChromium ? {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                systemAudio: 'include',
              } as any : true,
            });
          }
        } catch (e) {
          console.warn("System audio omitted or cancelled", e);
        }
      }

      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streams.push(micStream);
      let finalStream = micStream;

      if (sysStream && sysStream.getAudioTracks().length > 0) {
        streams.push(sysStream);
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;
        if (ctx.state === 'suspended') await ctx.resume();
        const dest = ctx.createMediaStreamDestination();
        ctx.createMediaStreamSource(micStream).connect(dest);

        const sysAudioStream = new MediaStream(sysStream.getAudioTracks());
        ctx.createMediaStreamSource(sysAudioStream).connect(dest);

        finalStream = dest.stream;
      } else if (sysStream) {
        alert("System Audio Missing: You didn't check the 'Also share tab audio' box. Only your microphone will be recorded.\n\nTip for YouTube/Music: Select 'Chrome Tab' in the popup and ensure 'Share tab audio' is toggled ON.");
        sysStream.getTracks().forEach(t => t.stop());
      }

      streamsRef.current = streams;

      let mimeType = 'audio/webm';
      const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mpeg'];
      for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }
      const recorder = new MediaRecorder(finalStream, { mimeType, audioBitsPerSecond: 64000 });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        streamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        await processAudio(blob);
      };

      recorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch (e: any) {
      console.error(e);
      alert(`Microphone access failed: ${e.message || "Denied or unavailable."}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    clearInterval(timerRef.current);
  };

  const pauseRecording = () => {
    mediaRecorderRef.current?.pause();
    setIsPaused(true);
    clearInterval(timerRef.current);
  };

  const resumeRecording = () => {
    mediaRecorderRef.current?.resume();
    setIsPaused(false);
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
  };

  const processAudio = async (blob: Blob) => {
    setIsProcessing(true);
    setStatusText('Uploading audio...');
    let transcript = '';
    let transcriptData: any[] = [];
    let aiInsights: any = null;

    try {
      const recordId = uuidv4().slice(0, 8);
      const storageRef = ref(storage, `recordings/${recordId}/audio.webm`);
      await uploadBytes(storageRef, blob);
      const audioUrl = await getDownloadURL(storageRef);

      setStatusText('Transcribing with Groq Intelligence...');
      try {
        const { fullText, segments } = await transcribeWithGroq(blob);
        transcript = fullText;
        transcriptData = segments;

        setStatusText('Generating MOM & Intelligence...');
        aiInsights = await analyzeWithGroq(transcript);
      } catch (aiErr: any) {
        console.warn("Groq Intelligence Pipeline Failed:", aiErr);
      }

      setStatusText('Saving...');
      await setDoc(doc(db, 'recordings', recordId), {
        id: recordId,
        audioUrl,
        transcript,
        transcriptData,
        aiInsights,
        createdAt: Timestamp.now(),
        authorUid: user?.uid || '',
        companyId: companyId || '',
        leadId: 'general' // No specific lead associated
      });

      navigate(`/r/${recordId}`);
    } catch (e: any) {
      console.error(e);
      if (e?.status === 429 || e?.message?.includes('quota') || e?.message?.includes('exhausted')) {
        alert(GEMINI_FALLBACK_MESSAGE);
        // Attempt to save basic record anyway if we have the audioUrl
        if (recordId && audioUrl) {
          try {
            await setDoc(doc(db, 'recordings', recordId), {
              id: recordId,
              audioUrl,
              transcript: "Intelligence services temporarily unavailable. Please re-sync later.",
              transcriptData: [],
              aiInsights: null,
              createdAt: Timestamp.now(),
              authorUid: user?.uid || '',
              companyId: companyId || '',
              leadId: 'general'
            });
            navigate(`/r/${recordId}`);
            return;
          } catch (saveErr) {
            console.error("Critical fallback save failure", saveErr);
          }
        }
      }
      alert("Failed to process recording: " + (e.message || "Unknown error"));
    } finally {
      setIsProcessing(false);
      setStatusText('');
    }
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[130] flex items-center gap-3">
        {!isRecording && !isProcessing && (
          <>
            <button onClick={startRecording} title="Record Meeting" className="flex items-center justify-center w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl shadow-indigo-600/30 hover:scale-105 active:scale-95 transition-all group border border-indigo-500">
              <Mic size={24} className="group-hover:animate-pulse" />
            </button>
          </>
        )}
        {isRecording && !isProcessing && (
          <div className="flex items-center gap-3 bg-slate-900 p-2.5 rounded-full shadow-2xl border border-slate-700">
            <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 animate-pulse">
              <Mic size={20} />
            </div>
            <div className="text-white font-mono text-xs font-bold px-2">
              {Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}
            </div>
            <button onClick={isPaused ? resumeRecording : pauseRecording} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-amber-400 hover:bg-white/20 transition-colors">
              {isPaused ? <Play size={16} className="ml-0.5" /> : <Pause size={16} />}
            </button>
            <button onClick={stopRecording} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-red-400 hover:bg-white/20 transition-colors">
              <Square size={16} />
            </button>
          </div>
        )}
      </div>
      <AnimatePresence>
        {isProcessing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md text-white text-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-indigo-400 w-12 h-12" />
              <div className="text-lg font-black">{statusText}</div>
              <div className="text-sm text-slate-400 font-medium">Please wait while we generate your meeting analytics...</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const AppContent = () => {
  const { user, companyId, role, active, onboardingComplete, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isQuickLeadOpen, setIsQuickLeadOpen] = useState(false);

  // Global deactivation check
  useEffect(() => {
    if (user && active === false && !loading) {
      signOut(auth).then(() => {
        navigate('/login', { state: { error: "Contact admin: your account is deactivated." } });
      });
    }
  }, [user, active, loading, navigate]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Close sidebar on route change automatically
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const { isDemoMode } = useDemo();

  useEffect(() => {
    if (!loading) {
      const isAuthPath = location.pathname === '/login' || location.pathname === '/register-company' || location.pathname === '/super-login';
      const isSuperPath = location.pathname.startsWith('/super-admin');
      const isOnboardingPath = location.pathname === '/onboarding';
      const isGuestPath = location.pathname.startsWith('/m/') || location.pathname.startsWith('/capture/');

      // In Demo Mode, we bypass auth checks for main app paths
      if (isDemoMode) {
        if (isAuthPath || isOnboardingPath) {
          navigate('/');
        }
        return;
      }

      if (!isGuestPath && !isSuperPath) {
        if (!user && !isAuthPath) {
          navigate('/login');
        } else if (user && !companyId && location.pathname !== '/register-company') {
          navigate('/register-company');
        } else if (user && companyId && !onboardingComplete && !isOnboardingPath) {
          navigate('/onboarding');
        } else if (user && companyId && onboardingComplete && (isAuthPath || isOnboardingPath)) {
          navigate('/');
        }
      }
    }
  }, [user, companyId, onboardingComplete, loading, navigate, location.pathname, isDemoMode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-zinc-300" size={48} />
      </div>
    );
  }

  const isGuestRoute = location.pathname.startsWith('/m/') || location.pathname.startsWith('/capture/');
  const isSuperRoute = location.pathname.startsWith('/super-admin');
  const isAuthRoute = location.pathname === '/login' || location.pathname === '/register-company' || location.pathname === '/super-login';
  const isOnboardingRoute = location.pathname === '/onboarding';

  if (isGuestRoute) {
    return (
      <div className="flex min-h-screen bg-[#0A0D14] text-white font-sans w-full">
        <Routes>
          <Route path="/m/:meetingId" element={<GuestRecord />} />
          <Route path="/capture/:companyId" element={<LeadCapture />} />
        </Routes>
      </div>
    );
  }

  if (isAuthRoute || isOnboardingRoute || isSuperRoute) {
    return (
      <div className="flex min-h-screen bg-zinc-50 text-zinc-900 font-sans w-full">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register-company" element={<RegisterCompany />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/super-login" element={<SuperLogin />} />
          <Route path="/super-admin" element={<SuperAdmin />} />
        </Routes>
      </div>
    );
  }

  if (!user || !companyId) return null;

  return (
    <div className="flex min-h-[100dvh] bg-[var(--crm-bg)] text-[var(--crm-text)] font-sans selection:bg-indigo-500/30 selection:text-white flex-row w-full overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 relative h-[100dvh] overflow-hidden w-full">
        <Navbar
          user={user}
          onMenuClick={() => setIsSidebarOpen(true)}
          onInstall={handleInstall}
          showInstallButton={!!deferredPrompt}
          onQuickLead={() => setIsQuickLeadOpen(true)}
        />
        <main className="flex-1 w-full max-w-full overflow-y-auto overflow-x-hidden scroll-smooth relative pb-12 hide-scrollbar">
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/r/:id" element={<RecordingView />} />
            {/* <Route path="/history" element={<HistoryView user={user} />} /> */}
            <Route path="/history" element={<Reports user={user} />} />
            <Route path="/clients" element={<Leads user={user} />} />
            <Route path="/active-clients" element={<Leads user={user} isActiveOnlyRoute={true} />} />
            <Route path="/clients/new" element={<LeadForm user={user} />} />
            <Route path="/clients/:id/edit" element={<LeadForm user={user} />} />
            <Route path="/upload" element={<ManualUpload user={user} />} />
            <Route path="/analytics/:id" element={<LeadInsights user={user} />} />
            <Route path="/settings" element={role === 'team_member' ? <Navigate to="/" replace /> : <Settings user={user} />} />
            <Route path="/calendar" element={<CalendarPage user={user} />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/download-app" element={<DownloadApp />} />
          </Routes>
        </main>
        <GlobalRecorder onQuickLead={() => setIsQuickLeadOpen(true)} />
        <NotificationWatcher />
        <QuickLeadModal
          isOpen={isQuickLeadOpen}
          onClose={() => setIsQuickLeadOpen(false)}
        />
        <SyncManager />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <DemoProvider>
          <AppContent />
        </DemoProvider>
      </AuthProvider>
    </Router>
  );
}
