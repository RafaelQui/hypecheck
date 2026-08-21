import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetProfileQueryKey,
  useGetProfile,
  type UserProfile,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";

type ProfileState = {
  profile: UserProfile | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  setProfile: (profile: UserProfile) => void;
};

const ProfileContext = createContext<ProfileState | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const profileQuery = useGetProfile({
    query: {
      queryKey: getGetProfileQueryKey(),
      enabled: Boolean(session) && !authLoading,
      retry: false,
    },
  });

  // The API response is identity-bound to the bearer token. Do not surface a
  // cached profile belonging to a previous session while a new session loads.
  const currentProfile =
    session && profileQuery.data?.id === session.user.id ? profileQuery.data : null;

  const profile = currentProfile ?? null;

  const setProfile = useCallback(
    (nextProfile: UserProfile) => {
      if (session?.user.id !== nextProfile.id) return;
      queryClient.setQueryData<UserProfile>(getGetProfileQueryKey(), nextProfile);
    },
    [queryClient, session?.user.id],
  );

  const refreshProfile = useCallback(async () => {
    if (!session) return;
    await profileQuery.refetch();
  }, [profileQuery, session]);

  const value = useMemo<ProfileState>(
    () => ({
      profile,
      isLoading: profileQuery.isLoading,
      refreshProfile,
      setProfile,
    }),
    [profile, profileQuery.isLoading, refreshProfile, setProfile],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const state = useContext(ProfileContext);
  if (!state) throw new Error("useProfile must be used inside ProfileProvider.");
  return state;
}