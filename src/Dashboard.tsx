import React from 'react';
import { 
  Download, Plus, TrendingUp, ChevronRight, Zap, Target, MoreHorizontal
} from 'lucide-react';
import { Link } from 'react-router-dom';

const PIPELINE_DATA = [
  { name: 'DISCOVERY', value: 412, percentage: '32% of total' },
  { name: 'DEMO', value: 128, percentage: '10% of total' },
  { name: 'NEGOTIATION', value: 64, percentage: '5% of total' },
  { name: 'ONBOARDING', value: 22, percentage: '2% of total' },
];

const PROSPECTS_DATA = [
  { id: '1', initials: 'NL', company: 'Nova Labs', contact: 'Ethan Hunt • CTO', stage: 'NEGOTIATION', health: 'Hot', healthColor: 'text-emerald-700 bg-emerald-100', dot: 'bg-emerald-500', date: 'Oct 24, 2023', rep: 'Sarah Jenkins' },
  { id: '2', initials: 'AT', company: 'Apex Tech', contact: 'Lana Kane • COO', stage: 'DEMO', health: 'Warm', healthColor: 'text-amber-700 bg-amber-100', dot: 'bg-amber-500', date: 'Oct 23, 2023', rep: 'David Miller' },
  { id: '3', initials: 'SQ', company: 'Skyline Quota', contact: 'Ray Gillette • VP Sales', stage: 'DISCOVERY', health: 'Cold', healthColor: 'text-red-700 bg-red-100', dot: 'bg-red-500', date: 'Oct 20, 2023', rep: 'Sarah Jenkins' },
  { id: '4', initials: 'VS', company: 'Vertex Solutions', contact: 'Cheryl Tunt • Director', stage: 'ONBOARDING', health: 'Hot', healthColor: 'text-emerald-700 bg-emerald-100', dot: 'bg-emerald-500', date: 'Yesterday', rep: 'David Miller' },
];

