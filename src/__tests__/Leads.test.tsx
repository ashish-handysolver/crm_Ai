import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Leads from '../Leads';
import { DemoProvider } from '../DemoContext';
import { AuthProvider } from '../contexts/AuthContext';
import { BrowserRouter } from 'react-router-dom';

// Mocking Dependencies
vi.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-user' } },
  storage: {}
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  onAuthStateChanged: vi.fn((auth, cb) => {
    cb({ uid: 'test-user', email: 'test@example.com' });
    return () => {};
  })
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  doc: vi.fn((db, coll, id) => ({ id, collection: coll })),
  onSnapshot: vi.fn((q, cb) => { 
    if (typeof cb === 'function') {
      if (q && q.id) {
        cb({ 
          exists: () => true, 
          data: () => ({ role: 'user', companyId: 'test', customPhases: ['STAGING'] }),
          id: q.id 
        });
      } else {
        cb({ docs: [], docChanges: () => [] }); 
      }
    }
    return () => {}; 
  }),
  getDoc: vi.fn(() => Promise.resolve({ 
    exists: () => true, 
    data: () => ({ role: 'user', companyId: 'test', customPhases: ['STAGING'] }) 
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
  getStorage: vi.fn(),
  ref: vi.fn(),
  uploadBytes: vi.fn(() => Promise.resolve()),
  getDownloadURL: vi.fn(() => Promise.resolve('https://example.com/audio.webm'))
}));

const renderLeads = (user = { uid: 'test-user', displayName: 'Test User' }) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <DemoProvider>
          <Leads user={user} />
        </DemoProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Leads Module', () => {
  it('renders lead list with search bar', () => {
    renderLeads();
    expect(screen.getByPlaceholderText(/Search/i)).toBeDefined();
    expect(screen.getByText(/Alexander Sterling/i)).toBeDefined();
  });

  it('filters leads based on search input', () => {
    renderLeads();
    const searchInput = screen.getByPlaceholderText(/Filter/i);
    fireEvent.change(searchInput, { target: { value: 'Elena' } });
    
    expect(screen.getByText(/Elena Thorne/i)).toBeDefined();
    expect(screen.queryByText(/Alexander Sterling/i)).toBeNull();
  });

  it('switches between List and Kanban view', () => {
    renderLeads();
    const kanbanBtn = screen.getByText(/Card View/i);
    fireEvent.click(kanbanBtn);
    
    expect(screen.getByText(/QUALIFIED/i)).toBeDefined();
    expect(screen.getByText(/NURTURING/i)).toBeDefined();
  });

  it('opens Import Lead modal on button click', () => {
    renderLeads();
    const importBtn = screen.getByText(/Import Excel/i);
    fireEvent.click(importBtn);
    
    expect(screen.getByText(/Bulk Import Protocols/i)).toBeDefined();
  });

  it('handles recording toggle interaction', () => {
    // Mock getUserMedia
    const mockGetUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }]
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      writable: true
    });

    renderLeads();
    const recordButtons = screen.getAllByTitle('Record Call');
    fireEvent.click(recordButtons[0]);
    
    expect(screen.getByText((content) => content.includes('00:00'))).toBeDefined();
  });

  it('handles lead deletion', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    renderLeads();
    const deleteButtons = screen.getAllByTitle('Delete Lead');
    fireEvent.click(deleteButtons[0]);
    
    expect(confirmSpy).toHaveBeenCalled();
  });

  it('toggles interest status', () => {
    renderLeads();
    const interestToggles = screen.getAllByTitle(/Interested/i);
    fireEvent.click(interestToggles[0]);
    // Since it's demo mode, it won't actually update the UI, but it should trigger the handler
  });
});
