import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetProfileQueryKey,
  useGetProfile,
  type UserProfile,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";

type CurrentProfile = UserProfile & {
  displayName: string | null;
  bio: string | null;
};

type ProfileState = {
  profile: CurrentProfile | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  setAvatarUrl: (avatarUrl: string) => void;
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

  const profile = useMemo<CurrentProfile | null>(
    () =>
      currentProfile
        ? {
            ...currentProfile,
            displayName: currentProfile.username ?? null,
            bio: null,
          }
        : null,
    [currentProfile],
  );

  const setAvatarUrl = useCallback(
    (avatarUrl: string) => {
      queryClient.setQueryData<UserProfile>(getGetProfileQueryKey(), (current) =>
        current ? { ...current, avatarUrl } : current,
      );
    },
    [queryClient],
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
      setAvatarUrl,
    }),
    [profile, profileQuery.isLoading, refreshProfile, setAvatarUrl],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const state = useContext(ProfileContext);
  if (!state) throw new Error("useProfile must be used inside ProfileProvider.");
  return state;
}