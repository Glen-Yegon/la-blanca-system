// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

import { 
  getFirestore, 
  collection, 
  addDoc, 
  setDoc,
  serverTimestamp, 
  onSnapshot, 
  query, 
  where,
  orderBy, 
  doc, 
  updateDoc 
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCKklq1q9AhD7Df2ARF3Z811_k-qbK19f0",
  authDomain: "la-baita.firebaseapp.com",
  projectId: "la-baita",
  storageBucket: "la-baita.firebasestorage.app",
  messagingSenderId: "616774640127",
  appId: "1:616774640127:web:840ef1af06004fd80e47ca",
  measurementId: "G-N11283LDYB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Auth + Firestore DB
export const auth = getAuth(app);
export const db = getFirestore(app);

// Export Firestore + Auth Utility Functions
export {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  collection,
  addDoc,
  setDoc,           // ✅ ADDED THIS
  serverTimestamp,
  onSnapshot,
  query,
  where,
  orderBy,
  doc,
  updateDoc
};
