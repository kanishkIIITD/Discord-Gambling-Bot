import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

// Create context
const ThemeContext = createContext(null);

/**
 * Available themes
 */
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
};

/**
 * Theme provider component
 * Manages theme state and provides theme-related utilities to the application
 */
export const ThemeProvider = ({ children, defaultTheme = THEMES.SYSTEM }) => {
  // State for the current theme
  const [theme, setTheme] = useState(() => {
    // Try to get the theme from localStorage
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || defaultTheme;
  });

  // State for the actual applied theme (light or dark, not system)
  const [appliedTheme, setAppliedTheme] = useState(THEMES.LIGHT);

  // Effect to update the document with the current theme
  useEffect(() => {
    // Save theme preference to localStorage
    localStorage.setItem('theme', theme);

    // Determine the actual theme to apply
    let newAppliedTheme = theme;

    // If theme is 'system', check system preference
    if (theme === THEMES.SYSTEM) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      newAppliedTheme = prefersDark ? THEMES.DARK : THEMES.LIGHT;
    }

    setAppliedTheme(newAppliedTheme);

    // Apply theme to document
    if (newAppliedTheme === THEMES.DARK) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== THEMES.SYSTEM) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e) => {
      const newAppliedTheme = e.matches ? THEMES.DARK : THEMES.LIGHT;
      setAppliedTheme(newAppliedTheme);

      if (newAppliedTheme === THEMES.DARK) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    // Add event listener
    mediaQuery.addEventListener('change', handleChange);

    // Clean up
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Toggle between light and dark themes
  const toggleTheme = () => {
    setTheme((prevTheme) => {
      if (prevTheme === THEMES.LIGHT) return THEMES.DARK;
      if (prevTheme === THEMES.DARK) return THEMES.LIGHT;
      
      // If system, toggle based on current applied theme
      return appliedTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    });
  };

  // Set a specific theme
  const setSpecificTheme = (newTheme) => {
    if (Object.values(THEMES).includes(newTheme)) {
      setTheme(newTheme);
    } else {
      console.error(`Invalid theme: ${newTheme}. Must be one of ${Object.values(THEMES).join(', ')}`);
    }
  };

  // Check if dark mode is active
  const isDarkMode = appliedTheme === THEMES.DARK;

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      theme,
      appliedTheme,
      isDarkMode,
      toggleTheme,
      setTheme: setSpecificTheme,
    }),
    [theme, appliedTheme, isDarkMode]
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};

/**
 * Custom hook to use the theme context
 * @returns {Object} Theme context value
 * @throws {Error} If used outside of a ThemeProvider
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

/**
 * Higher-order component that injects theme props into the wrapped component
 * @param {React.ComponentType} Component - Component to wrap
 * @returns {React.FC} - Wrapped component with theme props
 */
export const withTheme = (Component) => {
  const displayName = Component.displayName || Component.name || 'Component';
  
  const WithTheme = (props) => {
    const themeContext = useTheme();
    return <Component {...props} {...themeContext} />;
  };
  
  WithTheme.displayName = `withTheme(${displayName})`;
  
  return WithTheme;
};

export default ThemeContext;