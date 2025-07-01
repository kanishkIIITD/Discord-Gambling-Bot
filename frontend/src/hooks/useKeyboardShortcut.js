import { useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for handling keyboard shortcuts
 * @param {Object} shortcutsMap - Map of keyboard shortcuts to handlers
 * @param {Object} options - Configuration options
 * @param {boolean} options.enableOnFormElements - Whether shortcuts work when focus is on form elements
 * @param {boolean} options.enableOnContentEditable - Whether shortcuts work when focus is on contentEditable elements
 * @param {boolean} options.preventDefault - Whether to prevent default browser behavior
 * @param {boolean} options.enabled - Whether shortcuts are enabled
 * @returns {Object} Keyboard shortcut utilities
 */
export const useKeyboardShortcut = (shortcutsMap = {}, options = {}) => {
  const {
    enableOnFormElements = false,
    enableOnContentEditable = false,
    preventDefault = true,
    enabled = true,
  } = options;

  // Store shortcuts in a ref to avoid unnecessary re-renders
  const shortcutsRef = useRef(shortcutsMap);
  // Store active shortcuts to handle key combinations
  const activeKeysRef = useRef(new Set());
  // Store whether shortcuts are enabled
  const enabledRef = useRef(enabled);

  // Update refs when props change
  useEffect(() => {
    shortcutsRef.current = shortcutsMap;
  }, [shortcutsMap]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Normalize key names for consistency
  const normalizeKey = useCallback((key) => {
    // Normalize modifier keys
    if (key === 'Control' || key === 'Ctrl') return 'Control';
    if (key === 'Meta' || key === 'Command' || key === 'Cmd' || key === '⌘') return 'Meta';
    if (key === 'Alt' || key === 'Option' || key === '⌥') return 'Alt';
    if (key === 'Shift' || key === '⇧') return 'Shift';
    
    // Normalize common keys
    if (key === 'Esc') return 'Escape';
    if (key === 'Del') return 'Delete';
    if (key === 'Return') return 'Enter';
    if (key === 'Space') return ' ';
    
    // Return the key as is for other keys
    return key;
  }, []);

  // Parse shortcut string into an array of keys
  const parseShortcut = useCallback((shortcut) => {
    return shortcut
      .split('+')
      .map((key) => normalizeKey(key.trim()))
      .sort(); // Sort to ensure consistent order
  }, [normalizeKey]);

  // Check if the active keys match a shortcut
  const matchShortcut = useCallback(() => {
    if (!enabledRef.current || activeKeysRef.current.size === 0) return null;

    // Convert active keys to sorted array for comparison
    const activeKeys = Array.from(activeKeysRef.current).sort();

    // Check each shortcut for a match
    for (const [shortcut, handler] of Object.entries(shortcutsRef.current)) {
      const shortcutKeys = parseShortcut(shortcut);
      
      // Check if active keys match the shortcut
      if (
        activeKeys.length === shortcutKeys.length &&
        activeKeys.every((key, i) => key === shortcutKeys[i])
      ) {
        return handler;
      }
    }

    return null;
  }, [parseShortcut]);

  // Handle keydown event
  const handleKeyDown = useCallback(
    (event) => {
      if (!enabledRef.current) return;

      // Skip if focus is on form elements and enableOnFormElements is false
      if (
        !enableOnFormElements &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)
      ) {
        return;
      }

      // Skip if focus is on contentEditable elements and enableOnContentEditable is false
      if (
        !enableOnContentEditable &&
        event.target.isContentEditable
      ) {
        return;
      }

      // Add the key to active keys
      const key = normalizeKey(event.key);
      activeKeysRef.current.add(key);

      // Check for matching shortcut
      const matchedHandler = matchShortcut();
      if (matchedHandler) {
        if (preventDefault) {
          event.preventDefault();
        }
        matchedHandler(event);
      }
    },
    [normalizeKey, matchShortcut, enableOnFormElements, enableOnContentEditable, preventDefault]
  );

  // Handle keyup event
  const handleKeyUp = useCallback(
    (event) => {
      // Remove the key from active keys
      const key = normalizeKey(event.key);
      activeKeysRef.current.delete(key);
    },
    [normalizeKey]
  );

  // Add and remove event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Clear active keys when window loses focus
    window.addEventListener('blur', () => {
      activeKeysRef.current.clear();
    });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', () => {
        activeKeysRef.current.clear();
      });
    };
  }, [handleKeyDown, handleKeyUp]);

  // Register a new shortcut
  const registerShortcut = useCallback((shortcut, handler) => {
    shortcutsRef.current = {
      ...shortcutsRef.current,
      [shortcut]: handler,
    };
  }, []);

  // Unregister a shortcut
  const unregisterShortcut = useCallback((shortcut) => {
    const newShortcuts = { ...shortcutsRef.current };
    delete newShortcuts[shortcut];
    shortcutsRef.current = newShortcuts;
  }, []);

  // Enable shortcuts
  const enableShortcuts = useCallback(() => {
    enabledRef.current = true;
  }, []);

  // Disable shortcuts
  const disableShortcuts = useCallback(() => {
    enabledRef.current = false;
  }, []);

  return {
    registerShortcut,
    unregisterShortcut,
    enableShortcuts,
    disableShortcuts,
    isEnabled: enabledRef.current,
  };
};

export default useKeyboardShortcut;