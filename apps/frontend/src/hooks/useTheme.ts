import { createContext, useContext } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

export type ThemeContextType = {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
};

export const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  isDark: false,
  setMode: () => {},
});

export const useTheme = () => useContext(ThemeContext);
