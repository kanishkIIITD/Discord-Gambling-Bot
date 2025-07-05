import React, { useEffect, useState, useRef } from 'react';
import ReactPaginate from 'react-paginate';
import { Listbox } from '@headlessui/react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/20/solid';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDisplayNumber } from '../utils/numberFormat';
import LoadingSpinner from '../components/LoadingSpinner';

// Zustand stores
import { useUserStore } from '../store/useUserStore';
import { useGuildStore } from '../store/useGuildStore';
import { useUIStore } from '../store/useUIStore';
import { useZustandQuery } from '../hooks/useZustandQuery';

// API functions
import * as api from '../services/api';

const RESULT_FILTERS = [
  { value: 'all', label: 'All Results' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'pending', label: 'Pending' },
  { value: 'refunded', label: 'Refunded' },
];
const STATUS_FILTERS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'refunded', label: 'Refunded' },
];
const SORT_OPTIONS = [
  { value: 'amount', label: 'Amount' },
  { value: 'placedAt', label: 'Placed At' },
];
// Animation settings
const buttonMotion = {
  whileHover: { scale: 1.05, boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)', y: -2 },
  whileTap: { scale: 0.95 },
  transition: { type: 'spring', stiffness: 400, damping: 10 }
};

const MyBetsPage = () => {
  const user = useUserStore(state => state.user);
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  const { isLoading, getError } = useUIStore();
  
  const [page, setPage] = useState(1);
  const [resultFilter, setResultFilter] = useState(RESULT_FILTERS[0]);
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS[0]);
  const [sortBy, setSortBy] = useState(SORT_OPTIONS[0]);
  const [sortOrder, setSortOrder] = useState('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef(null);
  
  // Define loading keys
  const LOADING_KEYS = {
    PREFERENCES: 'my-bets-preferences',
    BETS: 'my-bets-data'
  };

  // Fetch user preferences using Zustand Query
  const { 
    data: userPreferences = {},
    isLoading: preferencesLoading,
    error: preferencesError
  } = useZustandQuery(
    ['userPreferences', user?.discordId],
    () => api.getUserPreferences(user?.discordId),
    {
      enabled: !!user?.discordId && !!selectedGuildId && !isGuildSwitching,
      staleTime: 1000 * 60, // 1 minute
      refetchOnMount: true,
      refetchOnWindowFocus: true
    },
    LOADING_KEYS.PREFERENCES
  );

  // Fetch bets using Zustand Query
  const {
    data: betsData = { data: [], totalCount: 0 },
    isLoading: betsLoading,
    error: betsError
  } = useZustandQuery(
    ['myPlacedBets', user?.discordId, selectedGuildId, page, userPreferences?.itemsPerPage || 10, resultFilter.value, statusFilter.value, sortBy.value, sortOrder],
    () => api.getMyPlacedBets(user?.discordId, page, userPreferences?.itemsPerPage || 10, resultFilter.value, statusFilter.value, sortBy.value, sortOrder, selectedGuildId),
    {
      enabled: !!user?.discordId && !!selectedGuildId && !isGuildSwitching && !!userPreferences,
      staleTime: 1000 * 30, // 30 seconds
      refetchOnMount: true,
      refetchOnWindowFocus: true
    },
    LOADING_KEYS.BETS
  );

  // Extract data from the query results
  const bets = betsData?.data || [];
  const totalCount = betsData?.totalCount || 0;
  const isDataLoading = isLoading(LOADING_KEYS.PREFERENCES) || isLoading(LOADING_KEYS.BETS) || isGuildSwitching;
  const loadingError = getError(LOADING_KEYS.PREFERENCES) || getError(LOADING_KEYS.BETS);

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

  // Server-side pagination
  const itemsPerPage = userPreferences?.itemsPerPage || 10;
  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;
  const paginatedBets = bets;

  const handlePageChange = (selectedItem) => {
    setPage(selectedItem.selected + 1);
  };

  const handleSortChange = (value) => {
    if (sortBy.value === value) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(SORT_OPTIONS.find(opt => opt.value === value));
      setSortOrder('desc');
    }
    setShowSortMenu(false);
  };

  if (isDataLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" color="primary" message="Loading your bets..." />
      </div>
    );
  }
  
  if (loadingError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card p-6 rounded-lg shadow-lg max-w-lg w-full">
          <h2 className="text-2xl font-bold text-text-primary mb-4">Error Loading Bets</h2>
          <div className="bg-error/10 border border-error/30 rounded-md p-4 mb-6">
            <p className="text-error font-medium">{loadingError.message || 'Failed to load your bets data'}</p>
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
      className="max-w-5xl mx-auto px-2 sm:px-6 lg:px-8 py-8 w-full"
    >
      <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight text-center font-display">My Bets</h1>
      {/* Filters and Sort */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-between items-center mb-6 w-full">
        {/* Segmented Button Group for Result Filter */}
        <div className="flex flex-wrap gap-1 bg-surface border border-border rounded-lg p-1 flex-shrink-0 overflow-x-auto max-w-full whitespace-nowrap">
          {RESULT_FILTERS.map(opt => (
            <motion.button
              key={opt.value}
              type="button"
              onClick={() => setResultFilter(opt)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:z-10 whitespace-nowrap flex-shrink-0 font-base
                ${resultFilter.value === opt.value
                  ? 'bg-primary text-white shadow'
                  : 'bg-transparent text-text-primary hover:bg-primary/10'}`}
              aria-pressed={resultFilter.value === opt.value}
              whileHover={{ scale: 1.05, boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)", y: -2 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              {opt.label}
            </motion.button>
          ))}
        </div>
        {/* Segmented Button Group for Status Filter */}
        <div className="flex flex-wrap gap-1 bg-surface border border-border rounded-lg p-1 flex-shrink-0 overflow-x-auto max-w-full whitespace-nowrap">
          {STATUS_FILTERS.map(opt => (
            <motion.button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:z-10 whitespace-nowrap flex-shrink-0 font-base
                ${statusFilter.value === opt.value
                  ? 'bg-primary text-white shadow'
                  : 'bg-transparent text-text-primary hover:bg-primary/10'}`}
              aria-pressed={statusFilter.value === opt.value}
              whileHover={{ scale: 1.05, boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)", y: -2 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              {opt.label}
            </motion.button>
          ))}
        </div>
        {/* Sort Dropdown */}
        <div className="relative w-full sm:w-44 flex-shrink-0" ref={sortMenuRef}>
          <motion.button
            type="button"
            className="flex items-center justify-between w-full px-3 py-1 rounded-lg bg-surface border border-border text-text-primary hover:bg-primary/10 transition-colors text-sm font-medium shadow-sm font-base"
            onClick={() => setShowSortMenu((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={showSortMenu}
            {...buttonMotion}
          >
            <span>Sort by: {sortBy.label}</span>
            {sortOrder === 'asc' ? (
              <ChevronUpIcon className="h-5 w-5 text-text-secondary ml-2" aria-hidden="true" />
            ) : (
              <ChevronDownIcon className="h-5 w-5 text-text-secondary ml-2" aria-hidden="true" />
            )}
          </motion.button>
          <AnimatePresence>
            {showSortMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute z-50 mt-1 w-full rounded-lg bg-card border border-border py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none text-left"
              >
                {SORT_OPTIONS.map(opt => (
                  <motion.button
                    key={opt.value}
                    onClick={() => handleSortChange(opt.value)}
                    className={`w-full flex items-center justify-between px-4 py-2 text-sm rounded transition-colors text-left font-base
                      ${sortBy.value === opt.value ? 'bg-primary/10 text-primary font-semibold' : 'text-text-primary hover:bg-primary/5'}`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    <span>{opt.label}</span>
                    {sortBy.value === opt.value && (
                      sortOrder === 'asc' ? <ChevronUpIcon className="h-4 w-4 ml-2" /> : <ChevronDownIcon className="h-4 w-4 ml-2" />
                    )}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="bg-card rounded-lg shadow-lg overflow-x-auto w-full mt-4">
        <div className="min-w-[500px] sm:min-w-full overflow-auto scrollbar-hide">
          <table className="min-w-full divide-y divide-border text-xs sm:text-sm">
            <thead className="bg-card">
              <tr>
                <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-heading">Bet</th>
                <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-heading">Amount</th>
                <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-heading">Option</th>
                <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-heading">Status</th>
                <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-heading">Result</th>
                <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-heading">Placed At</th>
                <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-heading">Actions</th>
              </tr>
            </thead>
            <AnimatePresence mode="wait" initial={false}>
              <motion.tbody
                key={`${resultFilter.value}-${statusFilter.value}-${sortBy.value}-${sortOrder}-${page}`}
                className="divide-y divide-border"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -24 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              >
                {paginatedBets.length > 0 ? (
                  paginatedBets.map((bet, index) => {
                    const betStatus = bet.bet?.status || '-';
                    const isResolved = betStatus === 'resolved';
                    const isRefunded = betStatus === 'refunded';
                    const isWon = isResolved && bet.option === bet.bet?.winningOption;
                    const statusColorClass = bet.status === 'open' 
                      ? 'bg-success/20 text-success' 
                      : bet.status === 'closed' 
                      ? 'bg-warning/20 text-warning'
                      : bet.status === 'resolved' 
                      ? 'bg-info/20 text-info' 
                      : bet.status === 'refunded'
                      ? 'bg-secondary/20 text-secondary'
                      : 'bg-text-secondary/20 text-text-secondary';
                    return (
                      <motion.tr
                        key={bet._id || index}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 16 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="hover:bg-primary/5 cursor-pointer"
                      >
                        <td className="px-2 sm:px-6 py-2 sm:py-3 whitespace-pre-line break-words max-w-[120px] sm:max-w-none text-sm text-text-primary tracking-wide text-center font-accent">{bet.bet?.description || '-'}</td>
                        <td className="px-2 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm font-medium text-primary tracking-wide text-center font-mono">{formatDisplayNumber(bet.amount)}</td>
                        <td className="px-2 sm:px-6 py-2 sm:py-3 break-words max-w-[100px] sm:max-w-none text-sm text-text-secondary tracking-wide text-center font-accent">{bet.option}</td>
                        <td className="px-2 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm text-text-secondary tracking-wide text-center">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColorClass} font-heading`}>
                            {betStatus === 'refunded' ? 'Refunded' : betStatus.charAt(0).toUpperCase() + betStatus.slice(1)}
                          </span>
                        </td>
                        <td className="px-2 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm tracking-wide text-center">
                          {isRefunded ? (
                            <span className="text-secondary font-semibold font-heading">Refunded</span>
                          ) : isResolved ? (
                            isWon ? <span className="text-success font-semibold font-heading">Won</span> : <span className="text-error font-semibold font-heading">Lost</span>
                          ) : (
                            <span className="text-text-secondary font-base">Pending</span>
                          )}
                        </td>
                        <td className="px-2 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm text-text-secondary tracking-wide text-center font-base">{bet.placedAt ? new Date(bet.placedAt).toLocaleString() : '-'}</td>
                        <td className="px-2 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm text-center">
                          {bet.bet?._id && (
                            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 400, damping: 10 }}>
                              <Link
                                to={`/dashboard/betting/view?betId=${bet.bet._id}`}
                                className="text-primary underline text-sm font-base"
                              >
                                View Bet
                              </Link>
                            </motion.div>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })
                ) : (
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <td colSpan="7" className="px-6 py-4 text-center text-sm text-text-secondary font-base">No bets found.</td>
                  </motion.tr>
                )}
              </motion.tbody>
            </AnimatePresence>
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
      {totalPages > 1 && !isDataLoading && !loadingError && (
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
            pageLinkClassName={"px-2 py-1 rounded bg-card text-text-secondary hover:bg-primary/10 font-base"}
            activeClassName={""}
            activeLinkClassName={"bg-primary text-white"}
            previousClassName={""}
            previousLinkClassName={"px-3 py-1 rounded bg-primary text-white disabled:bg-gray-300 disabled:text-gray-500 font-base"}
            nextClassName={""}
            nextLinkClassName={"px-3 py-1 rounded bg-primary text-white disabled:bg-gray-300 disabled:text-gray-500 font-base"}
            disabledClassName={"opacity-50 cursor-not-allowed"}
          />
        </div>
      )}
    </motion.div>
  );
};
export default MyBetsPage;