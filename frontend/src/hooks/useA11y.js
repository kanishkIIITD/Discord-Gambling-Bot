import { useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook for accessibility features
 * Provides utilities for keyboard navigation, focus management, and ARIA attributes
 */
const useA11y = () => {
  const focusRef = useRef(null);
  
  // Focus the element when it mounts or when focus() is called
  const focus = useCallback(() => {
    if (focusRef.current) {
      focusRef.current.focus();
    }
  }, []);

  // Trap focus within a container (for modals, dialogs, etc.)
  const useFocusTrap = (isActive = true) => {
    const containerRef = useRef(null);

    // Handle tab key to trap focus
    const handleTabKey = useCallback((e) => {
      if (!containerRef.current || !isActive) return;

      const focusableElements = containerRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // If shift+tab on first element, move to last element
      if (e.shiftKey && document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      } 
      // If tab on last element, move to first element
      else if (!e.shiftKey && document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }, [isActive]);

    // Set up event listeners
    useEffect(() => {
      if (!isActive) return;

      const handleKeyDown = (e) => {
        if (e.key === 'Tab') {
          handleTabKey(e);
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, [isActive, handleTabKey]);

    // Focus the first focusable element when the trap activates
    useEffect(() => {
      if (!containerRef.current || !isActive) return;

      const focusableElements = containerRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length > 0) {
        // Store the previously focused element
        const previouslyFocused = document.activeElement;
        
        // Focus the first element in the container
        focusableElements[0].focus();

        // Return focus to the previously focused element when the trap deactivates
        return () => {
          if (previouslyFocused) {
            previouslyFocused.focus();
          }
        };
      }
    }, [isActive]);

    return containerRef;
  };

  // Handle escape key press
  const useEscapeKey = (callback, isEnabled = true) => {
    useEffect(() => {
      if (!isEnabled) return;

      const handleEscapeKey = (e) => {
        if (e.key === 'Escape') {
          callback();
        }
      };

      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }, [callback, isEnabled]);
  };

  // Generate ARIA attributes for various components
  const getAriaAttributes = {
    // For buttons that toggle something
    toggle: (isExpanded, controlsId) => ({
      'aria-expanded': isExpanded,
      'aria-controls': controlsId,
    }),
    
    // For modal dialogs
    dialog: (labelId, descriptionId) => ({
      role: 'dialog',
      'aria-modal': true,
      'aria-labelledby': labelId,
      ...(descriptionId && { 'aria-describedby': descriptionId }),
    }),
    
    // For tabs
    tab: (isSelected, controlsId) => ({
      role: 'tab',
      'aria-selected': isSelected,
      'aria-controls': controlsId,
      tabIndex: isSelected ? 0 : -1,
    }),
    
    // For tab panels
    tabPanel: (labelledById) => ({
      role: 'tabpanel',
      'aria-labelledby': labelledById,
      tabIndex: 0,
    }),
    
    // For form fields
    formField: (labelId, isInvalid, errorId) => ({
      'aria-labelledby': labelId,
      ...(isInvalid && { 
        'aria-invalid': true,
        'aria-errormessage': errorId,
      }),
    }),
  };

  return {
    focusRef,
    focus,
    useFocusTrap,
    useEscapeKey,
    getAriaAttributes,
  };
};

export default useA11y;