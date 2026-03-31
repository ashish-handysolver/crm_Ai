import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Plus, Users, Settings, LogOut, LayoutDashboard, FileText, 
  BarChart3, ChevronRight, Menu, X, Sparkles, Mic, Monitor, Activity, Eye, EyeOff, History, CalendarDays, UploadCloud
} from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { useDemo } from './DemoContext';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

// Helper component for navigation items
function NavItem({ to, icon, label, colorClass, hoverBgClass, onClick }: { to: string, icon: React.ReactElement, label: string, colorClass: string, hoverBgClass: string, onClick?: () => void }) {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

  return (
    <Link 
      to={to} 
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-bold group relative overflow-hidden ${isActive ? 'text-white' : 'text-slate-400 hover:text-white'}`}
    >
      {isActive && (
        <motion.div layoutId="sidebar-active" className="absolute inset-0 bg-white/10 rounded-2xl border border-white/10" />
      )}
      <div className={`relative z-10 transition-transform duration-300 ${isActive ? colorClass : 'group-hover:scale-110 group-hover:' + colorClass}`}>
        {React.cloneElement(icon, { size: 20 })}
      </div>
      <span className="relative z-10">{label}</span>
    </Link>
  );
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { companyName, role, logout } = useAuth();
  const { isDemoMode, setDemoMode } = useDemo();
  const location = useLocation();

  // Mobile backdrop
  const mobileOverlay = (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
        />
      )}
    </AnimatePresence>
  );

  return (
    <>
      {mobileOverlay}
      <aside 
        className={`fixed lg:sticky top-0 left-0 h-[100dvh] w-[280px] bg-[#0A0D14] border-r border-white/5 shadow-2xl lg:shadow-none flex flex-col z-50 transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] lg:translate-x-0 overflow-hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none"></div>
        
        <div className="px-6 pt-8 pb-6 flex items-center justify-between relative z-10">
          <Link to="/" onClick={onClose} className="flex items-center gap-3 group">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-slate-200/50 border border-slate-100 p-1.5 overflow-hidden">
              <img src="/logo.png" alt="Handysolver Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">Handysolver</span>
          </Link>

          <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:text-white bg-white/5 rounded-full backdrop-blur transition-colors">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto scrollbar-hide relative z-10">
          <div className="text-xs font-bold text-slate-600 uppercase tracking-widest px-4 mb-4 mt-2">Overview</div>
          <NavItem onClick={onClose} to="/" icon={<LayoutDashboard />} label="Dashboard" colorClass="text-blue-400" hoverBgClass="" />
          <NavItem onClick={onClose} to="/clients" icon={<Users />} label="Clients" colorClass="text-indigo-400" hoverBgClass="" />
          <NavItem onClick={onClose} to="/upload" icon={<UploadCloud />} label="Upload Audio" colorClass="text-emerald-400" hoverBgClass="" />
          
          
          <div className="text-xs font-bold text-slate-600 uppercase tracking-widest px-4 mb-4 mt-8">Media</div>
          <NavItem onClick={onClose} to="/history" icon={<History />} label="Recordings" colorClass="text-slate-300" hoverBgClass="" />
          <NavItem onClick={onClose} to="/calendar" icon={<CalendarDays />} label="Calendar" colorClass="text-violet-400" hoverBgClass="" />
          
          <div className="text-xs font-bold text-slate-600 uppercase tracking-widest px-4 mb-4 mt-8">Manage</div>
          <NavItem onClick={onClose} to="/settings" icon={<Settings />} label="Admin Settings" colorClass="text-slate-300" hoverBgClass="" />
        </nav>

        {/* Bottom fading edge */}
        <div className="p-6 border-t border-white/5 relative z-10 text-center">
          <div className="space-y-2 mb-4">
            <button 
              onClick={() => setDemoMode(!isDemoMode)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${isDemoMode ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              {isDemoMode ? <Eye size={18} /> : <EyeOff size={18} />}
              {isDemoMode ? 'Demo Mode: ON' : 'Switch to Demo'}
            </button>
            <button 
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl text-sm font-bold transition-all group"
            >
              <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
              Sign Out
            </button>
          </div>
          <p className="text-[11px] font-medium text-slate-500 flex items-center justify-center gap-1.5">
            Made with <span className="text-[14px]">🧡</span> by Handysolver &copy; {new Date().getFullYear()}
          </p>
        </div>
      </aside>
    </>
  );
}
