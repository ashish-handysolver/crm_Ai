import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Dashboard from '../Dashboard';
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
      // If q has an id, it's likely a doc reference from our doc mock
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
  updateDoc: vi.fn(() => Promise.resolve()),
  Timestamp: {
    now: () => ({ toMillis: () => Date.now() }),
    fromDate: (date: Date) => ({ toMillis: () => date.getTime() })
  }
}));

const renderDashboard = (user = { uid: 'test-user', displayName: 'Test User' }) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <DemoProvider>
          <Dashboard user={user} />
        </DemoProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Dashboard Component', () => {
  it('renders correctly with default Overview tab', () => {
    renderDashboard();
    expect(screen.getByText(/Dashboard/i)).toBeDefined();
    expect(screen.getByText(/Total Leads/i)).toBeDefined();
  });

  it('switches to AI Analytics tab on click', () => {
    renderDashboard();
    const analyticsTab = screen.getByRole('button', { name: /AI Analytics/i });
    fireEvent.click(analyticsTab);
    
    expect(screen.getByText(/Intelligence Velocity/i)).toBeDefined();
  });

  it('switches to Reports tab on click', () => {
    renderDashboard();
    const reportsTab = screen.getByRole('button', { name: /Reports/i });
    fireEvent.click(reportsTab);
    
    expect(screen.getByText(/Operational Artifacts/i)).toBeDefined();
  });

  it('displays correct KPI values from demo data in demo mode', () => {
    renderDashboard();
    // In Dashboard.tsx, conversionRate uses interestedCount which is leads.filter(l => l.isInterested !== false).length
    // Demo data for leads is 124 in total.
    expect(screen.getByText('124')).toBeDefined();
  });

  // Removed invalid search test as Dashboard.tsx no longer contains a search bar in the overview tab.

  it('navigates to clients page when clicking a KPI card', () => {
    renderDashboard();
    const leadCard = screen.getByText(/Total Leads/i).closest('div');
    if (leadCard) fireEvent.click(leadCard);
    expect(window.location.pathname).toBe('/clients');
  });

  it('renders team performance table with demo data', () => {
    renderDashboard();
    expect(screen.getByText(/Team Performance/i)).toBeDefined();
    expect(screen.getByText(/Sarah Jenkins/i)).toBeDefined(); // From demo data
  });
});

/**
 * INSTALLATION NOTE:
 * To run these tests, ensure vitest and @testing-library/react are installed:
 * npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
 * 
 * Add to package.json scripts:
 * "test": "vitest"
 */
