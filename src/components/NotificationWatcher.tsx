import React, { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { playNotificationSound, SoundProfile } from '../utils/sounds';
import { showAppNotification } from '../utils/notifications';

export const NotificationWatcher: React.FC = () => {
  const { user, companyId, role } = useAuth();
  const alertedMeetingIds = useRef<Set<string>>(new Set());
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

    const unsub = onSnapshot(q, (snap) => {
      const allMeetings = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const myMeetings = (role === 'admin' || role === 'super_admin' || role === 'management')
        ? allMeetings
        : allMeetings.filter((m: any) => m.ownerUid === user.uid || (m.assignedTo || []).includes(user.uid));

      const checkReminders = () => {
        const now = new Date();
        const leadTimeMin = userSettings.current.notificationMinutes;

        myMeetings.forEach(m => {
          if (alertedMeetingIds.current.has(m.id)) return;

          const scheduledAt = m.scheduledAt instanceof Timestamp ? m.scheduledAt.toDate() : (m.scheduledAt?.toDate?.() || null);
          if (!scheduledAt) return;

          const diffMs = scheduledAt.getTime() - now.getTime();
          const diffMin = diffMs / 60000;

          if (diffMin > 0 && diffMin <= leadTimeMin) {
            alertedMeetingIds.current.add(m.id);
            playNotificationSound(userSettings.current.notificationSoundId);

            if ('Notification' in window && Notification.permission === 'granted') {
              void showAppNotification('Upcoming Session', {
                body: `"${m.title}" starts in ${Math.ceil(diffMin)} minute(s).`,
                tag: m.id
              });
            }
          }
        });
      };

      checkReminders();
      const interval = setInterval(checkReminders, 30000);
      return () => clearInterval(interval);
    });

    return () => unsub();
  }, [user, companyId, role]);

  return null;
};
