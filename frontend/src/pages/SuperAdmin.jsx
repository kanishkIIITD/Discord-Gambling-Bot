import React, { useEffect, useState, Fragment, useRef, useLayoutEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Listbox, Transition } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';
import { getAllUsers, getUserPreferences } from '../services/api';
import ReactPaginate from 'react-paginate';
import toast from 'react-hot-toast';
import { UserGroupIcon } from '@heroicons/react/24/outline';

const ROLE_OPTIONS = [
  { value: 'all', label: 'All Roles' },
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'User' },
];

export const SuperAdmin = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
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
  const [totalCount, setTotalCount] = useState(0);

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
          const { data, totalCount } = await getAllUsers(page, prefs.itemsPerPage);
          setUsers(data);
          setTotalCount(totalCount);
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
  }, [user, page, userPreferences?.itemsPerPage]);

  // Sync openDropdown with Listbox open state
  useEffect(() => {
    const openId = Object.keys(listboxOpen).find(id => listboxOpen[id]);
    setOpenDropdown(openId || null);
  }, [listboxOpen]);

  // Update dropdown position when openDropdown changes
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
        { role: newRole }
      );
      setUsers((prev) => prev.map(u => u._id === userId ? { ...u, role: newRole } : u));
      setSuccess(null);
      toast.success('Role updated successfully.');
    } catch (err) {
      setError(null);
      toast.error('Failed to update role.');
    } finally {
      setUpdating((prev) => ({ ...prev, [userId]: false }));
    }
  };

  // Filter users by role
  const filteredUsers = roleFilter === 'all' ? users : users.filter(u => u.role === roleFilter);
  // Sort by role for consistency
  const sortedUsers = [...filteredUsers].sort((a, b) => a.role.localeCompare(b.role));

  // Only allow superadmin
  if (!user || user.role !== 'superadmin') {
    return <div className="max-w-2xl mx-auto px-4 py-8 text-center text-error text-lg font-semibold">Access denied. Super admin only.</div>;
  }

  // Helper to calculate dropdown position
  const handleDropdownOpen = (userId) => {
    const btn = buttonRefs.current[userId];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const dropdownHeight = 48 * ROLE_OPTIONS.length; // 48px per option
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < dropdownHeight && spaceAbove > dropdownHeight;
      setDropdownPos((prev) => ({
        ...prev,
        [userId]: {
          top: openUp ? rect.top - dropdownHeight : rect.bottom,
          left: rect.left,
          width: rect.width,
          openUp,
        },
      }));
    }
  };

  const totalPages = userPreferences ? Math.ceil(totalCount / userPreferences.itemsPerPage) : 1;
  const handlePageChange = (selectedItem) => {
    setPage(selectedItem.selected + 1);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight text-center">User Role Management</h1>
      <div className="flex justify-end mb-2">
        <Listbox value={roleFilter} onChange={setRoleFilter}>
          {({ open }) => (
            <div className="relative w-48">
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
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        null
      ) : (
        <>
          <div className="bg-card rounded-lg shadow-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-card">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Username</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Discord ID</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedUsers.length === 0 ? (
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
                  sortedUsers.map((u, index) => {
                    const isOpen = openDropdown === u._id;
                    const isCurrentUser = user && u._id === user._id;
                    return (
                      <tr
                        key={u._id}
                        className={isCurrentUser ? 'bg-primary/10 font-semibold' : ''}
                      >
                        <td className="px-6 py-4 text-center text-sm text-text-primary">{u.username}</td>
                        <td className="px-6 py-4 text-center text-sm text-text-secondary">{u.discordId}</td>
                        <td className="px-6 py-4 text-center text-sm text-text-secondary">{u.role}</td>
                        <td className="px-6 py-4 text-center text-sm">
                          <div className="flex items-center justify-center gap-2 min-w-[140px]">
                            <Listbox
                              value={u.role}
                              onChange={role => {
                                handleRoleChange(u._id, role);
                                setOpenDropdown(null);
                              }}
                              disabled={isCurrentUser || updating[u._id]}
                            >
                              {({ open }) => (
                                <div className="relative w-full">
                                  <Listbox.Button
                                    ref={el => (buttonRefs.current[u._id] = el)}
                                    className={`relative w-full cursor-pointer rounded bg-surface border border-border py-1 pl-3 pr-8 text-left text-text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors duration-150 min-w-[110px] ${isCurrentUser || updating[u._id] ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary'}`}
                                    title={isCurrentUser ? 'You cannot change your own role' : undefined}
                                    onClick={() => setOpenDropdown(isOpen ? null : u._id)}
                                  >
                                    <span className="block truncate capitalize">{ROLE_OPTIONS.find(opt => opt.value === u.role)?.label}</span>
                                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                      <ChevronUpDownIcon className="h-5 w-5 text-text-secondary" aria-hidden="true" />
                                    </span>
                                    {updating[u._id] && (
                                      <span className="absolute right-8 top-1/2 -translate-y-1/2">
                                        <svg className="animate-spin h-4 w-4 text-primary" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                                      </span>
                                    )}
                                  </Listbox.Button>
                                  <Transition
                                    as="div"
                                    leave="transition ease-in duration-100"
                                    leaveFrom="opacity-100"
                                    leaveTo="opacity-0"
                                  >
                                    {isOpen && dropdownPos[u._id] && (
                                      <Listbox.Options
                                        className="z-50 rounded bg-card border border-border py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none text-left"
                                        style={{
                                          position: 'fixed',
                                          top: dropdownPos[u._id].top,
                                          left: dropdownPos[u._id].left,
                                          width: dropdownPos[u._id].width,
                                          maxHeight: 'calc(100vh - 32px)',
                                          overflowY: 'auto',
                                          backgroundColor: 'var(--color-card, #18181b)',
                                        }}
                                      >
                                        {/* Arrow indicator with solid background */}
                                        <div
                                          className={`absolute left-6 w-3 h-3 z-50 ${dropdownPos[u._id].openUp ? 'bottom-0 translate-y-full' : 'top-0 -translate-y-full'}`}
                                        >
                                          <svg width="12" height="12" viewBox="0 0 12 12">
                                            <polygon
                                              points="6,0 12,12 0,12"
                                              className="fill-card stroke-border"
                                              style={{ strokeWidth: 1, fill: 'var(--color-card, #18181b)' }}
                                            />
                                          </svg>
                                        </div>
                                        {ROLE_OPTIONS.filter(opt => opt.value !== 'all').map((opt) => (
                                          <Listbox.Option
                                            key={opt.value}
                                            value={opt.value}
                                            className={({ active, selected }) =>
                                              `relative cursor-pointer select-none py-2 pl-4 pr-4 text-text-primary text-left ${
                                                active ? 'bg-primary/10' : ''
                                              } ${selected ? 'font-semibold text-primary' : 'font-normal'}`
                                            }
                                          >
                                            {({ selected }) => (
                                              <span className={`block truncate capitalize ${selected ? 'text-primary' : ''}`}>{opt.label}</span>
                                            )}
                                          </Listbox.Option>
                                        ))}
                                      </Listbox.Options>
                                    )}
                                  </Transition>
                                </div>
                              )}
                            </Listbox>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
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
        </>
      )}
    </div>
  );
}; 