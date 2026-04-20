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
  hideSearch?: boolean;
  disabled?: boolean;
  showRequired?: boolean;
}

export default function SearchableSelect({ options, value, onChange, onAddNew, placeholder = "Select an option", label, compact, hideSearch, disabled, showRequired }: SearchableSelectProps) {
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
    if (isOpen && inputRef.current && !hideSearch) {
      inputRef.current.focus();
    }
  }, [isOpen, hideSearch]);

  const toggleDropdown = () => !disabled && setIsOpen(!isOpen);

  const handleSelect = (optionId: string) => {
    onChange(optionId);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={`relative w-full ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`} ref={containerRef}>
      {label && (
        <label className="flex items-center gap-2 text-[10px] font-black text-[var(--crm-text-muted)] uppercase tracking-widest mb-4 ml-1">
          <UserCircle size={18} className="text-indigo-500" />
          {label} {showRequired && <span className="text-rose-500">*</span>}
        </label>
      )}
      
      <div 
        onClick={toggleDropdown}
        className={`w-full bg-[var(--crm-input-bg)] border border-[var(--crm-border)] rounded-xl transition-all text-[var(--crm-text)] shadow-sm cursor-pointer flex items-center justify-between hover:border-indigo-500/45 ${compact ? 'px-3.5 py-2.5 text-sm min-h-[42px]' : 'px-4 py-3 text-base min-h-[48px]'} ${isOpen ? 'ring-4 ring-indigo-500/15 border-indigo-500 bg-[var(--crm-control-bg)]' : ''} ${disabled ? 'pointer-events-none' : ''}`}
      >
        <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
          {selectedOption ? (
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold truncate">{selectedOption.name}</span>
              {selectedOption.company && (
                <span className={`text-[var(--crm-text-muted)] font-medium truncate ${compact ? 'text-[10px]' : 'text-xs'}`}>— {selectedOption.company}</span>
              )}
            </div>
          ) : (
            <span className="text-[var(--crm-text-muted)] font-medium">{placeholder}</span>
          )}
        </div>
        <ChevronDown size={compact ? 16 : 20} className={`text-indigo-400 transition-transform duration-500 ease-out ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute z-[100] w-full mt-2 bg-[var(--crm-sidebar-bg)] border border-[var(--crm-border)] rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl"
          >
            {!hideSearch && (
              <div className="p-3 border-b border-[var(--crm-border)] flex items-center gap-3 bg-[var(--crm-control-bg)]">
                <Search size={18} className="text-indigo-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-transparent border-none focus:outline-none text-sm font-bold text-[var(--crm-text)] placeholder:text-[var(--crm-text-muted)]"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="p-1.5 hover:bg-white/10 rounded-xl transition-colors">
                    <X size={14} className="text-[var(--crm-text-muted)]" />
                  </button>
                )}
              </div>
            )}

            <div className="max-h-[300px] overflow-y-auto hide-scrollbar p-1.5">
              {onAddNew && (
                <div 
                  onClick={() => { onAddNew(); setIsOpen(false); }}
                  className="mb-2 p-3 bg-indigo-500/5 hover:bg-indigo-500/15 text-indigo-400 rounded-xl cursor-pointer flex items-center gap-3 border border-indigo-500/20 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all duration-300">
                    <Sparkles size={16} className="text-indigo-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">New Entity</span>
                    <span className="text-[10px] text-indigo-300/60 font-medium">Add a fresh record...</span>
                  </div>
                </div>
              )}

              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <div
                    key={option.id}
                    onClick={() => handleSelect(option.id)}
                    className={`flex items-center justify-between px-3.5 py-3 rounded-xl cursor-pointer transition-all mb-1 ${value === option.id ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' : 'hover:bg-indigo-500/5 text-[var(--crm-text)] border border-transparent hover:border-indigo-500/10'}`}
                  >
                    <div className="flex flex-col">
                      <span className={`text-sm tracking-tight ${value === option.id ? 'font-black' : 'font-bold'}`}>{option.name}</span>
                      {option.company && (
                        <span className="text-[10px] text-[var(--crm-text-muted)] font-medium opacity-80">{option.company}</span>
                      )}
                    </div>
                    {value === option.id && (
                      <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center">
                        <Check size={14} className="text-indigo-400" />
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-12 text-center opacity-50">
                  <div className="mb-3 flex justify-center">
                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-[var(--crm-border)] flex items-center justify-center">
                      <Search size={20} className="text-[var(--crm-text-muted)]" />
                    </div>
                  </div>
                  <p className="text-xs font-black uppercase tracking-widest text-[var(--crm-text-muted)]">No results</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

