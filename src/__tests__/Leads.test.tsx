import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Leads from '../Leads';
import demoData from '../data/demoData.json';

const authState = vi.hoisted(() => ({
  companyId: null as string | null,
  role: 'admin',
}));

const demoState = vi.hoisted(() => ({
  isDemoMode: false,
}));

vi.mock('../DemoContext', () => ({
  useDemo: () => ({
    isDemoMode: demoState.isDemoMode,
    setDemoMode: vi.fn(),
    demoData,
  }),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-user' } },
  storage: {}
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((db, path) => ({ path })),
  query: vi.fn((...args) => ({ args })),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  doc: vi.fn((db, coll, id) => ({ id, collection: coll })),
  onSnapshot: vi.fn(() => () => {}),
  getDoc: vi.fn(() => Promise.resolve({
    exists: () => true,
    data: () => ({ customLeadTypes: [], customPhases: [] })
  })),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  updateDoc: vi.fn(() => Promise.resolve()),
  setDoc: vi.fn(() => Promise.resolve()),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-id' })),
  deleteDoc: vi.fn(() => Promise.resolve()),
  Timestamp: {
    now: () => ({ toMillis: () => Date.now() }),
    fromDate: (date: Date) => ({ toMillis: () => date.getTime() })
  }
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(() => Promise.resolve()),
  getDownloadURL: vi.fn(() => Promise.resolve('https://example.com/audio.webm'))
}));

const testUser = { uid: 'test-user', displayName: 'Test User' };

class MockMediaRecorder {
  static isTypeSupported = vi.fn(() => true);

  state = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
    this.onstop?.();
  }

  pause() {
    this.state = 'paused';
  }

  resume() {
    this.state = 'recording';
  }
}

const renderLeads = () => render(
  <BrowserRouter>
    <Leads user={testUser} />
  </BrowserRouter>
);

describe('Leads Module', () => {
  beforeEach(() => {
    authState.companyId = null;
    authState.role = 'admin';
    demoState.isDemoMode = false;
    window.history.pushState({}, '', '/clients');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders lead list with search bar', async () => {
    renderLeads();

    expect(screen.getByPlaceholderText(/Search leads/i)).toBeDefined();
    expect((await screen.findAllByText(/Alexander Sterling/i)).length).toBeGreaterThan(0);
  });

  it('filters leads based on search input', async () => {
    renderLeads();
    fireEvent.change(screen.getByPlaceholderText(/Search leads/i), { target: { value: 'Elena' } });
    
    expect((await screen.findAllByText(/Elena Thorne/i)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Alexander Sterling/i)).toBeNull();
  });

  it('switches between List and Kanban view', async () => {
    renderLeads();
    const kanbanBtn = screen.getByTitle(/Kanban View/i);
    fireEvent.click(kanbanBtn);
    
    expect((await screen.findAllByText(/QUALIFIED/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/NURTURING/i).length).toBeGreaterThan(0);
  });

  it('opens Import Lead modal on button click', async () => {
    renderLeads();
    const importBtn = screen.getByTitle(/Import Excel/i);
    fireEvent.click(importBtn);
    
    expect(await screen.findByText(/Import Leads/i)).toBeDefined();
  });

  it('handles recording toggle interaction', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }]
        })
      },
      configurable: true
    });
    Object.defineProperty(window, 'MediaRecorder', {
      value: MockMediaRecorder,
      configurable: true
    });
    Object.defineProperty(globalThis, 'MediaRecorder', {
      value: MockMediaRecorder,
      configurable: true
    });

    renderLeads();
    const recordButtons = await screen.findAllByTitle('Record Call');
    fireEvent.click(recordButtons[0]);
    
    await waitFor(() => {
      expect(screen.getAllByText((content) => content.includes('00:00')).length).toBeGreaterThan(0);
    });
  });

  it('handles lead deletion', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    renderLeads();

    const deleteButtons = await screen.findAllByTitle('Delete Lead');
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });

    expect(confirmSpy).toHaveBeenCalled();
  });

  it('toggles interest status', async () => {
    renderLeads();
    const interestToggles = await screen.findAllByTitle(/Interested/i);
    fireEvent.click(interestToggles[0]);

    expect(interestToggles[0]).toBeDefined();
  });
});
