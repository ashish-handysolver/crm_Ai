import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

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
