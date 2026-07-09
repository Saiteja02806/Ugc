"use client";

import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  listenToAuthState,
  logout,
  type AuthUser,
} from "@/lib/firebase/auth";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  error: Error | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = listenToAuthState(
      (currentUser) => {
        setUser(currentUser);
        setError(null);
        setLoading(false);
      },
      (observerError) => {
        console.error("Firebase auth observer failed:", observerError);
        setUser(null);
        setError(observerError);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    setError(null);

    try {
      await logout();
    } catch (signOutError) {
      const normalizedError = normalizeError(signOutError);
      setError(normalizedError);
      throw normalizedError;
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      signOut,
    }),
    [user, loading, error, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}

function normalizeError(error: unknown) {
  return error instanceof Error
    ? error
    : new Error("An unexpected authentication error occurred.");
}
