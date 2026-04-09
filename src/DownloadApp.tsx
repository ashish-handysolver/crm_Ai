import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Download, Smartphone, Apple, Chrome, Sparkles, Zap, ShieldCheck } from 'lucide-react';

export default function DownloadApp() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

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
        }
    };

    return (
        <div className="flex-1 bg-transparent min-h-screen overflow-y-auto">
            <div className="max-w-5xl mx-auto p-4 sm:p-8 lg:p-12 space-y-12">

                {/* Header */}
                <header className="text-center space-y-6 mb-16">
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-black uppercase tracking-[0.2em] shadow-sm">
                        <Sparkles size={16} className="animate-pulse" /> Available Now
                    </motion.div>
                    <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
                        Install <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Handysolver</span>
                    </motion.h1>
                    <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-slate-400 font-medium max-w-2xl mx-auto text-lg sm:text-xl">
                        Get the full native experience. Install our Progressive Web App (PWA) to your device for offline access and better performance.
                    </motion.p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Native Install Card */}
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="glass-card !bg-slate-900/60 !border-white/10 p-8 sm:p-10 rounded-[2.5rem] relative overflow-hidden flex flex-col items-center text-center shadow-2xl">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[60px] pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
                        <div className="w-24 h-24 rounded-3xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-8 border border-indigo-500/30 shadow-inner">
                            <Download size={40} />
                        </div>
                        <h3 className="text-2xl font-black text-white mb-4 tracking-tight">Direct Installation</h3>
                        <p className="text-slate-400 mb-8 font-medium leading-relaxed">
                            Install directly to your device via your supported browser (Chrome, Edge, Android).
                        </p>
                        <button
                            onClick={handleInstall}
                            disabled={!deferredPrompt}
                            className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50 disabled:hover:bg-indigo-600 flex items-center justify-center gap-3 active:scale-95"
                        >
                            <Chrome size={20} />
                            {deferredPrompt ? 'Install App' : 'App Already Installed / Unsupported'}
                        </button>
                    </motion.div>

                    {/* iOS Install Card */}
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="glass-card !bg-slate-900/60 !border-white/10 p-8 sm:p-10 rounded-[2.5rem] relative overflow-hidden flex flex-col items-center text-center shadow-2xl">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[60px] pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
                        <div className="w-24 h-24 rounded-3xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-8 border border-purple-500/30 shadow-inner">
                            <Apple size={40} />
                        </div>
                        <h3 className="text-2xl font-black text-white mb-4 tracking-tight">iOS / Safari Setup</h3>
                        <p className="text-slate-400 mb-8 font-medium leading-relaxed">
                            Apple requires manual installation. Follow these quick steps to add Handysolver to your home screen.
                        </p>
                        <div className="w-full text-left space-y-4 bg-black/20 p-6 rounded-2xl border border-white/5">
                            <div className="flex items-center gap-4 text-slate-300 font-medium text-sm">
                                <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center font-black text-xs shrink-0">1</span>
                                Tap the Share button at the bottom of Safari.
                            </div>
                            <div className="flex items-center gap-4 text-slate-300 font-medium text-sm">
                                <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center font-black text-xs shrink-0">2</span>
                                Scroll down and tap "Add to Home Screen".
                            </div>
                            <div className="flex items-center gap-4 text-slate-300 font-medium text-sm">
                                <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center font-black text-xs shrink-0">3</span>
                                Tap "Add" in the top right corner.
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Features Row */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12">
                    <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl"><Zap size={20} /></div>
                        <div>
                            <div className="text-white font-black text-sm tracking-tight">Native Speed</div>
                            <div className="text-slate-400 text-xs font-medium">Faster loading times</div>
                        </div>
                    </div>
                    <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 flex items-center gap-4">
                        <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl"><Smartphone size={20} /></div>
                        <div>
                            <div className="text-white font-black text-sm tracking-tight">Standalone UI</div>
                            <div className="text-slate-400 text-xs font-medium">No browser controls</div>
                        </div>
                    </div>
                    <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 flex items-center gap-4">
                        <div className="p-3 bg-rose-500/20 text-rose-400 rounded-xl"><ShieldCheck size={20} /></div>
                        <div>
                            <div className="text-white font-black text-sm tracking-tight">Secure Data</div>
                            <div className="text-slate-400 text-xs font-medium">Encrypted storage</div>
                        </div>
                    </div>
                </motion.div>

            </div>
        </div>
    );
}