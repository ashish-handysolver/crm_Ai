import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Download, Smartphone, Apple, Chrome, Sparkles, 
  Zap, ShieldCheck, ChevronRight, Share2, PlusSquare, 
  ExternalLink, MousePointer2, CheckCircle2
} from 'lucide-react';

export default function DownloadApp() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        }
    };

    return (
        <div className="flex-1 bg-[var(--crm-bg)] min-h-screen overflow-y-auto selection:bg-indigo-500/30">
            {/* Background Decorative Elements */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-purple-600/5 blur-[100px] rounded-full"></div>
            </div>

            <div className="max-w-[1400px] mx-auto p-6 sm:p-12 lg:p-20 relative z-10 space-y-16">
                
                {/* Header Section - Dashboard Style */}
                <header className="space-y-4">
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2"
                    >
                        <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center">
                            <Download className="text-indigo-500" size={16} />
                        </div>
                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Deployment Nexus</span>
                    </motion.div>
                    
                    <div className="flex flex-col gap-2">
                        <motion.h1 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tighter text-[var(--crm-text)] leading-none"
                        >
                            Experience <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500">HandyCRM</span>
                        </motion.h1>
                        <motion.p 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-[var(--crm-text-muted)] font-black uppercase tracking-widest text-[10px] sm:text-xs opacity-60"
                        >
                            Optimize your workflow by adding handycrm.ai directly to your workspace.
                        </motion.p>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                    
                    {/* iOS Protocol - Premium Card Style */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="glass-card group p-8 lg:p-10 flex flex-col gap-10 border-indigo-500/10 hover:border-indigo-500/30"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-500">
                                    <Apple className="text-white" size={28} />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-2xl font-black tracking-tighter text-white">Apple iOS</h3>
                                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Safari Protocol</span>
                                </div>
                            </div>
                            <div className="hidden sm:block px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[8px] font-black text-indigo-400 uppercase tracking-widest">Recommended</div>
                        </div>

                        <div className="space-y-4">
                            {[
                                { icon: <ExternalLink size={14} />, step: "01", label: "Open in", bold: "Safari", detail: "Browser" },
                                { icon: <Share2 size={14} />, step: "02", label: "Tap the", bold: "Share", detail: "Icon" },
                                { icon: <PlusSquare size={14} />, step: "03", label: "Select", bold: "Add to Home Screen", detail: "" },
                                { icon: <CheckCircle2 size={14} />, step: "04", label: "Confirm with", bold: "Add", detail: "in top right" }
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-5 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all duration-300">
                                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 group-hover:text-indigo-400 transition-colors">
                                        {item.icon}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-[8px] font-black text-indigo-500/60 uppercase tracking-tighter leading-none mb-1">Step {item.step}</div>
                                        <div className="text-xs font-bold text-white/90">
                                            {item.label} <span className="text-white font-black">{item.bold}</span> {item.detail}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Desktop/Android Node */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="glass-card group p-8 lg:p-10 flex flex-col gap-10 border-indigo-500/10 hover:border-indigo-500/30"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-500">
                                    <Chrome className="text-indigo-400" size={28} />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-2xl font-black tracking-tighter text-white">Chromium</h3>
                                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Native Engine</span>
                                </div>
                            </div>
                            {!deferredPrompt && (
                                <div className="hidden sm:block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-black text-emerald-400 uppercase tracking-widest">Active</div>
                            )}
                        </div>

                        <div className="space-y-4">
                            {[
                                { icon: <MousePointer2 size={14} />, step: "01", label: "Launch", bold: "Chrome", detail: "or Edge" },
                                { icon: <Sparkles size={14} />, step: "02", label: "Tap the", bold: "Menu", detail: "(3 dots)" },
                                { icon: <Download size={14} />, step: "03", label: "Select", bold: "Install App", detail: "" },
                                { icon: <Zap size={14} />, step: "04", label: "Confirm and", bold: "Install", detail: "to Desktop" }
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-5 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all duration-300">
                                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 group-hover:text-indigo-400 transition-colors">
                                        {item.icon}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-[8px] font-black text-indigo-500/60 uppercase tracking-tighter leading-none mb-1">Step {item.step}</div>
                                        <div className="text-xs font-bold text-white/90">
                                            {item.label} <span className="text-white font-black">{item.bold}</span> {item.detail}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleInstall}
                            disabled={!deferredPrompt}
                            className="mt-4 w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all shadow-2xl shadow-indigo-600/20 active:scale-[0.98] flex items-center justify-center gap-3 group/btn overflow-hidden relative"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000"></div>
                            {success ? (
                                <><CheckCircle2 size={18} /> Success</>
                            ) : deferredPrompt ? (
                                <><Download size={18} /> One-Click Install</>
                            ) : (
                                "App Already Integrated"
                            )}
                        </button>
                    </motion.div>
                </div>

                {/* Integration Specs */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="grid grid-cols-1 sm:grid-cols-3 gap-6"
                >
                    {[
                        { icon: <Zap />, title: "Hyper Sync", color: "indigo" },
                        { icon: <Smartphone />, title: "OLED Support", color: "purple" },
                        { icon: <ShieldCheck />, title: "Local Vault", color: "emerald" }
                    ].map((spec, i) => (
                        <div key={i} className="glass-card p-6 flex items-center gap-5 hover:bg-white/5 transition-colors">
                            <div className={`p-3 bg-${spec.color}-500/10 text-${spec.color}-400 rounded-xl border border-${spec.color}-500/20`}>
                                {React.cloneElement(spec.icon as React.ReactElement, { size: 20 })}
                            </div>
                            <div className="text-xs font-black text-white uppercase tracking-widest">{spec.title}</div>
                        </div>
                    ))}
                </motion.div>

            </div>
        </div>
    );
}