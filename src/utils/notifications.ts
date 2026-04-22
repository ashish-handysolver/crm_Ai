export const requestNotificationPermission = async () => {
  if (typeof Notification === 'undefined') return 'unsupported' as const;
  return Notification.requestPermission();
};

export const showAppNotification = async (
  title: string,
  options: NotificationOptions = {}
) => {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return false;
  if (Notification.permission !== 'granted') return false;

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration?.showNotification) {
        await registration.showNotification(title, {
          icon: '/logo.png',
          badge: '/logo.png',
          ...options,
        });
        return true;
      }
    }

    new Notification(title, {
      icon: '/logo.png',
      ...options,
    });
    return true;
  } catch (error) {
    console.error('Notification dispatch failed:', error);
    return false;
  }
};
