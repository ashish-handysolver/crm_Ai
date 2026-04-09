import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export type ActivityType = 'FIELD_CHANGE' | 'MANUAL_NOTE' | 'SYSTEM' | 'CALL' | 'STATUS_CHANGE' | 'HEALTH_CHANGE' | 'INTEREST_CHANGE';

export interface ActivityLog {
  leadId: string;
  companyId: string;
  type: ActivityType;
  action: string;
  details?: {
    field?: string;
    oldValue?: any;
    newValue?: any;
    note?: string;
  };
  authorUid: string;
  authorName: string;
  createdAt: any;
}

export const logActivity = async (log: Omit<ActivityLog, 'createdAt'>) => {
  try {
    await addDoc(collection(db, 'activity_logs'), {
      ...log,
      createdAt: Timestamp.now()
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
};
