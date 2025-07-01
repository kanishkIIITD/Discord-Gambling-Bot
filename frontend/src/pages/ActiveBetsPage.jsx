import React, { useEffect, useState, useRef } from 'react';
import { getActiveBets, getUserPreferences } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/20/solid';
import ReactPaginate from 'react-paginate';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

// --- TEMP: Main Guild ID for single-guild mode ---
const MAIN_GUILD_ID = process.env.REACT_APP_MAIN_GUILD_ID;

const STATUS_FILTERS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'resolved', label: 'Resolved' },
];
const SORT_OPTIONS = [
  { value: 'closingTime', label: 'Closing Time' },
];
const buttonMotion = {
  whileHover: { scale: 1.05, boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)', y: -2 },
  whileTap: { scale: 0.95 },
  transition: { type: 'spring', stiffness: 400, damping: 10 }
};

const ActiveBetsPage = () => {
  const { user } = useAuth();
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS[0]);
  const [sortBy, setSortBy] = useState(SORT_OPTIONS[0]);
  const [sortOrder, setSortOrder] = useState('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [page, setPage] = useState(1);
  const [userPreferences, setUserPreferences] = useState(null);
  const navigate = useNavigate();
  const sortMenuRef = useRef(null);

  useEffect(() => {
    const fetchPrefsAndBets = async () => {
      setLoading(true);
      setError(null);
      try {
        let prefs = userPreferences;
        if (!prefs && user?.discordId) {
          prefs = await getUserPreferences(user.discordId);
          setUserPreferences(prefs);
        }
        const [openBets, closedBets] = await Promise.all([
          axios.get(`${process.env.REACT_APP_API_URL}/api/bets/open`, { params: { guildId: MAIN_GUILD_ID }, headers: { 'x-guild-id': MAIN_GUILD_ID } }).then(res => res.data),
          axios.get(`${process.env.REACT_APP_API_URL}/api/bets/closed`, { params: { guildId: MAIN_GUILD_ID }, headers: { 'x-guild-id': MAIN_GUILD_ID } }).then(res => res.data)
        ]);
        setBets([...openBets, ...closedBets]);
      } catch (err) {
        setError('Failed to fetch active bets or preferences.');
      } finally {
        setLoading(false);
      }
    };
    if (user?.discordId) {
      fetchPrefsAndBets();
    }
  }, [user]);

  // Reset page to 1 if preferences change (e.g., itemsPerPage)
  useEffect(() => {
    setPage(1);
  }, [userPreferences?.itemsPerPage]);

  // Close sort menu when clicking outside
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

  // Filtering and sorting
  let filteredBets = bets;
  if (statusFilter.value !== 'all') {
    filteredBets = filteredBets.filter(bet => bet.status === statusFilter.value);
  }
  filteredBets = [...filteredBets].sort((a, b) => {
    if (sortBy.value === 'closingTime') {
      const aTime = a.closingTime ? new Date(a.closingTime).getTime() : null;
      const bTime = b.closingTime ? new Date(b.closingTime).getTime() : null;
      // Sort bets with no closingTime to the bottom
      if (aTime === null && bTime === null) return 0;
      if (aTime === null) return 1;
      if (bTime === null) return -1;
      return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
    }
    return 0;
  });

  // Pagination
  const itemsPerPage = userPreferences?.itemsPerPage || 10;
  const totalPages = Math.ceil(filteredBets.length / itemsPerPage) || 1;
  const paginatedBets = filteredBets.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const handlePageChange = (selectedItem) => {
    setPage(selectedItem.selected + 1);
  };

  const handleSortChange = (value) => {
    if (sortBy.value === value) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(SORT_OPTIONS.find(opt => opt.value === value));
      setSortOrder('asc');
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
      className="max-w-fit mx-auto px-4 sm:px-6 lg:px-8 py-8"
    >
      <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight text-center font-display">Active Bets</h1>
      {/* Filters and Sort */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-between items-center mb-6">
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
        <div className="relative w-44 flex-shrink-0" ref={sortMenuRef}>
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
                <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-heading">#</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider font-heading">Bet ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider font-heading">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider font-heading">Options</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-heading">Status</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-heading">Closing Time</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-heading">Actions</th>
              </tr>
            </thead>
            <AnimatePresence mode="wait" initial={false}>
              <motion.tbody
                key={`${statusFilter.value}-${sortBy.value}-${sortOrder}-${page}`}
                className="divide-y divide-border"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -24 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              >
                {paginatedBets.length > 0 ? (
                  paginatedBets.map((bet, index) => {
                    const statusColorClass = bet.status === 'open' 
                      ? 'bg-success/20 text-success' 
                      : bet.status === 'closed' 
                      ? 'bg-warning/20 text-warning'
                      : bet.status === 'resolved' 
                      ? 'bg-info/20 text-info' 
                      : 'bg-text-secondary/20 text-text-secondary';

                    return (
                      <tr
                        key={bet._id || index}
                        className="hover:bg-primary/5 cursor-pointer"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary tracking-wide text-center font-base">{(page - 1) * itemsPerPage + index + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-text-secondary text-left">{bet._id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary font-medium text-left font-accent">{bet.description}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary text-left font-base">{bet.options.join(', ')}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary tracking-wide text-center capitalize">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColorClass} font-heading`}>
                            {bet.status.charAt(0).toUpperCase() + bet.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary tracking-wide text-center font-base">{bet.closingTime ? new Date(bet.closingTime).toLocaleString() : '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          <button
                            className="text-primary underline text-sm font-base"
                            onClick={() => navigate(`/dashboard/betting/view?betId=${bet._id}`)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-4 text-center text-sm text-text-secondary font-base">No active bets found.</td>
                  </tr>
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
      {/* Pagination outside the table container */}
      {totalPages > 1 && !loading && !error && (
        <div className="flex flex-wrap justify-center mt-6 w-full">
          <ReactPaginate
            previousLabel={"Prev"}
            nextLabel={"Next"}
            breakLabel={"..."}
            breakClassName={"px-2 py-1"}
            pageCount={Math.ceil(filteredBets.length / itemsPerPage)}
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
export default ActiveBetsPage; 