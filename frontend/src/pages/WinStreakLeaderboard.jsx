import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/20/solid';
import ReactPaginate from 'react-paginate';
import { motion, AnimatePresence } from 'framer-motion';
import { useWinStreakLeaderboard, useUserPreferences } from '../hooks/useQueryHooks';
import LoadingSpinner from '../components/LoadingSpinner';
import { useUserStore, useGuildStore } from '../store';
import { useLoading } from '../hooks/useLoading';


const SORT_OPTIONS = [
  { value: 'max', label: 'Max Streak' },
  { value: 'current', label: 'Current Streak' },
  { value: 'alpha', label: 'Player (A-Z)' },
];

export const WinStreakLeaderboard = () => {
  const user = useUserStore(state => state.user);
  const [sortBy, setSortBy] = useState('max');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [page, setPage] = useState(1);
  const sortMenuRef = useRef(null);
  
  // Define loading keys
  const LOADING_KEYS = {
    PREFERENCES: 'win-streak-preferences',
    LEADERBOARD: 'win-streak-leaderboard',
    GUILD_SWITCHING: 'win-streak-guild-switching'
  };
  
  // Get loading context
  const { isLoading, startLoading, stopLoading, setError, getError } = useLoading();
  
  // Use React Query hooks
  const { data: userPreferencesData, isLoading: preferencesLoading, error: preferencesError } = useUserPreferences(user?.discordId);
  const userPreferences = userPreferencesData || { itemsPerPage: 10 }; // Default to 10 items per page
  
  const { 
    data: leaderboardData, 
    isLoading: leaderboardLoading, 
    error: leaderboardError 
  } = useWinStreakLeaderboard(
    page, 
    userPreferences.itemsPerPage, 
    sortBy, 
    sortOrder
  );
  
  // Get guild switching state
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  
  // Update loading states in LoadingContext
  useEffect(() => {
    if (preferencesLoading) {
      startLoading(LOADING_KEYS.PREFERENCES);
    } else {
      stopLoading(LOADING_KEYS.PREFERENCES);
      if (preferencesError) {
        setError(LOADING_KEYS.PREFERENCES, preferencesError);
      }
    }
  }, [preferencesLoading, preferencesError, startLoading, stopLoading, setError]);
  
  useEffect(() => {
    if (leaderboardLoading) {
      startLoading(LOADING_KEYS.LEADERBOARD);
    } else {
      stopLoading(LOADING_KEYS.LEADERBOARD);
      if (leaderboardError) {
        setError(LOADING_KEYS.LEADERBOARD, leaderboardError);
      }
    }
  }, [leaderboardLoading, leaderboardError, startLoading, stopLoading, setError]);
  
  useEffect(() => {
    if (isGuildSwitching) {
      startLoading(LOADING_KEYS.GUILD_SWITCHING);
    } else {
      stopLoading(LOADING_KEYS.GUILD_SWITCHING);
    }
  }, [isGuildSwitching, startLoading, stopLoading]);
  
  // Derived state from React Query
  const leaderboard = leaderboardData?.data || [];
  const totalCount = leaderboardData?.totalCount || 0;
  const loading = isLoading(LOADING_KEYS.PREFERENCES) || isLoading(LOADING_KEYS.LEADERBOARD) || isLoading(LOADING_KEYS.GUILD_SWITCHING);
  const error = getError(LOADING_KEYS.LEADERBOARD) || getError(LOADING_KEYS.PREFERENCES);

  useEffect(() => {
    if (!showSortMenu) return;
    function handleClickOutside(event) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target)) {
        setShowSortMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSortMenu]);

  const handleSortChange = (value) => {
    if (sortBy === value) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(value);
      setSortOrder(value === 'alpha' ? 'asc' : 'desc');
    }
    setShowSortMenu(false);
  };

  const totalPages = userPreferences ? Math.ceil(totalCount / userPreferences.itemsPerPage) : 1;

  // react-paginate expects 0-based page index
  const handlePageChange = (selectedItem) => {
    setPage(selectedItem.selected + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" color="primary" message="Loading win streak leaderboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card p-6 rounded-lg shadow-lg max-w-lg w-full">
          <h2 className="text-2xl font-bold text-text-primary mb-4">Error Loading Win Streak Leaderboard</h2>
          <div className="bg-error/10 border border-error/30 rounded-md p-4 mb-6">
            <p className="text-error font-medium">{error.message || 'Failed to load win streak leaderboard data'}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-md"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="max-w-3xl mx-auto px-2 sm:px-6 lg:px-8 py-8 w-full"
    >
      <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight text-center font-display">Win Streak Leaderboard</h1>
      <div className="flex flex-col sm:flex-row sm:justify-end gap-4 mb-6 w-full">
        <div className="relative w-full sm:w-44 flex-shrink-0" ref={sortMenuRef}>
          <motion.button
            type="button"
            className="flex items-center justify-between w-full px-3 py-1 rounded-lg bg-surface border border-border text-text-primary hover:bg-primary/10 transition-colors text-sm font-medium shadow-sm font-base"
            onClick={() => setShowSortMenu((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={showSortMenu}
            whileHover={{ scale: 1.05, boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)', y: -2 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
          >
            <span>Sort by: {SORT_OPTIONS.find(opt => opt.value === sortBy)?.label}</span>
            {sortOrder === 'asc' ? (
              <ChevronUpIcon className="h-5 w-5 text-text-secondary ml-2" aria-hidden="true" />
            ) : (
              <ChevronDownIcon className="h-5 w-5 text-text-secondary ml-2" aria-hidden="true" />
            )}
          </motion.button>
          <AnimatePresence>
            {showSortMenu && (
              <motion.div 
                className="absolute z-50 mt-1 w-full rounded-lg bg-card border border-border py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none text-left"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
              >
                {SORT_OPTIONS.map(opt => (
                  <motion.button
                    key={opt.value}
                    onClick={() => handleSortChange(opt.value)}
                    className={`w-full flex items-center justify-between px-4 py-2 text-sm rounded transition-colors text-left font-base
                      ${sortBy === opt.value ? 'bg-primary/10 text-primary font-semibold' : 'text-text-primary hover:bg-primary/5'}
                    `}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    <span>{opt.label}</span>
                    {sortBy === opt.value && (
                      sortOrder === 'asc' ? <ChevronUpIcon className="h-4 w-4 ml-2" /> : <ChevronDownIcon className="h-4 w-4 ml-2" />
                    )}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="bg-card rounded-lg shadow-lg overflow-x-auto w-full">
        <div className="min-w-[400px] sm:min-w-full overflow-auto scrollbar-hide">
          <table className="min-w-full divide-y divide-border text-xs sm:text-sm">
            <thead className="bg-card">
              <tr>
                <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-base">#</th>
                <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-base">Player</th>
                <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-base">Max Streak</th>
                <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-base">Current Streak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border" key={page}>
              <AnimatePresence initial={false}>
                {leaderboard.length > 0 ? (
                  leaderboard.map((player, index) => (
                    <motion.tr
                      key={player.discordId || index}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 16 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className={`hover:bg-primary/5 ${player.discordId === user?.discordId ? 'bg-primary/20' : ''}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary tracking-wide text-center font-base">{(page - 1) * (userPreferences?.itemsPerPage || 10) + index + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary tracking-wide text-center font-option">{player.username}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary tracking-wide text-center font-mono">{player.maxWinStreak}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-yellow-500 tracking-wide text-center font-mono">{player.currentWinStreak}</td>
                    </motion.tr>
                  ))
                ) : (
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <td colSpan="4" className="px-6 py-4 text-center text-sm text-text-secondary font-base">No players found.</td>
                  </motion.tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      {totalPages > 1 && !loading && !error && (
        <div className="flex flex-wrap justify-center mt-6 w-full">
          <ReactPaginate
            previousLabel={"Prev"}
            nextLabel={"Next"}
            breakLabel={"..."}
            breakClassName={"px-2 py-1"}
            pageCount={totalPages}
            marginPagesDisplayed={1}
            pageRangeDisplayed={3}
            onPageChange={handlePageChange}
            forcePage={page - 1}
            containerClassName={"flex flex-wrap gap-1 items-center"}
            pageClassName={""}
            pageLinkClassName={"px-2 py-1 rounded bg-card text-text-secondary hover:bg-primary/10"}
            activeClassName={""}
            activeLinkClassName={"bg-primary text-white"}
            previousClassName={""}
            previousLinkClassName={"px-3 py-1 rounded bg-primary text-white disabled:bg-gray-300 disabled:text-gray-500"}
            nextClassName={""}
            nextLinkClassName={"px-3 py-1 rounded bg-primary text-white disabled:bg-gray-300 disabled:text-gray-500"}
            disabledClassName={"opacity-50 cursor-not-allowed"}
          />
        </div>
      )}
    </motion.div>
  );
};