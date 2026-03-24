import React from 'react';
import { Link } from 'react-router-dom';
import { Mic, LayoutDashboard, Users, Link as LinkIcon, MessageSquare, FileText } from 'lucide-react';

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-black/5 hidden md:flex flex-col z-40 overflow-y-auto pt-6">
      <div className="px-6 pb-6">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Mic className="text-white w-5 h-5" />
          </div>
          <span className="font-sans font-bold text-xl tracking-tight">AudioCRM</span>
        </Link>
      </div>
      <nav className="flex-1 px-4 space-y-2">
        <Link to="/" className="flex items-center gap-3 px-4 py-3 text-zinc-600 hover:text-black hover:bg-zinc-50 rounded-xl transition-colors font-medium">
          <LayoutDashboard size={18} />
          Dashboard
        </Link>
        <Link to="/clients" className="flex items-center gap-3 px-4 py-3 text-zinc-600 hover:text-black hover:bg-zinc-50 rounded-xl transition-colors font-medium">
          <Users size={18} />
          Clients / Leads
        </Link>
        {/* <Link to="/record" className="flex items-center gap-3 px-4 py-3 text-zinc-600 hover:text-black hover:bg-zinc-50 rounded-xl transition-colors font-medium">
          <LinkIcon size={18} />
          Generate Record Links
        </Link> */}
        <Link to="/reports" className="flex items-center gap-3 px-4 py-3 text-zinc-600 hover:text-black hover:bg-zinc-50 rounded-xl transition-colors font-medium">
          <FileText size={18} />
          Reports
        </Link>
        <Link to="/analytics" className="flex items-center gap-3 px-4 py-3 text-zinc-600 hover:text-black hover:bg-zinc-50 rounded-xl transition-colors font-medium">
          <MessageSquare size={18} />
          Analytics
        </Link>
      </nav>
    </aside>
  );
}
