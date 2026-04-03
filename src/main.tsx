import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Remove legacy service workers that might interfere with real-time updates
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
      console.log('Legacy ServiceWorker unregistered to ensure real-time security synchronization.');
    }
  });
}

// Operational Signal Tracking (Global Error Sync)
window.addEventListener('error', (event) => {
  // Check for critical failures (chunk load, React core crash, or script sync errors)
  if (event.message?.toLowerCase().includes('script error') || 
      event.error?.name === 'ChunkLoadError' ||
      event.error?.message?.includes('render')) {
    console.error('CRITICAL_SIGNAL_LOSS: Redirecting to fallback terminal.');
    window.location.href = '/outage.html';
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.name === 'FirebaseError' && event.reason?.code === 'unavailable') {
    console.error('FIREBASE_DATALINK_FAILURE: Diverting user to maintenance console.');
    window.location.href = '/outage.html';
  } 
  // If it's a generic unhandled rejection that might break the app
  console.error('UNHANDLED_PROTO_REJECTION:', event.reason);
});

try {
  (window as any).REACT_ROOT_INITIALIZED = true;
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} catch (e) {
  console.error('REACT_RENDER_EXCEPTION:', e);
  window.location.href = '/outage.html';
}

// Force Unregister all Service Workers to fix CORS and Stale Cache
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    if (registrations.length > 0) {
      for (const registration of registrations) {
        registration.unregister();
      }
      console.log('UNREGISTERED OLD SERVICE WORKERS - RELOADING FOR FIX...');
      window.location.reload();
    }
  }).catch(console.error);
}

console.log("HANDYSOLVER_CORE_VERSION: CORS_BYPASS_V4");
