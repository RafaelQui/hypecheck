import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authLogin, authLogout, authMe, authRefresh, authSignup, type AuthSession } from "@workspace/api-client-react";

const SESSION_KEY = "hypecheck_supabase_session";
const REFRESH_SKEW_MS = 60_000;

type StoredSession = AuthSession & { expiresAt: number };

type AuthState = {
  session: AuthSession | null;
  loading: boolean;
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
      signUp: async (email, password) => {
        const result = await authSignup({ email, password });
        if (result.confirmationRequired || !result.session) {
          throw new Error(result.message || "Account created. Confirm your email, then sign in.");
        }
        await acceptSession(result.session);
      },
      signIn: async (email, password) => acceptSession(await authLogin({ email, password })),
      signOut: async () => {
        try {
          if (session) {
            await authLogout({ headers: { Authorization: `Bearer ${session.accessToken}` } });
          }
        } finally {
          // Clearing the device session is still important if the network is
          // unavailable while revoking it remotely.
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