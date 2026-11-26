import { create } from "zustand";
import type { User } from "../types";

type AuthState = {
  user: User | null;
  accessToken: string | null;
  initialized: boolean;
  setSession: (session: { user: User; accessToken: string }) => void;
  updateUser: (user: User) => void;
  updateAccessToken: (accessToken: string) => void;
  logout: () => void;
  finishInitialization: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  initialized: false,
  setSession: (session) => set({ ...session, initialized: true }),
  updateUser: (user) => set({ user }),
  updateAccessToken: (accessToken) => set({ accessToken }),
  logout: () => set({ user: null, accessToken: null, initialized: true }),
  finishInitialization: () => set({ initialized: true }),
}));
