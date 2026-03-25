import React from 'react';
import { 
  Download, Plus, TrendingUp, ChevronRight, Zap, Target, MoreHorizontal, Activity, ArrowUpRight, Users, Sparkles, UserCircle, AlertCircle, CalendarDays
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

const PIPELINE_DATA = [
  { name: 'DISCOVERY', value: 412, percentage: '32% of total', color: 'bg-blue-500' },
  { name: 'DEMO', value: 128, percentage: '10% of total', color: 'bg-indigo-500' },
  { name: 'NEGOTIATION', value: 64, percentage: '5% of total', color: 'bg-violet-500' },
  { name: 'ONBOARDING', value: 22, percentage: '2% of total', color: 'bg-emerald-500' },
];

const PROSPECTS_DATA = [
  { id: '1', initials: 'NL', company: 'Nova Labs', contact: 'Ethan Hunt • CTO', stage: 'NEGOTIATION', health: 'Hot', healthColor: 'text-emerald-700 bg-emerald-100', dot: 'bg-emerald-500', date: 'Oct 24, 2023', rep: 'Sarah Jenkins', avatarBg: 'bg-emerald-50 text-emerald-600' },
  { id: '2', initials: 'AT', company: 'Apex Tech', contact: 'Lana Kane • COO', stage: 'DEMO', health: 'Warm', healthColor: 'text-amber-700 bg-amber-100', dot: 'bg-amber-500', date: 'Oct 23, 2023', rep: 'David Miller', avatarBg: 'bg-amber-50 text-amber-600' },
  { id: '3', initials: 'SQ', company: 'Skyline Quota', contact: 'Ray Gillette • VP Sales', stage: 'DISCOVERY', health: 'Cold', healthColor: 'text-red-700 bg-red-100', dot: 'bg-red-500', date: 'Oct 20, 2023', rep: 'Sarah Jenkins', avatarBg: 'bg-red-50 text-red-600' },
  { id: '4', initials: 'VS', company: 'Vertex Solutions', contact: 'Cheryl Tunt • Director', stage: 'ONBOARDING', health: 'Hot', healthColor: 'text-emerald-700 bg-emerald-100', dot: 'bg-emerald-500', date: 'Yesterday', rep: 'David Miller', avatarBg: 'bg-blue-50 text-blue-600' },
];

export default function Dashboard() {
  return (
    <div className="flex-1 bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-10 min-h-full">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-100/50 text-indigo-600 text-xs font-bold uppercase tracking-widest mb-3">
              <Activity size={14} />
              Executive Summary
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">Lead Performance</h1>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 bg-white rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:shadow-sm transition-all shadow-sm">
              <Download size={16} /> Export
            </button>
            <Link to="/clients/new" className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-indigo-500/30 active:scale-[0.98] transition-all relative overflow-hidden group">
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
              <Plus size={16} className="relative z-10" /> 
              <span className="relative z-10">New Prospect</span>
            </Link>
          </motion.div>
        </header>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:border-indigo-100 transition-colors">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Total Active Leads</div>
                <span className="flex items-center gap-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-1 rounded-full border border-emerald-100">
                  <TrendingUp size={10} /> +12%
                </span>
              </div>
              <div className="text-5xl font-black tracking-tight mb-2 text-slate-900">1,284</div>
            </div>
            <div className="absolute bottom-6 right-6 opacity-[0.03] group-hover:opacity-10 transition-opacity">
              <Users size={64} className="text-indigo-900" />
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:border-blue-100 transition-colors">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Conversion Rate</div>
                <span className="flex items-center gap-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-1 rounded-full border border-emerald-100">
                  <TrendingUp size={10} /> +3.2%
                </span>
              </div>
              <div className="text-5xl font-black tracking-tight mb-2 flex items-baseline text-slate-900">
                24.8<span className="text-3xl text-slate-400 ml-1 font-extrabold">%</span>
              </div>
            </div>
            <div className="absolute bottom-6 right-6 opacity-[0.03] group-hover:opacity-10 transition-opacity">
               <Target size={64} className="text-blue-900" />
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:border-violet-100 transition-colors">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Weighted Value</div>
                <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase bg-slate-50 px-2 py-1 rounded-md">USD</span>
              </div>
              <div className="text-5xl font-black tracking-tight mb-3 text-slate-900">$4.2M</div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold bg-slate-50/80 w-fit px-3 py-1.5 rounded-lg border border-slate-100">
                <Sparkles size={12} className="text-violet-500" /> Based on stage prob.
              </div>
            </div>
          </motion.div>
        </div>

        {/* Pipeline Progress */}
        <section className="bg-white p-6 md:p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Pipeline Velocity</h2>
              <p className="text-sm text-slate-500 font-medium mt-1">Current distribution of active prospects</p>
            </div>
            <span className="text-xs text-slate-400 font-bold bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">Updated 5 min ago</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {PIPELINE_DATA.map((item, i) => (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + (i * 0.1) }} key={item.name} className="bg-slate-50/50 rounded-2xl p-5 md:p-6 border border-slate-100/80 hover:bg-slate-50 transition-colors">
                <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-4 flex items-center justify-between">
                  <span>{item.name}</span>
                  <div className={`w-2.5 h-2.5 rounded-full ${item.color} shadow-sm shadow-${item.color.split('-')[1]}-500/50`} />
                </div>
                <div className="text-3xl md:text-4xl font-black text-slate-900 mb-1">{item.value}</div>
                <div className="text-xs font-bold text-slate-400">{item.percentage}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Active Prospects */}
        <section className="bg-white rounded-[2rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-extrabold text-slate-900">High-Priority Prospects</h2>
              <div className="hidden lg:flex bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/50">
                <button className="px-4 py-1.5 bg-white shadow-sm rounded-lg text-xs font-bold text-slate-800 transition-all">All</button>
                <button className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-all">Starred</button>
                <button className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-all">Recent</button>
              </div>
            </div>
            <button className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors group">
              View Database <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
          <div className="overflow-x-auto scollbar-hide">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">
                  <th className="py-5 px-8 relative">Prospect & Company <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-slate-200"></div></th>
                  <th className="py-5 px-8 relative">Stage <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-slate-200"></div></th>
                  <th className="py-5 px-8 relative">Health <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-slate-200"></div></th>
                  <th className="py-5 px-8 relative">Last Activity <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-slate-200"></div></th>
                  <th className="py-5 px-8 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-50">
                {PROSPECTS_DATA.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-5 px-8 whitespace-nowrap">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl ${item.avatarBg} font-black flex items-center justify-center text-sm tracking-wider shadow-sm`}>
                          {item.initials}
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-900 text-base">{item.company}</div>
                          <div className="text-slate-500 text-xs font-medium mt-0.5 flex items-center gap-1">
                            <UserCircle size={12} className="text-slate-400" /> {item.contact}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-8 whitespace-nowrap">
                      <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold px-3 py-1.5 rounded-lg tracking-widest uppercase shadow-sm">
                        {item.stage}
                      </span>
                    </td>
                    <td className="py-5 px-8 whitespace-nowrap">
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${item.healthColor.replace('bg-', 'border-').replace('100', '200')} ${item.healthColor}`}>
                        <div className={`w-1.5 h-1.5 rounded-full bg-white`} />
                        {item.health}
                      </div>
                    </td>
                    <td className="py-5 px-8 whitespace-nowrap">
                      <div className="font-bold text-slate-800 text-sm">{item.date}</div>
                      <div className="text-slate-400 text-xs font-semibold mt-1 flex items-center gap-1.5">
                        <Target size={12} /> {item.rep}
                      </div>
                    </td>
                    <td className="py-5 px-8 text-right whitespace-nowrap">
                      <button className="text-slate-400 hover:text-indigo-600 bg-white hover:bg-indigo-50 border border-transparent hover:border-indigo-100 p-2 rounded-xl transition-all shadow-sm">
                        <MoreHorizontal size={18} />
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
          <div className="lg:col-span-2 bg-[#0A0D14] text-white rounded-[2rem] p-8 md:p-10 relative overflow-hidden shadow-2xl">
            {/* Glowing orbs */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none translate-x-1/3 -translate-y-1/3"></div>
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/20 rounded-full blur-[80px] pointer-events-none -translate-x-1/3 translate-y-1/3"></div>
            
            <div className="flex items-center gap-3 mb-10 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                <Zap className="text-indigo-400 fill-indigo-400" size={20} />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight">AI Insights Board</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 tracking-widest uppercase mb-3">
                  <Target size={12} /> Priority Finding
                </div>
                <p className="text-base text-slate-300 font-medium leading-relaxed">
                  <span className="text-white font-bold">60% of active leads</span> cite legacy CRM integration as their #1 barrier to switching.
                </p>
              </div>
              
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-[10px] font-bold text-amber-400 tracking-widest uppercase mb-3">
                  <AlertCircle size={12} /> Velocity Warning
                </div>
                <p className="text-base text-slate-300 font-medium leading-relaxed">
                  "Discovery" phase is <span className="text-white font-bold">15% slower</span> than last quarter. Recommend prioritizing automated follow-ups.
                </p>
              </div>

              <div className="md:col-span-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-6 backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-1">Global Sentiment Score</div>
                  <div className="text-sm font-medium text-slate-300">Based on recent transcript analysis</div>
                </div>
                <div className="flex-1 w-full max-w-sm">
                  <div className="flex justify-between items-end mb-2">
                    <div className="text-3xl font-black text-white">8.4<span className="text-lg text-slate-500 ml-1">/10</span></div>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md mb-1">+0.4 from last week</span>
                  </div>
                  <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: '84%' }} transition={{ duration: 1, delay: 0.5 }} className="h-full bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full relative">
                      <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-white/40 blur-sm"></div>
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming Milestones */}
          <div className="col-span-1 bg-white rounded-[2rem] p-8 md:p-10 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-[100px] -z-0"></div>
            
            <h2 className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-8 relative z-10">Upcoming Milestones</h2>
            <div className="space-y-6 flex-1 relative z-10">
              
              <div className="group cursor-pointer">
                <div className="flex gap-4 items-start">
                  <div className="mt-1 w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                  <div className="flex-1 bg-slate-50 group-hover:bg-slate-100/80 p-3 -mt-3 rounded-xl transition-colors border border-transparent group-hover:border-slate-200">
                    <div className="font-extrabold text-sm text-slate-900 leading-tight">Security Audit - Nova Labs</div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-bold text-white bg-slate-800 px-2 py-0.5 rounded uppercase tracking-wider">Tomorrow</span>
                      <span className="text-xs font-semibold text-slate-500">Sarah J.</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="group cursor-pointer">
                <div className="flex gap-4 items-start">
                  <div className="mt-1 w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                  <div className="flex-1 bg-slate-50 group-hover:bg-slate-100/80 p-3 -mt-3 rounded-xl transition-colors border border-transparent group-hover:border-slate-200">
                    <div className="font-extrabold text-sm text-slate-900 leading-tight">Contract Review - Apex Tech</div>
                    <div className="flex items-center gap-2 mt-2">
                       <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded uppercase tracking-wider">This Week</span>
                      <span className="text-xs font-semibold text-slate-500">Lana M.</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="group cursor-pointer">
                <div className="flex gap-4 items-start">
                  <div className="mt-1 w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />
                  <div className="flex-1 bg-slate-50 group-hover:bg-slate-100/80 p-3 -mt-3 rounded-xl transition-colors border border-transparent group-hover:border-slate-200">
                    <div className="font-extrabold text-sm text-slate-900 leading-tight">Discovery Call - Skyline</div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded uppercase tracking-wider">Oct 26</span>
                      <span className="text-xs font-semibold text-slate-500">David M.</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
            
            <button className="w-full mt-8 py-3.5 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-slate-900/10 hover:shadow-xl hover:shadow-slate-900/20 active:scale-[0.98] transition-all relative z-10 flex justify-center items-center gap-2">
              <CalendarDays size={16} /> Open Calendar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
