import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { setupWebSocket } from '../services/api'; // Import setupWebSocket
import { useDashboard } from '../contexts/DashboardContext';

// --- TEMP: Main Guild ID for single-guild mode ---
// TODO: Replace with dynamic guild selection for multi-guild support
const MAIN_GUILD_ID = process.env.REACT_APP_MAIN_GUILD_ID;

export const DashboardNavigation = ({ walletBalance, setWalletBalance, onProfileMenuToggle }) => { // Accept walletBalance, setWalletBalance, and onProfileMenuToggle as props
  const { user, logout } = useAuth();
  const { suppressWalletBalance, prevWalletBalance } = useDashboard();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false); // For burger menu
  const [isClaimingDaily, setIsClaimingDaily] = useState(false);
  const [nextClaimTime, setNextClaimTime] = useState(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState('');
  const profileMenuRef = useRef(null);
  const wsRef = useRef(null);
  const mobileMenuRef = useRef(null); // Ref for mobile dropdown
  
  // Detect if screen is small (mobile)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
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
    
    if (diff <= 0) return 'Available now';
    
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

  // Update time remaining every second
  useEffect(() => {
    if (!nextClaimTime) return;
    
    const timer = setInterval(() => {
      const now = new Date().getTime();
      if (now >= nextClaimTime) {
        setNextClaimTime(null);
        setTimeRemaining('Available now');
      } else {
        setTimeRemaining(formatTimeRemaining(nextClaimTime));
      }
    }, 1000); // Update every second
    
    return () => clearInterval(timer);
  }, [nextClaimTime]);

  // Fetch daily bonus status (make available to both useEffect and handleDailyClaim)
  const fetchDailyStatus = async () => {
    if (!user?.discordId) return null;
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/users/${user.discordId}/daily-status`,
        {
          params: { guildId: MAIN_GUILD_ID },
          headers: { 'x-guild-id': MAIN_GUILD_ID }
        }
      );
      const { nextClaimTime: nextTime, currentStreak: streak } = response.data;
      setNextClaimTime(nextTime);
      setCurrentStreak(streak);
      setTimeRemaining(formatTimeRemaining(nextTime));
      return { nextClaimTime: nextTime, currentStreak: streak };
    } catch (error) {
      // If there's an error, assume the bonus is available
      setNextClaimTime(null);
      return { nextClaimTime: null, currentStreak };
    }
  };

  // Fetch daily bonus status on component mount or user change
  useEffect(() => {
    fetchDailyStatus();
  }, [user]);

  // Setup WebSocket connection for balance updates
  useEffect(() => {
    if (!user?.discordId || wsRef.current) return; // Prevent multiple connections

    const handleWebSocketMessage = (data) => {
      switch (data.type) {
        case 'BALANCE_UPDATE':
          setWalletBalance(data.balance); // Update balance state passed as prop
          break;
        // TODO: Handle other relevant WebSocket messages if needed in the navigation context
        default:
          // // console.log('Unknown message type in DashboardNavigation WS:', data.type); // Keep this for debugging if necessary
          break;
      }
    };

    wsRef.current = setupWebSocket(handleWebSocketMessage, user.discordId);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null; // Clean up ref on disconnect
      }
    };
  }, [user, setWalletBalance]); // Depend on user and setWalletBalance

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

  const handleDailyClaim = async () => {
    if (isClaimingDaily || nextClaimTime) return;
    
    setIsClaimingDaily(true);
    let prevStreak = currentStreak;
    let prevNextClaimTime = nextClaimTime;
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/users/${user.discordId}/daily`,
        { guildId: MAIN_GUILD_ID },
        { headers: { 'x-guild-id': MAIN_GUILD_ID } }
      );
      const { amount, streak, nextClaimTime: nextTime } = response.data;
      toast.success(`Claimed ${amount} points! (${streak} day streak)`);
      // Re-fetch daily status to update streak and timer
      await fetchDailyStatus();
    } catch (error) {
      console.error('Daily bonus error:', error.response?.data || error);
      // Always re-fetch status after error and get the new values
      const newStatus = await fetchDailyStatus();
      // Check if the status actually changed (bonus claimed)
      if (newStatus && (newStatus.nextClaimTime !== prevNextClaimTime || newStatus.currentStreak > prevStreak)) {
        toast.success('Daily bonus claimed!');
      } else if (error.response?.data?.nextClaimTime) {
        const nextTime = error.response.data.nextClaimTime;
        setNextClaimTime(nextTime);
        setTimeRemaining(formatTimeRemaining(nextTime));
        toast.error(`You can claim your next daily bonus in ${timeRemaining}`); // Note: timeRemaining might be slightly out of sync here
      } else {
        toast.error('Failed to claim daily bonus. Please try again later.');
      }
    } finally {
      setIsClaimingDaily(false);
    }
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
    <nav className="bg-background/80 backdrop-blur-md border-b border-border fixed top-0 left-0 right-0 z-50 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-row justify-between h-auto sm:h-16 items-center gap-2 sm:gap-0 py-2 sm:py-0">
          <div className="flex items-center mb-2 sm:mb-0">
            {/* Logo - Link to Home */}
            <Link to="/" className="flex items-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"> {/* Adjusted link to landing page */}
                Gambling Bot
              </h1>
            </Link>
          </div>
          {/* Desktop nav */}
          {!isMobile && (
            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-6 w-full sm:w-auto">
              {/* Balance Display - Use suppression logic */}
              <div className="flex items-center space-x-2">
                <span className="text-text-secondary">Balance:</span>
                <span className="text-lg font-bold text-primary">{(suppressWalletBalance ? prevWalletBalance : walletBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {/* Daily Bonus Button */}
              <div className="relative group w-full sm:w-auto">
                <button 
                  onClick={handleDailyClaim}
                  disabled={isClaimingDaily || nextClaimTime}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    nextClaimTime 
                      ? 'bg-gray-500/10 cursor-not-allowed'
                      : isClaimingDaily
                      ? 'bg-primary/20 cursor-wait'
                      : 'bg-primary/10 hover:bg-primary/20'
                  }`}
                >
                  <span className="text-primary">🎁</span>
                  <span className="text-text-primary font-medium">
                    {isClaimingDaily 
                      ? 'Claiming...' 
                      : nextClaimTime 
                      ? `Next: ${timeRemaining}`
                      : 'Daily Bonus'}
                  </span>
                </button>
                {/* Streak Information Tooltip */}
                <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 transform origin-top-right">
                  {/* Header */}
                  <div className="p-3 border-b border-border bg-primary/5">
                    <h3 className="text-lg font-semibold text-text-primary flex items-center">
                      <span className="text-primary mr-2">🔥</span>
                      Daily Streak
                    </h3>
                  </div>
                  {/* Content */}
                  <div className="p-4 space-y-4">
                    {/* Current Streak */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-text-secondary">Current Streak</span>
                        <div className="h-4 w-px bg-border"></div>
                        <span className="text-primary font-bold text-lg">{currentStreak}</span>
                      </div>
                      <div className="text-xs text-text-secondary">days</div>
                    </div>
                    {/* Next Bonus */}
                    <div className="bg-primary/5 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-text-secondary">Next Bonus</span>
                        <span className="text-primary font-bold">
                          {Math.floor(100 * (1 + (currentStreak * 0.1)))} points
                        </span>
                      </div>
                      <div className="text-xs text-text-secondary">
                        Base: 100 points + {((currentStreak * 0.1) * 100).toFixed(0)}% streak bonus
                      </div>
                    </div>
                    {/* Streak Progress */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-text-secondary">Streak Multiplier</span>
                        <span className="text-primary font-medium">
                          {((1 + (currentStreak * 0.1)) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 bg-border rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-500"
                          style={{ 
                            width: `${Math.min(((currentStreak * 0.1) * 100), 100)}%`,
                            maxWidth: '100%'
                          }}
                        ></div>
                      </div>
                      <div className="text-xs text-text-secondary text-right">
                        Max multiplier: 200%
                      </div>
                    </div>
                  </div>
                  {/* Footer */}
                  <div className="p-3 border-t border-border bg-primary/5">
                    <p className="text-xs text-text-secondary">
                      Claim daily to maintain your streak and increase your bonus!
                    </p>
                  </div>
                </div>
              </div>
              {/* Profile Dropdown */}
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center space-x-2 focus:outline-none px-3 py-2 rounded hover:bg-primary/10 transition-colors"
                >
                  <div className="h-8 w-8 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                    {user?.avatar ? (
                      <img
                        src={getDiscordAvatarUrl(user.discordId, user.avatar)}
                        alt={user.username}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-primary text-lg font-bold">{user?.username?.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <span className="text-text-primary font-medium">{user?.username}</span>
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
                  <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-card border border-border z-50">
                    <div className="py-1">
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-primary/10 transition-colors"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Mobile nav: burger menu */}
          {isMobile && (
            <div className="relative w-full flex justify-end">
              <button
                className="inline-flex items-center justify-center p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                aria-label="Open menu"
              >
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {showMobileMenu && (
                <div ref={mobileMenuRef} className="absolute right-0 mt-2 w-56 rounded-lg shadow-xl bg-card border border-border z-50 p-4 flex flex-col gap-4">
                  {/* Balance */}
                  <div className="flex items-center space-x-2">
                    <span className="text-text-secondary">Balance:</span>
                    <span className="text-lg font-bold text-primary">{(suppressWalletBalance ? prevWalletBalance : walletBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {/* Daily Bonus Button */}
                  <button 
                    onClick={handleDailyClaim}
                    disabled={isClaimingDaily || nextClaimTime}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                      nextClaimTime 
                        ? 'bg-gray-500/10 cursor-not-allowed'
                        : isClaimingDaily
                        ? 'bg-primary/20 cursor-wait'
                        : 'bg-primary/10 hover:bg-primary/20'
                    }`}
                  >
                    <span className="text-primary">🎁</span>
                    <span className="text-text-primary font-medium">
                      {isClaimingDaily 
                        ? 'Claiming...' 
                        : nextClaimTime 
                        ? `Next: ${timeRemaining}`
                        : 'Daily Bonus'}
                    </span>
                  </button>
                  {/* Profile Dropdown (as a button) */}
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="flex items-center space-x-2 focus:outline-none px-3 py-2 rounded hover:bg-primary/10 transition-colors"
                  >
                    <div className="h-8 w-8 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                      {user?.avatar ? (
                        <img
                          src={getDiscordAvatarUrl(user.discordId, user.avatar)}
                          alt={user.username}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-primary text-lg font-bold">{user?.username?.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <span className="text-text-primary font-medium">{user?.username}</span>
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
                    <div className="w-full rounded-md shadow-lg bg-card border border-border z-50 mt-2">
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-primary/10 transition-colors"
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}; 