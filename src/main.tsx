import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './contexts/ThemeContext.tsx';
import { Analytics } from '@vercel/analytics/react';

// Register Service Worker for PWA Support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        console.info('PWA_SYNC_ESTABLISHED: ServiceWorker registered');
        navigator.serviceWorker.getRegistrations()
          .then((registrations) => Promise.all(
            registrations
              .filter((item) => item.scope.includes('/firebase-cloud-messaging-push-scope'))
              .map((item) => item.unregister())
          ))
          .catch(err => console.warn('PWA_SYNC_CLEANUP_FAILED:', err));
        // Check for updates
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.info('PWA_UPDATE_DETECTED: New version available, reloading soon.');
              }
            };
          }
        };
      })
      .catch(err => console.error('PWA_SYNC_FAILED: ServiceWorker registration error:', err));
  });
}

// Operational Signal Tracking (Global Error Sync)
window.addEventListener('error', (event) => {
  // Check for critical failures (chunk load, React core crash, or script sync errors)
  const errorMessage = event.message?.toLowerCase() || '';
  const errorName = event.error?.name || '';
  
  const isChunkError = errorName === 'ChunkLoadError' || errorMessage.includes('script error');
  const isRenderError = errorMessage.includes('render') || event.error?.message?.includes('render');

  if (isChunkError || isRenderError) {
    console.error('CRITICAL_SIGNAL_LOSS: Error detected -', errorMessage);
    
    // Recovery Logic: Attempt forced reload once before diverting to outage terminal
    const recoveryKey = 'handycrm_recovery_timestamp';
    const lastRecovery = sessionStorage.getItem(recoveryKey);
    const now = Date.now();

    // If we haven't tried recovering in the last 10 seconds, try now
    if (!lastRecovery || (now - parseInt(lastRecovery)) > 10000) {
      sessionStorage.setItem(recoveryKey, now.toString());
      console.warn('INITIATING_SIGNAL_RECOVERY: Force reloading core modules...');
      window.location.reload();
      return;
    }

    console.error('RECOVERY_LIMIT_EXCEEDED: Diverting to backup terminal.');
    window.location.href = '/outage.html';
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const isFirebaseUnavailable = event.reason?.name === 'FirebaseError' && event.reason?.code === 'unavailable';
  
  if (isFirebaseUnavailable) {
    console.error('FIREBASE_DATALINK_FAILURE: Persistence sync lost.');
    
    // For Firebase unavailable, it might be transient. Try a reload if not in a loop.
    const recoveryKey = 'handycrm_fb_recovery_timestamp';
    const lastRecovery = sessionStorage.getItem(recoveryKey);
    const now = Date.now();

    if (!lastRecovery || (now - parseInt(lastRecovery)) > 30000) {
      sessionStorage.setItem(recoveryKey, now.toString());
      window.location.reload();
      return;
    }
    
    window.location.href = '/outage.html';
  } 
  console.error('UNHANDLED_PROTO_REJECTION:', event.reason);
});

try {
  (window as any).REACT_ROOT_INITIALIZED = true;
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider>
        <App />
        <Analytics />
      </ThemeProvider>
    </StrictMode>
  );
} catch (e) {
  console.error('REACT_RENDER_EXCEPTION:', e);
  window.location.href = '/outage.html';
}


console.log("HANDYSOLVER_CORE_VERSION: PWA_STABLE_V1");
