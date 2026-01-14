"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

export type AccentColor = "blue" | "green" | "purple" | "red" | "yellow";

export interface AccentColorOption {
  id: AccentColor;
  name: string;
  color: string;
  description: string;
}

export const ACCENT_COLORS: AccentColorOption[] = [
  {
    id: "blue",
    name: "Blue",
    color: "#61afef",
    description: "Classic One Dark blue",
  },
  {
    id: "green",
    name: "Green",
    color: "#98c379",
    description: "Fresh and natural",
  },
  {
    id: "purple",
    name: "Purple",
    color: "#c678dd",
    description: "Creative and bold",
  },
  {
    id: "red",
    name: "Red",
    color: "#e06c75",
    description: "Warm and energetic",
  },
  {
    id: "yellow",
    name: "Yellow",
    color: "#e5c07b",
    description: "Bright and optimistic",
  },
];

interface AccentColorContextValue {
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
  accentColors: AccentColorOption[];
  currentAccentHex: string;
}

const AccentColorContext = createContext<AccentColorContextValue | null>(null);

const STORAGE_KEY = "continuum-accent-color";

export function AccentColorProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [accentColor, setAccentColorState] = useState<AccentColor>("blue");
  const [isInitialized, setIsInitialized] = useState(false);

  // Load accent color from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ACCENT_COLORS.some((c) => c.id === stored)) {
      setAccentColorState(stored as AccentColor);
    }
    setIsInitialized(true);
  }, []);

  // Apply accent class to html element
  useEffect(() => {
    if (!isInitialized) return;

    const html = document.documentElement;

    // Remove all accent classes
    ACCENT_COLORS.forEach((c) => {
      html.classList.remove(`accent-${c.id}`);
    });

    // Add the current accent class
    html.classList.add(`accent-${accentColor}`);

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, accentColor);
  }, [accentColor, isInitialized]);

  const setAccentColor = useCallback((color: AccentColor) => {
    setAccentColorState(color);
  }, []);

  const currentAccentHex =
    ACCENT_COLORS.find((c) => c.id === accentColor)?.color || "#61afef";

  return (
    <AccentColorContext.Provider
      value={{
        accentColor,
        setAccentColor,
        accentColors: ACCENT_COLORS,
        currentAccentHex,
      }}
    >
      {children}
    </AccentColorContext.Provider>
  );
}

export function useAccentColor() {
  const context = useContext(AccentColorContext);
  if (!context) {
    throw new Error("useAccentColor must be used within an AccentColorProvider");
  }
  return context;
}
