import React, { useState } from 'react';
import { Settings as SettingsIcon, Users, Sliders, ShieldCheck, Database } from 'lucide-react';
import Team from './Team';
import CustomFields from './CustomFields';
import { useAuth } from './contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

export default function Settings({ user }: { user: any }) {
  const [activeTab, setActiveTab] = useState<'fields' | 'team'>('fields');
  const { companyId } = useAuth();

  return (
    <div className="flex-1 bg-transparent min-h-screen overflow-y-auto relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none translate-x-1/3 -translate-y-1/3"></div>
      <div className="max-w-7xl mx-auto p-4 sm:p-8 lg:p-12 space-y-12 relative z-10">

        {/* Header Section */}
        <header>
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 sm:space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">
              <SettingsIcon size={14} className="animate-spin-slow" /> System Settings
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-[var(--crm-text)] leading-none">Workspace Settings</h1>
            <p className="text-[var(--crm-text-muted)] font-medium max-w-2xl text-sm sm:text-base leading-relaxed">Configure your custom fields, manage team members, and update your preferences.</p>
          </motion.div>
        </header>

        {/* Dynamic Navigation Tabs */}
        <div className="flex bg-[var(--crm-bg)]/20 backdrop-blur-md p-1.5 rounded-2xl sm:rounded-[2rem] w-full max-w-md border border-[var(--crm-border)] shadow-xl shadow-black/20">
          <button
            onClick={() => setActiveTab('fields')}
            className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 sm:py-4 rounded-xl sm:rounded-[1.5rem] font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === 'fields' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20' : 'text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] hover:bg-[var(--crm-bg)]/20 shadow-inner'}`}
          >
            <Sliders size={18} className="hidden sm:block" /> Custom Fields
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 sm:py-4 rounded-xl sm:rounded-[1.5rem] font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === 'team' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20' : 'text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] hover:bg-[var(--crm-bg)]/20 shadow-inner'}`}
          >
            <Users size={18} className="hidden sm:block" /> Users
          </button>
        </div>

        {/* Content Container */}
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
                <CustomFields user={user} />
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
                <Team user={user} companyId={companyId || ''} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Administrative Badge */}
        <div className="flex justify-center pt-6 opacity-40">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] flex items-center gap-4">
            <ShieldCheck size={12} /> Admin Permissions Required
          </p>
        </div>

      </div>
    </div>
  );
}
