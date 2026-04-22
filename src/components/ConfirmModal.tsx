import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmClassName = tone === 'danger'
    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20'
    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-[var(--crm-overlay-bg)] backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 18 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="relative w-full max-w-md rounded-[1.75rem] border border-[var(--crm-border)] bg-[var(--crm-sidebar-bg)] p-6 shadow-2xl"
          >
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertTriangle size={24} />
            </div>
            <h2 className="text-xl font-black text-[var(--crm-text)]">{title}</h2>
            <p className="mt-3 text-sm leading-6 font-medium text-[var(--crm-text-muted)]">{message}</p>
            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-control-bg)] px-5 py-3 text-sm font-black text-[var(--crm-text)] transition hover:bg-[var(--crm-control-hover-bg)]"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`rounded-2xl px-5 py-3 text-sm font-black transition shadow-xl ${confirmClassName}`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
