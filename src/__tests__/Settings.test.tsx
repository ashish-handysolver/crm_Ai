import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Settings from '../Settings';

const authState = vi.hoisted(() => ({
  companyId: 'company-1',
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('../CustomFields', () => ({
  default: ({ user }: { user: any }) => <div>Custom Fields Panel for {user.displayName}</div>,
}));

vi.mock('../Team', () => ({
  default: ({ user, companyId }: { user: any; companyId: string }) => (
    <div>Team Panel for {user.displayName} at {companyId}</div>
  ),
}));

describe('Settings tabs', () => {
  const user = { uid: 'user-1', displayName: 'Test User' };

  beforeEach(() => {
    authState.companyId = 'company-1';
  });

  it('shows custom fields by default', () => {
    render(<Settings user={user} />);

    expect(screen.getByText(/workspace settings/i)).toBeDefined();
    expect(screen.getByText(/custom fields panel for test user/i)).toBeDefined();
  });

  it('switches to the users tab', async () => {
    render(<Settings user={user} />);

    fireEvent.click(screen.getByRole('button', { name: /users/i }));

    await waitFor(() => {
      expect(screen.getByText(/team panel for test user at company-1/i)).toBeDefined();
    });
  });
});
