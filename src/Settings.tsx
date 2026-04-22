import React, { useState } from 'react';
import { Settings as SettingsIcon, Users, Sliders, ShieldCheck, Database } from 'lucide-react';
import Team from './Team';
import CustomFields from './CustomFields';
import { useAuth } from './contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { PageLayout } from './components/layout/PageLayout';
import { PageHeader } from './components/layout/PageHeader';

export default function Settings({ user }: { user: any }) {
  const [activeTab, setActiveTab] = useState<'fields' | 'team'>('fields');
  const { companyId } = useAuth();

  return (
    <PageLayout>
      <PageHeader 
        title="Workspace Settings"
        description="Configure your custom fields, manage team members, and update your preferences."
        badge="System Settings"
        icon={SettingsIcon}
        actions={
          <div className="flex bg-[var(--crm-bg)]/20 backdrop-blur-md p-1.5 rounded-2xl border border-[var(--crm-border)] shadow-xl shadow-black/20 overflow-hidden">
            <button
              onClick={() => setActiveTab('fields')}
              className={`flex items-center justify-center gap-2.5 px-6 py-2.5 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === 'fields' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20' : 'text-[var(--crm-text-muted)] hover:text-[var(--crm-text)]'}`}
            >
              <Sliders size={16} /> <span className="hidden sm:inline">Custom Fields</span>
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`flex items-center justify-center gap-2.5 px-6 py-2.5 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === 'team' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20' : 'text-[var(--crm-text-muted)] hover:text-[var(--crm-text)]'}`}
            >
              <Users size={16} /> <span className="hidden sm:inline">Users</span>
            </button>
          </div>
        }
      />

      <motion.div
        layout
        className="glass-card !bg-transparent !p-0 !rounded-[2.5rem] border-none shadow-none ring-0 overflow-hidden min-h-[600px]"
      >
        <AnimatePresence mode="wait">
          {activeTab === 'fields' ? (
            <motion.div
              key="fields"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <CustomFields user={user} embedded />
            </motion.div>
          ) : (
            <motion.div
              key="team"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <Team user={user} companyId={companyId || ''} embedded />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </PageLayout>
  );
}
