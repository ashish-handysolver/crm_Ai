import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Dashboard from '../Dashboard';
import { DemoProvider } from '../DemoContext';
import { AuthProvider } from '../contexts/AuthContext';
import { BrowserRouter } from 'react-router-dom';

// Mocking Dependencies
vi.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-user' } }
}));

const renderDashboard = (user = { uid: 'test-user' }, companyId = 'test-company') => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <DemoProvider>
          <Dashboard user={user} companyId={companyId} />
        </DemoProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Dashboard Component', () => {
  it('renders correctly with default Overview tab', () => {
    renderDashboard();
    expect(screen.getByText(/Control Center/i)).toBeDefined();
    expect(screen.getByText(/Total Clients/i)).toBeDefined();
  });

  it('switches to AI Analytics tab on click', () => {
    renderDashboard();
    const analyticsTab = screen.getByRole('button', { name: /AI Analytics/i });
    fireEvent.click(analyticsTab);
    
    expect(screen.getByText(/Intelligence Velocity/i)).toBeDefined();
    expect(screen.getByText(/Neural Synthesis/i)).toBeDefined();
  });

  it('switches to Reports tab on click', () => {
    renderDashboard();
    const reportsTab = screen.getByRole('button', { name: /Reports/i });
    fireEvent.click(reportsTab);
    
    expect(screen.getByText(/Operational Artifacts/i)).toBeDefined();
    expect(screen.getByText(/Export Core Data/i)).toBeDefined();
  });

  it('displays correct KPI values from demo data in demo mode', () => {
    // Note: This relies on DemoContext providing initial values
    renderDashboard();
    expect(screen.getByText('124')).toBeDefined(); // Total Clients
    expect(screen.getByText('842')).toBeDefined(); // Total Records
  });

  it('handles search input interaction', () => {
    renderDashboard();
    const searchInput = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(searchInput, { target: { value: 'Alexander' } });
    expect(searchInput.value).toBe('Alexander');
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
