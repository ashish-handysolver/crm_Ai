import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={toggleTheme}
      className="relative p-2.5 rounded-xl transition-all duration-300 bg-[var(--crm-control-bg)] hover:bg-[var(--crm-control-hover-bg)] border border-[var(--crm-border)] group overflow-hidden shadow-inner flex items-center justify-center min-w-[44px] min-h-[44px]"
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      
      <AnimatePresence mode="wait" initial={false}>
        {theme === 'dark' ? (
          <motion.div
            key="moon"
            initial={{ y: 20, opacity: 0, rotate: 45 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: -20, opacity: 0, rotate: -45 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <Moon className="text-indigo-400 group-hover:text-indigo-300" size={20} />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ y: 20, opacity: 0, rotate: 45 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: -20, opacity: 0, rotate: -45 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <Sun className="text-amber-500 group-hover:text-amber-400" size={20} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-indigo-500/0 group-hover:bg-indigo-500/60 rounded-full blur-[1px] transition-all"></div>
    </motion.button>
  );
}
