import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyCDMYbu604E083IyEBE__U6KX4I2YaovQA",
  authDomain: "handydash-75858.firebaseapp.com",
  databaseURL: "https://handydash-75858.firebaseio.com",
  projectId: "handydash-75858",
  storageBucket: "handydash-75858.appspot.com",
  messagingSenderId: "18967278229",
  appId: "1:18967278229:web:eedb13d46173cf05b4619c"
};

const app = initializeApp(firebaseConfig);
// Using the specific named database the user created
export const db = getFirestore(app, 'handydash-firestore');
export const auth = getAuth();
export const storage = getStorage(app);
