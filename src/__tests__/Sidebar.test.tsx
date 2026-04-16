import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../contexts/ThemeContext';
import Sidebar from '../Sidebar';

const authState = vi.hoisted(() => ({
  companyName: 'Test Company',
  role: 'admin',
  logout: vi.fn(),
}));

const demoState = vi.hoisted(() => ({
  isDemoMode: false,
  setDemoMode: vi.fn(),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('../DemoContext', () => ({
  useDemo: () => demoState,
}));

vi.mock('../components/ThemeToggle', () => ({
  default: () => <button>Theme Toggle</button>,
}));

describe('Sidebar navigation', () => {
  beforeEach(() => {
    authState.companyName = 'Test Company';
    authState.role = 'admin';
    demoState.isDemoMode = false;
    demoState.setDemoMode.mockReset();
  });

  function renderSidebar(pathname = '/') {
    return render(
      <MemoryRouter initialEntries={[pathname]}>
        <ThemeProvider>
          <Sidebar isOpen={true} onClose={vi.fn()} />
        </ThemeProvider>
      </MemoryRouter>
    );
  }

  it('shows the active navigation routes for admins', () => {
    renderSidebar('/calendar');

    expect(screen.getByText(/test company/i)).toBeDefined();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /all leads/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /import audio/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /calendar/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /settings/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /app/i })).toBeDefined();
  });

  it('hides settings for team members', () => {
    authState.role = 'team_member';

    renderSidebar('/clients');

    expect(screen.queryByRole('link', { name: /settings/i })).toBeNull();
  });

  it('toggles demo mode from the footer control', () => {
    renderSidebar('/');

    fireEvent.click(screen.getByRole('button', { name: /switch to demo/i }));

    expect(demoState.setDemoMode).toHaveBeenCalledWith(true);
  });
});
