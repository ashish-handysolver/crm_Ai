import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';
import demoData from '../data/demoData.json';

const authState = vi.hoisted(() => ({
  companyId: 'test-company',
  role: 'admin',
}));

vi.mock('../DemoContext', () => ({
  useDemo: () => ({
    isDemoMode: true,
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
  storage: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  doc: vi.fn((db, coll, id) => ({ id, collection: coll })),
  onSnapshot: vi.fn(() => () => {}),
  getDoc: vi.fn(() => Promise.resolve({
    exists: () => true,
    data: () => ({ customPhases: ['STAGING'] }),
  })),
  updateDoc: vi.fn(() => Promise.resolve()),
}));

const testUser = { uid: 'test-user', displayName: 'Test User' };

const renderDashboard = () => render(
  <BrowserRouter>
    <Dashboard user={testUser} />
  </BrowserRouter>
);

describe('Dashboard Component', () => {
  beforeEach(() => {
    authState.companyId = 'test-company';
    authState.role = 'admin';
    window.history.pushState({}, '', '/');
  });

  it('renders correctly with default Overview tab', () => {
    renderDashboard();

    expect(screen.getByRole('button', { name: /Dashboard/i })).toBeDefined();
    expect(screen.getByText(/Total Leads/i)).toBeDefined();
  });

  it('switches to AI Analytics tab on click', async () => {
    renderDashboard();
    const analyticsTab = screen.getByRole('button', { name: /AI Analytics/i });
    fireEvent.click(analyticsTab);
    
    expect(await screen.findByText(/Lead Performance/i)).toBeDefined();
  });

  it('switches to Reports tab on click', async () => {
    renderDashboard();
    const reportsTab = screen.getByRole('button', { name: /Reports/i });
    fireEvent.click(reportsTab);
    
    expect(await screen.findByText(/Call Intelligence/i)).toBeDefined();
    expect(screen.getByText(/Archive Intelligence/i)).toBeDefined();
  });

  it('displays current demo KPI values in demo mode', () => {
    renderDashboard();

    expect(screen.getAllByText(String(demoData.leads.length)).length).toBeGreaterThan(0);
  });

  it('navigates to clients page when clicking the Total Leads KPI card', () => {
    renderDashboard();

    const leadCard = screen.getByText(/Total Leads/i).closest('.glass-card');
    expect(leadCard).toBeTruthy();
    fireEvent.click(leadCard!);

    expect(window.location.pathname).toBe('/clients');
  });

  it('renders team performance table with demo data', () => {
    renderDashboard();
    expect(screen.getByText(/Team Performance/i)).toBeDefined();
    expect(screen.getAllByText(/Sarah Jenkins/i).length).toBeGreaterThan(0);
  });
});
