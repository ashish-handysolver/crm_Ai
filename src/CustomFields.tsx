import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, Timestamp, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Loader2, Settings, Plus, Trash2, Save, AlertCircle, CheckCircle2, Tag, GitBranch } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export interface CustomFieldDef {
  id: string;
  name: string;
  type: 'TEXT' | 'NUMBER' | 'DROPDOWN' | 'DATE' | 'DATETIME';
  options: string[];
  companyId: string;
  createdAt: any;
}

const DEFAULT_SOURCES = ['LINKEDIN', 'REFERRAL', 'DIRECT', 'WEBSITE'];
const DEFAULT_PHASES  = ['DISCOVERY', 'NURTURING', 'QUALIFIED', 'INACTIVE'];

import { useAuth } from './App';

export default function CustomFields({ user }: { user: any }) {
  const { companyId } = useAuth();
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Custom source/phase options
  const [customSources, setCustomSources] = useState<string[]>([]);
  const [customPhases, setCustomPhases] = useState<string[]>([]);
  const [newSource, setNewSource] = useState('');
  const [newPhase, setNewPhase] = useState('');
  // Per-field new option input tracker
  const [newOptionInputs, setNewOptionInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    const load = async () => {
      try {
        // Load custom fields
        const q = query(collection(db, 'custom_fields'), where('companyId', '==', companyId));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomFieldDef));
        data.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
        setFields(data);

        // Load custom source/phase from companies doc
        const companySnap = await getDoc(doc(db, 'companies', companyId));
        if (companySnap.exists()) {
          setCustomSources(companySnap.data().customSources || []);
          setCustomPhases(companySnap.data().customPhases || []);
        }
      } catch (err: any) {
        setError('Failed to load: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [companyId]);

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
    if (!window.confirm("Delete this field?")) return;
    try {
      await deleteDoc(doc(db, 'custom_fields', id));
      setFields(prev => prev.filter(f => f.id !== id));
    } catch (err: any) {
      setError('Failed to delete: ' + err.message);
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

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (!companyId) throw new Error("No company context.");
      for (const f of fields) {
        if (!f.name.trim()) throw new Error("All fields must have a name.");
        if (f.type === 'DROPDOWN' && f.options.length === 0) throw new Error(`Dropdown "${f.name}" needs at least one option.`);
        await setDoc(doc(db, 'custom_fields', f.id), { ...f, companyId: companyId });
      }

      // Save custom sources/phases to company document
      const compRef = doc(db, 'companies', companyId);
      const compSnap = await getDoc(compRef);
      if (compSnap.exists()) {
        await updateDoc(compRef, { customSources, customPhases });
      } else {
        await setDoc(compRef, { customSources, customPhases }, { merge: true });
      }

      setSuccess('All configurations saved!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center min-h-screen"><Loader2 size={32} className="animate-spin text-slate-300" /></div>;

  return (
    <div className="flex-1 bg-[#f8fafc] text-slate-900 p-8 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Settings className="text-indigo-500" /> Custom System Fields
          </h1>
          <p className="text-slate-500 mt-2">Define custom data fields and configure your own Source & Phase options.</p>
        </header>

        {(error || success) && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-medium border ${error ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
            {error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            {error || success}
          </div>
        )}

        {/* Custom Fields */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8 mb-6">
          <h2 className="text-base font-extrabold text-slate-700 mb-5 flex items-center gap-2"><Settings size={16} className="text-indigo-500"/>Lead Custom Fields</h2>
          <div className="space-y-4 mb-6">
            {fields.length === 0 && (
              <div className="text-center p-8 bg-slate-50 rounded-xl border border-slate-100 text-slate-400 font-medium">
                No custom fields yet. Click "Add New Field" to start.
              </div>
            )}
            {fields.map((field) => (
              <div key={field.id} className="p-5 border border-slate-200 rounded-xl flex flex-col md:flex-row gap-4 items-start bg-slate-50">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Field Name</label>
                    <input type="text" value={field.name} onChange={(e) => updateField(field.id, { name: e.target.value })} placeholder="E.g. Gender, Deal Size" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Field Type</label>
                    <select value={field.type} onChange={(e) => updateField(field.id, { type: e.target.value as any })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium">
                      <option value="TEXT">Short Text</option>
                      <option value="NUMBER">Number</option>
                      <option value="DROPDOWN">Dropdown List</option>
                      <option value="DATE">Date</option>
                      <option value="DATETIME">Date & Time</option>
                    </select>
                  </div>
                  {field.type === 'DROPDOWN' && (
                    <div className="md:col-span-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Dropdown Options</label>
                      {/* Chips */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {field.options.length === 0 && (
                          <span className="text-xs text-slate-300 italic">No options yet — add some below.</span>
                        )}
                        {field.options.map(opt => (
                          <span key={opt} className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold">
                            {opt}
                            <button type="button" onClick={() => updateField(field.id, { options: field.options.filter(o => o !== opt) })} className="hover:text-red-500 transition-colors">
                              <Trash2 size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                      {/* Add option row */}
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
                          placeholder="Type an option and press Add or Enter"
                          className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium"
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
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-1"
                        >
                          <Plus size={14}/> Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={() => removeField(field.id)} className="shrink-0 p-2 mt-6 text-red-400 hover:text-white hover:bg-red-500 bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={addField} className="flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-bold hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600 transition-all">
            <Plus size={18} /> Add New Field
          </button>
        </div>

        {/* Custom Source Options */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8 mb-6">
          <h2 className="text-base font-extrabold text-slate-700 mb-1 flex items-center gap-2"><Tag size={16} className="text-emerald-500"/>Custom Lead Sources</h2>
          <p className="text-xs text-slate-400 mb-5">These are added alongside the default sources (LinkedIn, Referral, Direct, Website).</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {DEFAULT_SOURCES.map(s => <span key={s} className="px-3 py-1 bg-slate-100 text-slate-400 rounded-lg text-xs font-bold">{s} <span className="text-slate-300">(default)</span></span>)}
            {customSources.map(s => (
              <span key={s} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1.5">
                {s}
                <button onClick={() => setCustomSources(prev => prev.filter(x => x !== s))} className="hover:text-red-500 transition-colors"><Trash2 size={11} /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text" value={newSource} onChange={e => setNewSource(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSource()}
              placeholder="E.g. COLD_CALL, EMAIL..."
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium"
            />
            <button onClick={addSource} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-1">
              <Plus size={15}/> Add
            </button>
          </div>
        </div>

        {/* Custom Phase Options */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8 mb-8">
          <h2 className="text-base font-extrabold text-slate-700 mb-1 flex items-center gap-2"><GitBranch size={16} className="text-violet-500"/>Custom Lead Phases</h2>
          <p className="text-xs text-slate-400 mb-5">These are added alongside the default phases (Discovery, Nurturing, Qualified, Inactive).</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {DEFAULT_PHASES.map(p => <span key={p} className="px-3 py-1 bg-slate-100 text-slate-400 rounded-lg text-xs font-bold">{p} <span className="text-slate-300">(default)</span></span>)}
            {customPhases.map(p => (
              <span key={p} className="px-3 py-1 bg-violet-50 text-violet-700 rounded-lg text-xs font-bold flex items-center gap-1.5">
                {p}
                <button onClick={() => setCustomPhases(prev => prev.filter(x => x !== p))} className="hover:text-red-500 transition-colors"><Trash2 size={11} /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text" value={newPhase} onChange={e => setNewPhase(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPhase()}
              placeholder="E.g. PROPOSAL_SENT, NEGOTIATION..."
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium"
            />
            <button onClick={addPhase} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 transition-all flex items-center gap-1">
              <Plus size={15}/> Add
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-[#3b4256] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#2A303F] transition-all disabled:opacity-50">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Save All Configurations
          </button>
        </div>
      </div>
    </div>
  );
}
