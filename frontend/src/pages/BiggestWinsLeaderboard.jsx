import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserPreferences } from '../services/api';
import axios from 'axios';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/20/solid';
import ReactPaginate from 'react-paginate';

const SORT_OPTIONS = [
  { value: 'amount', label: 'Amount' },
  { value: 'alpha', label: 'Player (A-Z)' },
  { value: 'date', label: 'Date' },
];

export const BiggestWinsLeaderboard = () => {
  const { user } = useAuth();
  const [wins, setWins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userPreferences, setUserPreferences] = useState(null);
  const [sortBy, setSortBy] = useState('amount');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedRows, setExpandedRows] = useState({});
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
    const fetchWins = async () => {
      if (!userPreferences) return;
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/users/leaderboard/biggest-wins?page=${page}&limit=${userPreferences.itemsPerPage}`);
        setWins(res.data.data);
        setTotalCount(res.data.totalCount);
      } catch (err) {
        setError('Failed to load biggest wins leaderboard.');
      } finally {
        setLoading(false);
      }
    };
    fetchWins();
  }, [page, userPreferences]);

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

  // Sort client-side
  const sortedWins = [...wins].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'amount') {
      cmp = b.amount - a.amount;
    } else if (sortBy === 'alpha') {
      cmp = a.username.localeCompare(b.username);
    } else if (sortBy === 'date') {
      cmp = new Date(b.timestamp) - new Date(a.timestamp);
    }
    return sortOrder === 'asc' ? -cmp : cmp;
  });

  const handleSortChange = (value) => {
    if (sortBy === value) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(value);
      setSortOrder(value === 'alpha' ? 'asc' : 'desc'); // Default: alpha=asc, others=desc
    }
    setShowSortMenu(false);
  };

  const totalPages = userPreferences ? Math.ceil(totalCount / userPreferences.itemsPerPage) : 1;

  // react-paginate expects 0-based page index
  const handlePageChange = (selectedItem) => {
    setPage(selectedItem.selected + 1);
  };

  // Helper to toggle expanded state for a row
  const toggleExpand = (rowIndex) => {
    setExpandedRows((prev) => ({
      ...prev,
      [rowIndex]: !prev[rowIndex],
    }));
  };

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight text-center">Biggest Wins Leaderboard</h1>
      <div className="flex justify-end mb-6">
        <div className="relative w-44 flex-shrink-0" ref={sortMenuRef}>
          <button
            type="button"
            className="flex items-center justify-between w-full px-3 py-1 rounded-lg bg-surface border border-border text-text-primary hover:bg-primary/10 transition-colors text-sm font-medium shadow-sm"
            onClick={() => setShowSortMenu((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={showSortMenu}
          >
            <span>Sort by: {SORT_OPTIONS.find(opt => opt.value === sortBy)?.label}</span>
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
                    ${sortBy === opt.value ? 'bg-primary/10 text-primary font-semibold' : 'text-text-primary hover:bg-primary/5'}
                  `}
                >
                  <span>{opt.label}</span>
                  {sortBy === opt.value && (
                    sortOrder === 'asc' ? <ChevronUpIcon className="h-4 w-4 ml-2" /> : <ChevronDownIcon className="h-4 w-4 ml-2" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="bg-card rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-card">
              <tr>
                <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">#</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Player</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedWins.length > 0 ? (
                sortedWins.map((win, index) => {
                  const isExpanded = expandedRows[index];
                  const desc = win.description || '-';
                  const shouldTruncate = desc.length > 17;
                  const displayDesc = !shouldTruncate || isExpanded ? desc : desc.slice(0, 17) + '...';
                  return (
                  <tr key={index} className={`hover:bg-primary/5 ${win.discordId === user?.discordId ? 'bg-primary/20' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary tracking-wide text-center">{(page - 1) * (userPreferences?.itemsPerPage || 10) + index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary tracking-wide text-center">{win.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary tracking-wide text-center">{win.amount.toLocaleString()} points</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary tracking-wide text-center">
                        {displayDesc}
                        {shouldTruncate && (
                          <button
                            className="ml-2 text-primary underline text-xs focus:outline-none"
                            onClick={() => toggleExpand(index)}
                            aria-label={isExpanded ? 'Show less' : 'Show more'}
                          >
                            {isExpanded ? 'Show less' : 'Show more'}
                          </button>
                        )}
                      </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary tracking-wide text-center">{new Date(win.timestamp).toLocaleString()}</td>
                  </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-sm text-text-secondary">No wins found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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
    </div>
  );
}; 