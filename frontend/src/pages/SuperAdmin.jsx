import React, { useEffect, useState, Fragment, useRef, useLayoutEffect } from 'react';
import { Navigate } from 'react-router-dom';
import axios from '../services/axiosConfig';
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/20/solid';
import ReactPaginate from 'react-paginate';
import toast from 'react-hot-toast';
import { UserIcon } from '@heroicons/react/24/outline';
import RadixDialog from '../components/RadixDialog';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore, useGuildStore } from '../store';
import { useUserSearch, useUpdateUserRole, useGiveawayPoints, useAllUsers, useUserPreferences } from '../hooks/useQueryHooks';
import { useLoading } from '../hooks/useLoading';
import LoadingSpinner from '../components/LoadingSpinner';

const ROLE_OPTIONS = [
  { value: 'all', label: 'All Roles' },
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'User' },
];

export const SuperAdmin = () => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  const user = useUserStore(state => state.user);
  const { startLoading, stopLoading, setError: setLoadingError, isLoading, getError, withLoading } = useLoading();
  
  // Debug logging for user role
  // console.log('[SuperAdmin] Current user:', user);
  // console.log('[SuperAdmin] User role:', user?.role);
  // console.log('[SuperAdmin] Selected guild ID:', selectedGuildId);
  // console.log('[SuperAdmin] Is guild switching:', isGuildSwitching);
  // console.log('[SuperAdmin] Can access superadmin page:', user && user.role === 'superadmin');
  
  // Define loading keys
  const LOADING_KEYS = {
    USERS: 'admin-users-list',
    PREFERENCES: 'admin-preferences',
    UPDATE_ROLE: 'update-user-role',
    GIVEAWAY: 'giveaway-points'
  };
  
  const [allUsers, setAllUsers] = useState([]); // Store all users for filtering
  const [users, setUsers] = useState([]); // Users to display on current page
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [updating, setUpdating] = useState({}); // { userId: boolean }
  // For dropdown positioning
  const [dropdownPos, setDropdownPos] = useState({}); // { [userId]: { top, left, width, openUp } }
  const buttonRefs = useRef({});
  // Track which dropdown is open
  const [openDropdown, setOpenDropdown] = useState(null); // userId or null
  // const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'
  const [roleFilter, setRoleFilter] = useState('all');
  const [listboxOpen, setListboxOpen] = useState({}); // { [userId]: boolean }
  const [userPreferences, setUserPreferences] = useState(null);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  // const [totalCount, setTotalCount] = useState(0);
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
  // const [searchLoading, setSearchLoading] = useState(false);
  const inputRef = useRef(null);
  const [searchSelectedUser, setSearchSelectedUser] = useState(null);
  const [showRoleFilterMenu, setShowRoleFilterMenu] = useState(false);
  const roleFilterMenuRef = useRef(null);
  const userRoleDropdownRefs = useRef({});

  // Use React Query hooks for fetching data
  const { 
    data: preferencesData, 
    isLoading: preferencesLoading,
    error: preferencesError 
  } = useUserPreferences(user?.discordId);
  
  const { 
    data: usersData, 
    isLoading: usersLoading, 
    error: usersError 
  } = useAllUsers();
  
  // Update state when preferences data changes
  useEffect(() => {
    if (preferencesData) {
      setUserPreferences(preferencesData);
      setItemsPerPage(preferencesData.itemsPerPage || 10);
    }
  }, [preferencesData]);
  
  // Update state when users data changes
  useEffect(() => {
    if (usersData?.data) {
      setAllUsers(usersData.data);
    }
  }, [usersData]);
  
  // Integrate with LoadingContext
  useEffect(() => {
    if (preferencesLoading) {
      startLoading(LOADING_KEYS.PREFERENCES);
    } else {
      stopLoading(LOADING_KEYS.PREFERENCES);
    }
    
    if (usersLoading) {
      startLoading(LOADING_KEYS.USERS);
    } else {
      stopLoading(LOADING_KEYS.USERS);
    }
    
    // Set errors if queries have errors
    if (preferencesError) {
      setLoadingError(LOADING_KEYS.PREFERENCES, preferencesError);
    }
    
    if (usersError) {
      setLoadingError(LOADING_KEYS.USERS, usersError);
      setError(null);
      toast.error('Failed to load users.');
    }
  }, [preferencesLoading, usersLoading, preferencesError, usersError, startLoading, stopLoading, setLoadingError]);

  // Filter and paginate users on the frontend
  useEffect(() => {
    let filtered = roleFilter === 'all' ? allUsers : allUsers.filter(u => u.role === roleFilter);
    
    // If a specific user is selected from dropdown, show only that user
    if (searchSelectedUser) {
      filtered = [searchSelectedUser];
    } else {
    // Add search filtering by username or Discord ID
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(u =>
        (u.username && u.username.toLowerCase().includes(searchLower)) ||
        (u.discordId && u.discordId.toLowerCase().includes(searchLower))
      );
    }
    }
    
    filtered = [...filtered].sort((a, b) => a.role.localeCompare(b.role));
    const startIdx = (page - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    setUsers(filtered.slice(startIdx, endIdx));
  }, [allUsers, roleFilter, page, itemsPerPage, search, searchSelectedUser]);

  useEffect(() => {
    setPage(1); // Reset to first page when filter changes
  }, [roleFilter]);

  useEffect(() => {
    setPage(1); // Reset to first page when search changes
  }, [search, searchSelectedUser]);

  useEffect(() => {
    const openId = Object.keys(listboxOpen).find(id => listboxOpen[id]);
    setOpenDropdown(openId || null);
  }, [listboxOpen]);

  useLayoutEffect(() => {
    if (openDropdown) {
      handleDropdownOpen(openDropdown);
    }
  }, [openDropdown]);

  useEffect(() => {
    if (!showRoleFilterMenu) return;
    function handleClickOutside(event) {
      if (roleFilterMenuRef.current && !roleFilterMenuRef.current.contains(event.target)) {
        setShowRoleFilterMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showRoleFilterMenu]);

  useEffect(() => {
    if (!openDropdown) return;
    function handleClickOutside(event) {
      const ref = userRoleDropdownRefs.current[openDropdown];
      if (ref && !ref.contains(event.target)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);

  // Use React Query mutation hook for role updates
  const updateRoleMutation = useUpdateUserRole();
  
  const handleRoleChange = async (userId, newRole) => {
    setUpdating((prev) => ({ ...prev, [userId]: true }));
    setError(null);
    setSuccess(null);
    
    try {
      await withLoading(LOADING_KEYS.UPDATE_ROLE, async () => {
        await updateRoleMutation.mutateAsync({ userId, newRole });
        setAllUsers((prev) => prev.map(u => u._id === userId ? { ...u, role: newRole } : u));
        setSuccess(null);
        toast.success('Role updated successfully.');
      });
    } catch (error) {
      setError(null);
      toast.error('Failed to update role.');
    } finally {
      setUpdating((prev) => ({ ...prev, [userId]: false }));
    }
  };

  // const handleSearch = (e) => {
  //   e.preventDefault();
  //   setSearch(searchInput.trim());
  //   setPage(1);
  // };

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

  // Use React Query mutation hook for giveaway
  const giveawayMutation = useGiveawayPoints();

  const handleGiveaway = async () => {
    if (!giveawayAmount || isNaN(giveawayAmount) || Number(giveawayAmount) < 1) {
      setGiveawayError('Enter a valid amount.');
      return;
    }
    
    // Prevent giving points to yourself
    if (giveawayUser && user && giveawayUser.discordId === user.discordId) {
      setGiveawayError('You cannot give points to yourself.');
      return;
    }
    
    setGiveawayLoading(true);
    setGiveawayError(null);
    setGiveawaySuccess(null);
    
    try {
      await withLoading(LOADING_KEYS.GIVEAWAY, async () => {
        await giveawayMutation.mutateAsync({ 
          discordId: giveawayUser.discordId, 
          amount: Number(giveawayAmount) 
        });
        
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
      });
    } catch (err) {
      setGiveawayError(err.response?.data?.message || 'Failed to give points.');
    } finally {
      setGiveawayLoading(false);
    }
  };

  // Use React Query hook for user search
  const {
    data: searchResults,
    isLoading: searchLoading,
    isFetching: isSearchFetching
  } = useUserSearch(userSearch, {
    staleTime: 30000, // 30 seconds
    cacheTime: 300000, // 5 minutes
    refetchOnWindowFocus: false
  });

  // Update filtered users when search results change
  useEffect(() => {
    if (searchResults?.data) {
      setFilteredUsers(searchResults.data || []);
    } else {
      setFilteredUsers([]);
    }
  }, [searchResults]);

  // Show/hide dropdown based on search length
  useEffect(() => {
    if (userSearch.length >= 2) {
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

  // Combined loading state
  const isPageLoading = isLoading(LOADING_KEYS.USERS) || isLoading(LOADING_KEYS.PREFERENCES);
  
  // Only allow superadmin - redirect if not superadmin
  if (!user || user.role !== 'superadmin') {
    // Redirect to dashboard if user is not superadmin
    return <Navigate to="/dashboard" replace />;
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
  // Add search filtering by username or Discord ID
  const searchFiltered = search ? filtered.filter(u => {
    const searchLower = search.toLowerCase();
    return (u.username && u.username.toLowerCase().includes(searchLower)) ||
           (u.discordId && u.discordId.toLowerCase().includes(searchLower));
  }) : filtered;
  
  // If a specific user is selected from dropdown, show only that user
  const finalFiltered = searchSelectedUser ? [searchSelectedUser] : searchFiltered;
  
  const totalPages = Math.ceil(finalFiltered.length / itemsPerPage) || 1;
  const handlePageChange = (selectedItem) => {
    setPage(selectedItem.selected + 1);
  };

  const displayUsers = users;
  const displayTotalPages = totalPages;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-8 w-full"
    >
      <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight text-center font-display">User Role Management</h1>
      <div className="flex flex-col sm:flex-row sm:justify-end gap-4 mb-2 w-full">
        <div className="relative w-full sm:w-48" ref={roleFilterMenuRef}>
          <motion.button
            type="button"
            className="flex items-center justify-between w-full px-3 py-1 rounded-lg bg-surface border border-border text-text-primary hover:bg-primary/10 transition-colors text-sm font-base"
            onClick={() => setShowRoleFilterMenu((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={showRoleFilterMenu}
            whileHover={{ scale: 1.05, boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)', y: -2 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
          >
            <span className="font-base">Role: {ROLE_OPTIONS.find(opt => opt.value === roleFilter)?.label}</span>
            <ChevronDownIcon className="h-5 w-5 text-text-secondary ml-2" aria-hidden="true" />
          </motion.button>
          <AnimatePresence>
            {showRoleFilterMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute z-50 mt-1 w-full rounded-lg bg-card border border-border py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none text-left"
              >
                {ROLE_OPTIONS.map(opt => (
                  <motion.button
                    key={opt.value}
                    onClick={() => { setRoleFilter(opt.value); setShowRoleFilterMenu(false); setPage(1); }}
                    className={`w-full flex items-center justify-between px-4 py-2 text-sm rounded transition-colors text-left font-base
                      ${roleFilter === opt.value ? 'bg-primary/10 text-primary font-semibold' : 'text-text-primary hover:bg-primary/5'}`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    <span className="font-base">{opt.label}</span>
                    {roleFilter === opt.value && <CheckIcon className="h-4 w-4 ml-2" />}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {/* Search Bar */}
      <form onSubmit={e => { e.preventDefault(); }} className="mb-4 flex gap-2 items-center justify-center relative font-base">
        <div className="w-64 relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search by username..."
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
            autoComplete="off"
            className="px-3 py-2 border border-border rounded-md bg-background text-sm w-full font-base"
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
                  className="px-4 py-2 cursor-pointer hover:bg-primary/10 text-text-primary font-base"
                  onMouseDown={() => handleSuggestionSelect(u)}
                >
                  {u.username} <span className="text-xs text-text-tertiary font-mono">({u.discordId})</span>
                </li>
              ))}
            </ul>
          )}
          {searchLoading && <div className="text-xs text-text-tertiary mt-1 font-base">Searching...</div>}
        </div>
      </form>
      {isPageLoading ? (
        <div className="flex justify-center items-center py-8">
          <LoadingSpinner size="lg" color="primary" message="Loading users..." />
        </div>
      ) : error ? (
        null
      ) : (
        <>
          <div className="bg-card rounded-lg shadow-lg overflow-x-auto w-full">
            <div className="min-w-[500px] sm:min-w-full overflow-auto scrollbar-hide">
              <table className="min-w-full divide-y divide-border text-xs sm:text-sm">
                <thead className="bg-card">
                  <tr>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider whitespace-nowrap font-heading">Username</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider whitespace-nowrap font-heading">Discord ID</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider whitespace-nowrap font-heading">Role</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider whitespace-nowrap font-heading">Actions</th>
                  </tr>
                </thead>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.tbody
                    key={`${roleFilter}-${search || ''}-${searchSelectedUser ? searchSelectedUser.discordId : ''}-${page}`}
                    className="divide-y divide-border"
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -24 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                  >
                    {displayUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-sm text-text-secondary font-base">No users found.</td>
                      </tr>
                    ) : (
                      displayUsers.map((u, index) => {
                        const isCurrentUser = user && u._id === user._id;
                        return (
                          <tr
                            key={u._id || index}
                            className={`hover:bg-primary/5 ${isCurrentUser ? 'bg-primary/10 font-semibold' : ''}`}
                          >
                            <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-sm text-text-primary whitespace-nowrap font-base">{u.username}</td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-sm text-text-secondary whitespace-nowrap font-mono">{u.discordId}</td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-sm text-text-secondary whitespace-nowrap font-base">{u.role || <span className="italic text-text-tertiary font-base">Unknown</span>}</td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-sm whitespace-nowrap font-base">
                              <div className="flex items-center justify-center gap-2 min-w-[140px] font-base">
                                <div className="relative w-full min-w-[110px]" ref={el => userRoleDropdownRefs.current[u._id] = el}>
                                  <motion.button
                                    type="button"
                                    className={`relative w-full cursor-pointer rounded bg-surface border border-border py-1 pl-3 pr-3 text-left text-text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors duration-150 font-base ${isCurrentUser || updating[u._id] ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary hover:bg-primary/5'}`}
                                    disabled={isCurrentUser || updating[u._id]}
                                    onClick={() => setOpenDropdown(openDropdown === u._id ? null : u._id)}
                                    aria-haspopup="listbox"
                                    aria-expanded={openDropdown === u._id}
                                    whileHover={{ scale: 1.05, boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)', y: -2 }}
                                    whileTap={{ scale: 0.95 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                                  >
                                    <span className="block truncate capitalize font-base">{ROLE_OPTIONS.find(opt => opt.value === u.role)?.label}</span>
                                    {updating[u._id] && (
                                      <span className="absolute right-8 top-1/2 -translate-y-1/2">
                                        <svg className="animate-spin h-4 w-4 text-primary" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                                      </span>
                                    )}
                                  </motion.button>
                                  <AnimatePresence>
                                    {openDropdown === u._id && (
                                      <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute z-50 mt-1 w-full rounded-lg bg-card border border-border py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none text-left"
                                      >
                                        {ROLE_OPTIONS.filter(opt => opt.value !== 'all').map(opt => (
                                          <motion.button
                                            key={opt.value}
                                            onClick={() => { handleRoleChange(u._id, opt.value); setOpenDropdown(null); }}
                                            disabled={u.role === opt.value || isCurrentUser}
                                            className={`w-full flex items-center justify-between px-4 py-2 text-sm rounded transition-colors text-left font-base
                                              ${u.role === opt.value ? 'bg-primary/10 text-primary font-semibold' : 'text-text-primary hover:bg-primary/5'}
                                              ${isCurrentUser ? 'opacity-60 cursor-not-allowed' : ''}`}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.96 }}
                                          >
                                            <span className="font-base">{opt.label}</span>
                                            {u.role === opt.value && <CheckIcon className="h-4 w-4 ml-2" />}
                                          </motion.button>
                                        ))}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                                <button
                                  className="px-3 py-1 bg-primary text-white rounded-md text-xs font-medium font-base"
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
                  </motion.tbody>
                </AnimatePresence>
              </table>
            </div>
          </div>
          <div className="flex flex-wrap justify-center mt-6 w-full">
            {displayTotalPages > 1 && !searchSelectedUser && (
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
            )}
          </div>
        </>
      )}
      {/* Giveaway Modal */}
      <RadixDialog
        open={showGiveawayModal}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeGiveawayModal();
        }}
        title="Giveaway Points"
        className="max-w-md"
      >
        <div className="flex flex-col items-center mb-4">
          <UserIcon className="h-10 w-10 text-primary mb-1" />
          <div className="text-lg font-semibold text-text-primary font-base">{giveawayUser?.username}</div>
          <div className="text-xs text-text-tertiary font-mono">Discord ID: {giveawayUser?.discordId}</div>
        </div>
        <div className="mb-4">
          <label htmlFor="giveawayAmount" className="block text-sm font-medium text-text-secondary mb-1 font-heading">Amount</label>
          <input
            id="giveawayAmount"
            type="number"
            min="1"
            placeholder="Enter amount"
            value={giveawayAmount}
            onChange={e => setGiveawayAmount(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary no-spinners font-mono"
          />
        </div>
        {giveawayError && <div className="text-error text-sm mb-2 text-center font-base">{giveawayError}</div>}
        {giveawaySuccess && <div className="text-success text-sm mb-2 text-center font-base">{giveawaySuccess}</div>}
        <div className="flex gap-2 justify-end mt-4">
          <button
            onClick={closeGiveawayModal}
            className="px-4 py-2 bg-text-secondary/20 text-text-secondary rounded-md font-medium font-base"
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-primary text-white rounded-md font-medium font-base"
            onClick={handleGiveaway}
            disabled={giveawayLoading || isLoading(LOADING_KEYS.GIVEAWAY)}
          >
            {isLoading(LOADING_KEYS.GIVEAWAY) ? (
              <span className="flex items-center">
                <span className="mr-2">Giving</span>
                <LoadingSpinner size="sm" color="white" />
              </span>
            ) : 'Give Points'}
          </button>
        </div>
      </RadixDialog>
    </motion.div>
  );
};