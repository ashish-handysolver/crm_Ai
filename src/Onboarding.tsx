import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, ShieldCheck, Zap, Users, Calendar, BarChart3,
  ArrowRight, CheckCircle2, LayoutDashboard, MessageSquare, Mic,
  Rocket, ChevronRight, ChevronLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { db } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to AudioCRM',
    subtitle: 'Everything you need in one place',
    description: 'A simple way to manage your clients, meetings, and notes using the power of AI.',
    icon: <Sparkles className="text-indigo-400 w-12 h-12" />,
    color: 'from-indigo-500 to-purple-600',
    image: 'https://images.unsplash.com/photo-1639322537228-f710d846310a?auto=format&fit=crop&q=80&w=1000'
  },
  {
    id: 'leads',
    title: 'Manage your Leads',
    subtitle: 'Organize your sales easily',
    description: 'Keep track of all your potential customers in a simple-to-use list and board view.',
    icon: <Users className="text-emerald-400 w-12 h-12" />,
    color: 'from-emerald-500 to-teal-500',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=1000'
  },
  {
    id: 'ai',
    title: 'Smart AI Notes',
    subtitle: 'We listen so you can work',
    description: 'Our AI automatically takes notes from your meetings and tells you the most important points.',
    icon: <Zap className="text-purple-400 w-12 h-12" />,
    color: 'from-purple-500 to-fuchsia-500',
    image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1000'
  }
];

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const { user } = useAuth();

  const completeOnboarding = async () => {
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), { onboardingComplete: true });
      } catch (e) {
        console.error("Error marking onboarding complete:", e);
      }
    }
    navigate('/');
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      completeOnboarding();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
    }
  };

  const step = STEPS[currentStep];

  return (
    <div className="fixed inset-0 z-[200] bg-[var(--crm-bg)] flex items-center justify-center p-4 sm:p-8 overflow-hidden font-sans">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] -z-10 translate-x-1/4 -translate-y-1/4"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] -z-10 -translate-x-1/4 translate-y-1/4"></div>

      <motion.div
        layout
        className="w-full max-w-6xl bg-[var(--crm-card-bg)] backdrop-blur-2xl rounded-[3rem] shadow-2xl border border-[var(--crm-border)] overflow-hidden flex flex-col md:flex-row min-h-[600px] relative"
      >
        {/* Left Side: Visual Content */}
        <div className="md:w-1/2 relative overflow-hidden bg-black group">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0"
            >
              <img
                src={step.image}
                className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-[2s]"
                alt={step.title}
              />
              <div className={`absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent`}></div>

              <div className="absolute bottom-12 left-12 right-12">
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--crm-bg)]/20 backdrop-blur-md border border-[var(--crm-border)] rounded-xl text-[var(--crm-text)] text-xs font-black uppercase tracking-widest mb-6 shadow-xl"
                >
                  <Rocket size={14} className="text-indigo-400" /> Feature Overiew {currentStep + 1}
                </motion.div>
                <h3 className="text-3xl font-black text-[var(--crm-text)] tracking-tighter mb-4">{step.subtitle}</h3>
                <div className="flex gap-2">
                  {STEPS.map((_, i) => (
                    <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === currentStep ? 'w-12 bg-indigo-500' : 'w-2 bg-[var(--crm-text-muted)]/20'}`}></div>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right Side: Text & Navigation */}
        <div className="md:w-1/2 p-8 sm:p-16 flex flex-col justify-between relative bg-transparent">
          <div className="absolute top-12 right-12">
            <button onClick={completeOnboarding} className="text-[10px] font-black text-[var(--crm-text-muted)] hover:text-[var(--crm-text)] uppercase tracking-widest transition-colors">Skip for now</button>
          </div>

          <div className="my-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="w-20 h-20 rounded-[2rem] bg-[var(--crm-bg)]/20 flex items-center justify-center shadow-inner border border-[var(--crm-border)]">
                  {step.icon}
                </div>

                <div className="space-y-4">
                  <h2 className="text-4xl sm:text-5xl font-black text-[var(--crm-text)] tracking-tighter leading-none">{step.title}</h2>
                  <p className="text-[var(--crm-text-muted)] text-lg sm:text-xl font-medium leading-relaxed max-w-md">
                    {step.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="p-5 rounded-3xl bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] group hover:border-indigo-500/30 transition-colors shadow-inner">
                    <div className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest mb-2">Benefit</div>
                    <div className="font-bold text-[var(--crm-text)] text-sm">Save Time Monthly</div>
                  </div>
                  <div className="p-5 rounded-3xl bg-[var(--crm-bg)]/20 border border-[var(--crm-border)] group hover:border-indigo-500/30 transition-colors shadow-inner">
                    <div className="text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest mb-2">Status</div>
                    <div className="font-bold text-[var(--crm-text)] text-sm flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-500" /> Ready to Use
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between pt-12">
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className={`p-4 rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-bg)]/20 transition-all ${currentStep === 0 ? 'opacity-0 pointer-events-none' : 'hover:bg-white/10 hover:text-[var(--crm-text)] text-[var(--crm-text-muted)] active:scale-95'}`}
            >
              <ChevronLeft size={20} />
            </button>

            <div className="flex gap-4">
              {currentStep < STEPS.length - 1 && (
                <button
                  onClick={completeOnboarding}
                  className="hidden sm:flex items-center gap-2 px-6 py-4 border border-[var(--crm-border)] bg-transparent text-[var(--crm-text-muted)] rounded-2xl font-bold text-sm hover:bg-[var(--crm-bg)]/20 hover:text-[var(--crm-text)] transition-all active:scale-95"
                >
                  Finish Now
                </button>
              )}

              <button
                onClick={handleNext}
                className="flex items-center gap-3 px-10 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-500/20 active:scale-95 group"
              >
                {currentStep === STEPS.length - 1 ? 'Start Using App' : 'Next Step'}
                <ChevronRight className="group-hover:translate-x-2 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
