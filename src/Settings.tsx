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
    <div className="flex-1 p-4 sm:p-8 lg:p-12 max-w-7xl mx-auto w-full">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-3">
            <SettingsIcon size={14} /> System Configuration
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900">Admin Settings</h1>
          <p className="text-slate-500 font-medium mt-2 text-lg">Manage your team, custom data fields, and workspace preferences.</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex bg-slate-100/50 p-1.5 rounded-2xl w-full max-w-md mb-8 border border-slate-200/50">
        <button 
          onClick={() => setActiveTab('fields')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'fields' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Sliders size={18} /> Custom Fields
        </button>
        <button 
          onClick={() => setActiveTab('team')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'team' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Users size={18} /> Team Members
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden min-h-[600px]">
        <AnimatePresence mode="wait">
          {activeTab === 'fields' ? (
            <motion.div 
              key="fields"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              <CustomFields user={user} />
            </motion.div>
          ) : (
            <motion.div 
              key="team"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Team user={user} companyId={companyId || ''} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
