import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Use a more stable initialization approach with useCallback
  const getInitialTheme = useCallback(() => {
    // Check localStorage for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme;
    }
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }, []);

  const [theme, setTheme] = useState(getInitialTheme);

  // Memoize the toggle function to prevent unnecessary re-renders
  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => {
      const newTheme = prevTheme === 'light' ? 'dark' : 'light';
      // Update localStorage immediately to ensure consistency
      localStorage.setItem('theme', newTheme);
      return newTheme;
    });
  }, []);

  // Apply theme to document and localStorage when it changes
  useEffect(() => {
    // Update data-theme attribute on document
    document.documentElement.setAttribute('data-theme', theme);
    // Save to localStorage (redundant with the toggle function, but ensures consistency)
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = React.useMemo(() => ({
    theme,
    toggleTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light'
  }), [theme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};