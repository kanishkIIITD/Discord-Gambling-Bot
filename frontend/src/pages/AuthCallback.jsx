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
          const user = await checkAuth();
          // Update username in backend if available
          if (user && user.discordId && user.username) {
            try {
              await fetch(`${process.env.REACT_APP_API_URL}/api/users/${user.discordId}/update-username`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username: user.username })
              });
            } catch (err) {
              // Not fatal, just log
              console.warn('Failed to update username in backend:', err);
            }
          }
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