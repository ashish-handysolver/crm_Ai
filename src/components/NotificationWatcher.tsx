import React, { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { playNotificationSound, SoundProfile } from '../utils/sounds';
import { showAppNotification } from '../utils/notifications';

export const NotificationWatcher: React.FC = () => {
  const { user, companyId, role } = useAuth();
  const alertedMeetingIds = useRef<Set<string>>(new Set());
  const initializedReminderState = useRef(false);
  const userSettings = useRef<{ notificationMinutes: number; notificationSoundId: SoundProfile }>({
    notificationMinutes: 10,
    notificationSoundId: 'cyber_pulse'
  });

  useEffect(() => {
    if (!user) return;

    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          userSettings.current = {
            notificationMinutes: data.notificationMinutes || 10,
            notificationSoundId: (data.notificationSoundId as SoundProfile) || 'cyber_pulse'
          };
        }
      } catch (err) {
        console.error('Settings sync failed:', err);
      }
    };

    fetchSettings();
  }, [user]);

  useEffect(() => {
    if (!user || !companyId) return;

    const q = query(collection(db, 'meetings'), where('companyId', '==', companyId));
    let interval: ReturnType<typeof setInterval> | null = null;

    const unsub = onSnapshot(q, (snap) => {
      const allMeetings = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const myMeetings = (role === 'admin' || role === 'super_admin' || role === 'management')
        ? allMeetings
        : allMeetings.filter((m: any) => m.ownerUid === user.uid || (m.assignedTo || []).includes(user.uid));

      const getReminderState = (meeting: any) => {
        const now = new Date();
        const leadTimeMin = userSettings.current.notificationMinutes;
        const scheduledAt = meeting.scheduledAt instanceof Timestamp ? meeting.scheduledAt.toDate() : (meeting.scheduledAt?.toDate?.() || null);
        if (!scheduledAt) return null;

        const diffMs = scheduledAt.getTime() - now.getTime();
        const diffMin = diffMs / 60000;
        return { diffMin, leadTimeMin };
      };

      if (!initializedReminderState.current) {
        myMeetings.forEach((meeting) => {
          const state = getReminderState(meeting);
          if (!state) return;

          if (state.diffMin > 0 && state.diffMin <= state.leadTimeMin) {
            alertedMeetingIds.current.add(meeting.id);
          }
        });
        initializedReminderState.current = true;
      }

      const checkReminders = () => {
        myMeetings.forEach((meeting) => {
          if (alertedMeetingIds.current.has(meeting.id)) return;

          const state = getReminderState(meeting);
          if (!state) return;

          if (state.diffMin > 0 && state.diffMin <= state.leadTimeMin) {
            alertedMeetingIds.current.add(meeting.id);
            playNotificationSound(userSettings.current.notificationSoundId);

            if ('Notification' in window && Notification.permission === 'granted') {
              void showAppNotification('Upcoming Session', {
                body: `"${meeting.title}" starts in ${Math.ceil(state.diffMin)} minute(s).`,
                tag: meeting.id
              });
            }
          }
        });
      };

      if (interval) clearInterval(interval);
      interval = setInterval(checkReminders, 30000);
    });

    return () => {
      if (interval) clearInterval(interval);
      unsub();
    };
  }, [user, companyId, role]);

  return null;
};