export default function Dashboard() {
  return (
    <div className="flex-1 bg-[#f8fafc] text-slate-900 p-8 min-h-screen">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-1">Executive Summary</div>
            <h1 className="text-3xl font-bold tracking-tight">Lead Performance Ledger</h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
              <Download size={16} /> Export Report
            </button>
            <Link to="/clients/new" className="flex items-center gap-2 px-5 py-2.5 bg-[#475069] text-white rounded-lg text-sm font-semibold hover:bg-[#3b4256] transition-colors shadow-sm">
              <Plus size={16} /> New Prospect
            </Link>
          </div>
        </header>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Total Active Leads</div>
              <span className="flex items-center gap-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                <TrendingUp size={10} /> +12%
              </span>
            </div>
            <div className="text-4xl font-black tracking-tight mb-2">1,284</div>
            <div className="absolute bottom-6 right-6 opacity-20">
              <svg width="80" height="30" viewBox="0 0 100 40" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M0,30 L20,30 L40,15 L60,25 L80,10 L100,10" />
              </svg>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Conversion Rate</div>
              <span className="flex items-center gap-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                <TrendingUp size={10} /> +3.2%
              </span>
            </div>
            <div className="text-4xl font-black tracking-tight mb-2 flex items-baseline">
              24.8<span className="text-2xl text-slate-400 ml-1">%</span>
            </div>
            <div className="absolute bottom-6 right-6 opacity-20">
              <svg width="80" height="30" viewBox="0 0 100 40" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M0,35 L30,35 L50,15 L70,25 L100,5" />
              </svg>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm">
            <div className="flex justify-between items-start mb-6">
              <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Weighted Value</div>
              <span className="text-[10px] font-bold text-slate-300 tracking-widest uppercase">USD</span>
            </div>
            <div className="text-4xl font-black tracking-tight mb-3">$4.2M</div>
            <p className="text-xs text-slate-400 font-medium italic">Calculated based on stage probability</p>
          </div>
        </div>

        {/* Pipeline Progress */}
        <section>
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-lg font-bold">Pipeline Progress</h2>
            <span className="text-xs text-slate-400 font-medium">Updated 5 minutes ago</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {PIPELINE_DATA.map((item) => (
              <div key={item.name} className="bg-slate-50 rounded-xl p-5 border border-slate-200/50">
                <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-3 flex items-center justify-between">
                  {item.name}
                  <div className="w-5 h-5 bg-slate-200 rounded-md opacity-50" />
                </div>
                <div className="text-2xl font-black mb-1">{item.value}</div>
                <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">{item.percentage}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Active Prospects */}
        <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold">Active Prospects</h2>
              <div className="hidden md:flex bg-slate-100 p-1 rounded-lg">
                <button className="px-3 py-1 bg-white shadow-sm rounded-md text-xs font-bold text-slate-700">All</button>
                <button className="px-3 py-1 text-xs font-bold text-slate-500 hover:text-slate-700">Starred</button>
                <button className="px-3 py-1 text-xs font-bold text-slate-500 hover:text-slate-700">Recent</button>
              </div>
            </div>
            <button className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors">
              View All <ChevronRight size={14} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">
                  <th className="py-4 px-6 font-bold w-1/3">Prospect & Company</th>
                  <th className="py-4 px-6 font-bold">Stage</th>
                  <th className="py-4 px-6 font-bold">Health</th>
                  <th className="py-4 px-6 font-bold">Last Activity</th>
                  <th className="py-4 px-6 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {PROSPECTS_DATA.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-pink-50 text-pink-600 font-bold flex items-center justify-center text-xs tracking-wider">
                          {item.initials}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{item.company}</div>
                          <div className="text-slate-500 text-xs mt-0.5">{item.contact}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="bg-slate-100 text-slate-600 text-[9px] font-bold px-2 py-1 rounded-md tracking-widest uppercase">
                        {item.stage}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${item.healthColor}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
                        {item.health}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-medium text-slate-700 text-sm">{item.date}</div>
                      <div className="text-slate-400 text-xs mt-0.5 flex items-center gap-1">
                        <Target size={10} /> {item.rep}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button className="text-slate-400 hover:text-slate-700 p-1 transition-colors">
                        <MoreHorizontal size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Bottom Split Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* AI Intelligence Card */}
          <div className="lg:col-span-2 bg-[#4c546b] text-white rounded-2xl p-8 relative overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 mb-8">
              <Zap className="text-emerald-400 fill-emerald-400" size={20} />
              <h2 className="text-lg font-bold tracking-wide">AI Intelligence</h2>
            </div>
            
            <div className="space-y-6 relative z-10">
              <div>
                <div className="text-[10px] font-bold text-white/50 tracking-widest uppercase mb-2">Primary Pain Point</div>
                <p className="text-sm font-medium leading-relaxed">
                  <span className="text-emerald-400 font-bold">60% of active leads</span> cite legacy CRM integration as their #1 barrier to switching.
                </p>
              </div>
              
              <div>
                <div className="text-[10px] font-bold text-white/50 tracking-widest uppercase mb-2">Velocity Warning</div>
                <p className="text-sm font-medium leading-relaxed">
                  "Discovery" phase is 15% slower than last quarter. Recommend prioritizing automated follow-ups.
                </p>
              </div>

              <div className="pt-4 border-t border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-[10px] font-bold text-white/50 tracking-widest uppercase">Sentiment Score</div>
                  <div className="text-xs font-bold text-white/80">8.4/10</div>
                </div>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: '84%' }} />
                </div>
              </div>
            </div>
            <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-emerald-400/10 blur-3xl rounded-full mix-blend-screen pointer-events-none" />
          </div>

          {/* Upcoming Milestones */}
          <div className="col-span-1 bg-white rounded-2xl p-8 border border-slate-200/60 shadow-sm flex flex-col">
            <h2 className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-6">Upcoming Milestones</h2>
            <div className="space-y-6 flex-1">
              <div className="flex gap-4">
                <div className="mt-1 w-2 h-2 rounded-full bg-[#4c546b] shrink-0" />
                <div>
                  <div className="font-bold text-sm text-slate-800">Security Audit - Nova Labs</div>
                  <div className="text-xs text-slate-500 mt-1">Due tomorrow • Sarah J.</div>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="mt-1 w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <div>
                  <div className="font-bold text-sm text-slate-800">Contract Review - Apex Tech</div>
                  <div className="text-xs text-slate-500 mt-1">Due this week • Lana M.</div>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="mt-1 w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                <div>
                  <div className="font-bold text-sm text-slate-800">Discovery Call - Skyline Quota</div>
                  <div className="text-xs text-slate-500 mt-1">Oct 26 • David M.</div>
                </div>
              </div>
            </div>
            <button className="w-full mt-6 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
              View Calendar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
