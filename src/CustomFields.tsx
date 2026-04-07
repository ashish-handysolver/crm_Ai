import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, Timestamp, getDoc, updateDoc, deleteField } from 'firebase/firestore';
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
      if (companyId) {
        const fieldDocRef = doc(db, 'custom_fields', id);
        const fieldDocSnap = await getDoc(fieldDocRef);

        if (fieldDocSnap.exists()) {
          const actualFieldName = fieldDocSnap.data().name;
          if (actualFieldName) {
            const leadsSnap = await getDocs(query(collection(db, 'leads'), where('companyId', '==', companyId)));
            const updatePromises = leadsSnap.docs.map(leadDoc => {
              const data = leadDoc.data();
              if (data[actualFieldName] !== undefined) {
                return updateDoc(leadDoc.ref, { [actualFieldName]: deleteField() });
              }
              return Promise.resolve();
            });
            await Promise.all(updatePromises);
          }
        }
      }
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

      // Clean up orphaned data in leads table
      const leadsSnap = await getDocs(query(collection(db, 'leads'), where('companyId', '==', companyId)));
      const allSources = [...DEFAULT_SOURCES, ...customSources];
      const allPhases = [...DEFAULT_PHASES, ...customPhases];
      const allLeadTypes = [...DEFAULT_LEAD_TYPES, ...customLeadTypes];

      const updatePromises = leadsSnap.docs.map(leadDoc => {
        const data = leadDoc.data();
        let needsUpdate = false;
        const updates: any = {};

        if (data.source && !allSources.includes(data.source)) {
          updates.source = 'DIRECT';
          needsUpdate = true;
        }
        if (data.phase && !allPhases.includes(data.phase)) {
          updates.phase = 'DISCOVERY';
          needsUpdate = true;
        }
        if (data.leadType && !allLeadTypes.includes(data.leadType)) {
          updates.leadType = 'B2B';
          needsUpdate = true;
        }

        fields.forEach(f => {
          if (f.type === 'DROPDOWN' && data[f.name] && !f.options.includes(data[f.name])) {
            updates[f.name] = deleteField();
            needsUpdate = true;
          }
        });

        if (needsUpdate) return updateDoc(leadDoc.ref, updates);
        return Promise.resolve();
      });
      await Promise.all(updatePromises);

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
      <div className="flex-1 bg-slate-50/50 min-h-screen overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 sm:p-8 lg:p-12 space-y-12 animate-pulse">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 sm:gap-10">
            <div className="space-y-4 w-full">
              <div className="w-48 h-6 bg-slate-200 rounded-full"></div>
              <div className="w-64 sm:w-96 h-10 sm:h-12 bg-slate-200 rounded-xl"></div>
              <div className="w-full max-w-2xl h-4 bg-slate-200 rounded"></div>
            </div>
            <div className="w-full sm:w-48 h-12 bg-slate-200 rounded-2xl shrink-0"></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 h-[500px] bg-slate-200/50 rounded-[2.5rem]"></div>
            <div className="space-y-10">
              <div className="h-[200px] bg-slate-200/50 rounded-[2rem]"></div>
              <div className="h-[200px] bg-slate-200/50 rounded-[2rem]"></div>
              <div className="h-[200px] bg-slate-200/50 rounded-[2rem]"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const inputClasses = "w-full px-4 py-3 rounded-xl border border-orange-200 bg-orange-50 focus:bg-orange-50 outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-400 transition-all font-semibold text-sm text-slate-700 shadow-sm";
  const labelClasses = "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block";

  return (
    <div className="flex-1 bg-slate-50/50 min-h-screen overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 sm:p-8 lg:p-12 space-y-12">

        {/* Global Action Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 sm:gap-10">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">
              <Sparkles size={14} className="animate-pulse" /> Data Schema Architect
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 leading-none">Logic Modules</h1>
            <p className="text-slate-500 font-medium max-w-2xl text-sm sm:text-base leading-relaxed">Define custom data vectors and categorize lifecycle stages to optimize your intelligence pipeline.</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full sm:w-auto">
            <button
              onClick={handleSave}
              disabled={saving || isDemoMode}
              className="btn-primary w-full px-8 py-3.5 shadow-xl shadow-indigo-100 group/save flex items-center justify-center gap-3"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} className="group-hover/save:scale-110 transition-transform" />}
              <span>{isDemoMode ? 'Deployment Locked' : 'Sync Schema'}</span>
            </button>
          </motion.div>
        </header>

        {(error || success) && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`p-5 rounded-2xl flex items-center gap-4 text-sm font-bold shadow-xl border ${error ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${error ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
              {error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
            </div>
            {error || success}
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* Core Data Vectors Module */}
          <div className="lg:col-span-2 space-y-10">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card !rounded-[2.5rem] overflow-hidden relative border border-slate-200">
              <div className="p-8 sm:p-12 space-y-12">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner border border-indigo-100"><Settings size={18} /></div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Custom Attributes</h2>
                  </div>
                  {!isDemoMode && (
                    <button onClick={addField} className="text-[10px] font-black text-indigo-600 hover:text-white hover:bg-indigo-600 flex items-center justify-center gap-2 px-4 py-2.5 border border-indigo-100 rounded-xl transition-all active:scale-95 uppercase tracking-widest w-full sm:w-auto">
                      <Plus size={14} /> New Attribute
                    </button>
                  )}
                </div>

                <div className="space-y-8">
                  <AnimatePresence mode="popLayout">
                    {fields.length === 0 ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24 px-10 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center gap-6">
                        <div className="w-20 h-20 bg-white border border-slate-200 rounded-3xl flex items-center justify-center text-slate-200 shadow-xl shadow-slate-200/20"><Wand2 size={32} /></div>
                        <p className="text-slate-400 font-bold italic text-sm max-w-xs uppercase tracking-widest leading-loose">No custom attribute structures detected in the current partition.</p>
                      </motion.div>
                    ) : fields.map((field, idx) => (
                      <motion.div
                        key={field.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="p-6 sm:p-8 bg-slate-50/50 border border-slate-200 rounded-[2rem] flex flex-col gap-6 sm:gap-10 relative group/field hover:bg-white transition-all duration-500"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div>
                            <label className={labelClasses}>Attribute Identifier</label>
                            <input type="text" value={field.name} onChange={(e) => updateField(field.id, { name: e.target.value })} placeholder="e.g. Industry Focus" className={inputClasses.replace(/orange/g, 'slate')} />
                          </div>
                          <div>
                            <label className={labelClasses}>Primitive Data Type</label>
                            <select value={field.type} onChange={(e) => updateField(field.id, { type: e.target.value as any })} className={inputClasses.replace(/orange/g, 'slate')}>
                              <option value="TEXT">Short String</option>
                              <option value="NUMBER">Numeric Vector</option>
                              <option value="DROPDOWN">Enum Selection</option>
                              <option value="DATE">Standard Date</option>
                              <option value="DATETIME">Precision Timestamp</option>
                            </select>
                          </div>

                          {field.type === 'DROPDOWN' && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="md:col-span-2 space-y-6">
                              <label className={labelClasses}>Enum Parameters</label>
                              <div className="flex flex-wrap gap-2.5 min-h-[50px] p-6 bg-white rounded-2xl border border-slate-100 shadow-inner">
                                {field.options.length === 0 && <span className="text-[10px] font-black text-slate-200 uppercase tracking-[0.3em] pt-1">Null Options Set</span>}
                                {field.options.map(opt => (
                                  <span key={opt} className="inline-flex items-center gap-2.5 pl-4 pr-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-100 shadow-sm transition-all hover:bg-indigo-100">
                                    {opt}
                                    <button type="button" onClick={() => updateField(field.id, { options: field.options.filter(o => o !== opt) })} className="p-1 hover:bg-rose-100 hover:text-rose-600 rounded-md transition-colors">
                                      <X size={12} />
                                    </button>
                                  </span>
                                ))}
                              </div>
                              <div className="flex flex-col sm:flex-row gap-3">
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
                                  placeholder="Define new parameter..."
                                  className={`${inputClasses.replace(/orange/g, 'slate')} flex-1`}
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
                                  className="px-6 py-3.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all active:scale-95 shadow-lg shadow-slate-200/20"
                                >
                                  Append
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </div>
                        {!isDemoMode && (
                          <button onClick={() => removeField(field.id)} className="absolute top-6 right-6 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover/field:opacity-100">
                            <Trash2 size={20} />
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Categorization Matrices Column */}
          <div className="space-y-10">

            {/* Acquisition Matrix */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-8 border border-slate-200 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner border border-emerald-100"><Tag size={20} /></div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Source Channels</h2>
              </div>
              <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_SOURCES.map(s => <span key={s} className="px-3 py-1.5 bg-slate-50 text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100">{s} Node</span>)}
                  {customSources.map(s => (
                    <span key={s} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border border-emerald-100 shadow-sm">
                      {s}
                      <button onClick={() => setCustomSources(prev => prev.filter(x => x !== s))} className="p-0.5 hover:text-rose-500 transition-colors"><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-3">
                  <input
                    type="text" value={newSource} onChange={e => setNewSource(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addSource()}
                    placeholder="e.g. PARTNERSHIP"
                    className={`${inputClasses.replace(/orange/g, 'slate')} !py-3 !px-4 !text-xs`}
                  />
                  <button onClick={addSource} className="px-5 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black hover:bg-emerald-600 transition-all uppercase tracking-widest shadow-md">
                    Add
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Lifecycle Stages */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="glass-card p-8 border border-slate-200 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shadow-inner border border-violet-100"><GitBranch size={20} /></div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Pipeline Stages</h2>
              </div>
              <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_PHASES.map(p => <span key={p} className="px-3 py-1.5 bg-slate-50 text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100">{p} Core</span>)}
                  {customPhases.map(p => (
                    <span key={p} className="px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border border-violet-100 shadow-sm">
                      {p}
                      <button onClick={() => setCustomPhases(prev => prev.filter(x => x !== p))} className="p-0.5 hover:text-rose-50 transition-colors"><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-3">
                  <input
                    type="text" value={newPhase} onChange={e => setNewPhase(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addPhase()}
                    placeholder="e.g. EVALUATION"
                    className={`${inputClasses.replace(/orange/g, 'slate')} !py-3 !px-4 !text-xs`}
                  />
                  <button onClick={addPhase} className="px-5 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black hover:bg-violet-600 transition-all uppercase tracking-widest shadow-md">
                    Add
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Entity Types */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="glass-card p-8 border border-slate-200 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner border border-blue-100"><Users size={20} /></div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Profile Types</h2>
              </div>
              <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_LEAD_TYPES.map(p => <span key={p} className="px-3 py-1.5 bg-slate-50 text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100">{p} Unit</span>)}
                  {customLeadTypes.map(p => (
                    <span key={p} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border border-blue-100 shadow-sm">
                      {p}
                      <button onClick={() => setCustomLeadTypes(prev => prev.filter(x => x !== p))} className="p-0.5 hover:text-rose-500 transition-colors"><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-3">
                  <input type="text" value={newLeadType} onChange={e => setNewLeadType(e.target.value)} onKeyDown={e => e.key === 'Enter' && addLeadType()} placeholder="e.g. NON_PROFIT" className={`${inputClasses.replace(/orange/g, 'slate')} !py-3 !px-4 !text-xs`} />
                  <button onClick={addLeadType} className="px-5 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black hover:bg-indigo-600 transition-all uppercase tracking-widest shadow-md">Add</button>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  );
}
