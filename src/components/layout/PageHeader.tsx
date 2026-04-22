import React from 'react';
import { motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  badge,
  icon: Icon,
  actions
}) => {
  return (
    <header className="flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <motion.div 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }} 
          className="space-y-4 flex-1"
        >
          {badge && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">
              {Icon && <Icon size={14} className="animate-pulse" />} 
              {badge}
            </div>
          )}
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[var(--crm-text)] leading-tight">
              {title}
            </h1>
            {description && (
              <p className="text-[var(--crm-text-muted)] font-medium max-w-2xl text-sm sm:text-base leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </motion.div>

        {actions && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-wrap gap-3"
          >
            {actions}
          </motion.div>
        )}
      </div>
    </header>
  );
};
