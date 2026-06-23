/**
 * Firebase Configuration & Initialization
 * Centralized setup for Firebase Auth and Firestore
 */

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// #1205: On the production domain we use the app's OWN domain as the authDomain
// and reverse-proxy /__/auth/* to firebaseapp.com (see vercel.json). This keeps
// the sign-in iframe same-origin so mobile browsers that block third-party
// storage (Safari 16.1+, Chrome 115+, Firefox 109+) can complete redirect
// sign-in. localhost and preview deployments keep the default Firebase domain
// (popup works there for development).
const PROD_AUTH_DOMAIN = "fightweek-app.vercel.app";
const authDomain =
  typeof window !== "undefined" && window.location.hostname === PROD_AUTH_DOMAIN
    ? PROD_AUTH_DOMAIN
    : "fightweek-app.firebaseapp.com";

const firebaseConfig = {
  apiKey: "AIzaSyDdOsNxPtlvWBP3SmNOxo1JfVXV9KeGUVA",
  authDomain,
  projectId: "fightweek-app",
  storageBucket: "fightweek-app.firebasestorage.app",
  messagingSenderId: "141030861103",
  appId: "1:141030861103:web:962fd2747623b171f159da"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
