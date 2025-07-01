import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getTransactionHistory, getUserPreferences } from '../services/api';
import ReactPaginate from 'react-paginate';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/20/solid';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDisplayNumber } from '../utils/numberFormat';

const GAME_TYPE_FILTERS = [
  { value: 'all', label: 'All Games' },
  { value: 'event', label: 'Event Bet' },
  { value: 'roulette', label: 'Roulette' },
  { value: 'blackjack', label: 'Blackjack' },
  { value: 'coinflip', label: 'Coinflip' },
  { value: 'dice', label: 'Dice' },
  { value: 'slots', label: 'Slots' },
  { value: 'jackpot', label: 'Jackpot' },
];
const RESULT_FILTERS = [
  { value: 'all', label: 'All Results' },
  { value: 'win', label: 'Win' },
  { value: 'loss', label: 'Loss' },
  { value: 'pending', label: 'Pending' },
];
const SORT_OPTIONS = [
  { value: 'date', label: 'Date' },
  { value: 'amount', label: 'Amount' },
];
const buttonMotion = {
  whileHover: { scale: 1.05, boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)', y: -2 },
  whileTap: { scale: 0.95 },
  transition: { type: 'spring', stiffness: 400, damping: 10 }
};

const BetHistoryPage = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userPreferences, setUserPreferences] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [gameTypeFilter, setGameTypeFilter] = useState(GAME_TYPE_FILTERS[0]);
  const [resultFilter, setResultFilter] = useState(RESULT_FILTERS[0]);
  const [sortBy, setSortBy] = useState(SORT_OPTIONS[0]);
  const [sortOrder, setSortOrder] = useState('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef(null);
  const [expandedRows, setExpandedRows] = useState({});

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
    const fetchTransactions = async () => {
      if (!user?.discordId || !userPreferences) return;
      try {
        setLoading(true);
        const response = await getTransactionHistory(user.discordId, 1, 500); // Fetch a large batch for client-side filtering
        setTransactions(response.transactions);
        setTotalCount(response.transactions.length);
      } catch (err) {
        setError('Failed to load bet history.');
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, [user, userPreferences]);

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

  // Helper to infer game type from transaction
  const inferGameType = (tx) => {
    if (tx.description?.toLowerCase().includes('roulette')) return 'roulette';
    if (tx.description?.toLowerCase().includes('blackjack')) return 'blackjack';
    if (tx.description?.toLowerCase().includes('coinflip')) return 'coinflip';
    if (tx.description?.toLowerCase().includes('dice')) return 'dice';
    if (tx.description?.toLowerCase().includes('slots')) return 'slots';
    if (tx.type === 'jackpot' || tx.description?.toLowerCase().includes('jackpot')) return 'jackpot';
    if (tx.type === 'bet' && tx.description?.toLowerCase().includes('bet placed')) return 'event';
    if (tx.type === 'win' && tx.description?.toLowerCase().includes('bet on')) return 'event';
    return 'event';
  };

  // Helper to infer result
  const inferResult = (tx) => {
    if (tx.type === 'win' || tx.type === 'jackpot') return 'win';
    if (tx.type === 'bet') return 'loss';
    if (tx.type === 'jackpot_contribution') return 'pending';
    if (tx.type === 'gift_sent' || tx.type === 'gift_received' || tx.type === 'daily') return null;
    return null;
  };

  // Filtering
  let filtered = transactions.filter(tx => {
    // Only show gambling-related transactions
    const gameType = inferGameType(tx);
    if (gameTypeFilter.value !== 'all' && gameType !== gameTypeFilter.value) return false;
    const result = inferResult(tx);
    if (resultFilter.value !== 'all' && result !== resultFilter.value) return false;
    // Exclude non-gambling types
    if ([ 'gift_sent', 'gift_received', 'daily', 'jackpot_contribution', 'initial_balance' ].includes(tx.type)) return false;
    return true;
  });

  // Sorting
  filtered = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortBy.value === 'date') {
      cmp = new Date(b.timestamp) - new Date(a.timestamp);
    } else if (sortBy.value === 'amount') {
      cmp = Math.abs(b.amount) - Math.abs(a.amount);
    }
    return sortOrder === 'asc' ? -cmp : cmp;
  });

  // Pagination
  const itemsPerPage = userPreferences?.itemsPerPage || 10;
  const totalPagesCalc = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handlePageChange = (selectedItem) => {
    setCurrentPage(selectedItem.selected + 1);
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

  // Helper to toggle expanded state for a row
  const toggleExpand = (rowIndex) => {
    setExpandedRows((prev) => ({
      ...prev,
      [rowIndex]: !prev[rowIndex],
    }));
  };

  // UI
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  if (error) {
    return <div className="min-h-screen bg-background text-error flex items-center justify-center">{error}</div>;
  }

  // Animation variants for table body
  const tableBodyVariants = {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
    exit: { opacity: 0, y: -24, transition: { duration: 0.2, ease: 'easeIn' } },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-8 w-full">
        <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight text-center font-display">Bet History</h1>
        {/* Filters and Sort */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-between items-center mb-6 w-full">
          {/* Segmented Button Group for Game Type */}
          <div className="flex flex-wrap gap-1 bg-surface border border-border rounded-lg p-1 flex-shrink-0 overflow-x-auto max-w-full">
            {GAME_TYPE_FILTERS.map(opt => (
              <motion.button
                key={opt.value}
                type="button"
                onClick={() => setGameTypeFilter(opt)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:z-10 whitespace-nowrap flex-shrink-0 font-base
                  ${gameTypeFilter.value === opt.value
                    ? 'bg-primary text-white shadow'
                    : 'bg-transparent text-text-primary hover:bg-primary/10'}
                `}
                aria-pressed={gameTypeFilter.value === opt.value}
                whileHover={{ scale: 1.05, boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)', y: -2 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 10 }}
              >
                {opt.label}
              </motion.button>
            ))}
          </div>
          {/* Segmented Button Group for Result Filter */}
          <div className="flex flex-wrap gap-1 bg-surface border border-border rounded-lg p-1 flex-shrink-0 overflow-x-auto max-w-full">
            {RESULT_FILTERS.map(opt => (
              <motion.button
                key={opt.value}
                type="button"
                onClick={() => setResultFilter(opt)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:z-10 whitespace-nowrap flex-shrink-0 font-base
                  ${resultFilter.value === opt.value
                    ? 'bg-primary text-white shadow'
                    : 'bg-transparent text-text-primary hover:bg-primary/10'}
                `}
                aria-pressed={resultFilter.value === opt.value}
                whileHover={{ scale: 1.05, boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)', y: -2 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 10 }}
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
              <span className="font-base">Sort by: {sortBy.label}</span>
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
                      <span className="font-base">{opt.label}</span>
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
        <div className="bg-card rounded-lg shadow-lg overflow-x-auto w-full">
          <div className="min-w-[500px] sm:min-w-full overflow-auto scrollbar-hide">
            <table className="min-w-full divide-y divide-border text-xs sm:text-sm">
              <thead className="bg-card">
                <tr>
                  <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-heading">Date</th>
                  <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-heading">Type</th>
                  <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-heading">Description</th>
                  <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-heading">Amount</th>
                </tr>
              </thead>
              <AnimatePresence mode="wait" initial={false}>
                <motion.tbody
                  key={`${gameTypeFilter.value}-${resultFilter.value}-${sortBy.value}-${sortOrder}-${currentPage}`}
                  className="divide-y divide-border"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -24 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                >
                  {paginated.length > 0 ? (
                    paginated.map((tx, idx) => {
                      const date = new Date(tx.timestamp);
                      const formattedDate = date instanceof Date && !isNaN(date) ? date.toLocaleString() : '-';
                      const gameType = inferGameType(tx);
                      const result = inferResult(tx);
                      let resultLabel = '';
                      if (result === 'win') resultLabel = <span className="text-success font-semibold">Win</span>;
                      else if (result === 'loss') resultLabel = <span className="text-error font-semibold">Loss</span>;
                      else if (result === 'pending') resultLabel = <span className="text-text-secondary">Pending</span>;
                      else resultLabel = <span className="text-text-secondary">-</span>;
                      const amountColorClass = tx.amount >= 0 ? 'text-success' : 'text-error';
                      const isExpanded = expandedRows[idx];
                      const desc = tx.description || '-';
                      const shouldTruncate = desc.length > 17;
                      const displayDesc = !shouldTruncate || isExpanded ? desc : desc.slice(0, 17) + '...';
                      return (
                        <motion.tr
                          key={tx._id || idx}
                          className="hover:bg-primary/5"
                          whileHover={{ scale: 1.01, y: -1 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        >
                          <td className="px-2 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm text-text-primary tracking-wide text-center font-base">{formattedDate}</td>
                          <td className="px-2 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm text-text-primary tracking-wide text-center capitalize font-base">{gameType.charAt(0).toUpperCase() + gameType.slice(1)}</td>
                          <td className="px-2 sm:px-6 py-2 sm:py-3 text-sm text-text-primary tracking-wide text-center font-base">
                            {displayDesc}
                            {shouldTruncate && (
                              <button
                                className="ml-2 text-primary underline text-xs focus:outline-none font-base"
                                onClick={() => toggleExpand(idx)}
                                aria-label={isExpanded ? 'Show less' : 'Show more'}
                              >
                                {isExpanded ? 'Show less' : 'Show more'}
                              </button>
                            )}
                          </td>
                          <td className={`px-2 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm font-medium ${amountColorClass} tracking-wide text-right font-mono`}>{formatDisplayNumber(tx.amount, true)} pts</td>
                        </motion.tr>
                      );
                    })
                  ) : (
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.4 }}
                    >
                      <td colSpan="5" className="px-6 py-4 text-center text-sm text-text-secondary font-base">No bet history found for the selected filters.</td>
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
        {totalPagesCalc > 1 && !loading && !error && (
          <div className="flex flex-wrap justify-center mt-6 w-full">
            <ReactPaginate
              previousLabel={"Prev"}
              nextLabel={"Next"}
              breakLabel={"..."}
              breakClassName={"px-2 py-1"}
              pageCount={totalPagesCalc}
              marginPagesDisplayed={1}
              pageRangeDisplayed={3}
              onPageChange={handlePageChange}
              forcePage={currentPage - 1}
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
      </div>
    </motion.div>
  );
};

export default BetHistoryPage;
 