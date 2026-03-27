import React, { createContext, useContext, useState, ReactNode } from 'react';
import demoData from './data/demoData.json';

interface DemoContextType {
  isDemoMode: boolean;
  setDemoMode: (mode: boolean) => void;
  demoData: typeof demoData;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);

  return (
    <DemoContext.Provider value={{ isDemoMode, setDemoMode: setIsDemoMode, demoData }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (context === undefined) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
}
