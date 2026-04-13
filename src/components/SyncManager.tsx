import React, { useEffect, useState } from 'react';
import { idbService, OfflineLead } from '../utils/idb-service';
import { extractLeadFromCard } from '../utils/ai-service';
import { db, storage } from '../firebase';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Wifi, WifiOff, CloudUpload, CheckCircle2, AlertCircle } from 'lucide-react';

export const SyncManager = () => {
  const { companyId } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [syncCount, setSyncCount] = useState(0);
  const [lastSyncStatus, setLastSyncStatus] = useState<'success' | 'fail' | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      attemptSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (navigator.onLine) attemptSync();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [companyId]);

  const attemptSync = async () => {
    if (!companyId || syncing) return;
    
    const pending = await idbService.getAllPendingLeads();
    if (pending.length === 0) return;

    setSyncing(true);
    setSyncCount(pending.length);
    console.log(`SyncManager: Initializing sync for ${pending.length} offline targets...`);

    let success = true;
    for (const lead of pending) {
      if (lead.status === 'SYNCING') continue;
      
      try {
        await idbService.markAsSyncing(lead.id);
        
        let vCardUrl = '';
        let audioNoteUrl = '';

        // 1. Upload Blobs to Storage
        if (lead.vCard) {
            // Need to convert base64 to blob if stored as string, but we store as Blob
            const vCardRef = ref(storage, `companies/${companyId}/vCards/${lead.id}_sync_vcard.png`);
            await uploadBytes(vCardRef, lead.vCardBlob as Blob);
            vCardUrl = await getDownloadURL(vCardRef);
        }

        if (lead.audioBlob) {
            const audioRef = ref(storage, `companies/${companyId}/audioNotes/${lead.id}_sync_note.webm`);
            await uploadBytes(audioRef, lead.audioBlob as Blob);
            audioNoteUrl = await getDownloadURL(audioRef);
        }

        // 2. Run AI Parsing if name/company is missing
        let finalData = { ...lead.data };
        if (lead.vCardBlob && (!finalData.name || finalData.name === 'Quick Captured Lead')) {
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve) => {
                reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                reader.readAsDataURL(lead.vCardBlob as Blob);
            });
            const extracted = await extractLeadFromCard(base64);
            if (extracted) {
                finalData = { ...finalData, ...extracted };
            }
        }

        // 3. Save to Firestore
        await setDoc(doc(db, 'leads', lead.id), {
          ...finalData,
          id: lead.id,
          companyId,
          vCardUrl,
          audioNoteUrl,
          captureSource: 'OFFLINE_SYNC',
          createdAt: Timestamp.fromMillis(lead.timestamp),
          updatedAt: Timestamp.now(),
          phase: String((import.meta as any).env.VITE_DEFAULT_PHASE || 'DISCOVERY').trim().toUpperCase(),
          leadType: String((import.meta as any).env.VITE_DEFAULT_LEAD_TYPE || 'B2B').trim().toUpperCase(),
          health: String((import.meta as any).env.VITE_DEFAULT_HEALTH || 'WARM').trim().toUpperCase(),
          score: 0,
        });

        // 4. Cleanup IDB
        await idbService.removeLead(lead.id);
        setSyncCount(prev => prev - 1);
      } catch (err) {
        console.error(`Sync failed for lead ${lead.id}:`, err);
        await idbService.updateLeadStatus(lead.id, 'FAILED');
        success = false;
      }
    }

    setLastSyncStatus(success ? 'success' : 'fail');
    setSyncing(false);
    setTimeout(() => setLastSyncStatus(null), 5000);
  };

  if (!syncing && !lastSyncStatus && isOnline) return null;

  return (
    <div className="fixed top-24 right-6 z-[100] flex flex-col items-end gap-3 pointer-events-none">
      <AnimatePresence>
        {!isOnline && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="flex items-center gap-3 bg-rose-500/10 backdrop-blur-md border border-rose-500/20 px-4 py-2.5 rounded-2xl shadow-xl pointer-events-auto"
          >
            <WifiOff size={16} className="text-rose-400" />
            <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Logic Stream Terminated (Offline)</span>
          </motion.div>
        )}

        {syncing && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 bg-indigo-500/10 backdrop-blur-md border border-indigo-500/20 px-4 py-2.5 rounded-2xl shadow-xl pointer-events-auto"
          >
            <CloudUpload size={16} className="text-indigo-400 animate-bounce" />
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Residue Sync: {syncCount} remaining</span>
          </motion.div>
        )}

        {lastSyncStatus === 'success' && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="flex items-center gap-3 bg-emerald-500/10 backdrop-blur-md border border-emerald-500/20 px-4 py-2.5 rounded-2xl shadow-xl pointer-events-auto"
          >
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Sync Protocols Complete</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
