import React, { useState, useEffect, useRef, lazy, Suspense, useMemo } from 'react';
import { format, subDays, startOfDay, endOfDay, isValid, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { FixedSizeList as List } from 'react-window';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Checkbox } from '../components/Checkbox';
import { useUserSearch } from '../hooks/useQueryHooks';
import LoadingSpinner from '../components/LoadingSpinner';
import { useUserStore, useGuildStore } from '../store';
import { useLoading } from '../hooks/useLoading';

// Lazy load chart components
const BalanceHistoryGraph = lazy(() => import('../components/charts/BalanceHistoryGraph'));
const GamblingPerformancePieChart = lazy(() => import('../components/charts/GamblingPerformancePieChart'));
const GameTypeDistributionChart = lazy(() => import('../components/charts/GameTypeDistributionChart'));
const TransactionTypeAnalysisChart = lazy(() => import('../components/charts/TransactionTypeAnalysisChart'));
const GameComparisonMatrixChart = lazy(() => import('../components/charts/GameComparisonMatrixChart'));

// Lazy load new chart components
const TimeOfDayHeatmapChart = lazy(() => import('../components/charts/TimeOfDayHeatmapChart'));
const DailyProfitLossChart = lazy(() => import('../components/charts/DailyProfitLossChart'));
const TopGamesByProfitChart = lazy(() => import('../components/charts/TopGamesByProfitChart'));
const RiskScoreTrendChart = lazy(() => import('../components/charts/RiskScoreTrendChart'));
const FavoriteGameTrendChart = lazy(() => import('../components/charts/FavoriteGameTrendChart'));

// Chart descriptions
const chartDescriptions = {
  'balance-history': 'Track your balance changes over time with interactive zoom and pan controls.',
  'gambling-performance': 'Analyze your win/loss ratio with a detailed breakdown of gambling outcomes.',
  'game-distribution': 'See which games you play the most with a horizontal bar chart visualization.',
  'transaction-analysis': 'View your transaction patterns with a stacked area chart showing different transaction types.',
  'game-comparison': 'Compare your performance across different games using a Dual-Axis Line + Bar Chart.',
  'time-of-day-heatmap': 'Discover when you are most active with a heatmap showing activity by day of week and hour of day.',
  'daily-profit-loss': 'Track your daily gambling profits and losses over time to identify winning and losing streaks.',
  'top-games-profit': 'See which games are most profitable for you with a ranking of net profit by game type.',
  'risk-score-trend': 'Monitor how your risk-taking behavior changes over time based on bet size relative to balance.',
  'favorite-game-trend': 'Track how your game preferences change over time with a trend of most played games.',
};

// Tab configuration
const tabs = [
  {
    id: 'balance-history',
    name: 'Balance History',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
      </svg>
    ),
    component: BalanceHistoryGraph
  },
  {
    id: 'gambling-performance',
    name: 'Performance',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
        <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
      </svg>
    ),
    component: GamblingPerformancePieChart
  },
  {
    id: 'game-distribution',
    name: 'Game Types',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
        <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
      </svg>
    ),
    component: GameTypeDistributionChart
  },
  {
    id: 'transaction-analysis',
    name: 'Transactions',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
    component: TransactionTypeAnalysisChart
  },
  {
    id: 'game-comparison',
    name: 'Comparison',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm9 4a1 1 0 10-2 0v6a1 1 0 102 0V7zm-3 2a1 1 0 10-2 0v4a1 1 0 102 0V9zm-3 3a1 1 0 10-2 0v1a1 1 0 102 0v-1z" clipRule="evenodd" />
      </svg>
    ),
    component: GameComparisonMatrixChart
  },
  {
    id: 'time-of-day-heatmap',
    name: 'Activity Heatmap',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
      </svg>
    ),
    component: TimeOfDayHeatmapChart
  },
  {
    id: 'daily-profit-loss',
    name: 'Daily P&L',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
        <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
      </svg>
    ),
    component: DailyProfitLossChart
  },
  {
    id: 'top-games-profit',
    name: 'Best Games',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
      </svg>
    ),
    component: TopGamesByProfitChart
  },
  {
    id: 'risk-score-trend',
    name: 'Risk Score',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
    component: RiskScoreTrendChart
  },
  {
    id: 'favorite-game-trend',
    name: 'Game Trends',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
      </svg>
    ),
    component: FavoriteGameTrendChart
  },
];

