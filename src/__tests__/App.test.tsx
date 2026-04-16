import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '../contexts/ThemeContext';

const authState = vi.hoisted(() => ({
  user: { uid: 'user-1', displayName: 'Test User', photoURL: null, email: 'user@example.com' } as any,
  companyId: 'company-1' as string | null,
  companyName: 'Test Company',
  role: 'admin',
  active: true,
  onboardingComplete: true,
  loading: false,
}));

const demoState = vi.hoisted(() => ({
  isDemoMode: false,
}));

vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => authState,
}));

vi.mock('../DemoContext', () => ({
  DemoProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDemo: () => ({
    isDemoMode: demoState.isDemoMode,
    setDemoMode: vi.fn(),
    demoData: { leads: [] },
  }),
}));

vi.mock('../Dashboard', () => ({ default: () => <div>Dashboard Screen</div> }));
vi.mock('../Leads', () => ({ default: () => <div>Leads Screen</div> }));
vi.mock('../Sidebar', () => ({ default: () => <div>Sidebar</div> }));
vi.mock('../LeadForm', () => ({ default: () => <div>Lead Form</div> }));
vi.mock('../CustomFields', () => ({ default: () => <div>Custom Fields</div> }));
vi.mock('../Reports', () => ({ default: () => <div>Reports Screen</div> }));
vi.mock('../GuestRecord', () => ({ default: () => <div>Guest Record</div> }));
vi.mock('../Analytics', () => ({ default: () => <div>Analytics Screen</div> }));
vi.mock('../ManualUpload', () => ({ default: () => <div>Manual Upload</div> }));
vi.mock('../LeadInsights', () => ({ default: () => <div>Lead Insights</div> }));
vi.mock('../LeadCapture', () => ({ default: () => <div>Lead Capture</div> }));
vi.mock('../Calendar', () => ({ default: () => <div>Calendar Screen</div> }));
vi.mock('../ImportModal', () => ({ default: () => <div>Import Modal</div> }));
vi.mock('../Login', () => ({ default: () => <div>Login Screen</div> }));
vi.mock('../RegisterCompany', () => ({ default: () => <div>Register Company</div> }));
vi.mock('../Team', () => ({ default: () => <div>Team Screen</div> }));
vi.mock('../Onboarding', () => ({ default: () => <div>Onboarding Screen</div> }));
vi.mock('../Profile', () => ({ default: () => <div>Profile Screen</div> }));
vi.mock('../SuperAdmin', () => ({ default: () => <div>Super Admin</div> }));
vi.mock('../SuperLogin', () => ({ default: () => <div>Super Login</div> }));
vi.mock('../Settings', () => ({ default: () => <div>Settings Screen</div> }));
vi.mock('../TranscriptPlayer', () => ({ default: () => <div>Transcript Player</div> }));
vi.mock('../DownloadApp', () => ({ default: () => <div>Download App</div> }));
vi.mock('../QuickLeadModal', () => ({ default: () => <div>Quick Lead Modal</div> }));
vi.mock('../components/ThemeToggle', () => ({ default: () => <button>Theme Toggle</button> }));
vi.mock('../components/NotificationWatcher', () => ({ NotificationWatcher: () => <div>Notification Watcher</div> }));
vi.mock('../components/SyncManager', () => ({ SyncManager: () => <div>Sync Manager</div> }));

vi.mock('../firebase', () => ({
  db: {},
  auth: {},
  storage: {},
}));

vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signOut: vi.fn(() => Promise.resolve()),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  setDoc: vi.fn(() => Promise.resolve()),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  onSnapshot: vi.fn((_query, callback) => {
    callback({
      docs: [],
      docChanges: () => [],
    });
    return () => {};
  }),
  updateDoc: vi.fn(() => Promise.resolve()),
  Timestamp: {
    now: vi.fn(() => ({ toMillis: () => Date.now() })),
  },
  writeBatch: vi.fn(() => ({
    update: vi.fn(),
    commit: vi.fn(() => Promise.resolve()),
  })),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  getBytes: vi.fn(),
  uploadBytes: vi.fn(() => Promise.resolve()),
  getDownloadURL: vi.fn(() => Promise.resolve('https://example.com/file')),
}));

