import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mic, LayoutDashboard, Users, MessageSquare, FileText, UploadCloud, Settings, CalendarDays, History, X } from 'lucide-react';
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
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center hover:scale-110 hover:rotate-6 shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all duration-300">
              <Mic className="text-white w-5 h-5" />
            </div>
            <span className="font-sans font-extrabold text-2xl tracking-tight text-white">AudioCRM</span>
          </Link>

          <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:text-white bg-white/5 rounded-full backdrop-blur transition-colors">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto scrollbar-hide relative z-10">
          <div className="text-xs font-bold text-slate-600 uppercase tracking-widest px-4 mb-4 mt-2">Overview</div>
          <NavItem onClick={onClose} to="/" icon={<LayoutDashboard />} label="Dashboard" colorClass="text-blue-400" hoverBgClass="" />
          <NavItem onClick={onClose} to="/clients" icon={<Users />} label="Leads / CRM" colorClass="text-indigo-400" hoverBgClass="" />
          <NavItem onClick={onClose} to="/upload" icon={<UploadCloud />} label="Intelligence" colorClass="text-emerald-400" hoverBgClass="" />
          
          <div className="text-xs font-bold text-slate-600 uppercase tracking-widest px-4 mb-4 mt-8">Insights</div>
          <NavItem onClick={onClose} to="/analytics" icon={<MessageSquare />} label="Analytics" colorClass="text-pink-400" hoverBgClass="" />
          <NavItem onClick={onClose} to="/reports" icon={<FileText />} label="Reports" colorClass="text-orange-400" hoverBgClass="" />
          <NavItem onClick={onClose} to="/calendar" icon={<CalendarDays />} label="Calendar" colorClass="text-violet-400" hoverBgClass="" />
          
          <div className="text-xs font-bold text-slate-600 uppercase tracking-widest px-4 mb-4 mt-8">Organization</div>
          <NavItem onClick={onClose} to="/team" icon={<Users />} label="Team Directory" colorClass="text-cyan-400" hoverBgClass="" />
          <NavItem onClick={onClose} to="/history" icon={<History />} label="All Recordings" colorClass="text-slate-300" hoverBgClass="" />
          <NavItem onClick={onClose} to="/settings" icon={<Settings />} label="Workspace Settings" colorClass="text-slate-300" hoverBgClass="" />
        </nav>

        {/* Bottom fading edge */}
        <div className="p-6 relative z-10 border-t border-white/5 bg-gradient-to-t from-[#0A0D14] to-transparent">
          <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5 backdrop-blur-md">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex flex-shrink-0 items-center justify-center shadow-inner">
               <Mic className="text-white w-4 h-4" />
            </div>
            <div className="flex flex-col overflow-hidden">
               <span className="text-xs font-bold text-white truncate">Pro Workspace</span>
               <span className="text-[10px] font-medium text-slate-500 truncate">Audio intelligence active</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
