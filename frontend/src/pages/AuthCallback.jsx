import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserStore, useGuildStore } from '../store';
import LoadingSpinner from '../components/LoadingSpinner';

export const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const checkAuth = useUserStore(state => state.checkAuth);
  const setToken = useUserStore(state => state.setToken);
  const fetchGuilds = useGuildStore(state => state.fetchGuilds);
  
  // Add loading states
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('Authenticating...');

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
          
          // Update loading message
          setLoadingMessage('Verifying your account...');
          
          // Check auth status - this will authenticate the user without requiring a guild ID
          const user = await checkAuth();
          
          if (user) {
            // Update loading message
            setLoadingMessage('Loading your servers...');
            
            // Fetch guilds after successful authentication
            try {
              await fetchGuilds(user.discordId);
            } catch (guildError) {
              console.error('Failed to fetch guilds:', guildError);
              // Continue to dashboard even if guild fetch fails
              // The ProtectedRoute will handle redirecting to no-guilds if needed
            }
            
            // After successful authentication, navigate to dashboard
            navigate('/dashboard');
          } else {
            throw new Error('Authentication failed - no user data returned');
          }
        } else {
          // If no token, just check auth status
          setLoadingMessage('Checking authentication...');
          const user = await checkAuth();
          
          if (user) {
            setLoadingMessage('Loading your servers...');
            try {
              await fetchGuilds(user.discordId);
            } catch (guildError) {
              console.error('Failed to fetch guilds:', guildError);
            }
          }
          
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Authentication failed:', error);
        setAuthError(error.message || 'Authentication failed');
        setIsAuthenticating(false);
        
        // Delay navigation to login to show the error message
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    };

    handleCallback();
  }, [checkAuth, navigate, location, setToken, fetchGuilds]);

  // Show error state if authentication fails
  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="bg-card p-6 rounded-lg shadow-lg max-w-lg w-full text-center">
          <h2 className="text-2xl font-bold text-text-primary mb-4">Authentication Failed</h2>
          <div className="bg-error/10 border border-error/30 rounded-md p-4 mb-6">
            <p className="text-error font-medium">{authError}</p>
          </div>
          <p className="text-text-secondary mb-4">Redirecting to login page...</p>
          <LoadingSpinner size="md" color="primary" />
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <LoadingSpinner size="lg" color="primary" message={loadingMessage} />
        <p className="mt-4 text-text-secondary animate-pulse">Please wait while we set up your dashboard</p>
      </div>
    </div>
  );
};