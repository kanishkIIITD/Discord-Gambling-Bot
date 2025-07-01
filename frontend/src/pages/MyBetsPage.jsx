import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getMyPlacedBets, getUserPreferences } from '../services/api';
import ReactPaginate from 'react-paginate';
import { Listbox } from '@headlessui/react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/20/solid';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDisplayNumber } from '../utils/numberFormat';

// --- TEMP: Main Guild ID for single-guild mode ---
const MAIN_GUILD_ID = process.env.REACT_APP_MAIN_GUILD_ID;

const RESULT_FILTERS = [
  { value: 'all', label: 'All Results' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'pending', label: 'Pending' },
];
const STATUS_FILTERS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'resolved', label: 'Resolved' },
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
  const { user } = useAuth();
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userPreferences, setUserPreferences] = useState(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [resultFilter, setResultFilter] = useState(RESULT_FILTERS[0]);
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS[0]);
  const [sortBy, setSortBy] = useState(SORT_OPTIONS[0]);
  const [sortOrder, setSortOrder] = useState('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef(null);

  useEffect(() => {
    const fetchUserPreferences = async () => {
      if (!user?.discordId) return;
      try {
        setLoading(true);
        const data = await getUserPreferences(user.discordId);
        setUserPreferences(data);
      } catch (err) {
        setError('Failed to load preferences.');
      } finally {
        setLoading(false);
      }
    };
    fetchUserPreferences();
  }, [user]);

  useEffect(() => {
    const fetchMyBets = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(
          `${process.env.REACT_APP_API_URL}/api/users/${user.discordId}/bets`,
          {
            params: {
              page,
              limit: userPreferences.itemsPerPage,
              guildId: MAIN_GUILD_ID,
              result: resultFilter.value,
              status: statusFilter.value,
              sortBy: sortBy.value,
              sortOrder,
            },
            headers: { 'x-guild-id': MAIN_GUILD_ID }
          }
        );
        setBets(res.data.data);
        setTotalCount(res.data.totalCount);
      } catch (err) {
        setError('Failed to fetch your bets.');
      } finally {
        setLoading(false);
      }
    };
    if (user?.discordId && userPreferences) {
      fetchMyBets();
    }
  }, [user, page, userPreferences, resultFilter, statusFilter, sortBy, sortOrder]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
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
                    const isWon = isResolved && bet.option === bet.bet?.winningOption;
                    const statusColorClass = bet.status === 'open' 
                      ? 'bg-success/20 text-success' 
                      : bet.status === 'closed' 
                      ? 'bg-warning/20 text-warning'
                      : bet.status === 'resolved' 
                      ? 'bg-info/20 text-info' 
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
                            {betStatus.charAt(0).toUpperCase() + betStatus.slice(1)}
                          </span>
                        </td>
                        <td className="px-2 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm tracking-wide text-center">
                          {isResolved ? (
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