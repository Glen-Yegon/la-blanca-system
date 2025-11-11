// firebase-config.js
// single-version, consistent Firebase SDK imports (v10.x)
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
  deleteDoc,
  getDocs,
  doc,
  updateDoc,
  Timestamp
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

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// export commonly used helpers
export {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  collection,
  addDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  Timestamp,
  query,
  where,
  orderBy,
  doc,
  updateDoc
};
