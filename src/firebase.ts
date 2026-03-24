import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAMIBKe69JUMbXd5dT8gWAfomruHLc1nxg",
  authDomain: "gen-lang-client-0004919353.firebaseapp.com",
  projectId: "gen-lang-client-0004919353",
  storageBucket: "gen-lang-client-0004919353.firebasestorage.app",
  messagingSenderId: "744812235160",
  appId: "1:744812235160:web:14fc83746bbb070b06c3ed"
};

const app = initializeApp(firebaseConfig);
// Using the specific database ID from your project configuration
export const db = getFirestore(app, "ai-studio-a51e591f-052c-4aab-ac9b-b7ec428bbf63");
export const auth = getAuth();
export const storage = getStorage(app);
