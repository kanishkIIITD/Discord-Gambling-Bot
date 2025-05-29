import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getMyPlacedBets, getUserPreferences } from '../services/api';
import ReactPaginate from 'react-paginate';
import { Listbox } from '@headlessui/react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/20/solid';
import { Link } from 'react-router-dom';
import axios from 'axios';

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
    <div className="max-w-5xl mx-auto px-2 sm:px-6 lg:px-8 py-8 w-full">
      <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight text-center">My Bets</h1>
      {/* Filters and Sort */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-between items-center mb-6 w-full">
        {/* Segmented Button Group for Result Filter */}
        <div className="flex flex-wrap gap-1 bg-surface border border-border rounded-lg p-1 flex-shrink-0 overflow-x-auto max-w-full whitespace-nowrap">
          {RESULT_FILTERS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setResultFilter(opt)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:z-10 whitespace-nowrap flex-shrink-0
                ${resultFilter.value === opt.value
                  ? 'bg-primary text-white shadow'
                  : 'bg-transparent text-text-primary hover:bg-primary/10'}
              `}
              aria-pressed={resultFilter.value === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {/* Segmented Button Group for Status Filter */}
        <div className="flex flex-wrap gap-1 bg-surface border border-border rounded-lg p-1 flex-shrink-0 overflow-x-auto max-w-full whitespace-nowrap">
          {STATUS_FILTERS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:z-10 whitespace-nowrap flex-shrink-0
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
        <div className="relative w-full sm:w-44 flex-shrink-0" ref={sortMenuRef}>
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
      <div className="bg-card rounded-lg shadow-lg overflow-x-auto w-full">
        <div className="min-w-[500px] sm:min-w-full">
          <table className="min-w-full divide-y divide-border text-xs sm:text-sm">
            <thead className="bg-card">
              <tr>
                <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Bet</th>
                <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Amount</th>
                <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Option</th>
                <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Status</th>
                <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Result</th>
                <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Placed At</th>
                <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedBets.length > 0 ? (
                paginatedBets.map((bet, idx) => {
                  const betStatus = bet.bet?.status || '-';
                  const isResolved = betStatus === 'resolved';
                  const isWon = isResolved && bet.option === bet.bet?.winningOption;
                  return (
                    <tr key={bet._id} className="hover:bg-primary/5">
                      <td className="px-2 sm:px-6 py-2 sm:py-3 whitespace-pre-line break-words max-w-[120px] sm:max-w-none text-sm text-text-primary tracking-wide text-center">{bet.bet?.description || '-'}</td>
                      <td className="px-2 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm font-medium text-primary tracking-wide text-center">{bet.amount}</td>
                      <td className="px-2 sm:px-6 py-2 sm:py-3 break-words max-w-[100px] sm:max-w-none text-sm text-text-secondary tracking-wide text-center">{bet.option}</td>
                      <td className="px-2 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm text-text-secondary tracking-wide text-center">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          betStatus === 'open' ? 'bg-success/20 text-success' :
                          betStatus === 'closed' ? 'bg-warning/20 text-warning' :
                          betStatus === 'resolved' ? 'bg-info/20 text-info' : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {betStatus.charAt(0).toUpperCase() + betStatus.slice(1)}
                        </span>
                      </td>
                      <td className="px-2 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm tracking-wide text-center">
                        {isResolved ? (
                          isWon ? <span className="text-success font-semibold">Won</span> : <span className="text-error font-semibold">Lost</span>
                        ) : (
                          <span className="text-text-secondary">Pending</span>
                        )}
                      </td>
                      <td className="px-2 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm text-text-secondary tracking-wide text-center">{bet.placedAt ? new Date(bet.placedAt).toLocaleString() : '-'}</td>
                      <td className="px-2 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm text-center">
                        {bet.bet?._id && (
                          <Link
                            to={`/dashboard/betting/view?betId=${bet.bet._id}`}
                            className="text-primary underline text-sm"
                          >
                            View Bet
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-text-secondary text-lg">No bets found for the selected filters or page.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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
    </div>
  );
};
export default MyBetsPage; 