import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark";

type ThemeState = {
  theme: Theme;
  toggleTheme: () => void;
};

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
      toggleTheme: () => {
        const theme = get().theme === "light" ? "dark" : "light";
        applyTheme(theme);
        set({ theme });
      },
    }),
    {
      name: "vitrine-theme",
      onRehydrateStorage: () => (state) => applyTheme(state?.theme ?? "light"),
    },
  ),
);
