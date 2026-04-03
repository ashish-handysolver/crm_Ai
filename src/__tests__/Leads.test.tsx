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

const renderLeads = (user = { uid: 'test-user' }) => {
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
    const searchInput = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(searchInput, { target: { value: 'Elena' } });
    
    expect(screen.getByText(/Elena Thorne/i)).toBeDefined();
    expect(screen.queryByText(/Alexander Sterling/i)).toBeNull();
  });

  it('switches between List and Kanban view', () => {
    renderLeads();
    const kanbanBtn = screen.getByTitle('Kanban View');
    fireEvent.click(kanbanBtn);
    
    // Check for Kanban specific elements (e.g., column headers)
    expect(screen.getByText(/QUALIFIED/i)).toBeDefined();
    expect(screen.getByText(/NURTURING/i)).toBeDefined();
  });

  it('opens Import Lead modal on button click', () => {
    renderLeads();
    const importBtn = screen.getByText(/Import Lead/i);
    fireEvent.click(importBtn);
    
    expect(screen.getByText(/Bulk Import Protocols/i)).toBeDefined();
  });

  it('handles recording toggle interaction', () => {
    renderLeads();
    const recordButtons = screen.getAllByTitle('Record Call');
    fireEvent.click(recordButtons[0]);
    
    // Verify recording state (timer should appear)
    expect(screen.getByText(/00:00/)).toBeDefined();
  });
});
