import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { checkAuth, setToken } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get token from URL
        const searchParams = new URLSearchParams(location.search);
        const token = searchParams.get('token');
        
        if (token) {
          // Store the token
          setToken(token);
          // Remove token from URL
          window.history.replaceState({}, document.title, '/auth/callback');
          // Check auth status
          await checkAuth();
          navigate('/dashboard');
        } else {
          // If no token, just check auth status
          await checkAuth();
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Authentication failed:', error);
        navigate('/login');
      }
    };

    handleCallback();
  }, [checkAuth, navigate, location, setToken]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  );
}; 