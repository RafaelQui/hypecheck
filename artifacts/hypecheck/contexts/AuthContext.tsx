import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authLogin, authLogout, authMe, authRefresh, authSignup, type AuthSession } from "@workspace/api-client-react";

const SESSION_KEY = "hypecheck_supabase_session";
const REFRESH_SKEW_MS = 60_000;

// Demo mode kicks in when no backend domain is configured (e.g. the Emergent
// web preview). In that mode the app skips real Supabase auth and stores a
// client-only session so the user can still explore signed-in features.
export const isDemoMode = !process.env.EXPO_PUBLIC_DOMAIN;
const DEMO_TOKEN_PREFIX = "demo::";

function makeDemoSession(email: string): AuthSession {
  const stamp = Date.now();
  return {
    accessToken: `${DEMO_TOKEN_PREFIX}${stamp}`,
    refreshToken: `${DEMO_TOKEN_PREFIX}refresh-${stamp}`,
    expiresIn: 60 * 60 * 24 * 7,
    tokenType: "bearer",
    user: { id: `demo-${email.toLowerCase()}`, email, createdAt: new Date().toISOString() },
  } as unknown as AuthSession;
}

type StoredSession = AuthSession & { expiresAt: number };

type AuthState = {
  session: AuthSession | null;
  loading: boolean;
  isDemo: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function saveSession(session: StoredSession | null) {
  if (Platform.OS === "web") {
    if (!session) await AsyncStorage.removeItem(SESSION_KEY);
    else await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return;
  }
  if (!session) {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return;
  }
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

async function readSession(): Promise<StoredSession | null> {
  const stored = await (Platform.OS === "web"
    ? AsyncStorage.getItem(SESSION_KEY)
    : SecureStore.getItemAsync(SESSION_KEY));
  if (!stored) return null;
  const parsed = JSON.parse(stored) as AuthSession & { expiresAt?: number };
  if (!parsed.accessToken || !parsed.refreshToken) return null;
  return { ...parsed, expiresAt: parsed.expiresAt ?? 0 };
}

function withExpiry(session: AuthSession): StoredSession {
  return { ...session, expiresAt: Date.now() + Math.max(0, session.expiresIn) * 1000 };
}

let refreshInFlight: Promise<StoredSession | null> | null = null;

async function refreshStoredSession(): Promise<StoredSession | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const current = await readSession();
    if (!current) return null;
    // Demo tokens never need refreshing — just extend their expiry locally.
    if (current.accessToken?.startsWith(DEMO_TOKEN_PREFIX)) {
      const extended = withExpiry(current);
      await saveSession(extended);
      return extended;
    }
    try {
      const refreshed = withExpiry(await authRefresh({ refreshToken: current.refreshToken }));
      // Supabase rotates refresh tokens. Write the entire replacement session
      // before returning its access token so concurrent requests never reuse one.
      await saveSession(refreshed);
      return refreshed;
    } catch {
      await saveSession(null);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    readSession()
      .then(async (stored) => {
        if (!stored) return;
        // Demo sessions are trusted locally — no /auth/me round-trip.
        if (stored.accessToken?.startsWith(DEMO_TOKEN_PREFIX)) {
          if (active) setSession(stored);
          return;
        }
        const accessToken = await getStoredAccessToken();
        if (!accessToken) return;
        await authMe({ headers: { Authorization: `Bearer ${accessToken}` } });
        const current = await readSession();
        if (active && current) setSession(current);
      })
      .catch(() => saveSession(null))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const acceptSession = useCallback(async (next: AuthSession) => {
    const stored = withExpiry(next);
    await saveSession(stored);
    setSession(stored);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      isDemo: isDemoMode,
      signUp: async (email, password) => {
        const trimmed = email.trim();
        if (!trimmed) throw new Error("Enter your email address.");
        if (password.length < 6) throw new Error("Password must be at least 6 characters.");
        if (isDemoMode) { await acceptSession(makeDemoSession(trimmed)); return; }
        const result = await authSignup({ email: trimmed, password });
        if (result.confirmationRequired || !result.session) {
          throw new Error(result.message || "Account created. Confirm your email, then sign in.");
        }
        await acceptSession(result.session);
      },
      signIn: async (email, password) => {
        const trimmed = email.trim();
        if (!trimmed) throw new Error("Enter your email address.");
        if (password.length < 6) throw new Error("Password must be at least 6 characters.");
        if (isDemoMode) { await acceptSession(makeDemoSession(trimmed)); return; }
        await acceptSession(await authLogin({ email: trimmed, password }));
      },
      signOut: async () => {
        try {
          if (session && !session.accessToken?.startsWith(DEMO_TOKEN_PREFIX)) {
            await authLogout({ headers: { Authorization: `Bearer ${session.accessToken}` } });
          }
        } finally {
          await saveSession(null);
          setSession(null);
        }
      },
    }),
    [acceptSession, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const state = useContext(AuthContext);
  if (!state) throw new Error("useAuth must be used inside AuthProvider.");
  return state;
}

export async function getStoredAccessToken() {
  try {
    const session = await readSession();
    if (!session) return null;
    if (session.expiresAt <= Date.now() + REFRESH_SKEW_MS) {
      return (await refreshStoredSession())?.accessToken ?? null;
    }
    return session.accessToken;
  } catch {
    return null;
  }
}