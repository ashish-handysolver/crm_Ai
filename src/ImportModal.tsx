import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, UploadCloud, FileText, ArrowRight, CheckCircle2, Loader2, Download } from 'lucide-react';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { v4 as uuidv4 } from 'uuid';

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
  { id: 'score', label: 'Score (0-100)', required: false },
  { id: 'phase', label: 'Phase (e.g. DISCOVERY)', required: false }
];

export default function ImportModal({ isOpen, onClose, user }: ImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<Record<string, number>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ total: 0, current: 0 });
  const [error, setError] = useState('');

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
    }
  }, [isOpen]);

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
      SYSTEM_FIELDS.forEach(sysField => {
        const matchIdx = headers.findIndex(h => h.toLowerCase().includes(sysField.id.toLowerCase()));
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
    const headers = SYSTEM_FIELDS.map(f => f.id).join(',');
    const sampleRow = 'John Doe,john@example.com,Acme Corp,+1234567890,New York,LINKEDIN,85,DISCOVERY';
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
          ownerUid: user.uid,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          score: 50, // default
          phase: 'DISCOVERY', // default
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
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => !isImporting && onClose()}
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden relative z-10 max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Import Leads</h2>
              <p className="text-sm text-zinc-500 mt-1">Add multiple contacts to your CRM via CSV</p>
            </div>
            {!isImporting && (
              <button onClick={onClose} className="p-2 bg-white rounded-full hover:bg-zinc-100 transition-colors border border-zinc-200">
                <X size={18} className="text-zinc-500" />
              </button>
            )}
          </div>

          {/* Stepper */}
          <div className="px-8 py-6 border-b border-zinc-50 bg-white">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-zinc-100 z-0" />
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-[#3b4256] transition-all z-0" style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }} />
              
              {[1, 2, 3].map(s => (
                <div key={s} className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${step >= s ? 'bg-[#3b4256] text-white' : 'bg-white border-2 border-zinc-200 text-zinc-400'}`}>
                  {step > s ? <CheckCircle2 size={16} /> : s}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
              <span className={step >= 1 ? 'text-[#3b4256]' : ''}>Upload CSV</span>
              <span className={step >= 2 ? 'text-[#3b4256]' : ''}>Map Columns</span>
              <span className={step >= 3 ? 'text-[#3b4256]' : ''}>Import Data</span>
            </div>
          </div>

          {/* Body */}
          <div className="p-8 overflow-y-auto flex-1 bg-zinc-50/30">
            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium flex items-center gap-2">
                <CheckCircle2 size={16} />
                {error}
              </div>
            )}

            {step === 1 && (
              <div className="flex flex-col items-center justify-center min-h-[300px] gap-6">
                <label className="w-full max-w-lg cursor-pointer group">
                  <div className="border-2 border-dashed border-zinc-300 rounded-3xl p-12 text-center hover:bg-slate-50 hover:border-[#3b4256]/50 transition-all">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                      <UploadCloud size={32} className="text-blue-500" />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-800 mb-2">Upload your CSV file</h3>
                    <p className="text-sm text-zinc-500 mb-6">Drag and drop your file here, or click to browse.</p>
                    <span className="bg-[#3b4256] text-white px-6 py-2.5 rounded-xl text-sm font-bold inline-block">
                      Select File
                    </span>
                  </div>
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                </label>
                
                <div className="flex items-center gap-4 text-sm text-zinc-500">
                  <span className="w-12 h-px bg-zinc-300" />
                  OR
                  <span className="w-12 h-px bg-zinc-300" />
                </div>
                
                <button 
                  onClick={handleDownloadSample}
                  className="flex items-center gap-2 text-blue-600 font-bold hover:underline"
                >
                  <Download size={16} />
                  Download Sample CSV
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-3 mb-6 p-4 bg-blue-50 text-blue-800 rounded-xl text-sm">
                  <FileText size={20} className="text-blue-600" />
                  <div>
                    <span className="font-bold block">File uploaded: {file?.name}</span>
                    <span className="text-blue-600/80">Found {csvRows.length} rows to import</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex-1">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200">
                        <th className="py-3 px-4 font-bold text-zinc-600 w-1/2">System Field</th>
                        <th className="py-3 px-4 font-bold text-zinc-600 w-1/2">CSV Column</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SYSTEM_FIELDS.map((sysField, i) => (
                        <tr key={sysField.id} className={i !== SYSTEM_FIELDS.length - 1 ? 'border-b border-zinc-100' : ''}>
                          <td className="py-3 px-4">
                            <span className="font-medium text-zinc-800">{sysField.label}</span>
                            {sysField.required && <span className="text-red-500 ml-1">*</span>}
                          </td>
                          <td className="py-3 px-4">
                            <select 
                              className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#3b4256]/20 transition-all font-medium text-zinc-700"
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
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
                {importProgress.current < importProgress.total ? (
                  <>
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                      <Loader2 size={40} className="text-blue-500 animate-spin" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Importing Leads...</h3>
                    <p className="text-zinc-500 mb-6">Please do not close this window.</p>
                    
                    <div className="w-full max-w-md bg-zinc-100 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-blue-500 h-full transition-all duration-300"
                        style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-sm font-bold text-zinc-400 mt-3">{importProgress.current} of {importProgress.total} rows</p>
                  </>
                ) : (
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
                      <CheckCircle2 size={40} className="text-emerald-500" />
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-emerald-800">Import Complete!</h3>
                    <p className="text-zinc-500 mb-6">Successfully imported {importProgress.total} leads.</p>
                  </motion.div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-zinc-100 bg-white flex justify-between h-[88px] shrink-0">
            {step === 2 && (
              <button 
                onClick={() => setStep(1)}
                className="px-6 py-2.5 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors"
                disabled={isImporting}
              >
                Back
              </button>
            )}
            <div className="ml-auto">
              {step === 2 && (
                <button 
                  onClick={handleExecuteImport}
                  className="px-6 py-2.5 rounded-xl font-bold text-white bg-[#3b4256] hover:bg-black transition-colors flex items-center gap-2"
                >
                  Start Import
                  <ArrowRight size={16} />
                </button>
              )}
              {step === 3 && importProgress.current >= importProgress.total && (
                <button 
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl font-bold text-white bg-[#3b4256] hover:bg-black transition-colors"
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
