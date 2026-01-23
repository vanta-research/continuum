"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

export type Theme = "one-dark" | "monokai" | "dracula" | "catppuccin" | "ayu-dark";

export interface ThemeOption {
  id: Theme;
  name: string;
  description: string;
  colors: {
    background: string;
    foreground: string;
    accent: string;
    card: string;
  };
}

export const THEMES: ThemeOption[] = [
  {
    id: "one-dark",
    name: "One Dark",
    description: "Atom's iconic dark theme",
    colors: {
      background: "#282c34",
      foreground: "#abb2bf",
      accent: "#61afef",
      card: "#21252b",
    },
  },
  {
    id: "monokai",
    name: "Monokai",
    description: "Sublime Text classic",
    colors: {
      background: "#272822",
      foreground: "#f8f8f2",
      accent: "#a6e22e",
      card: "#1e1f1c",
    },
  },
  {
    id: "dracula",
    name: "Dracula",
    description: "Popular purple-tinted theme",
    colors: {
      background: "#282a36",
      foreground: "#f8f8f2",
      accent: "#bd93f9",
      card: "#21222c",
    },
  },
  {
    id: "catppuccin",
    name: "Catppuccin Mocha",
    description: "Modern pastel aesthetic",
    colors: {
      background: "#1e1e2e",
      foreground: "#cdd6f4",
      accent: "#cba6f7",
      card: "#181825",
    },
  },
  {
    id: "ayu-dark",
    name: "Ayu Dark",
    description: "Clean, muted aesthetic",
    colors: {
      background: "#0d1017",
      foreground: "#bfbdb6",
      accent: "#ffb454",
      card: "#0b0e14",
    },
  },
];

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themes: ThemeOption[];
  currentTheme: ThemeOption;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "continuum-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("one-dark");
  const [isInitialized, setIsInitialized] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && THEMES.some((t) => t.id === stored)) {
      setThemeState(stored as Theme);
    }
    setIsInitialized(true);
  }, []);

  // Apply theme class to html element
  useEffect(() => {
    if (!isInitialized) return;

    const html = document.documentElement;

    // Remove all theme classes
    THEMES.forEach((t) => {
      html.classList.remove(`theme-${t.id}`);
    });

    // Add the current theme class
    html.classList.add(`theme-${theme}`);

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, isInitialized]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const currentTheme = THEMES.find((t) => t.id === theme) || THEMES[0];

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        themes: THEMES,
        currentTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
