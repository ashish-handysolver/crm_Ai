import React, { useState, useEffect, useRef } from 'react';
import {
  collection, query, where, onSnapshot, addDoc, deleteDoc, doc, Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import {
  ChevronLeft, ChevronRight, Plus, X, Bell, Loader2,
  Clock, User, Trash2, CalendarDays, AlertCircle, CheckCircle2
} from 'lucide-react';

interface Meeting {
  id: string;
  title: string;
  leadName: string;
  leadId: string;
  scheduledAt: Timestamp;
  notes: string;
  ownerUid: string;
  reminderSent: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function CalendarPage({ user }: { user: any }) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [leads, setLeads] = useState<any[]>([]);

  const [form, setForm] = useState({ title: '', leadId: '', leadName: '', time: '10:00', notes: '' });

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
    if (!user) { setLoading(false); return; }
    const q = query(collection(db, 'meetings'), where('ownerUid', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Meeting));
      setMeetings(data);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  // Fetch leads for the meeting modal
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'leads'), where('ownerUid', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

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
          // Browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('📅 Meeting Starting Soon!', {
              body: `"${m.title}" with ${m.leadName} starts in ${Math.ceil(diffMin)} minute(s).`,
              icon: '/favicon.ico',
              tag: m.id,
            });
          }
          // In-app alert fallback
          setSuccess(`⏰ Reminder: "${m.title}" with ${m.leadName} starts in ${Math.ceil(diffMin)} min!`);
          setTimeout(() => setSuccess(''), 15000);
        }
      });
    }, 30000); // check every 30s

    return () => {
      if (reminderCheckRef.current) clearInterval(reminderCheckRef.current);
    };
  }, [meetings]);

  // Calendar grid helpers
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
    const date = new Date(currentYear, currentMonth, day);
    setSelectedDate(date);
    setForm({ title: '', leadId: '', leadName: '', time: '10:00', notes: '' });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return setError('Please enter a meeting title.');
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
        leadName: form.leadName || form.title,
        notes: form.notes,
        scheduledAt: Timestamp.fromDate(scheduledDate),
        ownerUid: user.uid,
        reminderSent: false,
      });
      setShowModal(false);
    } catch (err: any) {
      setError('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this meeting?')) return;
    await deleteDoc(doc(db, 'meetings', id));
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  // Upcoming meetings sorted
  const upcoming = [...meetings]
    .filter(m => m.scheduledAt?.toDate?.() >= new Date())
    .sort((a, b) => a.scheduledAt.toMillis() - b.scheduledAt.toMillis())
    .slice(0, 8);

  if (loading) return <div className="flex-1 flex items-center justify-center min-h-screen"><Loader2 size={32} className="animate-spin text-slate-300" /></div>;

  return (
    <div className="flex-1 bg-[#f8fafc] text-slate-900 p-8 min-h-screen">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <div className="text-xs font-extrabold text-indigo-500 tracking-widest uppercase mb-1.5 flex items-center gap-2">
              <CalendarDays size={14} /> Meeting Scheduler
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Calendar
            </h1>
          </div>
          <button
            onClick={() => { Notification.requestPermission(); setSuccess('Notifications enabled! You will be alerted 10 minutes before each meeting.'); setTimeout(() => setSuccess(''), 4000); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-all"
          >
            <Bell size={16} /> Enable Reminders
          </button>
        </header>

        {/* Alerts */}
        {(error || success) && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-medium border ${error ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
            {error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            {error || success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Grid */}
          <div className="lg:col-span-2 bg-white rounded-[2rem] shadow-sm border border-slate-200/60 overflow-hidden">
            {/* Month nav */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100">
              <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><ChevronLeft size={20} /></button>
              <h2 className="text-xl font-extrabold text-slate-800">{MONTHS[currentMonth]} {currentYear}</h2>
              <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><ChevronRight size={20} /></button>
            </div>

            {/* Day names */}
            <div className="grid grid-cols-7 border-b border-slate-100">
              {DAYS.map(d => (
                <div key={d} className="py-3 text-center text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">{d}</div>
              ))}
            </div>

            {/* Date cells */}
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="h-24 border-b border-r border-slate-50/80" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayMeetings = getMeetingsForDay(day);
                const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
                return (
                  <div
                    key={day}
                    onClick={() => openModal(day)}
                    className={`h-24 border-b border-r border-slate-50/80 p-2 cursor-pointer transition-all group hover:bg-blue-50/40 ${isToday ? 'bg-indigo-50/50' : ''}`}
                  >
                    <div className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mb-1 transition-colors ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700'}`}>
                      {day}
                    </div>
                    <div className="space-y-0.5 overflow-hidden">
                      {dayMeetings.slice(0, 2).map(m => (
                        <div key={m.id} className="text-[10px] font-bold bg-indigo-500 text-white px-1.5 py-0.5 rounded-md truncate">
                          {m.scheduledAt?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {m.title}
                        </div>
                      ))}
                      {dayMeetings.length > 2 && (
                        <div className="text-[10px] text-slate-400 font-bold">+{dayMeetings.length - 2} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Meetings */}
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200/60 p-6 flex-1">
              <h3 className="text-base font-extrabold text-slate-700 mb-4 flex items-center gap-2">
                <Clock size={16} className="text-indigo-500" /> Upcoming Meetings
              </h3>
              {upcoming.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm font-medium">
                  No upcoming meetings.<br />Click any date to schedule one.
                </div>
              ) : (
                <div className="space-y-3">
                  {upcoming.map(m => {
                    const d = m.scheduledAt?.toDate?.();
                    return (
                      <div key={m.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-indigo-200 hover:bg-indigo-50/30 transition-all">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-extrabold text-slate-800 text-sm truncate">{m.title}</div>
                            {m.leadName && (
                              <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5 font-medium">
                                <User size={11} /> {m.leadName}
                              </div>
                            )}
                            <div className="text-[11px] text-indigo-600 font-bold mt-1.5 flex items-center gap-1">
                              <CalendarDays size={11} />
                              {d?.toLocaleDateString([], { month: 'short', day: 'numeric' })} · {d?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <button onClick={() => handleDelete(m.id)} className="shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                            <Trash2 size={13} />
                          </button>
                        </div>
                        {m.notes && <p className="text-[11px] text-slate-400 mt-2 line-clamp-1">{m.notes}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Meeting Modal */}
      {showModal && selectedDate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-100">
            <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-extrabold text-slate-800">Schedule Meeting</h2>
                <p className="text-xs text-indigo-500 font-bold mt-0.5">
                  {selectedDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                <X size={18} />
              </button>
            </div>

            <div className="px-7 py-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl flex items-center gap-2 font-medium">
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Meeting Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="E.g. Discovery Call, Product Demo"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Time</label>
                <input
                  type="time"
                  value={form.time}
                  onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Lead (Optional)</label>
                <select
                  value={form.leadId}
                  onChange={e => {
                    const lead = leads.find(l => l.id === e.target.value);
                    setForm(f => ({ ...f, leadId: e.target.value, leadName: lead?.name || '' }));
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium text-sm"
                >
                  <option value="">— Select a Lead —</option>
                  {leads.map(l => <option key={l.id} value={l.id}>{l.name} {l.company ? `(${l.company})` : ''}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Agenda, talking points, etc."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium text-sm resize-none"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 font-medium">
                <Bell size={14} /> You will receive a browser notification 10 minutes before this meeting.
              </div>
            </div>

            <div className="px-7 pb-6 flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50 border border-slate-200 transition-all text-sm">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Schedule Meeting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
