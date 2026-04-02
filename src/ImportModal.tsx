import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, UploadCloud, FileText, ArrowRight, CheckCircle2, Loader2, Download } from 'lucide-react';
import { doc, setDoc, Timestamp, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { CustomFieldDef } from './CustomFields';
import { db } from './firebase';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from './contexts/AuthContext';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
}

const SYSTEM_FIELDS = [
  { id: 'name', label: 'Lead Name (Required)', required: true },
  { id: 'email', label: 'Email', required: false },
  { id: 'company', label: 'Organization/Company', required: false },
  { id: 'phone', label: 'Contact Number', required: false },
  { id: 'location', label: 'Location', required: false },
  { id: 'source', label: 'Source (e.g. LINKEDIN)', required: false },
  { id: 'leadType', label: 'Lead Type (e.g. B2B)', required: false },
  { id: 'health', label: 'Health (HOT/WARM/COLD)', required: false },
  { id: 'score', label: 'Score (0-100)', required: false },
  { id: 'phase', label: 'Phase (e.g. DISCOVERY)', required: false }
];

export default function ImportModal({ isOpen, onClose, user }: ImportModalProps) {
  const { companyId } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<Record<string, number>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ total: 0, current: 0 });
  const [error, setError] = useState('');
  const [dynamicSystemFields, setDynamicSystemFields] = useState(SYSTEM_FIELDS);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFile(null);
      setCsvHeaders([]);
      setCsvRows([]);
      setMappings({});
      setIsImporting(false);
      setError('');

      // Fetch custom fields from the custom_fields collection
      if (companyId) {
        const q = query(collection(db, 'custom_fields'), where('companyId', '==', companyId));
        getDocs(q).then(snap => {
          const customFields = snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomFieldDef));
          const combined = [...SYSTEM_FIELDS, ...customFields.map(cf => ({ id: cf.name, label: cf.name, required: false }))];
          setDynamicSystemFields(combined);
        }).catch(console.error);
      }
    }
  }, [isOpen, companyId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setError('');

    try {
      const text = await uploadedFile.text();
      const rows = text.split('\n').filter(row => row.trim().length > 0).map(r => r.split(','));
      if (rows.length < 2) {
        throw new Error('CSV file must have at least a header row and one data row.');
      }

      const headers = rows[0].map(h => h.trim());
      setCsvHeaders(headers);
      setCsvRows(rows.slice(1));

      // Auto-map where possible
      const newMappings: Record<string, number> = {};
      dynamicSystemFields.forEach(sysField => {
        const matchIdx = headers.findIndex(h => h.toLowerCase() === sysField.id.toLowerCase() || h.toLowerCase().includes(sysField.id.toLowerCase()));
        if (matchIdx !== -1) {
          newMappings[sysField.id] = matchIdx;
        }
      });
      setMappings(newMappings);

      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to parse CSV file.');
      setFile(null);
    }

    // reset input
    e.target.value = '';
  };

  const handleDownloadSample = () => {
    const headers = dynamicSystemFields.map(f => f.id).join(',');
    const sampleRow = dynamicSystemFields.map(f => {
      if (f.id === 'name') return 'John Doe';
      if (f.id === 'email') return 'john@example.com';
      if (f.id === 'score') return '85';
      if (f.id === 'phase') return 'DISCOVERY';
      if (f.id === 'leadType') return 'B2B';
      if (f.id === 'health') return 'WARM';
      return f.label;
    }).join(',');
    const csvContent = `${headers}\n${sampleRow}`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads_sample.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExecuteImport = async () => {
    if (!user) {
      setError('You must be logged in to import leads.');
      return;
    }

    // Validate required fields
    if (mappings['name'] === undefined) {
      setError('You must map the Lead Name field before importing.');
      return;
    }

    setIsImporting(true);
    setError('');
    setStep(3);
    setImportProgress({ total: csvRows.length, current: 0 });

    try {
      let successCount = 0;
      for (let i = 0; i < csvRows.length; i++) {
        const row = csvRows[i];

        // Skip empty rows
        if (!row || row.length < 2) continue;

        // Ensure required name exists
        const nameIdx = mappings['name'];
        if (!row[nameIdx]?.trim()) continue;

        const leadData: any = {
          companyId: companyId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          score: 50, // default
          phase: 'DISCOVERY', // default
          leadType: 'B2B', // default
          health: 'WARM', // default
        };

        // Apply mappings
        Object.entries(mappings).forEach(([sysFieldId, csvIdx]) => {
          if (row[csvIdx]?.trim()) {
            let val: any = row[csvIdx].trim();
            if (sysFieldId === 'score') {
              val = parseInt(val, 10);
              if (isNaN(val)) val = 50;
            }
            leadData[sysFieldId] = val;
          }
        });

        const id = uuidv4().slice(0, 8);
        await setDoc(doc(db, 'leads', id), leadData);

        successCount++;
        setImportProgress(prev => ({ ...prev, current: i + 1 }));
      }

      setTimeout(() => {
        onClose(); // Auto close on success
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Failed to import records.');
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 min-h-screen">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => !isImporting && onClose()}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          className="bg-orange-50 rounded-[2rem] shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden relative z-10 max-h-[90vh] md:max-h-[85vh] m-auto border border-orange-50/20"
        >
          {/* Header */}
          <div className="p-6 md:px-8 border-b border-zinc-100 flex items-center justify-between bg-gradient-to-r from-orange-50/50 via-white to-purple-50/50">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-orange-500 to-violet-600 bg-clip-text text-transparent">Import Leads</h2>
              <p className="text-sm font-medium text-slate-500 mt-1">Supercharge your CRM by bringing in fresh contacts.</p>
            </div>
            {!isImporting && (
              <button onClick={onClose} className="p-2.5 bg-orange-50 rounded-full hover:bg-red-50 hover:text-red-500 transition-all shadow-sm border border-zinc-100 group">
                <X size={18} className="text-zinc-400 group-hover:text-red-500" />
              </button>
            )}
          </div>

          {/* Stepper */}
          <div className="px-8 py-6 border-b border-orange-50 bg-orange-50 shadow-sm z-10">
            <div className="flex items-center justify-between relative max-w-lg mx-auto">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-orange-100 rounded-full z-0" />
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-orange-500 to-violet-500 rounded-full transition-all duration-500 z-0" style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }} />

              {[1, 2, 3].map(s => (
                <div key={s} className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 shadow-sm ${step >= s ? 'bg-gradient-to-br from-orange-500 to-violet-600 text-white scale-110' : 'bg-orange-50 border-2 border-orange-200 text-slate-400'}`}>
                  {step > s ? <CheckCircle2 size={20} /> : s}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest max-w-lg mx-auto px-1">
              <span className={step >= 1 ? 'text-orange-600' : ''}>Upload</span>
              <span className={step >= 2 ? 'text-violet-600' : ''}>Map</span>
              <span className={step >= 3 ? 'text-emerald-600' : ''}>Import</span>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-orange-50/50">
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-medium flex items-center gap-3 border border-red-100 shadow-sm">
                <div className="bg-red-100 p-1.5 rounded-full"><X size={14} /></div>
                {error}
              </motion.div>
            )}

            {step === 1 && (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex flex-col items-center justify-center py-4 gap-6">
                <label className="w-full max-w-lg cursor-pointer group">
                  <div className="relative border-[3px] border-dashed border-blue-200 bg-orange-50 rounded-[2rem] p-12 text-center hover:border-blue-400 hover:bg-orange-50/30 transition-all duration-300 shadow-sm hover:shadow-md overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-50/50 to-purple-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10">
                      <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-violet-100 rounded-3xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-sm">
                        <UploadCloud size={40} className="text-orange-600" />
                      </div>
                      <h3 className="text-xl font-extrabold text-slate-800 mb-2">Drop your CSV here</h3>
                      <p className="text-sm font-medium text-slate-500 mb-8">Format: standard comma-separated values (.csv)</p>
                      <span className="bg-black text-white px-8 py-3.5 rounded-2xl text-sm font-bold shadow-lg shadow-slate-200 group-hover:bg-orange-600 group-hover:shadow-blue-200 transition-all duration-300 inline-flex items-center gap-2">
                        Browse Files
                      </span>
                    </div>
                  </div>
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                </label>

                <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest w-full max-w-lg">
                  <span className="flex-1 h-px bg-slate-200" />
                  OR
                  <span className="flex-1 h-px bg-slate-200" />
                </div>

                <button
                  onClick={handleDownloadSample}
                  className="flex items-center gap-2 text-orange-600 font-bold hover:text-blue-700 bg-blue-50 hover:bg-orange-100 px-6 py-3 rounded-2xl transition-all"
                >
                  <Download size={18} />
                  Download Sample CSV
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col h-full space-y-6">
                <div className="flex items-center gap-4 p-5 bg-gradient-to-r from-orange-50 to-orange-50 border border-blue-100 rounded-2xl">
                  <div className="w-12 h-12 bg-orange-50 rounded-xl shadow-sm flex items-center justify-center shrink-0">
                    <FileText size={24} className="text-orange-600" />
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-800 block text-lg">{file?.name}</span>
                    <span className="text-orange-600/80 font-semibold text-sm">Discovered <span className="text-blue-700 font-bold">{csvRows.length} rows</span> ready for mapping</span>
                  </div>
                </div>

                <div className="bg-orange-50 rounded-3xl border border-orange-200 shadow-sm overflow-hidden flex-1">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-orange-50/80 border-b border-orange-200">
                        <th className="py-4 px-6 font-extrabold text-slate-500 uppercase tracking-wider text-xs w-1/2">System Field</th>
                        <th className="py-4 px-6 font-extrabold text-slate-500 uppercase tracking-wider text-xs w-1/2">CSV Column</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dynamicSystemFields.map((sysField) => (
                        <tr key={sysField.id} className="hover:bg-orange-50/50 transition-colors">
                          <td className="py-4 px-6">
                            <span className="font-bold text-slate-800 tracking-tight">{sysField.label}</span>
                            {(sysField as any).required && <span className="text-red-500 ml-1.5 font-bold">*</span>}
                          </td>
                          <td className="py-3 px-6">
                            <select
                              className="w-full bg-orange-50 border-2 border-orange-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-semibold text-slate-700 shadow-sm appearance-none cursor-pointer"
                              value={mappings[sysField.id] !== undefined ? mappings[sysField.id] : -1}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                setMappings(prev => ({
                                  ...prev,
                                  [sysField.id]: val >= 0 ? val : undefined
                                } as any));
                              }}
                            >
                              <option value={-1}>-- Ignore this field --</option>
                              {csvHeaders.map((h, idx) => (
                                <option key={idx} value={idx}>{h}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-12 text-center h-full">
                {importProgress.current < importProgress.total ? (
                  <>
                    <div className="relative mb-8">
                      <div className="absolute inset-0 bg-blue-400 blur-xl opacity-20 rounded-full animate-pulse" />
                      <div className="relative w-24 h-24 bg-gradient-to-br from-orange-50 to-orange-100 rounded-full flex items-center justify-center border-4 border-orange-50 shadow-xl">
                        <Loader2 size={48} className="text-orange-600 animate-spin" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-extrabold mb-3 text-slate-800">Processing Import...</h3>
                    <p className="text-slate-500 font-medium mb-8">Please wait while we sync your data to the CRM.</p>

                    <div className="w-full max-w-md bg-orange-100 rounded-full h-4 overflow-hidden shadow-inner p-0.5">
                      <div
                        className="bg-gradient-to-r from-orange-500 via-orange-500 to-violet-500 h-full rounded-full transition-all duration-300 relative overflow-hidden"
                        style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                      >
                        <div className="absolute inset-0 bg-orange-50/20 w-full animate-pulse" />
                      </div>
                    </div>
                    <p className="text-sm font-extrabold text-slate-400 mt-4 tracking-widest uppercase">{importProgress.current} / {importProgress.total} Records</p>
                  </>
                ) : (
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
                    <div className="relative mb-8">
                      <div className="absolute inset-0 bg-emerald-400 blur-xl opacity-30 rounded-full" />
                      <div className="relative w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center border-4 border-orange-50 shadow-xl">
                        <CheckCircle2 size={48} className="text-white" />
                      </div>
                    </div>
                    <h3 className="text-3xl font-extrabold mb-3 bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Import Complete!</h3>
                    <p className="text-slate-500 font-medium text-lg">Your workspace has successfully ingested <br /><span className="text-slate-800 font-bold">{importProgress.total}</span> total leads.</p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 md:px-8 border-t border-orange-100 bg-orange-50/80 flex justify-between shrink-0 rounded-b-[2rem]">
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 rounded-2xl font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-all shadow-sm"
                disabled={isImporting}
              >
                Back
              </button>
            )}
            <div className="ml-auto">
              {step === 2 && (
                <button
                  onClick={handleExecuteImport}
                  className="px-8 py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-orange-500 to-violet-600 hover:from-orange-700 hover:to-violet-700 hover:shadow-lg hover:shadow-blue-500/25 transition-all flex items-center gap-2"
                >
                  Start Import
                  <ArrowRight size={18} />
                </button>
              )}
              {step === 3 && importProgress.current >= importProgress.total && (
                <button
                  onClick={onClose}
                  className="px-10 py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25 transition-all"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
