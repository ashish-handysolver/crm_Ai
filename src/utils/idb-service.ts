import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'HandyCRM_Offline';
const STORE_NAME = 'pending_leads';
const VERSION = 1;

export interface OfflineLead {
  id: string;
  data: {
    name: string;
    company: string;
    email: string;
    phone: string;
    address: string;
  };
  vCardBlob: Blob | null;
  audioBlob: Blob | null;
  timestamp: number;
  status: 'PENDING' | 'SYNCING' | 'FAILED';
}

class IDBService {
  private db: Promise<IDBPDatabase>;

  constructor() {
    this.db = openDB(DB_NAME, VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }

  async addPendingLead(lead: OfflineLead) {
    const db = await this.db;
    return db.put(STORE_NAME, lead);
  }

  async getAllPendingLeads(): Promise<OfflineLead[]> {
    const db = await this.db;
    return db.getAll(STORE_NAME);
  }

  async markAsSyncing(id: string) {
    const db = await this.db;
    const lead = await db.get(STORE_NAME, id);
    if (lead) {
      lead.status = 'SYNCING';
      await db.put(STORE_NAME, lead);
    }
  }

  async removeLead(id: string) {
    const db = await this.db;
    return db.delete(STORE_NAME, id);
  }

  async updateLeadStatus(id: string, status: 'FAILED' | 'PENDING') {
    const db = await this.db;
    const lead = await db.get(STORE_NAME, id);
    if (lead) {
      lead.status = status;
      await db.put(STORE_NAME, lead);
    }
  }
}

export const idbService = new IDBService();
