import React from 'react';
import { Smartphone, Apple, Chrome, Share, MoreVertical, PlusSquare, Download, Sparkles, Globe } from 'lucide-react';
import { motion } from 'motion/react';

const DownloadApp = () => {
  return (
    <div className="flex-1 bg-slate-50/50 p-4 md:p-8 lg:p-12 min-h-full font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="mb-12 text-center md:text-left space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-[0.25em] shadow-sm mb-2">
            <Download size={14} className="animate-pulse" /> PWA Deployment
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 leading-tight uppercase">Install Experience</h1>
          <p className="text-slate-500 font-medium max-w-2xl text-lg italic mt-4">
            Optimize your workflow by adding handycrm.ai directly to your workspace for a native feel.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* iOS Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card !rounded-[2.5rem] p-8 md:p-10 shadow-2xl border-white/40 group"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-xl group-hover:scale-110 transition-transform">
                <Apple size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 lowercase">ios Protocol</h2>
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none">iPhone & iPad</p>
              </div>
            </div>

            <div className="space-y-6">
              {[
                { icon: <Globe size={18} />, text: <>Open in <span className="font-black text-slate-900">Safari</span> browser</> },
                { icon: <Share size={18} />, text: <>Tap the <span className="font-black text-slate-900">Share</span> icon</> },
                { icon: <PlusSquare size={18} />, text: <>Select <span className="font-black text-slate-900">Add to Home Screen</span></> },
                { icon: <Sparkles size={18} />, text: <>Confirm with <span className="font-black text-slate-900">Add</span> in top right</> },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50/50 border border-slate-100 group-hover:bg-white transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-indigo-600 shadow-sm">
                    {step.icon}
                  </div>
                  <div className="text-sm font-bold text-slate-600">
                    <span className="text-[10px] block font-black text-slate-400 uppercase tracking-tighter mb-0.5">Step 0{i+1}</span>
                    {step.text}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Android Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card !rounded-[2.5rem] p-8 md:p-10 shadow-2xl border-white/40 group"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl group-hover:scale-110 transition-transform">
                <Smartphone size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 lowercase">android Node</h2>
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none">Chrome & Edge</p>
              </div>
            </div>

            <div className="space-y-6">
              {[
                { icon: <Chrome size={18} />, text: <>Launch <span className="font-black text-slate-900">Chrome</span> browser</> },
                { icon: <MoreVertical size={18} />, text: <>Tap the <span className="font-black text-slate-900">Menu</span> (3 dots)</> },
                { icon: <Download size={18} />, text: <>Select <span className="font-black text-slate-900">Install app</span></> },
                { icon: <Sparkles size={18} />, text: <>Confirm and <span className="font-black text-slate-900">Install</span></> },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50/50 border border-slate-100 group-hover:bg-white transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-indigo-600 shadow-sm">
                    {step.icon}
                  </div>
                  <div className="text-sm font-bold text-slate-600">
                    <span className="text-[10px] block font-black text-slate-400 uppercase tracking-tighter mb-0.5">Step 0{i+1}</span>
                    {step.text}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="mt-12 p-8 rounded-[2.5rem] bg-slate-900 text-white relative overflow-hidden text-center">
           <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-indigo-500/10 to-purple-500/10 pointer-events-none"></div>
           <h3 className="text-xl font-black mb-2 uppercase tracking-tighter">Native Performance</h3>
           <p className="text-slate-400 text-sm font-medium">Enjoy push notifications, offline access, and lightning-fast boot sequences directly from your home screen.</p>
        </div>
      </div>
    </div>
  );
};

export default DownloadApp;