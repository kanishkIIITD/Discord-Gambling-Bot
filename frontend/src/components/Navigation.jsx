import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';

export const Navigation = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path) => {
    return location.pathname === path;
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Left side - Logo and main nav */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent tracking-tight">
                Gambling Bot
              </h1>
            </Link>
            <div className="hidden md:flex md:ml-10 space-x-8">
              <Link
                to="/"
                className={`inline-flex items-center px-1 pt-1 text-sm font-medium tracking-wide ${
                  isActive('/') 
                    ? 'text-primary border-b-2 border-primary' 
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Home
              </Link>
              <Link
                to="/privacy"
                className={`inline-flex items-center px-1 pt-1 text-sm font-medium tracking-wide ${
                  isActive('/privacy') 
                    ? 'text-primary border-b-2 border-primary' 
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms"
                className={`inline-flex items-center px-1 pt-1 text-sm font-medium tracking-wide ${
                  isActive('/terms') 
                    ? 'text-primary border-b-2 border-primary' 
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Terms of Service
              </Link>
              <Link
                to="/bot-permissions"
                className={`inline-flex items-center px-1 pt-1 text-sm font-medium tracking-wide ${
                  isActive('/bot-permissions') 
                    ? 'text-primary border-b-2 border-primary' 
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Bot Permissions
              </Link>
            </div>
          </div>

          {/* Right side - Auth buttons */}
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="text-text-secondary hover:text-primary transition-colors tracking-wide"
                >
                  Dashboard
                </Link>
                <button
                  onClick={logout}
                  className="text-text-secondary hover:text-primary transition-colors tracking-wide"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="text-text-secondary hover:text-primary transition-colors tracking-wide"
              >
                Login
              </Link>
            )}

            {/* Mobile menu button */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
            >
              <span className="sr-only">Open main menu</span>
              {/* Icon when menu is closed */}
              <svg
                className={`${isMobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              {/* Icon when menu is open */}
              <svg
                className={`${isMobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} md:hidden`}>
        <div className="px-2 pt-2 pb-3 space-y-1">
          <Link
            to="/"
            className={`block px-3 py-2 rounded-md text-base font-medium tracking-wide ${
              isActive('/') 
                ? 'text-primary bg-primary/10' 
                : 'text-text-secondary hover:text-text-primary hover:bg-primary/5'
            }`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Home
          </Link>
          <Link
            to="/privacy"
            className={`block px-3 py-2 rounded-md text-base font-medium tracking-wide ${
              isActive('/privacy') 
                ? 'text-primary bg-primary/10' 
                : 'text-text-secondary hover:text-text-primary hover:bg-primary/5'
            }`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Privacy Policy
          </Link>
          <Link
            to="/terms"
            className={`block px-3 py-2 rounded-md text-base font-medium tracking-wide ${
              isActive('/terms') 
                ? 'text-primary bg-primary/10' 
                : 'text-text-secondary hover:text-text-primary hover:bg-primary/5'
            }`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Terms of Service
          </Link>
          <Link
            to="/bot-permissions"
            className={`block px-3 py-2 rounded-md text-base font-medium tracking-wide ${
              isActive('/bot-permissions') 
                ? 'text-primary bg-primary/10' 
                : 'text-text-secondary hover:text-text-primary hover:bg-primary/5'
            }`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Bot Permissions
          </Link>
          {user ? (
            <Link
              to="/dashboard"
              className="block px-3 py-2 rounded-md text-base font-medium text-text-secondary hover:text-text-primary hover:bg-primary/5 tracking-wide"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
          ) : (
            <Link
              to="/login"
              className="block px-3 py-2 rounded-md text-base font-medium text-text-secondary hover:text-text-primary hover:bg-primary/5 tracking-wide"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Login with Discord
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}; 