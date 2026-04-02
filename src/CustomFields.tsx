import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, Timestamp, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Loader2, Settings, Plus, Trash2, Save, AlertCircle, CheckCircle2, Tag, GitBranch, Sparkles, Wand2, Info, ChevronRight, X, Users } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from './contexts/AuthContext';
import { useDemo } from './DemoContext';
import { motion, AnimatePresence } from 'motion/react';

export interface CustomFieldDef {
  id: string;
  name: string;
  type: 'TEXT' | 'NUMBER' | 'DROPDOWN' | 'DATE' | 'DATETIME';
  options: string[];
  companyId: string;
  createdAt: any;
}

const DEFAULT_SOURCES = ['LINKEDIN', 'REFERRAL', 'DIRECT', 'WEBSITE'];
const DEFAULT_PHASES = ['DISCOVERY', 'NURTURING', 'QUALIFIED', 'WON', 'LOST', 'INACTIVE'];
const DEFAULT_LEAD_TYPES = ['B2B', 'B2C', 'ENTERPRISE'];

export default function CustomFields({ user }: { user: any }) {
  const { companyId } = useAuth();
  const { isDemoMode, demoData } = useDemo();
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [customSources, setCustomSources] = useState<string[]>([]);
  const [customPhases, setCustomPhases] = useState<string[]>([]);
  const [customLeadTypes, setCustomLeadTypes] = useState<string[]>([]);
  const [newSource, setNewSource] = useState('');
  const [newPhase, setNewPhase] = useState('');
  const [newLeadType, setNewLeadType] = useState('');
  const [newOptionInputs, setNewOptionInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isDemoMode) {
      setFields(demoData.customFields as any);
      setLoading(false);
      return;
    }
    if (!companyId) { setLoading(false); return; }
    const load = async () => {
      try {
        const q = query(collection(db, 'custom_fields'), where('companyId', '==', companyId));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomFieldDef));
        data.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
        setFields(data);

        const companySnap = await getDoc(doc(db, 'companies', companyId));
        if (companySnap.exists()) {
          setCustomSources(companySnap.data().customSources || []);
          setCustomPhases(companySnap.data().customPhases || []);
          setCustomLeadTypes(companySnap.data().customLeadTypes || []);
        }
      } catch (err: any) {
        setError('Matrix Failure: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [companyId, isDemoMode, demoData]);

  const addField = () => {
    if (!companyId) return;
    setFields(prev => [...prev, {
      id: uuidv4(), name: '', type: 'TEXT', options: [],
      companyId: companyId, createdAt: Timestamp.now()
    }]);
  };

  const updateField = (id: string, updates: Partial<CustomFieldDef>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = async (id: string) => {
    if (!window.confirm("Abort this field definition from the matrix?")) return;
    try {
      await deleteDoc(doc(db, 'custom_fields', id));
      setFields(prev => prev.filter(f => f.id !== id));
    } catch (err: any) {
      setError('Matrix Refusal: ' + err.message);
    }
  };

  const addSource = () => {
    const val = newSource.trim().toUpperCase();
    if (!val || customSources.includes(val)) return;
    setCustomSources(prev => [...prev, val]);
    setNewSource('');
  };

  const addPhase = () => {
    const val = newPhase.trim().toUpperCase();
    if (!val || customPhases.includes(val)) return;
    setCustomPhases(prev => [...prev, val]);
    setNewPhase('');
  };

  const addLeadType = () => {
    const val = newLeadType.trim().toUpperCase();
    if (!val || customLeadTypes.includes(val)) return;
    setCustomLeadTypes(prev => [...prev, val]);
    setNewLeadType('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (!companyId) throw new Error("Null Context: No company detected.");
      for (const f of fields) {
        if (!f.name.trim()) throw new Error(`Invalid Schema: Field ID ${f.id.slice(0, 4)} requires a label.`);
        if (f.type === 'DROPDOWN' && f.options.length === 0) throw new Error(`Incomplete Logic: Dropdown "${f.name}" requires option parameters.`);
        await setDoc(doc(db, 'custom_fields', f.id), { ...f, companyId: companyId });
      }

      const compRef = doc(db, 'companies', companyId);
      await setDoc(compRef, { customSources, customPhases, customLeadTypes }, { merge: true });

      setSuccess('Logic Synthesis Complete: All configurations committed to the core.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.message || 'Transmission Failure.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 bg-slate-50 flex items-center justify-center min-h-[100dvh]">
        <Loader2 className="animate-spin text-indigo-500 w-12 h-12" />
      </div>
    );
  }

  const inputClasses = "w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:bg-white outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all font-semibold text-sm text-slate-700 shadow-sm";
  const labelClasses = "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block";

  return (
    <div className="flex-1 bg-[#F9FBFF] text-slate-900 p-4 sm:p-8 lg:p-12 min-h-full font-sans overflow-x-hidden">
      <div className="max-w-5xl mx-auto">

        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="text-[10px] font-black text-indigo-500 tracking-[0.25em] uppercase mb-4 flex items-center gap-2">
              <Sparkles size={14} className="fill-indigo-500 animate-pulse" /> Logic Vector Configuration
            </div>
            <h3 className="text-4xl sm:text-5xl font-black tracking-tighter text-slate-900">System Parameters</h3>
            <p className="text-slate-500 mt-4 text-lg font-medium max-w-xl leading-relaxed">
              Update Data Storage & Grouping
            </p>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            onClick={handleSave}
            disabled={saving || isDemoMode}
            className="shrink-0 bg-slate-900 text-white px-10 py-4 rounded-2xl font-black hover:bg-indigo-600 transition-all shadow-xl shadow-slate-900/10 active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            {isDemoMode ? 'Readonly Mode' : 'Save'}
          </motion.button>
        </header>

        {(error || success) && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={`mb-10 p-5 rounded-2xl flex items-center gap-4 text-sm font-bold shadow-lg border ${error ? 'bg-rose-50 text-rose-600 border-rose-100 shadow-rose-500/5' : 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-emerald-500/5'}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${error ? 'bg-rose-500 text-white shadow-rose-500/20' : 'bg-emerald-500 text-white shadow-emerald-500/20'}`}>
              {error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
            </div>
            {error || success}
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Main Custom Fields Column */}
          <div className="lg:col-span-2 space-y-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.02)] overflow-hidden relative group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-bl-[100px] -z-0 pointer-events-none transition-colors group-hover:bg-indigo-100/50"></div>

              <div className="p-8 sm:p-10 relative z-10">
                <div className="flex items-center justify-between mb-10 pb-4 border-b border-slate-50">
                  <h2 className="text-base font-black text-slate-800 uppercase tracking-[0.15em] flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center shadow-inner"><Settings size={16} /></div>
                    Custom Data Vectors
                  </h2>
                  {!isDemoMode && (
                    <button onClick={addField} className="text-xs font-black text-indigo-500 hover:text-indigo-700 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 rounded-lg transition-all active:scale-95">
                      <Plus size={14} /> Add New Fields
                    </button>
                  )}
                </div>

                <div className="space-y-6">
                  <AnimatePresence>
                    {fields.length === 0 ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 px-10 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-100 flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-200 shadow-sm"><Wand2 size={28} /></div>
                        <p className="text-slate-400 font-bold italic text-sm">No custom field definitions detected in the matrix.</p>
                      </motion.div>
                    ) : fields.map((field, idx) => (
                      <motion.div
                        key={field.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="p-6 bg-slate-50/50 border border-slate-100 rounded-3xl flex flex-col gap-6 relative group/field hover:bg-white hover:border-indigo-100 transition-all duration-300"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className={labelClasses}>Field Label</label>
                            <input type="text" value={field.name} onChange={(e) => updateField(field.id, { name: e.target.value })} placeholder="E.g. Gender, Deal Size" className={inputClasses} />
                          </div>
                          <div>
                            <label className={labelClasses}>System Type</label>
                            <select value={field.type} onChange={(e) => updateField(field.id, { type: e.target.value as any })} className={inputClasses}>
                              <option value="TEXT">Short Text</option>
                              <option value="NUMBER">Number </option>
                              <option value="DROPDOWN">Dropdown Fields</option>
                              <option value="DATE">Date</option>
                              <option value="DATETIME">Date & Time</option>
                            </select>
                          </div>

                          {field.type === 'DROPDOWN' && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="md:col-span-2 space-y-4">
                              <label className={labelClasses}>Operational Options</label>
                              <div className="flex flex-wrap gap-2 min-h-[40px] p-4 bg-white rounded-2xl border border-slate-100 shadow-inner">
                                {field.options.length === 0 && <span className="text-[10px] font-black text-slate-200 uppercase tracking-widest pt-1">Null Options Pool</span>}
                                {field.options.map(opt => (
                                  <span key={opt} className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-100 shadow-sm transition-all hover:bg-indigo-100">
                                    {opt}
                                    <button type="button" onClick={() => updateField(field.id, { options: field.options.filter(o => o !== opt) })} className="p-1 hover:bg-white hover:text-red-500 rounded-md transition-colors">
                                      <X size={10} />
                                    </button>
                                  </span>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={newOptionInputs[field.id] || ''}
                                  onChange={e => setNewOptionInputs(prev => ({ ...prev, [field.id]: e.target.value }))}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const val = (newOptionInputs[field.id] || '').trim();
                                      if (val && !field.options.includes(val)) {
                                        updateField(field.id, { options: [...field.options, val] });
                                        setNewOptionInputs(prev => ({ ...prev, [field.id]: '' }));
                                      }
                                    }
                                  }}
                                  placeholder="Add new option parameter..."
                                  className={`${inputClasses} flex-1`}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const val = (newOptionInputs[field.id] || '').trim();
                                    if (val && !field.options.includes(val)) {
                                      updateField(field.id, { options: [...field.options, val] });
                                      setNewOptionInputs(prev => ({ ...prev, [field.id]: '' }));
                                    }
                                  }}
                                  className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600 transition-all active:scale-95"
                                >
                                  ADD
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </div>
                        {!isDemoMode && (
                          <button onClick={() => removeField(field.id)} className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover/field:opacity-100">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Sidebar / Category Column */}
          <div className="space-y-8">

            {/* Custom Sources */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.02)] p-8">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-[0.15em] mb-6 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center shadow-inner"><Tag size={16} /></div>
                Acquisition Sources
              </h2>
              <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_SOURCES.map(s => <span key={s} className="px-3 py-1.5 bg-slate-50 text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-tighter border border-slate-100">{s} (SYS)</span>)}
                  {customSources.map(s => (
                    <span key={s} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-indigo-100 shadow-sm group/chip transition-all hover:bg-indigo-100">
                      {s}
                      <button onClick={() => setCustomSources(prev => prev.filter(x => x !== s))} className="p-0.5 text-indigo-300 hover:text-red-500 transition-colors"><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text" value={newSource} onChange={e => setNewSource(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addSource()}
                    placeholder="e.g. COLD_CALL"
                    className={`${inputClasses} !py-2.5 !px-3 font-bold`}
                  />
                  <button onClick={addSource} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black hover:bg-indigo-600 transition-all active:scale-95 uppercase">
                    ADD
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Custom Phases */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.02)] p-8">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-[0.15em] mb-6 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-500 flex items-center justify-center shadow-inner"><GitBranch size={16} /></div>
                Lifecycle Phases
              </h2>
              <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_PHASES.map(p => <span key={p} className="px-3 py-1.5 bg-slate-50 text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-tighter border border-slate-100">{p} (SYS)</span>)}
                  {customPhases.map(p => (
                    <span key={p} className="px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-violet-100 shadow-sm group/chip transition-all hover:bg-violet-100">
                      {p}
                      <button onClick={() => setCustomPhases(prev => prev.filter(x => x !== p))} className="p-0.5 text-violet-300 hover:text-red-500 transition-colors"><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text" value={newPhase} onChange={e => setNewPhase(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addPhase()}
                    placeholder="e.g. PROPOSAL"
                    className={`${inputClasses} !py-2.5 !px-3 font-bold`}
                  />
                  <button onClick={addPhase} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black hover:bg-violet-600 transition-all active:scale-95 uppercase">
                    ADD
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Custom Lead Types */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.02)] p-8">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-[0.15em] mb-6 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center shadow-inner"><Users size={16} /></div>
                Lead Types
              </h2>
              <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_LEAD_TYPES.map(p => <span key={p} className="px-3 py-1.5 bg-slate-50 text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-tighter border border-slate-100">{p} (SYS)</span>)}
                  {customLeadTypes.map(p => (
                    <span key={p} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-blue-100 shadow-sm group/chip transition-all hover:bg-blue-100">
                      {p}
                      <button onClick={() => setCustomLeadTypes(prev => prev.filter(x => x !== p))} className="p-0.5 text-blue-300 hover:text-red-500 transition-colors"><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={newLeadType} onChange={e => setNewLeadType(e.target.value)} onKeyDown={e => e.key === 'Enter' && addLeadType()} placeholder="e.g. PARTNER" className={`${inputClasses} !py-2.5 !px-3 font-bold`} />
                  <button onClick={addLeadType} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black hover:bg-blue-600 transition-all active:scale-95 uppercase">ADD</button>
                </div>
              </div>
            </motion.div>



          </div>
        </div>
      </div>
    </div>
  );
}
