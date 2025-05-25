import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Navigation } from '../components/Navigation';

export const Login = () => {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="w-full max-w-md">
            <div className="bg-card rounded-lg shadow p-8 space-y-8">
              <div className="text-center space-y-2">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent tracking-tight">
                  Gambling Bot
                </h1>
                <p className="text-text-secondary leading-relaxed tracking-wide">
                  Your ultimate Discord gambling companion
                </p>
              </div>

              <div className="space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-card text-text-secondary tracking-wide">
                      Sign in to continue
                    </span>
                  </div>
                </div>

                <button
                  onClick={login}
                  className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary tracking-wide"
                >
                  <img 
                    src="/discord-logo.svg" 
                    alt="Discord" 
                    className="h-6 w-6 mr-2"
                  />
                  <span>Continue with Discord</span>
                </button>

                <div className="text-center space-y-4">
                  <p className="text-sm text-text-secondary leading-relaxed tracking-wide">
                    By continuing, you agree to our{' '}
                    <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
                    {' '}and{' '}
                    <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                  </p>
                  <p className="text-xs text-text-secondary tracking-wide">
                    Must be 18+ to use this service
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}; 