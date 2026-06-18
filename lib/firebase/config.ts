/**
 * Firebase Client SDK Configuration
 *
 * Initializes the Firebase client SDK for GCP Identity Platform authentication.
 * This is client-side only — server-side token verification uses google-auth-library
 * (see lib/auth/gcpTokenVerifier.ts).
 *
 * Required environment variables:
 *   NEXT_PUBLIC_FIREBASE_API_KEY - Firebase Web API key
 *   NEXT_PUBLIC_GCP_PROJECT_ID  - GCP project ID
 *
 * @see docs/blueprint/GCP_IDENTITY_MIGRATION_PHASE2.md
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    `${process.env.NEXT_PUBLIC_GCP_PROJECT_ID || ''}.firebaseapp.com`,
  projectId: process.env.NEXT_PUBLIC_GCP_PROJECT_ID || '',
};

/**
 * Check if Firebase client is configured with required env vars
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_GCP_PROJECT_ID
  );
}

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;

/**
 * Get the Firebase app instance (singleton).
 * Returns null if Firebase is not configured.
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) {
    return null;
  }

  if (!app) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return app;
}

/**
 * Get the Firebase Auth instance (singleton).
 * Returns null if Firebase is not configured.
 */
export function getFirebaseAuth(): Auth | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) {
    return null;
  }

  if (!authInstance) {
    authInstance = getAuth(firebaseApp);

    // E2E ONLY: point the client Auth SDK at the local Firebase Auth emulator
    // when NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST is set. This env var is set
    // ONLY in the Playwright CI job (see .github/workflows/tests.yml) and is
    // NEVER present in prod or Vercel preview, so this is a strict no-op there.
    const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
    if (emulatorHost) {
      connectAuthEmulator(authInstance, `http://${emulatorHost}`, {
        disableWarnings: true,
      });
    }
  }
  return authInstance;
}
