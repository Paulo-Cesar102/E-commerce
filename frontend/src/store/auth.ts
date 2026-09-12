import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types";

type AuthState = {
  user: User | null;
  accessToken: string | null;
  setSession: (session: { user: User; accessToken: string }) => void;
  updateUser: (user: User) => void;
  updateAccessToken: (accessToken: string) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setSession: (session) => set(session),
      updateUser: (user) => set({ user }),
      updateAccessToken: (accessToken) => set({ accessToken }),
      logout: () => set({ user: null, accessToken: null }),
    }),
    { name: "vitrine-session" },
  ),
);