vi.mock('../utils/gemini', () => ({
  uploadFileToGemini: vi.fn(),
  getGeminiApiKey: vi.fn(),
  GEMINI_FALLBACK_MESSAGE: 'fallback message',
}));

vi.mock('../utils/ai-service', () => ({
  analyzeWithGroq: vi.fn(),
  transcribeWithGroq: vi.fn(),
}));

vi.mock('../utils/whatsapp', () => ({
  WHATSAPP_TEMPLATES: [],
  openWhatsApp: vi.fn(),
}));

import App from '../App';

function renderAppAt(pathname: string) {
  window.history.pushState({}, '', pathname);
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}

describe('App active routes', () => {
  beforeEach(() => {
    authState.user = { uid: 'user-1', displayName: 'Test User', photoURL: null, email: 'user@example.com' };
    authState.companyId = 'company-1';
    authState.role = 'admin';
    authState.active = true;
    authState.onboardingComplete = true;
    authState.loading = false;
    demoState.isDemoMode = false;
    window.history.pushState({}, '', '/');
  });

  it('renders the main shell widgets for authenticated routes', async () => {
    renderAppAt('/');

    expect(await screen.findByText(/dashboard screen/i)).toBeDefined();
    expect(screen.getByText(/sidebar/i)).toBeDefined();
    expect(screen.getByText(/notification watcher/i)).toBeDefined();
    expect(screen.getByText(/quick lead modal/i)).toBeDefined();
    expect(screen.getByText(/sync manager/i)).toBeDefined();
  });

  it.each([
    ['/', /dashboard screen/i],
    ['/history', /reports screen/i],
    ['/clients', /leads screen/i],
    ['/active-clients', /leads screen/i],
    ['/clients/new', /lead form/i],
    ['/clients/lead-1/edit', /lead form/i],
    ['/upload', /manual upload/i],
    ['/analytics/lead-1', /lead insights/i],
    ['/settings', /settings screen/i],
    ['/calendar', /calendar screen/i],
    ['/profile', /profile screen/i],
    ['/download-app', /download app/i],
    ['/super-admin', /super admin/i],
    ['/m/meeting-1', /guest record/i],
    ['/capture/company-1', /lead capture/i],
  ])('renders %s', async (pathname, expectedText) => {
    renderAppAt(pathname);
    expect(await screen.findByText(expectedText)).toBeDefined();
  });

  it('renders login for unauthenticated users on /login', async () => {
    authState.user = null;
    authState.companyId = null;

    renderAppAt('/login');

    expect(await screen.findByText(/login screen/i)).toBeDefined();
  });

  it('renders register-company when the user has no company', async () => {
    authState.companyId = null;

    renderAppAt('/register-company');

    expect(await screen.findByText(/register company/i)).toBeDefined();
  });

  it('renders onboarding when setup is incomplete', async () => {
    authState.onboardingComplete = false;

    renderAppAt('/onboarding');

    expect(await screen.findByText(/onboarding screen/i)).toBeDefined();
  });

  it('renders super-login independently of the main auth shell', async () => {
    authState.user = null;
    authState.companyId = null;

    renderAppAt('/super-login');

    expect(await screen.findByText(/super login/i)).toBeDefined();
  });

  it('redirects unauthenticated users to login routes', async () => {
    authState.user = null;
    authState.companyId = null;

    renderAppAt('/clients');

    await waitFor(() => {
      expect(window.location.pathname).toBe('/login');
    });
    expect(screen.getByText(/login screen/i)).toBeDefined();
  });

  it('redirects authenticated users without a company to register-company', async () => {
    authState.companyId = null;

    renderAppAt('/clients');

    await waitFor(() => {
      expect(window.location.pathname).toBe('/register-company');
    });
    expect(screen.getByText(/register company/i)).toBeDefined();
  });

  it('redirects authenticated users with incomplete onboarding to onboarding', async () => {
    authState.onboardingComplete = false;

    renderAppAt('/clients');

    await waitFor(() => {
      expect(window.location.pathname).toBe('/onboarding');
    });
    expect(screen.getByText(/onboarding screen/i)).toBeDefined();
  });

  it('blocks team members from the settings route', async () => {
    authState.role = 'team_member';

    renderAppAt('/settings');

    expect(await screen.findByText(/dashboard screen/i)).toBeDefined();
  });
});
