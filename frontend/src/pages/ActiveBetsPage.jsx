import React, { useEffect, useState, useRef } from 'react';
import { getActiveBets, getUserPreferences } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/20/solid';
import ReactPaginate from 'react-paginate';
import { useAuth } from '../contexts/AuthContext';

const STATUS_FILTERS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'resolved', label: 'Resolved' },
];
const SORT_OPTIONS = [
  { value: 'closingTime', label: 'Closing Time' },
];

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
        const data = await getActiveBets();
        setBets(data);
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight text-center">Active Bets</h1>
      {/* Filters and Sort */}
      <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
        {/* Segmented Button Group for Status Filter */}
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1 flex-shrink-0">
          {STATUS_FILTERS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:z-10
                ${statusFilter.value === opt.value
                  ? 'bg-primary text-white shadow'
                  : 'bg-transparent text-text-primary hover:bg-primary/10'}
              `}
              aria-pressed={statusFilter.value === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {/* Sort Dropdown */}
        <div className="relative w-44 flex-shrink-0" ref={sortMenuRef}>
          <button
            type="button"
            className="flex items-center justify-between w-full px-3 py-1 rounded-lg bg-surface border border-border text-text-primary hover:bg-primary/10 transition-colors text-sm font-medium shadow-sm"
            onClick={() => setShowSortMenu((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={showSortMenu}
          >
            <span>Sort by: {sortBy.label}</span>
            {sortOrder === 'asc' ? (
              <ChevronUpIcon className="h-5 w-5 text-text-secondary ml-2" aria-hidden="true" />
            ) : (
              <ChevronDownIcon className="h-5 w-5 text-text-secondary ml-2" aria-hidden="true" />
            )}
          </button>
          {showSortMenu && (
            <div className="absolute z-50 mt-1 w-full rounded-lg bg-card border border-border py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none text-left">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleSortChange(opt.value)}
                  className={`w-full flex items-center justify-between px-4 py-2 text-sm rounded transition-colors text-left
                    ${sortBy.value === opt.value ? 'bg-primary/10 text-primary font-semibold' : 'text-text-primary hover:bg-primary/5'}
                  `}
                >
                  <span>{opt.label}</span>
                  {sortBy.value === opt.value && (
                    sortOrder === 'asc' ? <ChevronUpIcon className="h-4 w-4 ml-2" /> : <ChevronDownIcon className="h-4 w-4 ml-2" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="bg-card rounded-lg shadow-lg overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-lg text-info">Loading active bets...</div>
        ) : error ? (
          <div className="text-center py-12 text-error">{error}</div>
        ) : paginatedBets.length === 0 ? (
          <div className="p-8 text-text-secondary text-center">No active bets found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-card">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Bet ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Options</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Closing Time</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedBets.map((bet, idx) => (
                  <tr key={bet._id} className="hover:bg-primary/5 cursor-pointer">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary tracking-wide text-center">{(page - 1) * itemsPerPage + idx + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-text-secondary text-left">{bet._id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary font-medium text-left">{bet.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary text-left">{bet.options.join(', ')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary tracking-wide text-center capitalize">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        bet.status === 'open' ? 'bg-success/20 text-success' :
                        bet.status === 'closed' ? 'bg-warning/20 text-warning' :
                        bet.status === 'resolved' ? 'bg-info/20 text-info' : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {bet.status.charAt(0).toUpperCase() + bet.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary tracking-wide text-center">{bet.closingTime ? new Date(bet.closingTime).toLocaleString() : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <button
                        className="text-primary underline text-sm"
                        onClick={() => navigate(`/dashboard/betting/view?betId=${bet._id}`)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Pagination outside the table container */}
      {totalPages > 1 && !loading && !error && (
        <div className="flex justify-center mt-6">
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
            containerClassName={"flex gap-1 items-center"}
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
  );
};
export default ActiveBetsPage; 