export const StatisticsDashboard = () => {
  const { startLoading, stopLoading, setError, isLoading, getError } = useLoading();
  const { selectedGuildId, isGuildSwitching } = useGuildStore();
  const { user } = useUserStore();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Parse URL parameters
  const queryParams = new URLSearchParams(location.search);
  const rangeParam = queryParams.get('range') || '7days';
  const startParam = queryParams.get('start') || format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const endParam = queryParams.get('end') || format(new Date(), 'yyyy-MM-dd');
  const userParam = queryParams.get('user') || '';
  const tabParam = queryParams.get('tab') || 'balance-history';
  const archivedParam = queryParams.get('archived') === 'true';
  
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [dateRange, setDateRange] = useState(rangeParam);
  const [customStartDate, setCustomStartDate] = useState(startParam);
  const [customEndDate, setCustomEndDate] = useState(endParam);
  const [activeTab, setActiveTab] = useState(tabParam);
  
  // User selection state
  const [selectedUser, setSelectedUser] = useState(null);
  const [userSearch, setUserSearch] = useState(userParam);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState([]);
  // const [searchLoading, setSearchLoading] = useState(false);
  const inputRef = useRef(null);

  // Date range options
  const dateRangeOptions = [
    { id: '7days', name: 'Last 7 Days' },
    { id: '30days', name: 'Last 30 Days' },
    { id: '90days', name: 'Last 90 Days' },
    { id: 'custom', name: 'Custom Range' }
  ];

  // Show archived data state
  const [showArchived, setShowArchived] = useState(archivedParam);
  // Date dropdown state
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  // Handle window resize for responsiveness
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close date dropdown on outside click
  useEffect(() => {
    if (!showDateDropdown) return;
    const handleClick = (e) => {
      const dropdown = document.getElementById('date-range-dropdown');
      if (dropdown && !dropdown.contains(e.target)) {
        setShowDateDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDateDropdown]);

  // Get actual date range based on selection, with pre-validation
  const computedDateRange = useMemo(() => {
    const today = new Date();
    let start, end;
    switch(dateRange) {
      case '7days':
        start = startOfDay(subDays(today, 7));
        end = endOfDay(today);
        break;
      case '30days':
        start = startOfDay(subDays(today, 30));
        end = endOfDay(today);
        break;
      case '90days':
        start = startOfDay(subDays(today, 90));
        end = endOfDay(today);
        break;
      case 'custom':
        if (customStartDate && customEndDate && isValid(parseISO(customStartDate)) && isValid(parseISO(customEndDate))) {
          start = startOfDay(parseISO(customStartDate));
          end = endOfDay(parseISO(customEndDate));
        } else {
          start = startOfDay(subDays(today, 7));
          end = endOfDay(today);
        }
        break;
      default:
        start = startOfDay(subDays(today, 7));
        end = endOfDay(today);
    }
    return { startDate: format(start, 'yyyy-MM-dd'), endDate: format(end, 'yyyy-MM-dd') };
  }, [dateRange, customStartDate, customEndDate]);

  // User search using React Query with LoadingContext integration
  const {
    data: searchResults,
    isLoading: searchLoading,
    isFetching: isSearchFetching,
    error: searchError
  } = useUserSearch(userSearch, {
    staleTime: 30000, // 30 seconds
    cacheTime: 300000, // 5 minutes
    refetchOnWindowFocus: false
  });
  
  // Update loading state for user search
  useEffect(() => {
    if (searchLoading || isSearchFetching) {
      startLoading(LOADING_KEYS.USER_SEARCH);
    } else {
      stopLoading(LOADING_KEYS.USER_SEARCH);
      if (searchError) {
        setError(LOADING_KEYS.USER_SEARCH, searchError);
      }
    }
  }, [searchLoading, isSearchFetching, searchError, startLoading, stopLoading, setError]);

  // Update filtered users when search results change
  useEffect(() => {
    if (searchResults?.data) {
      setFilteredUsers(searchResults.data || []);
    } else {
      setFilteredUsers([]);
    }
  }, [searchResults]);

  // Show/hide dropdown based on search length
  useEffect(() => {
    if (userSearch.length < 2) {
      setFilteredUsers([]);
      setShowUserDropdown(false);
      setSelectedUser(null);
      return;
    }
    
    // Show dropdown when search is valid
    setShowUserDropdown(true);
  }, [userSearch]);

  const handleSuggestionSelect = (u) => {
    setUserSearch(u.username);
    setShowUserDropdown(false);
    setSelectedUser(u);
    
    // Update URL with selected user
    const params = new URLSearchParams(location.search);
    params.set('user', u.discordId);
    navigate(`${location.pathname}?${params.toString()}`);
  };

  const handleClearSearch = () => {
    setUserSearch('');
    setSelectedUser(null);
    setShowUserDropdown(false);
    
    // Remove user from URL
    const params = new URLSearchParams(location.search);
    params.delete('user');
    navigate(`${location.pathname}?${params.toString()}`);
  };

  // Initialize selected user from URL param
  useEffect(() => {
    if (userParam && user?.discordId) {
      if (userParam === user.discordId) {
        setSelectedUser(user);
        setUserSearch(user.username);
      } else {
        setUserSearch(userParam);
      }
    }
  }, [userParam, user]);

  // Handle tab change
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    const params = new URLSearchParams(location.search);
    params.set('tab', tabId);
    navigate(`${location.pathname}?${params.toString()}`);
  };

  const isLargeScreen = windowWidth >= 1024; // lg breakpoint
  const canViewOtherUsers = user && (user.role === 'admin' || user.role === 'superadmin');
  const targetUser = selectedUser || user;

  // Compute the guildId to use
  const computedGuildId = showArchived ? `archived_${selectedGuildId}` : selectedGuildId;

  // Ref for tab container
  const tabsRef = useRef(null);

  // Define loading keys
  const LOADING_KEYS = {
    USER_SEARCH: 'statistics-user-search',
    CHART_DATA: 'statistics-chart-data'
  };

  // Loading fallback component
  const LoadingFallback = () => (
    <div className="flex justify-center items-center h-80">
      <LoadingSpinner size="lg" color="primary" message="Loading chart data..." />
    </div>
  );
  
  // When toggling showArchived, update URL param
  const handleToggleArchived = () => {
    setShowArchived((prev) => {
      const newValue = !prev;
      const params = new URLSearchParams(location.search);
      if (newValue) {
        params.set('archived', 'true');
      } else {
        params.delete('archived');
      }
      navigate(`${location.pathname}?${params.toString()}`);
      return newValue;
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight font-display">Statistics Dashboard</h1>
      
      {/* Controls Section */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* User Selection */}
        {canViewOtherUsers && (
          <motion.div 
            className="bg-card rounded-lg shadow border border-border z-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="bg-card-secondary p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary flex items-center font-heading">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
                User Selection
              </h2>
            </div>
            <div className="p-4">
              <div className="flex gap-2 items-center justify-center relative">
                <div className="w-full relative">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search by username..."
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    autoComplete="off"
                    className="px-3 py-2 border border-border rounded-md bg-background text-sm w-full font-base"
                    onBlur={() => setShowUserDropdown(false)}
                    onFocus={() => userSearch.length >= 2 && setShowUserDropdown(true)}
                  />
                  {userSearch && (
                    <button 
                      type="button" 
                      onClick={handleClearSearch}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                      disabled={isLoading(LOADING_KEYS.USER_SEARCH)}
                    >
                      {isLoading(LOADING_KEYS.USER_SEARCH) ? (
                        <LoadingSpinner size="xs" color="primary" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  )}
                  {showUserDropdown && filteredUsers.length > 0 && (
                    <motion.div
                      className="absolute z-[9999] bg-card border border-border rounded-md mt-1 shadow-lg w-full"
                      style={{
                        top: '100%',
                        left: 0,
                        right: 0,
                        maxHeight: 192,
                        overflow: 'hidden',
                        height: filteredUsers.length <= 4 ? filteredUsers.length * 44 : 192
                      }}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.18 }}
                    >
                      <List
                        height={filteredUsers.length <= 4 ? filteredUsers.length * 44 : 192}
                        itemCount={filteredUsers.length}
                        itemSize={44}
                        width={'100%'}
                      >
                        {({ index, style }) => {
                          const u = filteredUsers[index];
                          return (
                            <div
                              key={u.discordId}
                              style={style}
                              className="px-4 py-2 cursor-pointer hover:bg-primary/10 text-text-primary font-accent flex items-center"
                              onMouseDown={() => handleSuggestionSelect(u)}
                            >
                              {u.username}
                              <span className="text-xs text-text-tertiary font-mono ml-2">({u.discordId})</span>
                            </div>
                          );
                        }}
                      </List>
                    </motion.div>
                  )}
                </div>
              </div>
              {targetUser && (
                <div className="mt-3 pt-3 border-t border-border text-sm text-text-secondary">
                  <p className="flex items-center font-base">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-primary" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    Viewing: <span className="font-medium text-text-primary ml-1 font-accent">{targetUser.username}</span>
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Date Range Selection */}
        <motion.div 
          className="bg-card rounded-lg shadow border border-border z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="bg-card-secondary p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary flex items-center font-heading">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              Date Range
            </h2>
          </div>
          <div className="p-4">
            <div className="relative">
              <button
                type="button"
                className="w-full rounded-md shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-card text-text-primary py-3 px-4 border border-border appearance-none font-base flex items-center justify-between"
                onClick={() => setShowDateDropdown(v => !v)}
                aria-haspopup="listbox"
                aria-expanded={showDateDropdown}
                id="date-range-dropdown"
              >
                {dateRangeOptions.find(option => option.id === dateRange)?.name}
                <svg className={`ml-2 h-4 w-4 transition-transform ${showDateDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              <AnimatePresence>
                {showDateDropdown && (
                  <motion.ul
                    className="absolute left-0 right-0 z-[9999] bg-card border border-border rounded-md mt-1 shadow-xl overflow-hidden"
                    style={{ top: '100%' }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.18 }}
                  >
                    {dateRangeOptions.map(option => (
                      <li
                        key={option.id}
                        className={`px-4 py-3 cursor-pointer font-base transition-colors duration-100 ${dateRange === option.id ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-primary/5 text-text-primary'}`}
                        onClick={() => {
                          setDateRange(option.id);
                          setShowDateDropdown(false);
                          const params = new URLSearchParams(location.search);
                          params.set('range', option.id);
                          if (option.id === 'custom') {
                            params.set('start', customStartDate);
                            params.set('end', customEndDate);
                          } else {
                            params.delete('start');
                            params.delete('end');
                          }
                          navigate(`${location.pathname}?${params.toString()}`);
                        }}
                      >
                        {option.name}
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
            {/* Custom Range Date Pickers */}
            {dateRange === 'custom' && !showDateDropdown && (
              <div className="flex gap-2 mt-3 items-center">
                <DatePicker
                  selected={customStartDate ? new Date(customStartDate) : null}
                  onChange={date => {
                    if (date) setCustomStartDate(format(date, 'yyyy-MM-dd'));
                  }}
                  selectsStart
                  startDate={customStartDate ? new Date(customStartDate) : null}
                  endDate={customEndDate ? new Date(customEndDate) : null}
                  maxDate={customEndDate ? new Date(customEndDate) : new Date()}
                  dateFormat="yyyy-MM-dd"
                  className="border border-border rounded-md px-3 py-2 bg-background text-sm font-base w-36"
                  placeholderText="Start date"
                  popperPlacement="bottom-start"
                />
                <span className="self-center text-text-secondary">to</span>
                <DatePicker
                  selected={customEndDate ? new Date(customEndDate) : null}
                  onChange={date => {
                    if (date) setCustomEndDate(format(date, 'yyyy-MM-dd'));
                  }}
                  selectsEnd
                  startDate={customStartDate ? new Date(customStartDate) : null}
                  endDate={customEndDate ? new Date(customEndDate) : null}
                  minDate={customStartDate ? new Date(customStartDate) : null}
                  maxDate={new Date()}
                  dateFormat="yyyy-MM-dd"
                  className="border border-border rounded-md px-3 py-2 bg-background text-sm font-base w-36"
                  placeholderText="End date"
                  popperPlacement="bottom-end"
                />
              </div>
            )}
          </div>
        </motion.div>

        {/* Show Archived Data Toggle */}
        <div className="flex items-center gap-2 mt-4 font-base">
          <Checkbox
            checked={showArchived}
            onCheckedChange={handleToggleArchived}
            label="Show Archived Data"
          />
        </div>

      </div>

      {/* Chart Section */}
      <motion.div 
        className="bg-card rounded-lg shadow-lg z-0"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        {/* Tab Navigation */}
        {isLargeScreen ? (
          <div className="bg-card-secondary border-b border-border">
            <div className="relative">
              <div className="flex items-center">
                {/* Left scroll button */}
                <button 
                  className="flex-none px-2 py-4 text-text-secondary hover:text-primary transition-colors duration-200 z-10 bg-card-secondary bg-opacity-90 rounded-r shadow-sm"
                  onClick={() => {
                    if (tabsRef.current) {
                      tabsRef.current.scrollBy({ left: -200, behavior: 'smooth' });
                    }
                  }}
                  aria-label="Scroll tabs left"
                  title="Scroll left"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                
                {/* Scrollable tabs */}
                <nav className="flex-1 overflow-x-auto scrollbar-hide tabs-container" aria-label="Tabs" ref={tabsRef}>
                  <div className="flex px-4 min-w-full pb-1">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={`
                          ${activeTab === tab.id
                            ? 'border-primary text-primary'
                            : 'border-transparent text-text-secondary hover:text-text-primary hover:border-text-secondary'
                          }
                          flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-colors duration-200 whitespace-nowrap mr-4 last:mr-0
                        `}
                      >
                        <span className="mr-2">{tab.icon}</span>
                        {tab.name}
                      </button>
                    ))}
                  </div>
                </nav>
                
                {/* Right scroll button */}
                <button 
                  className="flex-none px-2 py-4 text-text-secondary hover:text-primary transition-colors duration-200 z-10 bg-card-secondary bg-opacity-90 rounded-l shadow-sm"
                  onClick={() => {
                    if (tabsRef.current) {
                      tabsRef.current.scrollBy({ left: 200, behavior: 'smooth' });
                    }
                  }}
                  aria-label="Scroll tabs right"
                  title="Scroll right"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card-secondary to-transparent pointer-events-none"></div>
            </div>
          </div>
        ) : (
          <div className="bg-card-secondary border-b border-border p-4">
            <select
              value={activeTab}
              onChange={(e) => handleTabChange(e.target.value)}
              className="block w-full rounded-md shadow-sm focus:border-primary focus:ring-primary
                      bg-card text-text-primary py-2 px-3 border border-border text-sm font-base"
            >
              {tabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Chart Description */}
        <div className="px-6 py-3 bg-card-secondary border-b border-border">
          <p className="text-sm text-text-secondary font-base">
            {chartDescriptions[activeTab]}
          </p>
        </div>

        {/* Chart Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Suspense fallback={<LoadingFallback />}>
                {(() => {
                  const ActiveChart = tabs.find(tab => tab.id === activeTab)?.component;
                  if (activeTab === 'balance-history') {
                    return (
                      <BalanceHistoryGraph
                        dateRange={computedDateRange}
                        targetUserId={targetUser?.discordId}
                        guildId={computedGuildId}
                      />
                    );
                  }
                  return ActiveChart ? (
                    <ActiveChart
                      dateRange={computedDateRange}
                      targetUserId={targetUser?.discordId}
                      guildId={computedGuildId}
                    />
                  ) : null;
                })()}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default StatisticsDashboard;