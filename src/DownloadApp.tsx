import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Apple,
  CheckCircle2,
  Chrome,
  Download,
  ExternalLink,
  MonitorSmartphone,
  MousePointer2,
  PlusSquare,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Zap,
} from 'lucide-react';
import ThemeToggle from './components/ThemeToggle';

const installTracks = [
  {
    id: 'ios',
    eyebrow: 'iPhone & iPad',
    title: 'Install on Safari',
    subtitle: 'Best for Apple devices using Safari browser.',
    icon: Apple,
    accentClassName: 'bg-slate-900 text-white border-slate-800',
    badgeClassName: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    steps: [
      { icon: ExternalLink, label: 'Open handycrm.ai', highlight: 'in Safari' },
      { icon: Share2, label: 'Tap the', highlight: 'Share button' },
      { icon: PlusSquare, label: 'Choose', highlight: 'Add to Home Screen' },
      { icon: CheckCircle2, label: 'Confirm with', highlight: 'Add' },
    ],
  },
  {
    id: 'android',
    eyebrow: 'Chrome & Edge',
    title: 'Install on Desktop or Android',
    subtitle: 'Fastest setup when the browser supports app install.',
    icon: Chrome,
    accentClassName: 'bg-indigo-600 text-white border-indigo-500',
    badgeClassName: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    steps: [
      { icon: MousePointer2, label: 'Open handycrm.ai', highlight: 'in Chrome or Edge' },
      { icon: Sparkles, label: 'Open the browser', highlight: 'menu' },
      { icon: Download, label: 'Select', highlight: 'Install App' },
      { icon: Zap, label: 'Confirm to create', highlight: 'your app shortcut' },
    ],
  },
];

