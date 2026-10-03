import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = window.__FIREBASE_CONFIG__;

if (!firebaseConfig || !firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error("Firebase config missing. Fill env.js from env.example.js");
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_STORAGE_KEY = "admin_session_meta";

export {
  auth,
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
  updateDoc,
  where,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
};

export function setAdminLocalSession(user, profile) {
  localStorage.setItem(
    ADMIN_STORAGE_KEY,
    JSON.stringify({
      uid: user.uid,
      email: user.email,
      role: profile.role,
      name: profile.name || "Admin"
    })
  );
}

export function clearAdminLocalSession() {
  localStorage.removeItem(ADMIN_STORAGE_KEY);
}

export function getAdminLocalSession() {
  const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    clearAdminLocalSession();
    return null;
  }
}
