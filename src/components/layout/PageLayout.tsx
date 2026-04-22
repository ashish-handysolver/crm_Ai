import React from 'react';
import { motion } from 'motion/react';

interface PageLayoutProps {
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
  animate?: boolean;
}

export const PageLayout: React.FC<PageLayoutProps> = ({ 
  children, 
  maxWidth = '1400px', 
  className = '',
  animate = true 
}) => {
  const content = (
    <div 
      className={`w-full mx-auto p-4 sm:p-8 lg:p-10 space-y-8 sm:space-y-10 ${className}`}
      style={{ maxWidth }}
    >
      {children}
    </div>
  );

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="flex-1 bg-transparent min-h-screen overflow-y-auto"
      >
        {content}
      </motion.div>
    );
  }

  return (
    <div className="flex-1 bg-transparent min-h-screen overflow-y-auto">
      {content}
    </div>
  );
};
