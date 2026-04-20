import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, CalendarDays, Clock, FileText, Search, Target, UserCheck, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './contexts/AuthContext';
import { useDemo } from './DemoContext';

type ActivityLogRecord = {
  id: string;
  leadId?: string;
  type?: string;
  action?: string;
  authorUid?: string;
  authorName?: string;
  createdAt?: any;
  details?: {
    field?: string;
    oldValue?: any;
    newValue?: any;
    note?: string;
  };
};

type TeamMember = {
  id: string;
  uid?: string;
  displayName?: string;
  email?: string;
  role?: string;
};

type LeadSummary = {
  id: string;
  name?: string;
  contactName?: string;
  company?: string;
  companyName?: string;
  email?: string;
};

const canViewManagement = (role: string | null) =>
  role === 'admin' || role === 'super_admin' || role === 'management';

const toDateInputValue = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const getLogDate = (log: ActivityLogRecord) => {
  const rawDate = log.createdAt?.toDate?.() || log.createdAt;
  const date = rawDate instanceof Date ? rawDate : rawDate ? new Date(rawDate) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const getMemberKey = (log: ActivityLogRecord) => log.authorUid || log.authorName || 'unknown';

const formatLogTime = (log: ActivityLogRecord) => {
  const date = getLogDate(log);
  if (!date) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatValue = (value: any) => {
  if (typeof value === 'boolean') return value ? 'Interested' : 'Not interested';
  if (value === null || value === undefined || value === '') return 'Empty';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const getDetailText = (log: ActivityLogRecord) => {
  const details = log.details;
  if (!details) return 'No extra details added';
  if (details.note) return details.note;
  if (details.field || details.oldValue !== undefined || details.newValue !== undefined) {
    const field = details.field || 'Value';
    return `${field}: ${formatValue(details.oldValue)} -> ${formatValue(details.newValue)}`;
  }
  return 'No extra details added';
};

const getActivityTone = (type?: string) => {
  const value = (type || '').toUpperCase();
  if (value.includes('INTEREST')) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20';
  if (value.includes('CALL')) return 'bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/20';
  if (value.includes('HEALTH') || value.includes('STATUS')) return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20';
  if (value.includes('NOTE')) return 'bg-violet-500/10 text-violet-600 dark:text-violet-300 border-violet-500/20';
  return 'bg-slate-500/10 text-[var(--crm-text-muted)] border-[var(--crm-border)]';
};

export default function ManagementActivity({ user }: { user: any }) {
  const { companyId, role } = useAuth();
  const { isDemoMode, demoData } = useDemo();
  const [logs, setLogs] = React.useState<ActivityLogRecord[]>([]);
  const [members, setMembers] = React.useState<TeamMember[]>([]);
  const [leads, setLeads] = React.useState<LeadSummary[]>([]);
  const [selectedDate, setSelectedDate] = React.useState('');
  const [selectedMember, setSelectedMember] = React.useState('ALL');
  const [selectedType, setSelectedType] = React.useState('ALL');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [loading, setLoading] = React.useState(!isDemoMode);

  const allowed = canViewManagement(role);

  React.useEffect(() => {
    if (!allowed) return;

    if (isDemoMode) {
      const now = new Date();
      const demoMembers = (demoData.team || []).map((member: any) => ({
        id: member.id || member.uid || member.email,
        uid: member.uid || member.id,
        displayName: member.displayName || member.name || member.email,
        email: member.email,
        role: member.role
      }));

      const demoLeads = (demoData.leads || []).slice(0, 5).map((lead: any) => ({
        id: lead.id,
        name: lead.name,
        company: lead.company,
        email: lead.email
      }));

      const demoLogs = demoLeads.map((lead: any, index: number) => {
        const member = demoMembers[index % Math.max(demoMembers.length, 1)] || {};
        return {
          id: `demo-log-${index}`,
          leadId: lead.id,
          type: index % 2 === 0 ? 'STATUS_CHANGE' : 'MANUAL_NOTE',
          action: index % 2 === 0 ? 'Lead status updated' : 'Follow-up note added',
          authorUid: member.uid || member.id || 'demo-user',
          authorName: member.displayName || 'Demo member',
          createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10 + index, 15),
          details: index % 2 === 0
            ? { field: 'status', oldValue: 'Discovery', newValue: 'Connected' }
            : { note: 'Customer asked for pricing and callback tomorrow.' }
        };
      });

      setMembers(demoMembers);
      setLeads(demoLeads);
      setLogs(demoLogs);
      setLoading(false);
      return;
    }

    if (!companyId) return;

    setLoading(true);
    const activityQuery = query(collection(db, 'activity_logs'), where('companyId', '==', companyId));
    const leadsQuery = query(collection(db, 'leads'), where('companyId', '==', companyId));
    const usersQuery = query(collection(db, 'users'), where('companyId', '==', companyId));

    const unsubscribeActivity = onSnapshot(activityQuery, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLogRecord)));
      setLoading(false);
    }, (error) => {
      console.error('Failed to load activity logs:', error);
      setLoading(false);
    });

    const unsubscribeLeads = onSnapshot(leadsQuery, (snapshot) => {
      setLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeadSummary)));
    }, (error) => {
      console.error('Failed to load leads for management report:', error);
    });

    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamMember)));
    }, (error) => {
      console.error('Failed to load team members for management report:', error);
    });

    return () => {
      unsubscribeActivity();
      unsubscribeLeads();
      unsubscribeUsers();
    };
  }, [allowed, companyId, isDemoMode, demoData]);

  const leadById = React.useMemo(() => {
    return new Map(leads.map(lead => [lead.id, lead]));
  }, [leads]);

  const memberById = React.useMemo(() => {
    const map = new Map<string, TeamMember>();
    members.forEach(member => {
      map.set(member.id, member);
      if (member.uid) map.set(member.uid, member);
    });
    return map;
  }, [members]);

  const memberOptions = React.useMemo(() => {
    const fromMembers = members.map(member => ({
      id: member.uid || member.id,
      name: member.displayName || member.email || 'Unnamed member'
    }));

    const fromLogs = logs
      .filter(log => log.authorUid || log.authorName)
      .map(log => ({ id: getMemberKey(log), name: log.authorName || 'Unknown member' }));

    const merged = new Map<string, { id: string; name: string }>();
    [...fromMembers, ...fromLogs].forEach(member => merged.set(member.id, member));
    return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [members, logs]);

  const activityTypes = React.useMemo(() => {
    return Array.from(new Set(logs.map(log => log.type).filter(Boolean) as string[])).sort();
  }, [logs]);

  const filteredLogs = React.useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();

    return logs
      .filter(log => {
        const date = getLogDate(log);
        if (selectedDate && (!date || toDateInputValue(date) !== selectedDate)) return false;
        if (selectedMember !== 'ALL' && getMemberKey(log) !== selectedMember) return false;
        if (selectedType !== 'ALL' && log.type !== selectedType) return false;

        if (!needle) return true;
        const lead = log.leadId ? leadById.get(log.leadId) : undefined;
        const searchable = [
          log.authorName,
          log.action,
          log.type,
          getDetailText(log),
          lead?.name,
          lead?.contactName,
          lead?.company,
          lead?.companyName,
          lead?.email
        ].filter(Boolean).join(' ').toLowerCase();
        return searchable.includes(needle);
      })
      .sort((a, b) => (getLogDate(b)?.getTime() || 0) - (getLogDate(a)?.getTime() || 0));
  }, [logs, selectedDate, selectedMember, selectedType, searchTerm, leadById]);

  const groupedLogs = React.useMemo(() => {
    const groups = new Map<string, ActivityLogRecord[]>();
    filteredLogs.forEach(log => {
      const key = getMemberKey(log);
      groups.set(key, [...(groups.get(key) || []), log]);
    });
    return Array.from(groups.entries()).map(([memberId, items]) => {
      const member = memberById.get(memberId);
      return {
        memberId,
        name: member?.displayName || items[0]?.authorName || 'Unknown member',
        email: member?.email,
        items
      };
    });
  }, [filteredLogs, memberById]);

  const activeMembers = new Set(filteredLogs.map(getMemberKey)).size;
  const leadsTouched = new Set(filteredLogs.map(log => log.leadId).filter(Boolean)).size;
  const topMember = groupedLogs.slice().sort((a, b) => b.items.length - a.items.length)[0];

  if (!allowed) {
    return (
      <div className="min-h-screen bg-[var(--crm-bg)] p-4 sm:p-6 lg:p-10">
        <div className="mx-auto max-w-3xl rounded-[8px] border border-[var(--crm-border)] bg-[var(--crm-card-bg)] p-8 text-center shadow-lg">
          <Users className="mx-auto mb-4 text-[var(--crm-text-muted)]" size={40} />
          <h1 className="text-2xl font-black text-[var(--crm-text)]">Management access only</h1>
          <p className="mt-2 text-sm font-semibold text-[var(--crm-text-muted)]">
            Daily activity reports are available for management, admins, and super admins.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--crm-bg)] px-3 py-4 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-4 rounded-[8px] border border-[var(--crm-border)] bg-[var(--crm-card-bg)] p-4 shadow-lg sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-[8px] border border-[var(--crm-border)] bg-[var(--crm-control-bg)] px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-[var(--crm-text-muted)]">
              <Activity size={14} />
              Manager Report
            </div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--crm-text)] sm:text-3xl">Daily Activity</h1>
            <p className="mt-1 max-w-2xl text-sm font-semibold text-[var(--crm-text-muted)]">
              Track who changed leads, added notes, updated status, and followed up during the selected day.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <button
              type="button"
              onClick={() => setSelectedDate(toDateInputValue())}
              className="rounded-[8px] border border-[var(--crm-border)] bg-[var(--crm-control-bg)] px-4 py-2 text-xs font-black uppercase tracking-wider text-[var(--crm-text)] transition hover:bg-[var(--crm-control-hover-bg)]"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate('')}
              className="rounded-[8px] border border-[var(--crm-border)] bg-[var(--crm-control-bg)] px-4 py-2 text-xs font-black uppercase tracking-wider text-[var(--crm-text)] transition hover:bg-[var(--crm-control-hover-bg)]"
            >
              All Dates
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedDate('');
                setSelectedMember('ALL');
                setSelectedType('ALL');
                setSearchTerm('');
              }}
              className="rounded-[8px] border border-[var(--crm-border)] bg-[var(--crm-control-bg)] px-4 py-2 text-xs font-black uppercase tracking-wider text-[var(--crm-text)] transition hover:bg-[var(--crm-control-hover-bg)]"
            >
              Clear Filters
            </button>
          </div>
        </div>

        <div className="grid gap-3 rounded-[8px] border border-[var(--crm-border)] bg-[var(--crm-card-bg)] p-3 shadow-lg sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.4fr]">
          <label className="space-y-2">
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--crm-text-muted)]">
              <CalendarDays size={13} />
              Date
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="w-full rounded-[8px] border border-[var(--crm-border)] bg-[var(--crm-control-bg)] px-3 py-3 text-sm font-bold text-[var(--crm-text)] outline-none transition focus:border-indigo-400"
            />
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--crm-text-muted)]">
              <Users size={13} />
              Team Member
            </span>
            <select
              value={selectedMember}
              onChange={(event) => setSelectedMember(event.target.value)}
              className="w-full rounded-[8px] border border-[var(--crm-border)] bg-[var(--crm-control-bg)] px-3 py-3 text-sm font-bold text-[var(--crm-text)] outline-none transition focus:border-indigo-400"
            >
              <option value="ALL">All team members</option>
              {memberOptions.map(member => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--crm-text-muted)]">
              <FileText size={13} />
              Activity
            </span>
            <select
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value)}
              className="w-full rounded-[8px] border border-[var(--crm-border)] bg-[var(--crm-control-bg)] px-3 py-3 text-sm font-bold text-[var(--crm-text)] outline-none transition focus:border-indigo-400"
            >
              <option value="ALL">All activity</option>
              {activityTypes.map(type => (
                <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2 sm:col-span-2 lg:col-span-1">
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--crm-text-muted)]">
              <Search size={13} />
              Search
            </span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search action, lead, note..."
              className="w-full rounded-[8px] border border-[var(--crm-border)] bg-[var(--crm-control-bg)] px-3 py-3 text-sm font-bold text-[var(--crm-text)] outline-none transition placeholder:text-[var(--crm-text-muted)] focus:border-indigo-400"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Activities', value: filteredLogs.length, icon: Activity },
            { label: 'Active Members', value: activeMembers, icon: UserCheck },
            { label: 'Leads Touched', value: leadsTouched, icon: Target },
            { label: 'Top Member', value: topMember?.name || '-', icon: Users }
          ].map(item => (
            <div key={item.label} className="rounded-[8px] border border-[var(--crm-border)] bg-[var(--crm-card-bg)] p-4 shadow-sm">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[8px] border border-[var(--crm-border)] bg-[var(--crm-control-bg)] text-indigo-500">
                <item.icon size={18} />
              </div>
              <div className="truncate text-xl font-black text-[var(--crm-text)]">{item.value}</div>
              <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--crm-text-muted)]">{item.label}</div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="rounded-[8px] border border-[var(--crm-border)] bg-[var(--crm-card-bg)] p-8 text-center text-sm font-bold text-[var(--crm-text-muted)]">
              Loading daily activity report...
            </div>
          ) : groupedLogs.length === 0 ? (
            <div className="rounded-[8px] border border-dashed border-[var(--crm-border)] bg-[var(--crm-card-bg)] p-8 text-center">
              <Clock className="mx-auto mb-3 text-[var(--crm-text-muted)]" size={34} />
              <h2 className="text-lg font-black text-[var(--crm-text)]">No activity found</h2>
              <p className="mt-1 text-sm font-semibold text-[var(--crm-text-muted)]">
                Try another date, team member, or search term.
              </p>
            </div>
          ) : groupedLogs.map(group => (
            <motion.section
              key={group.memberId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-[8px] border border-[var(--crm-border)] bg-[var(--crm-card-bg)] shadow-lg"
            >
              <div className="flex flex-col gap-3 border-b border-[var(--crm-border)] bg-[var(--crm-control-bg)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] bg-indigo-500 text-sm font-black text-white">
                    {(group.name || 'U').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-black text-[var(--crm-text)]">{group.name}</h2>
                    <p className="truncate text-xs font-bold text-[var(--crm-text-muted)]">{group.email || 'Team activity'}</p>
                  </div>
                </div>
                <div className="rounded-[8px] border border-[var(--crm-border)] bg-[var(--crm-card-bg)] px-3 py-2 text-xs font-black uppercase tracking-wider text-[var(--crm-text)]">
                  {group.items.length} action{group.items.length === 1 ? '' : 's'}
                </div>
              </div>

              <div className="divide-y divide-[var(--crm-border)]">
                {group.items.map(log => {
                  const lead = log.leadId ? leadById.get(log.leadId) : undefined;
                  const leadName = lead?.name || lead?.contactName || 'Lead record';
                  const company = lead?.company || lead?.companyName || lead?.email || '';

                  return (
                    <div key={log.id} className="grid gap-3 p-4 transition hover:bg-[var(--crm-control-hover-bg)] md:grid-cols-[84px_1fr_auto] md:items-start">
                      <div className="flex items-center gap-2 text-xs font-black text-[var(--crm-text-muted)]">
                        <Clock size={14} />
                        {formatLogTime(log)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-[8px] border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${getActivityTone(log.type)}`}>
                            {(log.type || 'Activity').replaceAll('_', ' ')}
                          </span>
                          {log.leadId ? (
                            <Link to={`/clients/${log.leadId}/edit`} className="truncate text-sm font-black text-indigo-500 hover:underline">
                              {leadName}
                            </Link>
                          ) : (
                            <span className="text-sm font-black text-[var(--crm-text)]">{leadName}</span>
                          )}
                          {company && <span className="text-xs font-bold text-[var(--crm-text-muted)]">{company}</span>}
                        </div>
                        <h3 className="mt-2 text-sm font-black text-[var(--crm-text)]">{log.action || 'Activity recorded'}</h3>
                        <p className="mt-1 break-words text-sm font-semibold leading-6 text-[var(--crm-text-muted)]">{getDetailText(log)}</p>
                      </div>

                      {log.leadId && (
                        <Link
                          to={`/analytics/${log.leadId}`}
                          className="inline-flex items-center justify-center rounded-[8px] border border-[var(--crm-border)] bg-[var(--crm-control-bg)] px-3 py-2 text-xs font-black uppercase tracking-wider text-[var(--crm-text)] transition hover:bg-[var(--crm-card-bg)]"
                        >
                          Analytics
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.section>
          ))}
        </div>

        <p className="pb-4 text-center text-xs font-semibold text-[var(--crm-text-muted)]">
          Report generated for {user?.displayName || user?.email || 'manager'} on {new Date().toLocaleDateString()}.
        </p>
      </div>
    </div>
  );
}
