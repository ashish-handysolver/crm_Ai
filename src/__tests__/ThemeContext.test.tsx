import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ThemeToggle from '../components/ThemeToggle';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';

function ThemeStateProbe() {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button onClick={() => setTheme('light')}>Force Light</button>
+    </div>
  );
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.className = '';
  });

  it('defaults to the saved localStorage theme', () => {
    localStorage.setItem('theme', 'light');

    render(
      <ThemeProvider>
        <ThemeStateProbe />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-value').textContent).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('toggles theme from dark to light via ThemeToggle', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const toggle = screen.getByRole('button', { name: /switch to light mode/i });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    fireEvent.click(toggle);

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeDefined();
  });

  it('supports direct theme updates from the context', () => {
    render(
      <ThemeProvider>
        <ThemeStateProbe />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /force light/i }));

    expect(screen.getByTestId('theme-value').textContent).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });
});
