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
    <div className="flex-1 bg-slate-50/50 min-h-screen overflow-y-auto">
      <div className="max-w-7xl mx-auto p-4 sm:p-8 lg:p-12 space-y-12">
        
        {/* Header Section */}
        <header>
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 sm:space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">
              <SettingsIcon size={14} className="animate-spin-slow" /> System Architecture Protocol
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 leading-none">Workspace Preferences</h1>
            <p className="text-slate-500 font-medium max-w-2xl text-sm sm:text-base leading-relaxed">Configure your data schemas, manage organizational units, and optimize your intelligence workflows.</p>
          </motion.div>
        </header>

        {/* Dynamic Navigation Tabs */}
        <div className="flex bg-white/60 backdrop-blur-md p-1.5 rounded-2xl sm:rounded-[2rem] w-full max-w-md border border-slate-200 shadow-xl shadow-slate-200/20">
          <button 
            onClick={() => setActiveTab('fields')}
            className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 sm:py-4 rounded-xl sm:rounded-[1.5rem] font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === 'fields' ? 'bg-black text-white shadow-xl shadow-black/20' : 'text-slate-400 hover:text-indigo-600 hover:bg-white'}`}
          >
            <Sliders size={18} className="hidden sm:block" /> Logic
          </button>
          <button 
            onClick={() => setActiveTab('team')}
            className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 sm:py-4 rounded-xl sm:rounded-[1.5rem] font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === 'team' ? 'bg-black text-white shadow-xl shadow-black/20' : 'text-slate-400 hover:text-indigo-600 hover:bg-white'}`}
          >
            <Users size={18} className="hidden sm:block" /> Human
          </button>
        </div>

        {/* Content Container */}
        <motion.div 
          layout
          className="glass-card !p-0 !rounded-[2.5rem] overflow-hidden min-h-[600px] ring-1 ring-slate-100"
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
             <ShieldCheck size={12} /> Secure Override Permissions - Root Authenticated
           </p>
        </div>

      </div>
    </div>
  );
}
