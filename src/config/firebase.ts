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
//
// Extended to the stable TST branch URL: exactly these two deployed
// hostnames use a same-origin authDomain (their own hostname), sharing the
// same vercel.json /__/auth reverse proxy. Deliberately an explicit
// exact-host allow-list — never inferred from a vercel.app suffix, preview
// URL pattern, branch-name substring, or environment variable. Every other
// hostname (localhost, unique per-deployment Vercel URLs, any other
// vercel.app host) keeps the default cross-origin Firebase domain,
// unchanged.
const PROD_AUTH_DOMAIN = "fightweek-app.vercel.app";
const STABLE_TST_AUTH_DOMAIN = "fightweek-app-git-feature-bedre-design-runes-projects-de9c17f6.vercel.app";
const DEFAULT_AUTH_DOMAIN = "fightweek-app.firebaseapp.com";
const SAME_ORIGIN_AUTH_DOMAINS = [PROD_AUTH_DOMAIN, STABLE_TST_AUTH_DOMAIN];

export function resolveAuthDomain(hostname: string): string {
  return SAME_ORIGIN_AUTH_DOMAINS.includes(hostname) ? hostname : DEFAULT_AUTH_DOMAIN;
}

const authDomain = typeof window !== "undefined" ? resolveAuthDomain(window.location.hostname) : DEFAULT_AUTH_DOMAIN;

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
