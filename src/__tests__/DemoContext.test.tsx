import React from 'react';
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DemoProvider, useDemo } from '../DemoContext';

function DemoProbe() {
  const { isDemoMode, setDemoMode, demoData } = useDemo();

  return (
    <div>
      <span data-testid="demo-mode">{String(isDemoMode)}</span>
      <span data-testid="lead-count">{demoData.leads.length}</span>
      <button onClick={() => setDemoMode(true)}>Enable Demo</button>
    </div>
  );
}

describe('DemoContext', () => {
  it('provides demo data and toggles demo mode', () => {
    render(
      <DemoProvider>
        <DemoProbe />
      </DemoProvider>
    );

    expect(screen.getByTestId('demo-mode').textContent).toBe('false');
    expect(Number(screen.getByTestId('lead-count').textContent)).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /enable demo/i }));

    expect(screen.getByTestId('demo-mode').textContent).toBe('true');
  });
});
