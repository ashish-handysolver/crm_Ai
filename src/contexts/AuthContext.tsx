import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface AuthContextType {
  user: User | null;
  companyId: string | null;
  companyName: string | null;
  onboardingComplete: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  companyId: null,
  companyName: null,
  onboardingComplete: true, // Default to true to avoid flicker
  loading: true
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
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
            setOnboardingComplete(userData.onboardingComplete === true);
            
            if (userData.companyId) {
              const companyDoc = await getDoc(doc(db, 'companies', userData.companyId));
              if (companyDoc.exists()) {
                setCompanyName(companyDoc.data().name);
              }
            }
          } else {
            setCompanyId(null);
            setCompanyName(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error listening to user data:", error);
          setCompanyId(null);
          setCompanyName(null);
          setLoading(false);
        });
      } else {
        setCompanyId(null);
        setCompanyName(null);
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
    <AuthContext.Provider value={{ user, companyId, companyName, onboardingComplete, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
