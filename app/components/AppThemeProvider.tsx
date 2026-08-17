"use client";

import { Theme, ThemeMode } from "@astryxdesign/core/theme";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { lyricstapperTheme } from "../theme/lyricstapper";

const THEME_STORAGE_KEY = "lyricstapper-theme-mode";

type ThemeModeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const savedMode = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (savedMode === "system" || savedMode === "light" || savedMode === "dark") {
        setModeState(savedMode);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const value = useMemo<ThemeModeContextValue>(() => ({
    mode,
    setMode(nextMode) {
      setModeState(nextMode);
      window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
    },
  }), [mode]);

  return (
    <Theme theme={lyricstapperTheme} mode={mode}>
      <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>
    </Theme>
  );
}

export function useThemeMode() {
  const value = useContext(ThemeModeContext);
  if (!value) throw new Error("useThemeMode must be used within AppThemeProvider.");
  return value;
}
