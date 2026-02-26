/**
 * Serves /__/firebase/init.json for the Firebase Auth handler popup.
 *
 * When using a custom authDomain (e.g., www.monitrax.com.au) the auth handler
 * page fetches /__/firebase/init.json from the same origin to discover the
 * Firebase project config.  If Firebase Hosting is not deployed for the
 * project, that endpoint returns 404/403.  This route fills in the gap by
 * returning the config from environment variables.
 *
 * The Next.js rewrite in next.config.ts maps
 *   /__/firebase/init.json  →  /api/firebase-init
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const projectId = process.env.NEXT_PUBLIC_GCP_PROJECT_ID || '';
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';
  const authDomain =
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    `${projectId}.firebaseapp.com`;

  return NextResponse.json({
    projectId,
    apiKey,
    authDomain,
  });
}
