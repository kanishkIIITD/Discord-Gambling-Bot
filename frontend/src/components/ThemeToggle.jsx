import React, { useEffect, useState } from 'react';
import { useUIStore } from '../store';
import { Switch } from './animate-ui/base/switch';
import { MoonIcon, SunIcon } from '@heroicons/react/24/outline';

export const ThemeToggle = ({ className = '' }) => {
  const theme = useUIStore(state => state.theme);
  const toggleTheme = useUIStore(state => state.toggleTheme);
  const isDark = theme === 'dark';
  
  // Use local state to track the checked state to prevent visual flicker during navigation
  const [isChecked, setIsChecked] = useState(isDark);
  
  // Update local state when theme context changes
  useEffect(() => {
    setIsChecked(isDark);
  }, [isDark]);
  
  // Handle theme toggle with local state update first
  const handleToggle = () => {
    const newChecked = !isChecked;
    setIsChecked(newChecked);
    toggleTheme();
  };

  return (
    <div className={`flex items-center ${className}`}>
      <Switch
        checked={isChecked}
        onCheckedChange={handleToggle}
        id="theme-toggle"
        thumbIcon={isChecked ? <MoonIcon /> : <SunIcon />}
        aria-label={`Switch to ${isChecked ? 'light' : 'dark'} mode`}
      />
    </div>
  );
};