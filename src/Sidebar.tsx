import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Users, Settings, LayoutDashboard,
  X, Sparkles, Activity, Eye, EyeOff, History, CalendarDays, UploadCloud, Download
} from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { useDemo } from './DemoContext';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

// Helper component for navigation items
function NavItem({ to, icon, label, onClick }: { to: string, icon: React.ReactElement, label: string, onClick?: () => void }) {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`sidebar-item ${isActive ? 'sidebar-item-active' : 'sidebar-item-inactive'}`}
    >
      <div className={`relative z-10 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
        {React.cloneElement(icon, { size: 20, strokeWidth: isActive ? 2.5 : 2 })}
      </div>
      <span className={`relative z-10 font-bold transition-all ${isActive ? 'text-white' : ''}`}>{label}</span>
      {isActive && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 z-0"
          initial={false}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
    </Link>
  );
}

function NavButton({ icon, label, onClick }: { icon: React.ReactElement, label: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="sidebar-item sidebar-item-inactive w-full text-left flex items-center"
    >
      <div className="relative z-10 transition-transform duration-300 group-hover:scale-110">
        {React.cloneElement(icon, { size: 20, strokeWidth: 2 })}
      </div>
      <span className="relative z-10 font-bold transition-all">{label}</span>
    </button>
  );
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { companyName, role, logout } = useAuth();
  const { isDemoMode, setDemoMode } = useDemo();

  // Mobile backdrop
  const mobileOverlay = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[90] lg:hidden"
        />
      )}
    </AnimatePresence>
  );

  return (
    <>
      {mobileOverlay}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-[100dvh] w-[280px] bg-slate-950 border-r border-white/5 shadow-2xl lg:shadow-none flex flex-col z-[100] transform transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/4 w-32 h-32 bg-indigo-500/20 blur-[60px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-purple-500/10 blur-[60px] rounded-full pointer-events-none"></div>

        <div className="px-6 py-8 flex items-center justify-between relative z-10">
          <Link to="/" onClick={onClose} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/10 border border-white/10 p-1.5 overflow-hidden">
              <img src="/logo.png" className="w-full h-full object-contain" alt="handycrm.ai" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tighter text-white lowercase">handycrm.ai</span>
              <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em] leading-none opacity-80">{companyName || 'handycrm.ai'}</span>
            </div>
          </Link>

          <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:text-white bg-white/5 rounded-xl backdrop-blur transition-colors">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto hide-scrollbar relative z-10">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-4 mb-4 mt-2">Menu</div>
          <NavItem onClick={onClose} to="/" icon={<LayoutDashboard />} label="Dashboard" />
          <NavItem onClick={onClose} to="/clients" icon={<Users />} label="All Leads" />
          {/* <NavItem onClick={onClose} to="/active-clients" icon={<Activity />} label="Active Leads" /> */}
          <NavItem onClick={onClose} to="/upload" icon={<UploadCloud />} label="Import audio" />
          <NavItem onClick={onClose} to="/calendar" icon={<CalendarDays />} label="Calendar" />
          {/* <NavItem onClick={onClose} to="/history" icon={<History />} label="Logs" /> */}

          <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-4 mb-4 mt-8">System</div>
          <NavItem onClick={onClose} to="/settings" icon={<Settings />} label="Settings" />
          <NavItem onClick={onClose} to="/download-app" icon={<Download />} label="App" />
        </nav>

        <div className="p-4 border-t border-white/5 relative z-10">
          <button
            onClick={() => setDemoMode(!isDemoMode)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${isDemoMode ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
          >
            {isDemoMode ? <Eye size={16} /> : <EyeOff size={16} />}
            {isDemoMode ? 'Demo Active' : 'Switch To Demo'}
          </button>

          <div className="mt-6 pt-4 border-t border-white/5 flex justify-center">
            <div className="px-3 py-2.5 w-full rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all cursor-default group text-center">
              <p className="text-[8px] sm:text-[9px] font-black text-slate-400 group-hover:text-slate-200 flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 uppercase tracking-wider sm:tracking-[0.2em] transition-colors">
                Made with <span className="text-[10px] sm:text-[12px] animate-pulse">🧡</span> by Handysolver &copy; {new Date().getFullYear()}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
