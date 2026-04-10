import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X, UserCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Option {
  id: string;
  name: string;
  company?: string;
  avatar?: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  onAddNew?: () => void;
  placeholder?: string;
  label?: string;
  compact?: boolean;
}

export default function SearchableSelect({ options, value, onChange, onAddNew, placeholder = "Select an option", label, compact }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(opt => opt.id === value);

  const filteredOptions = options.filter(opt => 
    opt.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (opt.company && opt.company.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const toggleDropdown = () => setIsOpen(!isOpen);

  const handleSelect = (optionId: string) => {
    onChange(optionId);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className="flex items-center gap-2 text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest mb-4 ml-1">
          <UserCircle size={18} className="text-indigo-500" />
          {label} <span className="text-rose-500">*</span>
        </label>
      )}
      
      <div 
        onClick={toggleDropdown}
        className={`w-full bg-[var(--crm-bg)]/40 border border-[var(--crm-border)] rounded-2xl transition-all text-[var(--crm-text)] shadow-sm cursor-pointer flex items-center justify-between hover:border-indigo-500/50 ${compact ? 'px-4 py-2.5 text-sm' : 'px-5 py-4 text-base'} ${isOpen ? 'ring-4 ring-indigo-500/20 border-indigo-500' : ''}`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {selectedOption ? (
            <>
              <span className="truncate">{selectedOption.name}</span>
              {selectedOption.company && (
                <span className={`text-[var(--crm-text-muted)] font-medium truncate ${compact ? 'text-[10px]' : 'text-xs'}`}>— {selectedOption.company}</span>
              )}
            </>
          ) : (
            <span className="text-[var(--crm-text-muted)]">{placeholder}</span>
          )}
        </div>
        <ChevronDown size={compact ? 16 : 20} className={`text-[var(--crm-text-muted)] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute z-[100] w-full mt-2 bg-[var(--crm-sidebar-bg)] border border-[var(--crm-border)] rounded-[2rem] shadow-2xl overflow-hidden backdrop-blur-xl"
          >
            <div className="p-3 border-b border-[var(--crm-border)] flex items-center gap-3">
              <Search size={18} className="text-[var(--crm-text-muted)]" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search leads..."
                className="w-full bg-transparent border-none focus:outline-none text-sm font-bold text-[var(--crm-text)] placeholder:text-[var(--crm-text-muted)]"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="p-1 hover:bg-white/5 rounded-full transition-colors">
                  <X size={14} className="text-[var(--crm-text-muted)]" />
                </button>
              )}
            </div>

            <div className="max-h-[300px] overflow-y-auto hide-scrollbar py-2">
              {onAddNew && (
                <div 
                  onClick={() => { onAddNew(); setIsOpen(false); }}
                  className="mx-2 mb-2 p-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl cursor-pointer flex items-center gap-3 border border-indigo-500/20 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Sparkles size={14} className="animate-pulse" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">Add New Lead...</span>
                </div>
              )}

              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <div
                    key={option.id}
                    onClick={() => handleSelect(option.id)}
                    className={`flex items-center justify-between px-5 py-3.5 cursor-pointer transition-all ${value === option.id ? 'bg-indigo-500/20 text-indigo-300' : 'hover:bg-white/5 text-[var(--crm-text)]'}`}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-black">{option.name}</span>
                      {option.company && (
                        <span className="text-[10px] text-[var(--crm-text-muted)] opacity-70">{option.company}</span>
                      )}
                    </div>
                    {value === option.id && <Check size={16} className="text-indigo-400" />}
                  </div>
                ))
              ) : (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm font-bold text-[var(--crm-text-muted)]">No leads found</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
