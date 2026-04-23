import React, { useState, useEffect, useRef } from 'react';
import {
  collection, query, where, onSnapshot, addDoc, deleteDoc, doc, Timestamp, updateDoc, getDoc
} from 'firebase/firestore';
import { db } from './firebase';
import {
  Edit2, Mic,
  ChevronLeft, ChevronRight, Plus, X, Bell, Loader2,
  Clock, User, Trash2, CalendarDays, AlertCircle, CheckCircle2, Sparkles, Zap, Calendar as CalendarIcon, Info, Video, MessageSquare, ShieldCheck, Users
} from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { useDemo } from './DemoContext';
import { motion, AnimatePresence } from 'motion/react';
import { WHATSAPP_TEMPLATES, openWhatsApp } from './utils/whatsapp';
import { PageLayout } from './components/layout/PageLayout';
import { PageHeader } from './components/layout/PageHeader';
import ConfirmModal from './components/ConfirmModal';
import { sendPushToUser } from './utils/push';

interface Meeting {
  id: string;
  title: string;
  leadId: string;
  leadName?: string;
  scheduledAt: Timestamp;
  notes: string;
  companyId: string;
  reminderSent: boolean;
  meetLink?: string;
  assignedTo?: string[];
  ownerUid?: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function CalendarPage({ user }: { user: any }) {
  const { companyId, role } = useAuth();
  const { isDemoMode, demoData } = useDemo();
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [meetingToDelete, setMeetingToDelete] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(!isDemoMode);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [leads, setLeads] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [userSettings, setUserSettings] = useState({ defaultMeetUrl: '' });
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [leadSearch, setLeadSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');

  const [form, setForm] = useState({
    title: '',
    leadId: '',
    leadName: '',
    time: '10:00',
    notes: '',
    meetLink: '',
    assignedTo: [] as string[]
  });
  const [showShareTemplates, setShowShareTemplates] = useState<string | null>(null);

  const sentReminders = useRef<Set<string>>(new Set());

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Fetch user settings
  useEffect(() => {
    if (user) {
      getDoc(doc(db, 'users', user.uid)).then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          setUserSettings({ defaultMeetUrl: data.defaultMeetUrl || '' });
        }
      });
    }
  }, [user]);

  // Fetch meetings
  useEffect(() => {
    if (isDemoMode) {
      const formattedMeetings = demoData.meetings.map(m => ({
        ...m,
        scheduledAt: m.scheduledAt ? {
          ...m.scheduledAt,
          toDate: () => new Date(m.scheduledAt.seconds * 1000),
          toMillis: () => m.scheduledAt.seconds * 1000
        } : null
      }));
      setMeetings(formattedMeetings as any);
      setLoading(false);
      return;
    }

    if (!companyId) { setLoading(false); return; }
    const q = query(collection(db, 'meetings'), where('companyId', '==', companyId));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Meeting));
      const filtered = (role === 'admin' || role === 'super_admin' || role === 'management')
        ? data
        : data.filter((m: any) => m.ownerUid === user.uid || (m.assignedTo || []).includes(user.uid));
      setMeetings(filtered);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, [companyId, isDemoMode, demoData, role, user.uid]);

  // Fetch leads for the meeting modal
  useEffect(() => {
    if (isDemoMode) {
      setLeads(demoData.leads);
      return;
    }
    if (!companyId) return;
    const q = query(collection(db, 'leads'), where('companyId', '==', companyId));
    const unsub = onSnapshot(q, snap => {
      const allLeads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = (role === 'admin' || role === 'super_admin' || role === 'management')
        ? allLeads
        : allLeads.filter((l: any) => l.assignedTo === user.uid || l.authorUid === user.uid);
      setLeads(filtered);
    });

    const qUsers = query(collection(db, 'users'), where('companyId', '==', companyId));
    const unsubUsers = onSnapshot(qUsers, snap => {
      setTeamMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsub(); unsubUsers(); };
  }, [companyId, isDemoMode, demoData, role, user.uid]);

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const getMeetingsForDay = (day: number) => {
    return meetings.filter(m => {
      const d = m.scheduledAt?.toDate?.();
      if (!d) return false;
      return d.getDate() === day && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  };

  const openModal = (day: number) => {
    if (isDemoMode) return;
    const date = new Date(currentYear, currentMonth, day);
    setSelectedDate(date);
    setEditingMeetingId(null);
    setForm({
      title: '',
      leadId: '',
      leadName: '',
      time: '10:00',
      notes: '',
      meetLink: userSettings.defaultMeetUrl || '',
      assignedTo: [user.uid]
    });
    setError('');
    setShowModal(true);
  };

  const openEditModal = (m: Meeting) => {
    if (isDemoMode) return;
    const date = m.scheduledAt.toDate();
    setSelectedDate(date);
    setEditingMeetingId(m.id);
    setForm({
      title: m.title,
      leadId: m.leadId,
      leadName: m.leadName || '',
      time: date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0'),
      notes: m.notes,
      meetLink: m.meetLink || '',
      assignedTo: m.assignedTo || [user.uid]
    });
    setError('');
    setShowModal(true);
  };

  const handleShareWhatsApp = (rec: any, templateId: string) => {
    const template = WHATSAPP_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    const lead = leads.find(l => l.id === rec.leadId);
    const d = rec.scheduledAt?.toDate?.() || new Date();
    const dateTimeStr = d.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short', hour12: false });

    const text = template.generate({
      leadName: rec.leadName,
      meetingTitle: rec.title,
      dateTime: dateTimeStr,
      meetingUrl: rec.meetLink
    });

    openWhatsApp(lead?.phone || '', text);
    setShowShareTemplates(null);
  };

  const handleQuickShare = (rec: any) => {
    const template = WHATSAPP_TEMPLATES.find(t => t.id === 'meeting-invite');
    if (!template) return;
    const lead = leads.find(l => l.id === rec.leadId);

    const d = rec.scheduledAt?.toDate?.() || new Date();
    const dateTimeStr = d.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short', hour12: false });

    const text = template.generate({
      leadName: rec.leadName,
      meetingTitle: rec.title,
      dateTime: dateTimeStr,
      meetingUrl: rec.meetLink

    });

    openWhatsApp(lead?.phone || '', text);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return setError('Designation Failure: Meeting requires a title.');
    if (!selectedDate) return;
    setSaving(true);
    setError('');
    try {
      const [h, min] = form.time.split(':').map(Number);
      const scheduledDate = new Date(selectedDate);
      scheduledDate.setHours(h, min, 0, 0);

      const meetingData = {
        title: form.title,
        leadId: form.leadId || '',
        leadName: form.leadName || '',
        notes: form.notes,
        scheduledAt: Timestamp.fromDate(scheduledDate),
        companyId: companyId,
        meetLink: form.meetLink,
        assignedTo: form.assignedTo.length > 0 ? form.assignedTo : [user.uid],
      };

      if (editingMeetingId) {
        await updateDoc(doc(db, 'meetings', editingMeetingId), meetingData);
      } else {
        const meetingRef = await addDoc(collection(db, 'meetings'), {
          ...meetingData,
          ownerUid: user.uid,
          reminderSent: false,
        });

        // Generate push notification for related users only
        if (meetingData.assignedTo) {
          for (const uid of meetingData.assignedTo) {
            if (uid !== user.uid) {
              await addDoc(collection(db, 'notifications'), {
                userId: uid,
                title: '📆 New Meeting',
                message: `You were invited to meeting: ${meetingData.title}`,
                type: 'meeting_invite',
                link: '/calendar',
                createdAt: Timestamp.now(),
                read: false,
                companyId: companyId
              });
              await sendPushToUser(uid, {
                title: 'New Meeting',
                body: `You were invited to meeting: ${meetingData.title}`,
                tag: `meeting-${meetingRef.id}`,
                url: '/calendar',
              });
            }
          }
        }
      }
      setShowModal(false);
    } catch (err: any) {
      setError('Matrix Denial: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (isDemoMode) return;
    await deleteDoc(doc(db, 'meetings', id));
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const upcoming = [...meetings]
    .filter(m => m.scheduledAt?.toDate?.() >= new Date())
    .sort((a, b) => a.scheduledAt.toMillis() - b.scheduledAt.toMillis())
    .slice(0, 8);

  if (loading) {
    return (
      <PageLayout>
        <div className="space-y-12 animate-pulse">
          <div className="space-y-4 w-full">
            <div className="w-32 h-4 bg-[var(--crm-border)] rounded-full"></div>
            <div className="w-64 sm:w-96 h-12 bg-[var(--crm-border)] rounded-xl"></div>
            <div className="w-full max-w-xl h-6 bg-[var(--crm-border)] rounded"></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
            <div className="lg:col-span-3 h-[600px] bg-[var(--crm-card-bg)] border border-[var(--crm-border)] rounded-[2.5rem]"></div>
            <div className="h-[600px] bg-[var(--crm-card-bg)] border border-[var(--crm-border)] rounded-[2.5rem]"></div>
          </div>
        </div>
      </PageLayout>
    );
  }

  const inputClasses = "w-full px-4 py-3 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-bg)]/20 focus:bg-[var(--crm-bg)]/40 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold text-sm text-[var(--crm-text)] shadow-inner [&>option]:bg-[var(--crm-sidebar-bg)]";
  const labelClasses = "text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest mb-2 block px-1";

  return (
    <PageLayout>
      <PageHeader
        title=""
        description="Organize your team's schedule and keep track of client engagements with ease."
        badge="Strategic Calendar"
        icon={CalendarIcon}
        actions={
          <button
            onClick={() => {
              Notification.requestPermission();
              setSuccess('Notifications active: High-priority alerts tested.');
              setTimeout(() => setSuccess(''), 4000);
            }}
            className="btn-secondary"
          >
            <Bell size={18} /> <span className="hidden sm:inline">Alerts</span>
          </button>
        }
      />

      <AnimatePresence>
        {(error || success) && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className={`mb-10 p-5 rounded-[2rem] flex items-center gap-4 text-sm font-bold shadow-lg border ${error ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${error ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
              {error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
            </div>
            {error || success}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Calendar Grid */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-3 glass-card !bg-[var(--crm-card-bg)] !p-0 !rounded-[2.5rem] shadow-2xl border border-[var(--crm-border)] overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/20 rounded-bl-[100px] -z-0 pointer-events-none group-hover:bg-indigo-100/10 transition-colors"></div>

          {/* Month nav */}
          <div className="flex items-center justify-between px-6 md:px-10 py-6 md:py-8 border-b border-[var(--crm-border)] bg-[var(--crm-bg)]/20 relative z-10">
            <button onClick={prevMonth} className="p-2.5 md:p-3 bg-[var(--crm-bg)]/20 hover:bg-[var(--crm-bg)]/40 border border-[var(--crm-border)] rounded-2xl transition-all active:scale-90 shadow-sm"><ChevronLeft size={20} className="text-[var(--crm-text-muted)]" /></button>
            <h2 className="text-lg md:text-2xl font-black text-[var(--crm-text)] tracking-tight">{MONTHS[currentMonth]} {currentYear}</h2>
            <button onClick={nextMonth} className="p-2.5 md:p-3 bg-[var(--crm-bg)]/20 hover:bg-[var(--crm-bg)]/40 border border-[var(--crm-border)] rounded-2xl transition-all active:scale-90 shadow-sm"><ChevronRight size={20} className="text-[var(--crm-text-muted)]" /></button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 border-b border-[var(--crm-border)] bg-[var(--crm-bg)]/40 relative z-10">
            {DAYS.map(d => (
              <div key={d} className="py-4 text-center text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-[0.2em]">{d}</div>
            ))}
          </div>

          {/* Date cells */}
          <div className="grid grid-cols-7 relative z-10">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="h-20 sm:h-36 border-b border-r border-white/5 bg-transparent" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayMeetings = getMeetingsForDay(day);
              const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();

              return (
                <div
                  key={day}
                  onClick={() => openModal(day)}
                  className={`h-20 sm:h-36 border-b border-r border-[var(--crm-border)] p-1 sm:p-4 cursor-pointer transition-all group/cell hover:bg-indigo-500/10 ${isToday ? 'bg-indigo-500/20' : 'bg-transparent'}`}
                >
                  <div className={`text-[10px] sm:text-xs font-black w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg sm:rounded-xl mb-1.5 sm:mb-3 transition-all ${isToday ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-[var(--crm-text-muted)] group-hover/cell:text-indigo-300 group-hover/cell:bg-indigo-500/20 group-hover/cell:shadow-sm'}`}>
                    {day}
                  </div>
                  {/* Desktop View: Full Text */}
                  <div className="hidden sm:block space-y-1.5 overflow-hidden">
                    {dayMeetings.slice(0, 3).map(m => (
                      <div key={m.id} className="relative group/meeting">
                        <div
                          className="text-[9px] font-black bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-lg truncate border border-indigo-500/30 shadow-sm transition-all group-hover/cell:scale-105"
                        >
                          {m.scheduledAt?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} · {m.title}
                        </div>

                        {/* Quick Actions Hover */}
                        <div className="absolute inset-0 bg-indigo-600 rounded-lg opacity-0 group-hover/meeting:opacity-100 transition-opacity flex items-center justify-center gap-3 z-10">
                          <button onClick={(e) => { e.stopPropagation(); openEditModal(m); }} className="text-white hover:scale-125 transition-transform" title="Edit Meeting"><Sparkles size={10} /></button>
                          {m.meetLink && (
                            <button onClick={(e) => { e.stopPropagation(); window.open(m.meetLink, '_blank'); }} className="text-white hover:scale-125 transition-transform" title="Join Meet"><Video size={10} /></button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); handleQuickShare(m); }} className="text-white hover:scale-125 transition-transform" title="WhatsApp Invite"><MessageSquare size={10} /></button>
                        </div>
                      </div>
                    ))}
                    {dayMeetings.length > 3 && (
                      <div className="text-[9px] text-[var(--crm-text-muted)] font-bold uppercase tracking-tighter pl-1">+{dayMeetings.length - 3} more</div>
                    )}
                  </div>
                  {/* Mobile View: Markers (Dots) */}
                  <div className="flex sm:hidden flex-wrap gap-1 mt-auto">
                    {dayMeetings.slice(0, 6).map(m => (
                      <div key={m.id} className="w-1 h-1 rounded-full bg-indigo-500 shadow-[0_0_4px_rgba(99,102,241,0.6)]" />
                    ))}
                    {dayMeetings.length > 6 && <div className="text-[6px] text-indigo-400 font-black">+</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Upcoming Meetings Sidebar */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <div className="glass-card !bg-[var(--crm-card-bg)] !border-[var(--crm-border)] !rounded-[2.5rem] p-8 text-[var(--crm-text)] relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-[40px] pointer-events-none translate-x-1/2 -translate-y-1/2"></div>

            <h3 className="text-xs font-black text-indigo-400 tracking-[0.2em] uppercase mb-8 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center"><Clock size={16} /></div>
              Upcoming
            </h3>

            {upcoming.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 bg-[var(--crm-control-bg)] border border-[var(--crm-border)] rounded-2xl flex items-center justify-center text-[var(--crm-text-muted)]/40 mx-auto mb-4">
                  <CalendarIcon size={24} />
                </div>
                <p className="text-[var(--crm-text-muted)] text-xs font-bold leading-relaxed italic opacity-70">
                  Calendar is clear.<br />Select a node to begin.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {upcoming.map((m, idx) => {
                  const d = m.scheduledAt?.toDate?.();
                  return (
                    <motion.div
                      initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
                      key={m.id} className="p-5 rounded-2xl bg-[var(--crm-control-bg)] border border-[var(--crm-border)] group/item hover:bg-[var(--crm-control-hover-bg)] hover:border-indigo-400/30 transition-all relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between gap-3 relative z-10">
                        <div className="min-w-0 w-full space-y-2">
                          {/* Title */}
                          <div className="font-black text-[var(--crm-text)] text-sm truncate tracking-tight mb-1">{m.title}</div>

                          {/* Date/Time */}
                          <div className="flex items-center gap-2 text-[10px] text-indigo-400 font-black uppercase tracking-widest bg-indigo-500/10 px-2 py-1 w-fit rounded-lg border border-indigo-500/20">
                            <Clock size={12} />
                            {d?.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · {d?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </div>

                          {/* Entity Tags */}
                          <div className="flex flex-col gap-1.5 mt-2">
                            {m.leadName && (
                              <div className="flex items-center gap-2 text-[10px] text-[var(--crm-text-muted)] font-bold">
                                <User size={10} />
                                <span className="text-[var(--crm-text)] truncate">{m.leadName}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 mt-5 relative z-10">
                        {m.meetLink ? (
                          <button
                            onClick={() => window.open(m.meetLink, '_blank')}
                            className="flex-1 btn-primary !py-2 !px-3 text-[10px] shadow-sm"
                          >
                            <Video size={12} /> Meet
                          </button>
                        ) : (
                          <button
                            onClick={() => handleQuickShare(m)}
                            className="flex-1 btn-primary !py-2 !px-3 text-[10px] shadow-sm"
                          >
                            <MessageSquare size={12} /> WhatsApp
                          </button>
                        )}
                        <button
                          onClick={() => handleQuickShare(m)}
                          className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all"
                          title="WhatsApp Invite"
                        >
                          <MessageSquare size={12} />
                        </button>
                        <button
                          onClick={() => openEditModal(m)}
                          className="p-2 rounded-xl bg-[var(--crm-bg)]/40 hover:bg-[var(--crm-bg)] border border-[var(--crm-border)] transition-all"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => setMeetingToDelete(m.id)}
                          className="p-2 rounded-xl bg-[var(--crm-bg)]/40 hover:bg-rose-500/20 text-rose-400 border border-[var(--crm-border)] transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Create/Edit Meeting Modal */}
      <AnimatePresence>
        {showModal && selectedDate && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 50 }}
              className="bg-[var(--crm-sidebar-bg)] sm:rounded-[2.5rem] shadow-2xl w-full h-full sm:h-auto sm:max-w-xl border border-[var(--crm-border)] relative z-10 overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-6 md:px-10 py-6 md:py-8 border-b border-[var(--crm-border)] bg-[var(--crm-bg)]/20 relative z-10 shrink-0">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-[var(--crm-text)] tracking-tight">
                    {editingMeetingId ? 'Modify Strategy' : 'Schedule Meeting'}
                  </h2>
                  <div className="text-[9px] md:text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1 md:mt-2 flex items-center gap-2">
                    <CalendarIcon size={12} />
                    {selectedDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2.5 bg-[var(--crm-bg)]/20 hover:bg-[var(--crm-bg)]/40 rounded-2xl transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 md:p-10 space-y-6 md:space-y-8 relative z-10 overflow-y-auto flex-1 custom-scrollbar">
                {error && (
                  <div className="p-4 bg-rose-500/10 text-rose-400 text-xs rounded-2xl flex items-center gap-3 font-bold border border-rose-500/20 shadow-lg">
                    <AlertCircle size={18} className="shrink-0" /> {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  <div className="space-y-6">
                    <div>
                      <label className={labelClasses}>Meeting Title</label>
                      <input
                        type="text"
                        value={form.title}
                        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="e.g. Discovery Call"
                        className={inputClasses}
                      />
                    </div>

                    <div>
                      <label className={labelClasses}>Meeting Time</label>
                      <div className="relative">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--crm-text-muted)]" size={18} />
                        <input
                          type="time"
                          value={form.time}
                          onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                          className={`${inputClasses} pl-12 [color-scheme:dark]`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={labelClasses}>Meet Link (URL)</label>
                      <div className="relative">
                        <Video className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--crm-text-muted)]" size={18} />
                        <input
                          type="url"
                          value={form.meetLink}
                          onChange={e => setForm(f => ({ ...f, meetLink: e.target.value }))}
                          placeholder="https://meet.google.com/..."
                          className={`${inputClasses} pl-12`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className={labelClasses}>Target Lead</label>
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Search lead..."
                          value={leadSearch}
                          onChange={e => setLeadSearch(e.target.value)}
                          className={`${inputClasses} !bg-[var(--crm-control-bg)] border-dashed`}
                        />
                        <select
                          value={form.leadId}
                          onChange={e => {
                            const lead = leads.find(l => l.id === e.target.value);
                            setForm(f => ({ ...f, leadId: e.target.value, leadName: lead?.name || '' }));
                          }}
                          className={`${inputClasses} !appearance-none`}
                        >
                          <option value="">— No Lead Selected —</option>
                          {leads
                            .filter(l => l.name?.toLowerCase().includes(leadSearch.toLowerCase()) || l.company?.toLowerCase().includes(leadSearch.toLowerCase()))
                            .map(l => <option key={l.id} value={l.id}>{l.name} {l.company ? `(${l.company})` : ''}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className={labelClasses}>Assigned Representatives</label>
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Search member..."
                          value={memberSearch}
                          onChange={e => setMemberSearch(e.target.value)}
                          className={`${inputClasses} !bg-[var(--crm-control-bg)] border-dashed`}
                        />
                        <div className="bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] rounded-2xl p-4 max-h-[160px] overflow-y-auto space-y-3 custom-scrollbar">
                          {teamMembers
                            .filter(m => (m.displayName || m.email).toLowerCase().includes(memberSearch.toLowerCase()))
                            .map(m => {
                              const isSelected = form.assignedTo.includes(m.id);
                              return (
                                <div
                                  key={m.id}
                                  onClick={() => {
                                    if (role === 'team_member' && m.id !== user.uid) return;
                                    setForm(f => ({
                                      ...f,
                                      assignedTo: isSelected
                                        ? f.assignedTo.filter(id => id !== m.id)
                                        : [...f.assignedTo, m.id]
                                    }));
                                  }}
                                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${isSelected ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-transparent border-transparent hover:bg-[var(--crm-control-bg)]'}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] ${isSelected ? 'bg-indigo-500 text-white' : 'bg-[var(--crm-border)] text-[var(--crm-text-muted)]'}`}>
                                      {m.displayName?.[0] || m.email?.[0] || 'U'}
                                    </div>
                                    <div>
                                      <div className={`text-xs font-bold ${isSelected ? 'text-[var(--crm-text)]' : 'text-[var(--crm-text-muted)]'}`}>{m.displayName || m.email?.split('@')[0]}</div>
                                      <div className="text-[9px] font-black uppercase text-indigo-400 opacity-60 tracking-tighter">{m.role}</div>
                                    </div>
                                  </div>
                                  {isSelected ? <CheckCircle2 size={16} className="text-indigo-400" /> : <div className="w-4 h-4 rounded-full border-2 border-[var(--crm-border)]" />}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className={labelClasses}>Notes</label>
                    <textarea
                      value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Objectives and key talking points..."
                      rows={4}
                      className={`${inputClasses} resize-none py-4`}
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 md:px-10 pb-6 md:pb-10 pt-4 md:pt-0 border-t sm:border-t-0 border-[var(--crm-border)] flex gap-4 relative z-10 shrink-0 bg-[var(--crm-sidebar-bg)]">
                <button onClick={() => setShowModal(false)} className="flex-1 py-4 rounded-2xl font-black text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] hover:bg-[var(--crm-control-bg)] transition-all text-xs md:text-sm uppercase tracking-widest">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary shadow-xl shadow-indigo-500/20 disabled:opacity-50 !py-4 text-xs md:text-sm">
                  {saving ? <Loader2 size={20} className="animate-spin" /> : (editingMeetingId ? <Sparkles size={18} /> : <Plus size={18} />)}
                  <span>{editingMeetingId ? 'Update Protocol' : 'Schedule Meeting'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <ConfirmModal
        open={meetingToDelete !== null}
        title="Delete meeting?"
        message="This scheduled meeting will be removed from the calendar."
        confirmLabel="Delete meeting"
        onCancel={() => setMeetingToDelete(null)}
        onConfirm={async () => {
          if (!meetingToDelete) return;
          const id = meetingToDelete;
          setMeetingToDelete(null);
          await handleDelete(id);
        }}
      />
    </PageLayout>
  );
}
