import React, { useState, useEffect, useRef } from 'react';
import {
  collection, query, where, onSnapshot, addDoc, deleteDoc, doc, Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import {
  ChevronLeft, ChevronRight, Plus, X, Bell, Loader2,
  Clock, User, Trash2, CalendarDays, AlertCircle, CheckCircle2, Sparkles, Zap, Calendar as CalendarIcon, Info, Video
} from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { useDemo } from './DemoContext';
import { motion, AnimatePresence } from 'motion/react';

interface Meeting {
  id: string;
  title: string;
  leadId: string;
  leadName?: string;
  scheduledAt: Timestamp;
  notes: string;
  companyId: string;
  reminderSent: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function CalendarPage({ user }: { user: any }) {
  const { companyId } = useAuth();
  const { isDemoMode, demoData } = useDemo();
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(!isDemoMode);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [leads, setLeads] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', leadId: '', leadName: '', time: '10:00', notes: '' });

  // Waiting ringtone — generated via Web Audio API (no external URL needed)
  const playPulseSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (freq1: number, freq2: number, startAt: number, duration: number) => {
        [freq1, freq2].forEach(freq => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
          gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + startAt + 0.02);
          gain.gain.setValueAtTime(0.18, ctx.currentTime + startAt + duration - 0.02);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + startAt + duration);
          osc.start(ctx.currentTime + startAt);
          osc.stop(ctx.currentTime + startAt + duration);
        });
      };
      // Ring pattern: 7 cycles × ~1.4s = ~10 seconds of ringing
      for (let i = 0; i < 7; i++) {
        const base = i * 1.4;
        playTone(480, 440, base, 0.4); // first ring
        playTone(480, 440, base + 0.6, 0.4); // second ring
      }
      setTimeout(() => ctx.close(), 11000);
    } catch (e) {
      console.error('Ringtone playback failed:', e);
    }
  };

  const reminderCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sentReminders = useRef<Set<string>>(new Set());

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

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
      setMeetings(data);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, [companyId, isDemoMode, demoData]);

  // Fetch leads for the meeting modal
  useEffect(() => {
    if (isDemoMode) {
      setLeads(demoData.leads);
      return;
    }
    if (!companyId) return;
    const q = query(collection(db, 'leads'), where('companyId', '==', companyId));
    const unsub = onSnapshot(q, snap => {
      setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [companyId, isDemoMode, demoData]);

  // 10-minute reminder checker
  useEffect(() => {
    reminderCheckRef.current = setInterval(() => {
      const now = new Date();
      meetings.forEach(m => {
        if (sentReminders.current.has(m.id)) return;
        const meetingTime = m.scheduledAt?.toDate?.();
        if (!meetingTime) return;
        const diffMs = meetingTime.getTime() - now.getTime();
        const diffMin = diffMs / 60000;
        if (diffMin > 0 && diffMin <= 10) {
          sentReminders.current.add(m.id);
          playPulseSound();
          // Browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('📅 Temporal Alignment Detected', {
              body: `"${m.title}" with ${m.leadName || 'Entity'} initiates in ${Math.ceil(diffMin)} minute(s).`,
              icon: '/favicon.ico',
              tag: m.id,
            });
          }
          setSuccess(`⏰ Proximity Alert: "${m.title}" with ${m.leadName || 'Lead'} starts in ${Math.ceil(diffMin)} min.`);
          setTimeout(() => setSuccess(''), 15000);
        }
      });
    }, 30000);

    return () => {
      if (reminderCheckRef.current) clearInterval(reminderCheckRef.current);
    };
  }, [meetings]);

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
    setForm({ title: '', leadId: '', leadName: '', time: '10:00', notes: '' });
    setError('');
    setShowModal(true);
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

      await addDoc(collection(db, 'meetings'), {
        title: form.title,
        leadId: form.leadId || '',
        leadName: form.leadName || '',
        notes: form.notes,
        scheduledAt: Timestamp.fromDate(scheduledDate),
        companyId: companyId,
        ownerUid: user.uid,
        reminderSent: false,
      });
      setShowModal(false);
    } catch (err: any) {
      setError('Matrix Denial: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (isDemoMode) return;
    if (!window.confirm('Erase this temporal entry?')) return;
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
      <div className="flex-1 bg-slate-50/50 text-black p-4 sm:p-8 lg:p-12 min-h-full font-sans overflow-x-hidden">
        <div className="max-w-7xl mx-auto animate-pulse">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
            <div className="space-y-4 w-full">
              <div className="w-32 h-4 bg-slate-200 rounded-full"></div>
              <div className="w-64 sm:w-96 h-12 bg-slate-200 rounded-xl"></div>
              <div className="w-full max-w-xl h-6 bg-slate-200 rounded"></div>
            </div>
            <div className="w-48 h-14 bg-slate-200 rounded-2xl shrink-0"></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
            <div className="lg:col-span-3 h-[600px] bg-slate-200/50 rounded-[2.5rem]"></div>
            <div className="h-[600px] bg-slate-200/50 rounded-[2.5rem]"></div>
          </div>
        </div>
      </div>
    );
  }

  const inputClasses = "w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:bg-white outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all font-bold text-sm text-slate-700 shadow-sm";
  const labelClasses = "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1";

  return (
    <div className="flex-1 bg-slate-50/50 text-black p-4 sm:p-8 lg:p-12 min-h-full font-sans overflow-x-hidden">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="text-[10px] font-black text-indigo-600 tracking-[0.25em] uppercase mb-4 flex items-center gap-2">
              <CalendarIcon size={14} className="fill-indigo-600 animate-pulse" /> Meeting Scheduler
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-slate-900 leading-none uppercase">Team Calendar</h1>
            <p className="text-slate-500 mt-4 text-lg font-medium max-w-xl leading-relaxed italic">
              Coordinate client meetings and internal strategy sessions in real-time.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <button
              onClick={() => {
                Notification.requestPermission();
                playPulseSound();
                setSuccess('Notifications active: High-priority alerts tested.');
                setTimeout(() => setSuccess(''), 4000);
              }}
              className="group flex items-center gap-3 px-8 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl text-sm font-black hover:border-indigo-200 hover:text-indigo-600 shadow-sm transition-all active:scale-95 uppercase tracking-widest"
            >
              <Bell size={18} className="group-hover:rotate-12 transition-transform" />
              Test Notifications
            </button>
          </motion.div>
        </header>

        {/* Alerts */}
        <AnimatePresence>
          {(error || success) && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className={`mb-10 p-5 rounded-[2rem] flex items-center gap-4 text-sm font-bold shadow-lg border ${error ? 'bg-rose-50 text-rose-600 border-rose-100 shadow-rose-500/5' : 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-emerald-500/5'}`}>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${error ? 'bg-rose-500 text-white shadow-rose-500/20' : 'bg-emerald-500 text-white shadow-emerald-500/20'}`}>
                {error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
              </div>
              {error || success}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">

          {/* Calendar Grid */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-3 glass-card !p-0 !rounded-[2.5rem] shadow-2xl border-white/40 overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/20 rounded-bl-[100px] -z-0 pointer-events-none group-hover:bg-indigo-100/10 transition-colors"></div>

            {/* Month nav */}
            <div className="flex items-center justify-between px-10 py-8 border-b border-slate-100 relative z-10">
              <button onClick={prevMonth} className="p-3 bg-white hover:bg-slate-50 border border-slate-100 rounded-2xl transition-all active:scale-90 hover:shadow-md"><ChevronLeft size={20} className="text-slate-600" /></button>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">{MONTHS[currentMonth]} {currentYear}</h2>
              <button onClick={nextMonth} className="p-3 bg-white hover:bg-slate-50 border border-slate-100 rounded-2xl transition-all active:scale-90 hover:shadow-md"><ChevronRight size={20} className="text-slate-600" /></button>
            </div>

            {/* Day names */}
            <div className="grid grid-cols-7 border-b border-slate-50 bg-slate-50/30 relative z-10">
              {DAYS.map(d => (
                <div key={d} className="py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{d}</div>
              ))}
            </div>

            {/* Date cells */}
            <div className="grid grid-cols-7 relative z-10">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="h-28 sm:h-36 border-b border-r border-slate-100/60 bg-slate-50/5" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayMeetings = getMeetingsForDay(day);
                const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();

                return (
                  <div
                    key={day}
                    onClick={() => openModal(day)}
                    className={`h-28 sm:h-36 border-b border-r border-slate-100/60 p-2 sm:p-4 cursor-pointer transition-all group/cell hover:bg-indigo-50/30 ${isToday ? 'bg-indigo-50/20' : ''}`}
                  >
                    <div className={`text-xs font-black w-8 h-8 flex items-center justify-center rounded-xl mb-3 transition-all ${isToday ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 group-hover/cell:text-indigo-600 group-hover/cell:bg-white group-hover/cell:shadow-sm'}`}>
                      {day}
                    </div>
                    <div className="space-y-1.5 overflow-hidden">
                      {dayMeetings.slice(0, 3).map(m => (
                        <div key={m.id} className="text-[9px] font-black bg-white text-indigo-700 px-2 py-1 rounded-lg truncate border border-slate-100 shadow-sm transition-all group-hover/cell:scale-105">
                          {m.scheduledAt?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} · {m.title}
                        </div>
                      ))}
                      {dayMeetings.length > 3 && (
                        <div className="text-[9px] text-slate-300 font-bold uppercase tracking-tighter pl-1">+{dayMeetings.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Upcoming Meetings Sidebar */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-[40px] pointer-events-none translate-x-1/2 -translate-y-1/2"></div>

              <h3 className="text-xs font-black text-indigo-400 tracking-[0.2em] uppercase mb-8 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center"><Clock size={16} /></div>
                Agenda
              </h3>

              {upcoming.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white/20 mx-auto mb-4">
                    <CalendarIcon size={24} />
                  </div>
                  <p className="text-white/40 text-xs font-bold leading-relaxed italic">
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
                        key={m.id} className="p-5 rounded-2xl bg-white/5 border border-white/5 group/item hover:bg-white/10 hover:border-indigo-400/30 transition-all relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between gap-3 relative z-10">
                          <div className="min-w-0">
                            <div className="font-black text-white text-sm truncate tracking-tight">{m.title}</div>
                            <div className="flex items-center gap-2 text-[10px] text-indigo-400 font-black uppercase mt-1.5 tracking-widest">
                              <CalendarIcon size={12} />
                              {d?.toLocaleDateString([], { month: 'short', day: 'numeric' })} · {d?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                            </div>
                            {m.leadName && (
                              <div className="flex items-center gap-2 text-[10px] text-white/40 font-bold mt-1">
                                <User size={10} /> Lead: {m.leadName}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 mt-4 relative z-10">
                          <button
                            onClick={() => window.open(`/m/${m.id}`, '_blank')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 hover:text-white text-[10px] font-black tracking-widest uppercase transition-all active:scale-95"
                          >
                            <Video size={11} /> Launch Hub
                          </button>
                          <button onClick={() => handleDelete(m.id)} className="ml-auto p-2 text-white/10 hover:text-rose-400 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Legend / Information */}

          </motion.div>
        </div>
      </div>

      {/* Create Meeting Modal */}
      <AnimatePresence>
        {showModal && selectedDate && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl border border-slate-100 relative z-10 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-bl-[100px] -z-0 pointer-events-none"></div>

              <div className="flex items-center justify-between px-10 py-8 border-b border-slate-50 relative z-10">
                <div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">Schedule Meeting</h2>
                  <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-2 flex items-center gap-2">
                    <CalendarIcon size={14} />
                    {selectedDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-colors text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <div className="p-10 space-y-8 relative z-10">
                {error && (
                  <div className="p-4 bg-rose-50 text-rose-600 text-xs rounded-2xl flex items-center gap-3 font-bold border border-rose-100 shadow-lg shadow-rose-500/5">
                    <AlertCircle size={18} /> {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                        <input
                          type="time"
                          value={form.time}
                          onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                          className={`${inputClasses} pl-12`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className={labelClasses}>Target Lead</label>
                      <select
                        value={form.leadId}
                        onChange={e => {
                          const lead = leads.find(l => l.id === e.target.value);
                          setForm(f => ({ ...f, leadId: e.target.value, leadName: lead?.name || '' }));
                        }}
                        className={`${inputClasses} !appearance-none`}
                      >
                        <option value="">— No Lead Selected —</option>
                        {leads.map(l => <option key={l.id} value={l.id}>{l.name} {l.company ? `(${l.company})` : ''}</option>)}
                      </select>
                    </div>

                    <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <Bell size={16} />
                      </div>
                      <p className="text-[10px] font-bold text-indigo-700 leading-relaxed uppercase tracking-widest">
                        Smart notifications enabled. You will receive a reminder 10 minutes before the start.
                      </p>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className={labelClasses}>Agenda & Notes</label>
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

              <div className="px-10 pb-10 flex gap-4 relative z-10">
                <button onClick={() => setShowModal(false)} className="flex-1 py-4 rounded-2xl font-black text-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-all text-sm uppercase tracking-widest">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary shadow-xl shadow-indigo-100 disabled:opacity-50 !py-4">
                  {saving ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                  <span>Schedule Meeting</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
