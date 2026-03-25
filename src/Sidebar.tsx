import React from 'react';
import { Link } from 'react-router-dom';
import { Mic, LayoutDashboard, Users, Link as LinkIcon, MessageSquare, FileText, UploadCloud, Settings, CalendarDays } from 'lucide-react';

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white/80 backdrop-blur-xl border-r border-white/40 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.05)] hidden md:flex flex-col z-40 overflow-y-auto pt-6">
      <div className="px-6 pb-8">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 shadow-lg shadow-blue-500/30 transition-all duration-300">
            <Mic className="text-white w-5 h-5" />
          </div>
          <span className="font-sans font-extrabold text-2xl tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">AudioCRM</span>
        </Link>
      </div>
      <nav className="flex-1 px-4 space-y-1.5">
        <Link to="/" className="flex items-center gap-3 px-4 py-3.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50/50 rounded-2xl transition-all font-bold group">
          <LayoutDashboard size={20} className="group-hover:scale-110 transition-transform" />
          Dashboard
        </Link>
        <Link to="/clients" className="flex items-center gap-3 px-4 py-3.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-2xl transition-all font-bold group">
          <Users size={20} className="group-hover:scale-110 transition-transform" />
          Clients / Leads
        </Link>
        <Link to="/upload" className="flex items-center gap-3 px-4 py-3.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50/50 rounded-2xl transition-all font-bold group">
          <UploadCloud size={20} className="group-hover:scale-110 transition-transform" />
          Upload Intelligence
        </Link>
        <Link to="/reports" className="flex items-center gap-3 px-4 py-3.5 text-slate-600 hover:text-orange-600 hover:bg-orange-50/50 rounded-2xl transition-all font-bold group">
          <FileText size={20} className="group-hover:scale-110 transition-transform" />
          Reports
        </Link>
        <Link to="/analytics" className="flex items-center gap-3 px-4 py-3.5 text-slate-600 hover:text-pink-600 hover:bg-pink-50/50 rounded-2xl transition-all font-bold group">
          <MessageSquare size={20} className="group-hover:scale-110 transition-transform" />
          Analytics
        </Link>
        <Link to="/calendar" className="flex items-center gap-3 px-4 py-3.5 text-slate-600 hover:text-violet-600 hover:bg-violet-50/50 rounded-2xl transition-all font-bold group">
          <CalendarDays size={20} className="group-hover:scale-110 transition-transform" />
          Calendar
        </Link>
        <div className="pt-4 mt-4 border-t border-slate-200/50" />
        <Link to="/settings" className="flex items-center gap-3 px-4 py-3.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-2xl transition-all font-bold group">
          <Settings size={20} className="group-hover:rotate-45 transition-transform" />
          Custom Fields
        </Link>
      </nav>
    </aside>
  );
}
