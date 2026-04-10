import React, { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { playNotificationSound, SoundProfile } from '../utils/sounds';

export const NotificationWatcher: React.FC = () => {
  const { user, companyId, role } = useAuth();
  const alertedMeetingIds = useRef<Set<string>>(new Set());
  const userSettings = useRef<{ notificationMinutes: number; notificationSoundId: SoundProfile }>({
    notificationMinutes: 10,
    notificationSoundId: 'cyber_pulse'
  });

  // Fetch user settings on mount/user change
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

  // Meeting subscription and reminder loop
  useEffect(() => {
    if (!user || !companyId) return;

    // Browser Notification permission solicitation
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

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

          // If within the lead time window (and hasn't already started)
          if (diffMin > 0 && diffMin <= leadTimeMin) {
            alertedMeetingIds.current.add(m.id);
            
            // Execute Audio Protocol
            playNotificationSound(userSettings.current.notificationSoundId);

            // Execute Visual Protocol (Browser Notification)
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('📅 UPCOMING SESSION', {
                body: `"${m.title}" starts in ${Math.ceil(diffMin)} minute(s).`,
                icon: '/logo.png',
                tag: m.id
              });
            }
          }
        });
      };

      // Initial check and set interval
      checkReminders();
      const interval = setInterval(checkReminders, 30000); // Check every 30s
      return () => clearInterval(interval);
    });

    return () => unsub();
  }, [user, companyId, role]);

  return null; // Headless component
};
