import { useCallback, useRef, useEffect, useState } from 'react';
import useA11y from './useA11y';

/**
 * Enhanced accessibility hook that extends useA11y with additional features
 * - Skip to content functionality
 * - Announcement system for screen readers
 * - Focus management for modals and dialogs
 * - Keyboard navigation for custom components
 * - High contrast mode detection and toggling
 */
const useEnhancedA11y = () => {
  // Get base accessibility utilities
  const baseA11y = useA11y();
  
  // State for high contrast mode
  const [highContrastMode, setHighContrastMode] = useState(false);
  
  // Ref for the announcement element
  const announcerRef = useRef(null);
  
  // Check if user prefers reduced motion
  const prefersReducedMotion = useCallback(() => {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }, []);
  
  // Detect high contrast mode
  useEffect(() => {
    // Check if user has high contrast mode enabled
    const detectHighContrast = () => {
      // This is a simple heuristic and not 100% reliable
      const testEl = document.createElement('div');
      testEl.style.borderColor = 'red';
      testEl.style.backgroundColor = 'red';
      testEl.style.color = 'yellow';
      testEl.setAttribute('style', 'position: absolute; z-index: -999; opacity: 0;');
      document.body.appendChild(testEl);
      
      // Force layout calculation
      const computed = window.getComputedStyle(testEl);
      const hasHighContrast = (
        computed.backgroundColor === computed.borderColor ||
        computed.backgroundColor === 'transparent' ||
        computed.color === computed.backgroundColor
      );
      
      document.body.removeChild(testEl);
      return hasHighContrast;
    };
    
    setHighContrastMode(detectHighContrast());
  }, []);
  
  // Announce messages to screen readers
  const announce = useCallback((message, priority = 'polite') => {
    if (!announcerRef.current) {
      // Create the announcer element if it doesn't exist
      const announcer = document.createElement('div');
      announcer.setAttribute('aria-live', priority);
      announcer.setAttribute('aria-atomic', 'true');
      announcer.setAttribute('class', 'sr-only');
      document.body.appendChild(announcer);
      announcerRef.current = announcer;
    }
    
    // Clear previous announcements
    announcerRef.current.textContent = '';
    
    // Set the new announcement after a small delay
    // This ensures screen readers will announce it even if it's the same message
    setTimeout(() => {
      if (announcerRef.current) {
        announcerRef.current.textContent = message;
      }
    }, 50);
  }, []);
  
  // Skip to content functionality
  const setupSkipToContent = useCallback((mainContentId = 'main-content') => {
    // Create skip link if it doesn't exist
    if (!document.getElementById('skip-to-content')) {
      const skipLink = document.createElement('a');
      skipLink.id = 'skip-to-content';
      skipLink.href = `#${mainContentId}`;
      skipLink.textContent = 'Skip to content';
      skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:p-4 focus:bg-background focus:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary';
      
      // Insert at the beginning of the body
      document.body.insertBefore(skipLink, document.body.firstChild);
    }
    
    // Ensure the main content has the correct ID and tabIndex
    const mainContent = document.getElementById(mainContentId);
    if (mainContent) {
      mainContent.tabIndex = -1;
    }
  }, []);
  
  // Enhanced keyboard navigation for custom components
  const useKeyboardNavigation = (options = {}) => {
    const {
      containerRef,
      itemSelector = '[role="option"], button, a, [tabindex]',
      orientation = 'vertical',
      loop = true,
      typeAheadTimeout = 500,
      onSelect,
      onEscape,
      initialFocusIndex = 0,
    } = options;
    
    const [focusedIndex, setFocusedIndex] = useState(initialFocusIndex);
    const typeAheadRef = useRef({ text: '', lastKeyTime: 0 });
    
    // Handle keyboard navigation
    const handleKeyDown = useCallback((e) => {
      if (!containerRef?.current) return;
      
      const items = Array.from(containerRef.current.querySelectorAll(itemSelector));
      if (items.length === 0) return;
      
      let newIndex = focusedIndex;
      
      // Handle arrow keys based on orientation
      if (orientation === 'vertical') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          newIndex = focusedIndex + 1;
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          newIndex = focusedIndex - 1;
        }
      } else if (orientation === 'horizontal') {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          newIndex = focusedIndex + 1;
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          newIndex = focusedIndex - 1;
        }
      }
      
      // Handle looping
      if (loop) {
        if (newIndex < 0) newIndex = items.length - 1;
        if (newIndex >= items.length) newIndex = 0;
      } else {
        if (newIndex < 0) newIndex = 0;
        if (newIndex >= items.length) newIndex = items.length - 1;
      }
      
      // Handle Home and End keys
      if (e.key === 'Home') {
        e.preventDefault();
        newIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        newIndex = items.length - 1;
      }
      
      // Handle Enter or Space to select
      if ((e.key === 'Enter' || e.key === ' ') && onSelect) {
        e.preventDefault();
        onSelect(items[focusedIndex], focusedIndex);
        return;
      }
      
      // Handle Escape key
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }
      
      // Handle type-ahead functionality
      if (e.key.length === 1 && e.key.match(/\S/)) {
        e.preventDefault();
        
        const currentTime = Date.now();
        const { text, lastKeyTime } = typeAheadRef.current;
        
        // Reset text if it's been too long since the last keypress
        const newText = currentTime - lastKeyTime > typeAheadTimeout
          ? e.key
          : text + e.key;
        
        typeAheadRef.current = {
          text: newText,
          lastKeyTime: currentTime,
        };
        
        // Find the first item that starts with the typed text
        const matchIndex = items.findIndex(item => {
          const text = item.textContent?.toLowerCase() || '';
          return text.startsWith(newText.toLowerCase());
        });
        
        if (matchIndex !== -1) {
          newIndex = matchIndex;
        }
      }
      
      // Update focus if index changed
      if (newIndex !== focusedIndex) {
        setFocusedIndex(newIndex);
        items[newIndex]?.focus();
      }
    }, [containerRef, itemSelector, focusedIndex, orientation, loop, onSelect, onEscape, typeAheadTimeout]);
    
    // Set up event listeners
    useEffect(() => {
      const container = containerRef?.current;
      if (!container) return;
      
      container.addEventListener('keydown', handleKeyDown);
      
      return () => {
        container.removeEventListener('keydown', handleKeyDown);
      };
    }, [containerRef, handleKeyDown]);
    
    // Set initial focus
    useEffect(() => {
      const container = containerRef?.current;
      if (!container) return;
      
      const items = Array.from(container.querySelectorAll(itemSelector));
      if (items.length === 0) return;
      
      const index = Math.min(initialFocusIndex, items.length - 1);
      setFocusedIndex(index);
    }, [containerRef, itemSelector, initialFocusIndex]);
    
    return {
      focusedIndex,
      setFocusedIndex,
    };
  };
  
  // Get enhanced ARIA attributes
  const getEnhancedAriaAttributes = {
    ...baseA11y.getAriaAttributes,
    
    // For menus
    menu: (isExpanded, controlsId) => ({
      role: 'menu',
      'aria-expanded': isExpanded,
      'aria-controls': controlsId,
    }),
    
    // For menu items
    menuItem: (isSelected) => ({
      role: 'menuitem',
      'aria-selected': isSelected,
      tabIndex: isSelected ? 0 : -1,
    }),
    
    // For comboboxes
    combobox: (isExpanded, controlsId, activeDescendant) => ({
      role: 'combobox',
      'aria-expanded': isExpanded,
      'aria-controls': controlsId,
      ...(activeDescendant && { 'aria-activedescendant': activeDescendant }),
    }),
    
    // For listboxes
    listbox: (labelledById, multiselectable = false) => ({
      role: 'listbox',
      'aria-labelledby': labelledById,
      ...(multiselectable && { 'aria-multiselectable': 'true' }),
    }),
    
    // For options in a listbox
    option: (isSelected, id) => ({
      role: 'option',
      id,
      'aria-selected': isSelected,
      tabIndex: isSelected ? 0 : -1,
    }),
  };
  
  // Skip to content hook for components to use
  const useSkipToContent = (contentId = 'main-content') => {
    useEffect(() => {
      setupSkipToContent(contentId);
    }, [contentId]);
    
    return {
      skipLinkProps: {
        href: `#${contentId}`,
        className: 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:p-4 focus:bg-background focus:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary',
      }
    };
  };

  return {
    ...baseA11y,
    announce,
    setupSkipToContent,
    useSkipToContent,
    useKeyboardNavigation,
    prefersReducedMotion,
    highContrastMode,
    getEnhancedAriaAttributes,
  };
};

export default useEnhancedA11y;