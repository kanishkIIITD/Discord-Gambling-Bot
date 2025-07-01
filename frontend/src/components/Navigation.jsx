import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { motion, useSpring } from 'framer-motion';
import useEnhancedA11y from '../hooks/useEnhancedA11y';

const MotionLink = motion(Link);

// Move tabList outside the component to avoid recreation on every render
const tabList = [
  { to: '/', label: 'Home' },
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms of Service' },
  { to: '/bot-permissions', label: 'Bot Permissions' },
  { to: '/commands', label: 'Commands' },
  { to: '/support', label: 'Support' },
];

export const Navigation = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Use enhanced accessibility features
  const { 
    useSkipToContent
  } = useEnhancedA11y();
  
  // Set up skip to content functionality
  const { skipLinkProps } = useSkipToContent('main-content');
  
  // --- Smooth Tabs logic ---
  const tabRefs = useRef({});
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  // Use springs for smooth indicator animation
  const springLeft = useSpring(indicatorStyle.left, { stiffness: 500, damping: 40 });
  const springWidth = useSpring(indicatorStyle.width, { stiffness: 500, damping: 40 });

  // Update indicator position/width on tab change or resize
  useLayoutEffect(() => {
    const activeTab = tabList.find(tab => tab.to === location.pathname);
    const node = tabRefs.current[activeTab?.to];
    if (node) {
      const { offsetLeft, offsetWidth } = node;
      setIndicatorStyle({ left: offsetLeft, width: offsetWidth });
    }
    // Only depend on location.pathname
  }, [location.pathname]);

  const isActive = (path) => {
    return location.pathname === path;
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };
  
  // ARIA attributes for navigation and menu button
  const navAriaProps = { role: 'navigation', 'aria-label': 'Main Navigation' };
  const menuButtonAriaProps = {
    'aria-expanded': isMobileMenuOpen,
    'aria-controls': 'mobile-menu',
    'aria-label': isMobileMenuOpen ? 'Close menu' : 'Open menu'
  };

  return (
    <>
      {/* Skip to content link - hidden visually but accessible to screen readers */}
      <a {...skipLinkProps} className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-md">
        Skip to content
      </a>
      
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border" {...navAriaProps}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap justify-between items-center gap-y-2 py-2">
          {/* Left side - Logo and main nav */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <motion.h1 
                className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent tracking-tight font-display"
                whileHover={{ 
                  scale: 1.05,
                  filter: "drop-shadow(0 4px 8px rgba(99, 102, 241, 0.3))"
                }}
                transition={{ 
                  type: "spring", 
                  stiffness: 400, 
                  damping: 10 
                }}
              >
                Gambling Bot
              </motion.h1>
            </Link>
            <div className="hidden md:flex md:ml-10 relative">
              <div className="flex space-x-2 bg-background border border-border rounded-xl px-2 py-1 relative w-fit">
                {/* Animated indicator highlight */}
                <motion.div
                  className="absolute top-0 left-0 h-full bg-primary/20 rounded-lg z-0"
                  style={{
                    left: springLeft,
                    width: springWidth,
                    height: '100%',
                  }}
                  layout
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
                {/* Smooth Tabs */}
                {tabList.map((tab) => (
                  <Link
                    key={tab.to}
                    to={tab.to}
                    tabIndex={0}
                    ref={el => (tabRefs.current[tab.to] = el)}
                    className={`relative z-10 inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium tracking-wide transition-colors duration-200 font-base
                      ${isActive(tab.to)
                        ? 'text-surface bg-primary border border-primary shadow-sm'
                        : 'text-text-secondary hover:text-primary hover:bg-primary/10'}
                    `}
                    style={{ minWidth: '90px', justifyContent: 'center' }}
                  >
                    {tab.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Right side - Auth buttons and theme toggle */}
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="text-text-secondary hover:text-primary transition-colors tracking-wide font-base"
                >
                  Dashboard
                </Link>
                <button
                  onClick={logout}
                  className="text-text-secondary hover:text-primary transition-colors tracking-wide font-base"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="text-text-secondary hover:text-primary transition-colors tracking-wide font-base"
              >
                Login
              </Link>
            )}

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Mobile menu button */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
              {...menuButtonAriaProps}
            >
              <span className="sr-only">{isMobileMenuOpen ? 'Close main menu' : 'Open main menu'}</span>
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

      {/* Mobile menu, show/hide based on menu state */}
      <div 
        id="mobile-menu"
        className={`${isMobileMenuOpen ? 'block' : 'hidden'} md:hidden`}
        role="navigation"
        aria-label="Mobile Navigation"
      >
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-background border-t border-border">
          {tabList.map((tab, index) => (
            <Link
              key={tab.to}
              to={tab.to}
              className={`${isActive(tab.to) ? 'bg-primary text-white' : 'text-text-secondary hover:bg-primary/10 hover:text-primary'} block px-3 py-2 rounded-md text-base font-medium tracking-wide font-base`}
              onClick={() => setIsMobileMenuOpen(false)}
              aria-current={isActive(tab.to) ? 'page' : undefined}
              tabIndex={isMobileMenuOpen ? 0 : -1}
              aria-label={tab.label}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
    </>
    
  );
};