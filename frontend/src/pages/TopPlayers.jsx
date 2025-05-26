import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserPreferences } from '../services/api';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/20/solid';
import axios from 'axios';
import ReactPaginate from 'react-paginate';

const SORT_OPTIONS = [
  { value: 'balance', label: 'Balance' },
  { value: 'alpha', label: 'Player (A-Z)' },
];

export const TopPlayers = () => {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userPreferences, setUserPreferences] = useState(null);
  const [sortBy, setSortBy] = useState('balance');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
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
    const fetchLeaderboardData = async () => {
      if (!user?.discordId || !userPreferences) return;
      try {
        setLoading(true);
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/users/${user.discordId}/leaderboard?page=${page}&limit=${userPreferences.itemsPerPage}`);
        setLeaderboard(res.data.data);
        setTotalCount(res.data.totalCount);
      } catch (err) {
        setError('Failed to load leaderboard.');
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboardData();
  }, [user, page, userPreferences]);

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

  // Sort leaderboard client-side (for alpha only, since backend sorts by balance)
  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'balance') {
      cmp = b.balance - a.balance;
    } else if (sortBy === 'alpha') {
      cmp = a.username.localeCompare(b.username);
    }
    return sortOrder === 'asc' ? -cmp : cmp;
  });

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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return <div className="min-h-screen bg-background text-error flex items-center justify-center">{error}</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-6 lg:px-8 py-8 w-full">
      <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight text-center">Top Players</h1>
      <div className="flex flex-col sm:flex-row sm:justify-end gap-4 mb-6 w-full">
        <div className="relative w-full sm:w-44 flex-shrink-0" ref={sortMenuRef}>
          <button
            type="button"
            className="flex items-center justify-between w-full px-3 py-1 rounded-lg bg-surface border border-border text-text-primary hover:bg-primary/10 transition-colors text-sm font-medium shadow-sm"
            onClick={() => setShowSortMenu((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={showSortMenu}
          >
            <span>Sort by: {sortBy === 'balance' ? 'Balance' : sortBy === 'alpha' ? 'Player (A-Z)' : ''}</span>
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
      <div className="bg-card rounded-lg shadow-lg overflow-x-auto w-full">
        <div className="min-w-[400px] sm:min-w-full">
          <table className="min-w-full divide-y divide-border text-xs sm:text-sm">
            <thead className="bg-card">
              <tr>
                <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">#</th>
                <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Player</th>
                <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedLeaderboard.length > 0 ? (
                sortedLeaderboard.map((player, index) => (
                  <tr key={player.discordId} className={`hover:bg-primary/5 ${player.discordId === user?.discordId ? 'bg-primary/20' : ''}`}>
                    <td className="px-2 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm text-text-primary tracking-wide text-center">{(page - 1) * (userPreferences?.itemsPerPage || 10) + index + 1}</td>
                    <td className="px-2 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm text-text-primary tracking-wide text-center">{player.username}</td>
                    <td className="px-2 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-sm font-medium text-primary tracking-wide text-center">{player.balance.toLocaleString()} points</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="px-2 sm:px-6 py-2 sm:py-3 text-center text-sm text-text-secondary">No players found on the leaderboard.</td>
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