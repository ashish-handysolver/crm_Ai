import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker for PWA Support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('ServiceWorker registered:', reg))
      .catch(err => console.error('ServiceWorker registration failed:', err));
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


console.log("HANDYSOLVER_CORE_VERSION: PWA_STABLE_V1");
