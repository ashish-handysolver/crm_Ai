import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface AuthContextType {
  user: User | null;
  companyId: string | null;
  companyName: string | null;
  role: string | null;
  active: boolean;
  onboardingComplete: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  companyId: null,
  companyName: null,
  role: null,
  active: true,
  onboardingComplete: true, // Default to true to avoid flicker
  loading: true
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUser = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        unsubscribeUser = onSnapshot(doc(db, 'users', currentUser.uid), async (userDoc) => {
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setCompanyId(userData.companyId);
            
            // Check if user is specified as super admin in .env or has the role in DB
            if (currentUser.email === (import.meta as any).env.VITE_SUPER_ADMIN_EMAIL || userData.role === 'super_admin') {
              setRole('super_admin');
            } else {
              setRole(userData.role || 'user');
            }
            
            setOnboardingComplete(userData.onboardingComplete === true);
            setActive(userData.active !== false); // Default to true if field missing
            
            if (userData.companyId) {
              getDoc(doc(db, 'companies', userData.companyId)).then((companyDoc) => {
                if (companyDoc.exists()) {
                  setCompanyName(companyDoc.data().name);
                }
              }).catch(err => console.error("Error fetching company name:", err));
            }
          } else {
            setCompanyId(null);
            setCompanyName(null);
            setRole(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error listening to user data:", error);
          setCompanyId(null);
          setCompanyName(null);
          setRole(null);
          setLoading(false);
        });
      } else {
        setCompanyId(null);
        setCompanyName(null);
        setRole(null);
        unsubscribeUser();
        setLoading(false);
      }
    });
    
    return () => {
      unsubscribeAuth();
      unsubscribeUser();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, companyId, companyName, role, active, onboardingComplete, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
