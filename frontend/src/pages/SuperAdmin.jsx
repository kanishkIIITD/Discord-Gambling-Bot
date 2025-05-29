import React, { useEffect, useState, Fragment, useRef, useLayoutEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Listbox, Transition } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon, ChevronDownIcon } from '@heroicons/react/20/solid';
import { getAllUsers, getUserPreferences } from '../services/api';
import ReactPaginate from 'react-paginate';
import toast from 'react-hot-toast';
import { UserGroupIcon, UserIcon } from '@heroicons/react/24/outline';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

// --- TEMP: Main Guild ID for single-guild mode ---
const MAIN_GUILD_ID = process.env.REACT_APP_MAIN_GUILD_ID;

const ROLE_OPTIONS = [
  { value: 'all', label: 'All Roles' },
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'User' },
];

export const SuperAdmin = () => {
  const { user } = useAuth();
  const [allUsers, setAllUsers] = useState([]); // Store all users for filtering
  const [users, setUsers] = useState([]); // Users to display on current page
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [updating, setUpdating] = useState({}); // { userId: boolean }
  // For dropdown positioning
  const [dropdownPos, setDropdownPos] = useState({}); // { [userId]: { top, left, width, openUp } }
  const buttonRefs = useRef({});
  // Track which dropdown is open
  const [openDropdown, setOpenDropdown] = useState(null); // userId or null
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'
  const [roleFilter, setRoleFilter] = useState('all');
  const [listboxOpen, setListboxOpen] = useState({}); // { [userId]: boolean }
  const [userPreferences, setUserPreferences] = useState(null);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showGiveawayModal, setShowGiveawayModal] = useState(false);
  const [giveawayUser, setGiveawayUser] = useState(null);
  const [giveawayAmount, setGiveawayAmount] = useState('');
  const [giveawayLoading, setGiveawayLoading] = useState(false);
  const [giveawayError, setGiveawayError] = useState(null);
  const [giveawaySuccess, setGiveawaySuccess] = useState(null);
  const [userSearch, setUserSearch] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const inputRef = useRef(null);
  const [searchSelectedUser, setSearchSelectedUser] = useState(null);

  // Fetch all users once (for filtering)
  useEffect(() => {
    const fetchUserPreferencesAndUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        let prefs = userPreferences;
        if (!prefs && user?.discordId) {
          prefs = await getUserPreferences(user.discordId);
          setUserPreferences(prefs);
        }
        if (prefs) {
          setItemsPerPage(prefs.itemsPerPage || 10);
          console.log('Fetching users with guildId:', MAIN_GUILD_ID);
          // Fetch all users (no pagination)
          const { data } = await axios.get(
            `${process.env.REACT_APP_API_URL}/api/users`,
            { params: { page: 1, limit: 10000, guildId: MAIN_GUILD_ID }, headers: { 'x-guild-id': MAIN_GUILD_ID } }
          );
          console.log('SuperAdmin users API data:', data);
          setAllUsers(data.data);
        }
      } catch (err) {
        setError(null);
        toast.error('Failed to load users.');
      } finally {
        setLoading(false);
      }
    };
    fetchUserPreferencesAndUsers();
    // eslint-disable-next-line
  }, [user, userPreferences?.itemsPerPage]);

  // Filter and paginate users on the frontend
  useEffect(() => {
    let filtered = roleFilter === 'all' ? allUsers : allUsers.filter(u => u.role === roleFilter);
    // Add search filtering by username or Discord ID
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(u =>
        (u.username && u.username.toLowerCase().includes(searchLower)) ||
        (u.discordId && u.discordId.toLowerCase().includes(searchLower))
      );
    }
    filtered = [...filtered].sort((a, b) => a.role.localeCompare(b.role));
    const startIdx = (page - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    setUsers(filtered.slice(startIdx, endIdx));
  }, [allUsers, roleFilter, page, itemsPerPage, search]);

  useEffect(() => {
    setPage(1); // Reset to first page when filter changes
  }, [roleFilter]);

  useEffect(() => {
    const openId = Object.keys(listboxOpen).find(id => listboxOpen[id]);
    setOpenDropdown(openId || null);
  }, [listboxOpen]);

  useLayoutEffect(() => {
    if (openDropdown) {
      handleDropdownOpen(openDropdown);
    }
  }, [openDropdown]);

  const handleRoleChange = async (userId, newRole) => {
    setUpdating((prev) => ({ ...prev, [userId]: true }));
    setError(null);
    setSuccess(null);
    try {
      await axios.patch(
        `${process.env.REACT_APP_API_URL}/api/admin/users/${userId}/role`,
        { role: newRole, guildId: MAIN_GUILD_ID },
        { headers: { 'x-guild-id': MAIN_GUILD_ID } }
      );
      setAllUsers((prev) => prev.map(u => u._id === userId ? { ...u, role: newRole } : u));
      setSuccess(null);
      toast.success('Role updated successfully.');
    } catch (err) {
      setError(null);
      toast.error('Failed to update role.');
    } finally {
      setUpdating((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const openGiveawayModal = (user) => {
    setGiveawayUser(user);
    setGiveawayAmount('');
    setGiveawayError(null);
    setGiveawaySuccess(null);
    setShowGiveawayModal(true);
  };

  const closeGiveawayModal = () => {
    setShowGiveawayModal(false);
    setGiveawayUser(null);
    setGiveawayAmount('');
    setGiveawayError(null);
    setGiveawaySuccess(null);
  };

  const handleGiveaway = async () => {
    if (!giveawayAmount || isNaN(giveawayAmount) || Number(giveawayAmount) < 1) {
      setGiveawayError('Enter a valid amount.');
      return;
    }
    setGiveawayLoading(true);
    setGiveawayError(null);
    setGiveawaySuccess(null);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${process.env.REACT_APP_API_URL}/api/users/${giveawayUser.discordId}/giveaway`,
        { amount: Number(giveawayAmount) },
        {
          headers: {
            'x-guild-id': MAIN_GUILD_ID,
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        }
      );
      setGiveawaySuccess('Points given successfully!');
      setGiveawayAmount('');
      setTimeout(() => {
        setShowGiveawayModal(false);
        setGiveawayUser(null);
        setGiveawayAmount('');
        setGiveawayError(null);
        setGiveawaySuccess(null);
        toast.success('Points given successfully!');
      }, 800);
    } catch (err) {
      setGiveawayError(err.response?.data?.message || 'Failed to give points.');
    } finally {
      setGiveawayLoading(false);
    }
  };

  const handleUserSearch = async (query) => {
    if (!query || query.length < 2) {
      setFilteredUsers([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/users/search-users`,
        {
          params: { q: encodeURIComponent(query), guildId: MAIN_GUILD_ID },
          headers: { 'x-guild-id': MAIN_GUILD_ID }
        }
      );
      setFilteredUsers(res.data.data || []);
    } catch (err) {
      setFilteredUsers([]);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (userSearch.length >= 2) {
      handleUserSearch(userSearch);
      setShowUserDropdown(true);
    } else {
      setFilteredUsers([]);
      setShowUserDropdown(false);
      setSearchSelectedUser(null);
    }
    // eslint-disable-next-line
  }, [userSearch]);

  const handleSuggestionSelect = (u) => {
    setUserSearch(u.username);
    setShowUserDropdown(false);
    setSearchSelectedUser(u);
    setPage(1);
  };

  const handleClearSearch = () => {
    setUserSearch('');
    setSearchSelectedUser(null);
    setShowUserDropdown(false);
    setPage(1);
  };

  // Only allow superadmin
  if (!user || user.role !== 'superadmin') {
    return <div className="max-w-2xl mx-auto px-4 py-8 text-center text-error text-lg font-semibold">Access denied. Super admin only.</div>;
  }

  // Helper to calculate dropdown position
  const handleDropdownOpen = (userId) => {
    const btn = buttonRefs.current[userId];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const dropdownHeight = 48 * ROLE_OPTIONS.filter(opt => opt.value !== 'all').length; // 48px per option
      const buttonHeight = rect.height;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < dropdownHeight && spaceAbove > dropdownHeight;
      setDropdownPos((prev) => ({
        ...prev,
        [userId]: {
          top: openUp ? rect.top - dropdownHeight : rect.bottom,
          buttonHeight,
          dropdownHeight,
          left: rect.left,
          width: rect.width,
          openUp,
        },
      }));
    }
  };

  // Calculate total pages for filtered users
  const filtered = roleFilter === 'all' ? allUsers : allUsers.filter(u => u.role === roleFilter);
  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const handlePageChange = (selectedItem) => {
    setPage(selectedItem.selected + 1);
  };

  const displayUsers = searchSelectedUser ? [searchSelectedUser] : users;
  const displayTotalPages = searchSelectedUser ? 1 : totalPages;

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-6 lg:px-8 py-8 w-full">
      <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight text-center">User Role Management</h1>
      <div className="flex flex-col sm:flex-row sm:justify-end gap-4 mb-2 w-full">
        <div className="relative w-full sm:w-48" >
          <Listbox value={roleFilter} onChange={setRoleFilter}>
            {({ open }) => (
              <div className="relative w-full">
                <Listbox.Button className="flex items-center justify-between w-full px-3 py-1 rounded bg-surface border border-border text-text-primary hover:bg-primary/10 transition-colors text-sm">
                  <span>{ROLE_OPTIONS.find(opt => opt.value === roleFilter)?.label}</span>
                  <ChevronUpDownIcon className="h-5 w-5 text-text-secondary ml-2" aria-hidden="true" />
                </Listbox.Button>
                <Transition
                  as="div"
                  leave="transition ease-in duration-100"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  {open && (
                    <Listbox.Options className="absolute z-50 mt-1 w-full rounded bg-card border border-border py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none text-left">
                      {ROLE_OPTIONS.map((opt) => (
                        <Listbox.Option
                          key={opt.value}
                          value={opt.value}
                          className={({ active, selected }) =>
                            `cursor-pointer select-none py-2 pl-4 pr-4 text-text-primary text-left ${
                              active ? 'bg-primary/10' : ''
                            } ${selected ? 'font-semibold text-primary' : 'font-normal'}`
                          }
                        >
                          {opt.label}
                        </Listbox.Option>
                      ))}
                    </Listbox.Options>
                  )}
                </Transition>
              </div>
            )}
          </Listbox>
        </div>
      </div>
      {/* Search Bar */}
      <form onSubmit={e => { e.preventDefault(); }} className="mb-4 flex gap-2 items-center justify-center relative">
        <div className="w-64 relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search by username..."
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
            autoComplete="off"
            className="px-3 py-2 border border-border rounded-md bg-background text-sm w-full"
            onBlur={() => setTimeout(() => setShowUserDropdown(false), 150)}
            onFocus={() => userSearch.length >= 2 && setShowUserDropdown(true)}
          />
          {userSearch && (
            <button type="button" onClick={handleClearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary text-xs">✕</button>
          )}
          {showUserDropdown && filteredUsers.length > 0 && (
            <ul
              className="absolute z-50 bg-card border border-border rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg w-full"
              style={{ minWidth: inputRef.current?.offsetWidth, width: inputRef.current?.offsetWidth }}
            >
              {filteredUsers.map(u => (
                <li
                  key={u.discordId}
                  className="px-4 py-2 cursor-pointer hover:bg-primary/10 text-text-primary"
                  onMouseDown={() => handleSuggestionSelect(u)}
                >
                  {u.username} <span className="text-xs text-text-tertiary">({u.discordId})</span>
                </li>
              ))}
            </ul>
          )}
          {searchLoading && <div className="text-xs text-text-tertiary mt-1">Searching...</div>}
        </div>
      </form>
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        null
      ) : (
        <>
          <div className="bg-card rounded-lg shadow-lg overflow-x-auto w-full">
            <div className="min-w-[500px] sm:min-w-full">
              <table className="min-w-full divide-y divide-border text-xs sm:text-sm table-auto">
                <thead className="bg-card">
                  <tr>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider whitespace-nowrap">Username</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider whitespace-nowrap">Discord ID</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider whitespace-nowrap">Role</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 bg-surface/70 border border-border rounded-lg p-8 mx-auto max-w-md">
                          <UserGroupIcon className="h-10 w-10 text-primary mb-2" aria-hidden="true" />
                          <span className="text-text-secondary text-base font-medium">No users with this role found.</span>
                          <span className="text-text-tertiary text-sm">Try selecting a different role or check back later.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    displayUsers.map((u, index) => {
                      const isOpen = openDropdown === u._id;
                      const isCurrentUser = user && u._id === user._id;
                      return (
                        <tr
                          key={u._id}
                          className={isCurrentUser ? 'bg-primary/10 font-semibold' : ''}
                        >
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-sm text-text-primary whitespace-nowrap">{u.username}</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-sm text-text-secondary whitespace-nowrap">{u.discordId}</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-sm text-text-secondary whitespace-nowrap">{u.role || <span className="italic text-text-tertiary">Unknown</span>}</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-sm whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2 min-w-[140px]">
                              <DropdownMenu.Root
                                open={openDropdown === u._id}
                                onOpenChange={(open) => setOpenDropdown(open ? u._id : null)}
                              >
                                <DropdownMenu.Trigger asChild>
                                  <button
                                    ref={el => buttonRefs.current[u._id] = el}
                                    className={`relative w-full cursor-pointer rounded bg-surface border border-border py-1 pl-3 pr-3 text-left text-text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors duration-150 min-w-[110px] ${isCurrentUser || updating[u._id] ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary hover:bg-primary/5'}`}
                                    disabled={isCurrentUser || updating[u._id]}
                                    title={isCurrentUser ? 'You cannot change your own role' : undefined}
                                  >
                                    <span className="block truncate capitalize">{ROLE_OPTIONS.find(opt => opt.value === u.role)?.label}</span>
                                    {updating[u._id] && (
                                      <span className="absolute right-8 top-1/2 -translate-y-1/2">
                                        <svg className="animate-spin h-4 w-4 text-primary" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                                      </span>
                                    )}
                                  </button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Portal>
                                  <DropdownMenu.Content
                                    align="start"
                                    sideOffset={4}
                                    className="z-50 rounded-lg bg-card border border-border py-1 shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none text-left min-w-[110px] animate-fadeIn"
                                    style={{
                                      minWidth: buttonRefs.current[u._id]?.offsetWidth || 110,
                                      width: buttonRefs.current[u._id]?.offsetWidth || 110,
                                    }}
                                  >
                                    {ROLE_OPTIONS.filter(opt => opt.value !== 'all').map(opt => (
                                      <DropdownMenu.Item
                                        key={opt.value}
                                        onSelect={() => handleRoleChange(u._id, opt.value)}
                                        disabled={u.role === opt.value || isCurrentUser}
                                        className={({ focused, disabled }) =>
                                          `flex items-center gap-2 cursor-pointer select-none py-2 pl-4 pr-4 text-text-primary text-left capitalize transition-colors duration-100
                                          ${u.role === opt.value ? 'font-semibold text-primary bg-primary/10' : 'font-normal'}
                                          ${focused ? 'bg-primary/10' : ''}
                                          ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-primary/10'}
                                          `
                                        }
                                      >
                                        {opt.label}
                                      </DropdownMenu.Item>
                                    ))}
                                  </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                              </DropdownMenu.Root>
                              <button
                                className="px-3 py-1 bg-primary text-white rounded-md text-xs font-medium"
                                onClick={() => openGiveawayModal(u)}
                                disabled={isCurrentUser}
                                title={isCurrentUser ? 'You cannot give points to yourself' : undefined}
                              >
                                Giveaway Points
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
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
              pageCount={displayTotalPages}
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
        </>
      )}
      {/* Giveaway Modal */}
      {showGiveawayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-card rounded-xl shadow-2xl p-8 w-full max-w-md border border-border animate-fadeIn">
            <h2 className="text-2xl font-bold mb-2 text-center text-primary">Giveaway Points</h2>
            <div className="flex flex-col items-center mb-4">
              <UserIcon className="h-10 w-10 text-primary mb-1" />
              <div className="text-lg font-semibold text-text-primary">{giveawayUser?.username}</div>
              <div className="text-xs text-text-tertiary">Discord ID: {giveawayUser?.discordId}</div>
            </div>
            <div className="mb-4">
              <label htmlFor="giveawayAmount" className="block text-sm font-medium text-text-secondary mb-1">Amount</label>
              <input
                id="giveawayAmount"
                type="number"
                min="1"
                placeholder="Enter amount"
                value={giveawayAmount}
                onChange={e => setGiveawayAmount(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary no-spinners"
              />
            </div>
            {giveawayError && <div className="text-error text-sm mb-2 text-center">{giveawayError}</div>}
            {giveawaySuccess && <div className="text-success text-sm mb-2 text-center">{giveawaySuccess}</div>}
            <div className="flex gap-2 justify-end mt-4">
              <button
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md font-medium"
                onClick={closeGiveawayModal}
                disabled={giveawayLoading}
              >Cancel</button>
              <button
                className="px-4 py-2 bg-primary text-white rounded-md font-medium"
                onClick={handleGiveaway}
                disabled={giveawayLoading}
              >{giveawayLoading ? 'Giving...' : 'Give Points'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 