import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing data in localStorage with type safety and expiration
 * @param {string} key - The localStorage key
 * @param {any} initialValue - The initial value if key doesn't exist in localStorage
 * @param {Object} options - Additional options
 * @param {number} options.expiresIn - Expiration time in milliseconds
 * @param {boolean} options.serialize - Whether to serialize/deserialize the value
 * @returns {Array} [storedValue, setValue, removeValue]
 */
export const useLocalStorage = (key, initialValue, options = {}) => {
  const { expiresIn, serialize = true } = options;

  // Helper function to get stored value from localStorage
  const getStoredValue = useCallback(() => {
    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);
      
      // Parse stored json or return initialValue if null
      if (!item) return initialValue;

      let parsedItem;
      
      if (serialize) {
        parsedItem = JSON.parse(item);
      } else {
        parsedItem = item;
      }

      // Check if the item has expired
      if (parsedItem && typeof parsedItem === 'object' && parsedItem._expiry) {
        const now = new Date().getTime();
        if (now > parsedItem._expiry) {
          // Item has expired, remove it and return initialValue
          window.localStorage.removeItem(key);
          return initialValue;
        }
        // Return the value without the expiry
        return parsedItem.value;
      }

      return parsedItem;
    } catch (error) {
      // If error, return initialValue
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  }, [key, initialValue, serialize]);

  // State to store our value
  const [storedValue, setStoredValue] = useState(getStoredValue);

  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue = useCallback((value) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Save state
      setStoredValue(valueToStore);
      
      // Save to local storage
      let itemToStore = valueToStore;
      
      // Add expiration if specified
      if (expiresIn) {
        const now = new Date().getTime();
        const expiryTime = now + expiresIn;
        itemToStore = {
          value: valueToStore,
          _expiry: expiryTime,
        };
      }

      if (serialize) {
        window.localStorage.setItem(key, JSON.stringify(itemToStore));
      } else {
        window.localStorage.setItem(key, itemToStore);
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue, expiresIn, serialize]);

  // Remove value from localStorage
  const removeValue = useCallback(() => {
    try {
      // Remove from localStorage
      window.localStorage.removeItem(key);
      // Reset state to initialValue
      setStoredValue(initialValue);
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  // Update stored value if the key changes
  useEffect(() => {
    setStoredValue(getStoredValue());
  }, [key, getStoredValue]);

  // Listen for changes to this localStorage key in other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === key) {
        setStoredValue(getStoredValue());
      }
    };

    // Add event listener
    window.addEventListener('storage', handleStorageChange);

    // Remove event listener on cleanup
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, getStoredValue]);

  return [storedValue, setValue, removeValue];
};

/**
 * Helper function to check if localStorage is available
 * @returns {boolean} Whether localStorage is available
 */
export const isLocalStorageAvailable = () => {
  try {
    const testKey = '__test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

export default useLocalStorage;