const valueProps = [
  {
    icon: Zap,
    title: 'Fast launch',
    copy: 'Open HandyCRM like a native app without searching tabs.',
    iconClassName: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  },
  {
    icon: Smartphone,
    title: 'Mobile ready',
    copy: 'Clean install flow for iPhone, iPad, Android, and desktop browsers.',
    iconClassName: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  },
  {
    icon: ShieldCheck,
    title: 'Secure workspace',
    copy: 'Keep your CRM close with the same secure session and branded shell.',
    iconClassName: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
];

export default function DownloadApp() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event);
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
    <div className="min-h-screen bg-[var(--crm-bg)] text-[var(--crm-text)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_56%)]" />
        <div className="absolute -top-24 right-[-8%] h-80 w-80 rounded-full bg-indigo-500/10 blur-[100px]" />
        <div className="absolute bottom-0 left-[-8%] h-72 w-72 rounded-full bg-cyan-500/10 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-12 px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4"
        >
          <div className="inline-flex items-center gap-3 rounded-full border border-indigo-500/20 bg-[var(--crm-card-bg)] px-4 py-2 shadow-[var(--crm-card-shadow)] backdrop-blur-xl">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400">
              <Download size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.28em] text-indigo-500">PWA Deployment</span>
              <span className="text-[11px] font-semibold text-[var(--crm-text-muted)]">Install HandyCRM on any device</span>
            </div>
          </div>
          <ThemeToggle />
        </motion.div>

        <section className="grid items-stretch gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8 rounded-[2rem] border border-[var(--crm-border)] bg-[var(--crm-card-bg)] p-8 shadow-[var(--crm-card-shadow)] backdrop-blur-xl sm:p-10"
          >
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-indigo-400">
                <Sparkles size={13} />
                Install Experience
              </div>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-black uppercase leading-[0.95] tracking-[-0.05em] text-[var(--crm-text)] sm:text-6xl xl:text-7xl">
                  Put HandyCRM
                  <span className="block bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-300 bg-clip-text text-transparent">
                    on the home screen
                  </span>
                </h1>
                <p className="max-w-2xl text-base font-medium leading-8 text-[var(--crm-text-muted)] sm:text-lg">
                  Install the CRM once and launch it like a polished desktop or mobile app. Pick your device below and
                  follow the shortest path.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {valueProps.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-[1.5rem] border border-[var(--crm-border)] bg-[var(--crm-control-bg)] p-5 transition-colors hover:bg-[var(--crm-control-hover-bg)]"
                  >
                    <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border ${item.iconClassName}`}>
                      <Icon size={20} />
                    </div>
                    <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[var(--crm-text)]">{item.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-[var(--crm-text-muted)]">{item.copy}</p>
                  </div>
                );
              })}
            </div>
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="flex flex-col justify-between rounded-[2rem] border border-[var(--crm-border)] bg-[linear-gradient(180deg,var(--crm-surface-strong),var(--crm-card-bg))] p-8 shadow-[var(--crm-card-shadow)] backdrop-blur-xl sm:p-10"
          >
            <div className="space-y-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 shadow-lg shadow-indigo-500/10">
                <MonitorSmartphone size={28} />
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl font-black uppercase tracking-tight text-[var(--crm-text)]">One-click install</h2>
                <p className="text-sm leading-7 text-[var(--crm-text-muted)]">
                  If your browser supports direct install, use the primary action below. Otherwise, the guided steps on
                  the left will get you there in seconds.
                </p>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <button
                onClick={handleInstall}
                disabled={!deferredPrompt}
                className="flex w-full items-center justify-center gap-3 rounded-[1.4rem] bg-indigo-600 px-6 py-4 text-sm font-black uppercase tracking-[0.18em] text-white shadow-xl shadow-indigo-600/20 transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {success ? (
                  <>
                    <CheckCircle2 size={18} />
                    Installed
                  </>
                ) : deferredPrompt ? (
                  <>
                    <Download size={18} />
                    Install now
                  </>
                ) : (
                  'Already available'
                )}
              </button>

              <div className="rounded-[1.25rem] border border-[var(--crm-border)] bg-[var(--crm-control-bg)] px-4 py-4 text-sm text-[var(--crm-text-muted)]">
                {deferredPrompt
                  ? 'Your browser supports direct installation right now.'
                  : 'Direct install prompt is not available on this browser, so use the guided steps below.'}
              </div>
            </div>
          </motion.aside>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          {installTracks.map((track, index) => {
            const Icon = track.icon;

            return (
              <motion.article
                key={track.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 + index * 0.08 }}
                className="rounded-[2rem] border border-[var(--crm-border)] bg-[var(--crm-card-bg)] p-6 shadow-[var(--crm-card-shadow)] backdrop-blur-xl sm:p-8"
              >
                <div className="mb-8 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-16 w-16 items-center justify-center rounded-[1.4rem] border shadow-lg ${track.accentClassName}`}>
                      <Icon size={28} />
                    </div>
                    <div className="space-y-2">
                      <div className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${track.badgeClassName}`}>
                        {track.eyebrow}
                      </div>
                      <h3 className="text-2xl font-black tracking-tight text-[var(--crm-text)]">{track.title}</h3>
                      <p className="max-w-md text-sm leading-6 text-[var(--crm-text-muted)]">{track.subtitle}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {track.steps.map((step, stepIndex) => {
                    const StepIcon = step.icon;

                    return (
                      <div
                        key={step.highlight}
                        className="flex items-center gap-4 rounded-[1.5rem] border border-[var(--crm-border)] bg-[var(--crm-control-bg)] p-4 transition-colors hover:bg-[var(--crm-control-hover-bg)]"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--crm-surface-strong)] text-indigo-400 shadow-sm">
                          <StepIcon size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400/70">
                            Step {String(stepIndex + 1).padStart(2, '0')}
                          </div>
                          <div className="text-sm font-semibold leading-6 text-[var(--crm-text-muted)]">
                            {step.label} <span className="font-black text-[var(--crm-text)]">{step.highlight}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
