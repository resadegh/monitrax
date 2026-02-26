'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase/config';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isGCPEnabled: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Sync a Firebase user to the Monitrax backend.
 * Sends the GCP ID token to /api/auth/gcp/sync, which verifies it
 * and returns a Monitrax JWT + user data.
 */
async function syncFirebaseUser(firebaseUser: FirebaseUser): Promise<{ token: string; user: User }> {
  const idToken = await firebaseUser.getIdToken();

  const response = await fetch('/api/auth/gcp/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to sync with server');
  }

  const data = await response.json();

  return {
    token: data.data.token,
    user: {
      id: data.data.userId,
      email: data.data.email,
      name: data.data.name || data.data.email.split('@')[0],
      role: 'OWNER', // Default role for new users; server sets actual role
    },
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const gcpEnabled = isFirebaseConfigured();

  useEffect(() => {
    // Check for stored token on mount
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  /**
   * Helper to persist auth state after successful login/register
   */
  const persistAuth = (authToken: string, authUser: User) => {
    setToken(authToken);
    setUser(authUser);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(authUser));
  };

  /**
   * Login with email/password.
   * Uses Firebase Auth if GCP Identity Platform is configured,
   * otherwise falls back to the legacy Monitrax API.
   */
  const login = async (email: string, password: string) => {
    if (gcpEnabled) {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error('Firebase Auth not initialized');

      const credential = await signInWithEmailAndPassword(auth, email, password);
      const result = await syncFirebaseUser(credential.user);
      persistAuth(result.token, result.user);
      return;
    }

    // Legacy fallback: direct API login
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      let errorMessage = errorData.error || 'Login failed';
      if (errorData.remainingAttempts !== undefined) {
        errorMessage += ` (${errorData.remainingAttempts} attempts remaining)`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    persistAuth(data.token, data.user);
  };

  /**
   * Login with Google via Firebase Auth popup.
   * Only available when GCP Identity Platform is configured.
   */
  const loginWithGoogle = async () => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Google sign-in is not configured');

    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');

    const credential = await signInWithPopup(auth, provider);
    const result = await syncFirebaseUser(credential.user);
    persistAuth(result.token, result.user);
  };

  /**
   * Register a new account with email/password.
   * Uses Firebase Auth if GCP Identity Platform is configured,
   * otherwise falls back to the legacy Monitrax API.
   */
  const register = async (email: string, password: string, name: string) => {
    if (gcpEnabled) {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error('Firebase Auth not initialized');

      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const result = await syncFirebaseUser(credential.user);
      // The sync endpoint creates the user with the display name from the token,
      // but we can update the name to what the user provided
      result.user.name = name;
      persistAuth(result.token, result.user);
      return;
    }

    // Legacy fallback: direct API register
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Registration failed');
    }

    const data = await response.json();
    persistAuth(data.token, data.user);
  };

  /**
   * Logout — clears both Firebase and local state
   */
  const logout = () => {
    // Sign out from Firebase if configured
    if (gcpEnabled) {
      const auth = getFirebaseAuth();
      if (auth) {
        firebaseSignOut(auth).catch(() => {
          // Silent fail — local state is cleared regardless
        });
      }
    }

    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider
      value={{ user, token, login, loginWithGoogle, register, logout, isLoading, isGCPEnabled: gcpEnabled }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
