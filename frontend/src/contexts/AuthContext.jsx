import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Set up axios defaults
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No token found');
      }

      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      // The returned user object contains the Discord username (from OAuth),
      // which is used to update the backend username after login.
      setUser(response.data);
      return response.data;
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      localStorage.removeItem('token');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth().catch(() => {
      // Silent fail on initial load
    });
  }, []);

  const login = () => {
    window.location.href = `${process.env.REACT_APP_API_URL}/api/auth/discord`;
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await axios.post(`${process.env.REACT_APP_API_URL}/api/auth/logout`, {}, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      }
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  };

  const setToken = (token) => {
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth, setToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 