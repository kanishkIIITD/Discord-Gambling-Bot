import { Link, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { ThemeToggle } from './ThemeToggle';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDisplayNumber } from '../utils/numberFormat';
import GuildSelector from './GuildSelector';
import { useUserStore, useGuildStore, useUIStore } from '../store';
import { useZustandQuery, useZustandMutation } from '../hooks/useZustandQuery';
import { useWalletBalance, useClaimDailyBonus, useDailyBonusStatus } from '../hooks/useQueryHooks';
import * as api from '../services/api';

export const DashboardNavigation = ({ suppressWalletBalance, onProfileMenuToggle, onSidebarToggle }) => {
  const user = useUserStore(state => state.user);
  const logout = useUserStore(state => state.logout);
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const guilds = useGuildStore(state => state.guilds);
  const fetchGuilds = useGuildStore(state => state.fetchGuilds);
  const initializeGuildStore = useGuildStore(state => state.initialize);
  
  // Use React Query hook for wallet balance synchronization
  const { data: walletBalanceData, isLoading: walletLoading } = useWalletBalance(user?.discordId);
  const walletBalance = walletBalanceData?.balance || 0;
  
  // Local state for previous wallet balance (for animation purposes)
  const [prevWalletBalance, setPrevWalletBalance] = useState(walletBalance);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const profileMenuRef = useRef(null);
  const mobileMenuRef = useRef(null);
  
  // Enhanced responsive breakpoints
  const [screenSize, setScreenSize] = useState({
    isMobile: window.innerWidth < 768,
    isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
    isDesktop: window.innerWidth >= 1024
  });
  
  // Use React Query hook for daily bonus status
  const { data: dailyStatus, isLoading: isDailyStatusLoading } = useDailyBonusStatus(user?.discordId);
  
  // Initialize guild store on mount
  useEffect(() => {
    initializeGuildStore();
  }, [initializeGuildStore]);
  
  // Fetch guilds if not already loaded
  useEffect(() => {
    if (user?.discordId && guilds.length === 0) {
      fetchGuilds(user.discordId);
    }
  }, [user?.discordId, guilds.length, fetchGuilds]);
  
  // Wallet balance is now managed by React Query through useWalletBalance hook
  // No need for manual fetching - it's handled automatically
  
  // Use the proper React Query mutation hook for daily bonus
  const { mutate: claimDailyBonus, isLoading: isClaimingDaily } = useClaimDailyBonus();
  
  // Local state for daily bonus
  const [nextClaimTime, setNextClaimTime] = useState(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState('');
  
  useEffect(() => {
    function handleResize() {
      setScreenSize({
        isMobile: window.innerWidth < 768,
        isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
        isDesktop: window.innerWidth >= 1024
      });
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Function to format time remaining
  const formatTimeRemaining = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date().getTime();
    const diff = timestamp - now;
    
    if (diff <= 0) return 'Ready';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  // Update daily bonus status from React Query data
  useEffect(() => {
    if (dailyStatus) {
      setNextClaimTime(dailyStatus.nextClaimTime);
      setCurrentStreak(dailyStatus.currentStreak);
      setTimeRemaining(formatTimeRemaining(dailyStatus.nextClaimTime));
    }
  }, [dailyStatus]);
  
  // Update prevWalletBalance when walletBalance changes
  useEffect(() => {
    if (!suppressWalletBalance) {
      setPrevWalletBalance(walletBalance);
    }
  }, [walletBalance, suppressWalletBalance]);

  // Update time remaining every second
  useEffect(() => {
    if (!nextClaimTime) return;
    
    const timer = setInterval(() => {
      const now = new Date().getTime();
      if (now >= nextClaimTime) {
        setNextClaimTime(null);
        setTimeRemaining('Ready');
      } else {
        setTimeRemaining(formatTimeRemaining(nextClaimTime));
      }
    }, 1000); // Update every second
    
    return () => clearInterval(timer);
  }, [nextClaimTime]);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (typeof onProfileMenuToggle === 'function') {
      onProfileMenuToggle(showProfileMenu);
    }
    // eslint-disable-next-line
  }, [showProfileMenu]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  // Format Discord avatar URL
  const getDiscordAvatarUrl = (userId, avatarHash) => {
    if (!avatarHash) return null;
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png`;
  };

  // Handle daily bonus claim using React Query
  const handleDailyClaim = () => {
    if (isClaimingDaily || nextClaimTime) return;
    
    claimDailyBonus(
      { discordId: user.discordId },
      {
        onSuccess: (data) => {
          toast.success(`Claimed ${data.amount} points! (${data.streak} day streak)`);
          // Wallet balance will be automatically updated through React Query invalidation
        },
        onError: (error) => {
          console.error('Daily bonus error:', error.response?.data || error);
          
          if (error.response?.data?.nextClaimTime) {
            toast.error(`You can claim your next daily bonus in ${formatTimeRemaining(error.response.data.nextClaimTime)}`);
          } else {
            toast.error('Failed to claim daily bonus. Please try again later.');
          }
        }
      }
    );
  };

  // Close mobile menu on outside click
  useEffect(() => {
    if (!showMobileMenu) return;
    function handleClickOutside(event) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
        setShowMobileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMobileMenu]);

  return (
    <nav className="w-full font-base relative h-16 bg-surface border-b border-border">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 h-full">
        <div className="flex items-center justify-between h-full gap-2">
          {/* Left side - Logo and hamburger */}
          <div className="flex items-center gap-2 min-w-0">
            {/* Hamburger Menu Button */}
            <button
              onClick={() => {
                onProfileMenuToggle(false); // Close profile menu if open
                onSidebarToggle(); // Toggle sidebar
              }}
              className="p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-primary/10 transition-colors"
              aria-label="Toggle sidebar"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            {/* Logo - Link to Home */}
            <Link to="/" className="flex items-center min-w-0">
              <motion.h1 
                className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent tracking-tight font-display truncate"
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
          </div>

          {/* Center section - Guild Selector (tablet and up) */}
          {!screenSize.isMobile && (
            <div className="hidden md:flex items-center justify-center flex-1 max-w-md mx-4">
              <GuildSelector />
            </div>
          )}

          {/* Right side - Navigation items */}
          <div className="flex items-center gap-2 min-w-0">
            {/* Desktop Navigation */}
            {!screenSize.isMobile && (
              <>
                {/* Balance Display */}
                <div className="hidden lg:flex items-center space-x-2 px-3 py-2 rounded-lg bg-surface/50 border border-border">
                  <span className="text-text-secondary text-sm font-base">Balance:</span>
                  <span className="text-lg font-bold text-primary font-mono">
                    {formatDisplayNumber(suppressWalletBalance ? prevWalletBalance : walletBalance)}
                  </span>
                </div>

                {/* Daily Bonus Button */}
                <div className="relative group">
                  <button
                    onClick={handleDailyClaim}
                    disabled={isClaimingDaily || nextClaimTime}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                      nextClaimTime 
                        ? 'bg-text-secondary/20 cursor-not-allowed'
                        : isClaimingDaily
                        ? 'bg-primary/20 cursor-wait'
                        : 'bg-primary/10 hover:bg-primary/20'
                    }`}
                  >
                    <span className="text-primary">🎁</span>
                    <span className="text-text-primary font-medium font-base hidden xl:inline">
                      {isClaimingDaily 
                        ? 'Claiming...' 
                        : nextClaimTime 
                        ? `Next: ${timeRemaining}`
                        : 'Daily Bonus'}
                    </span>
                    <span className="text-text-primary font-medium font-base xl:hidden">
                      {isClaimingDaily 
                        ? '...' 
                        : nextClaimTime 
                        ? timeRemaining
                        : 'Bonus'}
                    </span>
                  </button>
                  
                  {/* Streak Information Tooltip */}
                  <div className="absolute right-0 mt-2 w-64 bg-surface border border-border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 transform origin-top-right">
                    {/* Header */}
                    <div className="p-3 border-b border-border bg-primary/5">
                      <h3 className="text-lg font-semibold text-text-primary flex items-center font-heading">
                        <span className="text-primary mr-2">🔥</span>
                        Daily Streak
                      </h3>
                    </div>
                    {/* Content */}
                    <div className="p-4 space-y-4">
                      {/* Current Streak */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-text-secondary font-base">Current Streak</span>
                          <div className="h-4 w-px bg-text-secondary"></div>
                          <span className="text-primary font-bold text-lg font-mono">{currentStreak}</span>
                        </div>
                        <div className="text-xs text-text-secondary font-base">days</div>
                      </div>
                      {/* Next Bonus */}
                      <div className="bg-primary/5 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-text-secondary font-base">Next Bonus</span>
                          <span className="text-primary font-bold font-mono">
                            {Math.floor(100 * (1 + (currentStreak * 0.1)))} points
                          </span>
                        </div>
                        <div className="text-xs text-text-secondary font-base">
                          Base: 100 points + {((currentStreak * 0.1) * 100).toFixed(0)}% streak bonus
                        </div>
                      </div>
                      {/* Streak Progress */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm font-base">
                          <span className="text-text-secondary font-base">Streak Multiplier</span>
                          <span className="text-primary font-medium font-base">
                            {((1 + (currentStreak * 0.1)) * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-2 bg-text-secondary/20 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-500"
                            style={{ 
                              width: `${Math.min(((currentStreak * 0.1) * 100), 100)}%`,
                              maxWidth: '100%'
                            }}
                          ></div>
                        </div>
                        <div className="text-xs text-text-secondary text-right font-base">
                          Max multiplier: 200%
                        </div>
                      </div>
                    </div>
                    {/* Footer */}
                    <div className="p-3 border-t border-border bg-primary/5">
                      <p className="text-xs text-text-secondary font-base">
                        Claim daily to maintain your streak and increase your bonus!
                      </p>
                    </div>
                  </div>
                </div>

                {/* Profile Dropdown */}
                <div className="relative" ref={profileMenuRef}>
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="flex items-center space-x-2 focus:outline-none px-3 py-2 rounded-lg hover:bg-primary/10 transition-colors"
                  >
                    <div className="h-8 w-8 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                      {user?.avatar ? (
                        <img
                          src={getDiscordAvatarUrl(user.discordId, user.avatar)}
                          alt={user.username}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-primary text-lg font-bold font-base">{user?.username?.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <span className="text-text-primary font-medium font-base hidden lg:inline">{user?.username}</span>
                    <svg
                      className={`h-5 w-5 text-text-secondary transition-transform ${showProfileMenu ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showProfileMenu && (
                    <AnimatePresence>
                      <motion.div
                        key="profile-menu"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 16 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-surface border border-border z-50 top-full"
                      >
                        <div className="py-1">
                          <button
                            onClick={handleLogout}
                            className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-primary/10 transition-colors"
                          >
                            Sign out
                          </button>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>
                
                {/* Theme Toggle */}
                <ThemeToggle />
              </>
            )}

            {/* Mobile Navigation */}
            {screenSize.isMobile && (
              <div className="relative">
                <button
                  className="inline-flex items-center justify-center p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary transition-colors"
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  aria-label="Open menu"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                
                {/* Mobile menu dropdown with animation */}
                <AnimatePresence>
                  {showMobileMenu && (
                    <motion.div 
                      ref={mobileMenuRef} 
                      className="absolute right-0 mt-2 w-72 max-w-[90vw] rounded-lg shadow-xl bg-surface border border-border z-50 p-4 flex flex-col gap-4 top-full"
                      initial={{ opacity: 0, y: -20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                    >
                      {/* Close button */}
                      <div className="flex justify-end w-full">
                        <button
                          onClick={() => setShowMobileMenu(false)}
                          className="p-1 rounded-full hover:bg-primary/10 text-text-secondary transition-colors"
                          aria-label="Close menu"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* User info */}
                      <div className="flex items-center space-x-3 p-3 border-b border-border/20 pb-4">
                        <div className="h-12 w-12 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                          {user?.avatar ? (
                            <img
                              src={getDiscordAvatarUrl(user.discordId, user.avatar)}
                              alt={user.username}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-primary text-xl font-bold font-base">{user?.username?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-text-primary font-medium font-base truncate">{user?.username}</span>
                          <span className="text-text-secondary text-sm font-base">{user?.role || 'User'}</span>
                        </div>
                      </div>
                      
                      {/* Guild Selector */}
                      <div className="w-full">
                        <GuildSelector />  
                      </div>
                      
                      {/* Balance */}
                      <div className="flex items-center justify-between p-3 bg-surface/50 rounded-lg border border-border">
                        <span className="text-text-secondary font-base">Balance:</span>
                        <span className="text-lg font-bold text-primary font-mono">
                          {formatDisplayNumber(suppressWalletBalance ? prevWalletBalance : walletBalance)}
                        </span>
                      </div>
                      
                      {/* Daily Bonus Button */}
                      <button
                        onClick={handleDailyClaim}
                        disabled={isClaimingDaily || nextClaimTime}
                        className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors w-full ${
                          nextClaimTime 
                            ? 'bg-text-secondary/20 cursor-not-allowed'
                            : isClaimingDaily
                            ? 'bg-primary/20 cursor-wait'
                            : 'bg-primary/10 hover:bg-primary/20'
                        }`}
                      >
                        <span className="text-primary text-lg">🎁</span>
                        <span className="text-text-primary font-medium font-base">
                          {isClaimingDaily 
                            ? 'Claiming...' 
                            : nextClaimTime 
                            ? `Next: ${timeRemaining}`
                            : 'Daily Bonus'}
                        </span>
                      </button>
                      
                      {/* Theme Toggle */}
                      <div className="flex justify-between items-center p-2">
                        <span className="text-text-secondary font-base">Theme</span>
                        <ThemeToggle />
                      </div>
                      
                      {/* Sign out button */}
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-3 text-sm text-text-primary hover:bg-primary/10 transition-colors rounded-lg flex items-center space-x-2"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>Sign out</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};