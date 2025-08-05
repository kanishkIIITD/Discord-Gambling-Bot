import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUserStore } from '../store';
import { motion, AnimatePresence } from 'framer-motion';

export const Sidebar = ({ onCollapse, collapsed, isMobile }) => {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState({});
  const user = useUserStore(state => state.user);
  const sidebarRef = useRef(null);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  
  // Handle touch gestures for mobile swipe
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };
  
  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    
    if (isLeftSwipe && !collapsed) {
      // Close sidebar on left swipe when open
      onCollapse(true);
    } else if (isRightSwipe && collapsed) {
      // Open sidebar on right swipe when closed
      onCollapse(false);
    }
    
    // Reset values
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Toggle sidebar collapse state
  const toggleCollapse = () => {
    onCollapse(!collapsed);
  };

  // Expand section if any child link is active on load
  useEffect(() => {
    const initialExpanded = {};
    menuItems.forEach(section => {
      if (section.items && section.items.some(item => isActive(item.path))) {
        initialExpanded[section.title] = true;
      }
    });
    setExpandedSections(initialExpanded);
  }, [location.pathname, location.search]); // Re-run when location or search params change

  const isActive = (path) => {
    // Extract pathname from path if it contains query parameters
    const pathWithoutQuery = path.split('?')[0];
    
    // Check for exact match for single items (ignoring query parameters)
    if (location.pathname === pathWithoutQuery) return true;
    // Check if path is a prefix for section links (e.g., /dashboard/betting)
    if (pathWithoutQuery.endsWith('/') && location.pathname.startsWith(pathWithoutQuery)) return true;
    // Check if current path is a child of a section path (e.g. /dashboard/betting/active is child of /dashboard/betting)
    if (sectionPaths[path] && location.pathname.startsWith(sectionPaths[path])) return true;
    return false;
  };

  const toggleSection = (sectionTitle) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionTitle]: !prev[sectionTitle]
    }));
  };

  const menuItems = [
    {
      title: 'DASHBOARD',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6" /></svg>
      ),
      path: '/dashboard',
      isDirect: true
    },
    {
      title: 'BETTING',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M16.2 7.8l-2.8 2.8m-2.8 2.8L7.8 16.2"></path><path d="M7.8 7.8l8.4 8.4"></path></svg>
      ),
      items: [
        ...(user && (user.role === 'admin' || user.role === 'superadmin') ? [{ name: 'Create Bet', path: '/dashboard/betting/create' }] : []),
        { name: 'View Bet', path: '/dashboard/betting/view' },
        { name: 'Active Bets', path: '/dashboard/betting/active' },
        { name: 'My Bets', path: '/dashboard/betting/my' },
        { name: 'Bet History', path: '/dashboard/betting/history' }
      ]
    },
    {
      title: 'GAMES',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
      ),
      items: [
        { name: 'Coin Flip', path: '/dashboard/games/coinflip' },
        { name: 'Dice Roll', path: '/dashboard/games/diceroll' },
        { name: 'Slots', path: '/dashboard/games/slots' },
        { name: 'Blackjack', path: '/dashboard/games/blackjack' },
        { name: 'Roulette', path: '/dashboard/games/roulette' }
      ]
    },
    {
      title: 'WALLET',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20h-4.172a2 2 0 0 1-1.414-.586L9.414 15.414a2 2 0 0 0-1.414-.586H3V4h18v16z"></path><line x1="10" y1="12" x2="14" y2="12"></line><line x1="12" y1="10" x2="12" y2="14"></line></svg>
      ),
      items: [
        { name: 'Transactions', path: '/dashboard/wallet/transactions' },
        { name: 'Gift Points', path: '/dashboard/wallet/gift' }
      ]
    },
    {
      title: 'POKÉMON',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
      ),
      items: [
        { name: 'Pokédex', path: '/dashboard/pokedex' },
        { name: 'Evolution Tracker', path: '/dashboard/evolution' }
      ]
    },
    {
      title: 'STATISTICS',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"></path><path d="M12 20V4"></path><path d="M6 20v-6"></path></svg>
      ),
      path: '/dashboard/statistics?range=7days',
      isDirect: true
    },
    {
      title: 'LEADERBOARD',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20v-6m0 0V4m0 10l-4 4m4-4l4 4m-4-4l-4-4m4 4l4-4"></path></svg>
      ),
      items: [
        { name: 'Top Players', path: '/dashboard/leaderboard/top' },
        { name: 'Win Streaks', path: '/dashboard/leaderboard/streaks' },
        { name: 'Biggest Wins', path: '/dashboard/leaderboard/wins' }
      ]
    },
    {
      title: 'SETTINGS',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .35 1.33L21 19l-2 2-2.17-.35a1.65 1.65 0 0 0-1.33-.35H9.65a1.65 1.65 0 0 0-1.33.35L5 21l-2-2 1.35-2.17a1.65 1.65 0 0 0-.35-1.33L3 9l2-2 2.17.35a1.65 1.65 0 0 0 1.33-.35L12 5l2-2 2.17.35a1.65 1.65 0 0 0 1.33.35H19.4z"></path></svg>
      ),
      items: [
        { name: 'Profile', path: '/dashboard/settings/profile' },
        { name: 'Preferences', path: '/dashboard/settings/preferences' },
        { name: 'Help', path: '/dashboard/settings/help' }
      ]
    }
  ];

  // Helper object to map item paths to section paths for isActive check
  const sectionPaths = menuItems.reduce((acc, section) => {
    if (section.items) {
      section.items.forEach(item => {
        // Extract pathname without query parameters
        const itemPathWithoutQuery = item.path.split('?')[0];
        const sectionPathWithoutQuery = section.path ? section.path.split('?')[0] : null;
        
        // Map both the full path and the path without query
        acc[item.path] = section.path;
        acc[itemPathWithoutQuery] = sectionPathWithoutQuery;
      });
    }
    return acc;
  }, {});

  // Adjust isActive to correctly identify active section based on child routes
  const isSectionActive = (section) => {
    if (!section.items) return false;
    return section.items.some(item => location.pathname.startsWith(item.path));
  };

  return (
    <>
      {/* Sidebar */}
      <motion.aside
        ref={sidebarRef}
        className={`h-full bg-card border-r border-border-primary overflow-y-auto ${collapsed ? 'w-16' : 'w-64'} ${isMobile ? 'shadow-lg' : ''}`}
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: 1,
          width: collapsed ? 64 : 256,
          x: isMobile && collapsed ? -300 : 0 // Slide out of view when collapsed on mobile
        }}
        transition={{ 
          type: 'spring', 
          stiffness: 300, 
          damping: 30 
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        
        <div className="p-2">
          {menuItems.map((section, index) => (
            section.isDirect ? (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <motion.div
                  whileHover={{ scale: 1.02, x: 3 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    to={section.path}
                    className={`flex items-center px-2 py-2 mb-2 rounded-lg text-sm font-semibold uppercase tracking-wider font-heading ${
                      isActive(section.path)
                        ? 'bg-primary/10 text-primary'
                        : 'text-text-secondary hover:bg-primary/5 hover:text-primary'
                    } ${collapsed ? 'justify-center' : ''}`}
                    title={collapsed ? section.title : undefined}
                  >
                    <motion.div
                      animate={{ scale: location.pathname === section.path ? 1.1 : 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                    >
                      {section.icon}
                    </motion.div>
                    {!collapsed && (
                      <motion.span
                        className="font-heading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        {section.title}
                      </motion.span>
                    )}
                  </Link>
                </motion.div>
              </motion.div>
            ) : (
                <motion.div 
                  key={index} 
                  className="mb-2 last:mb-0"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <motion.button
                    onClick={() => toggleSection(section.title)}
                    className={`w-full flex items-center px-2 py-2 rounded-lg justify-between ${
                      isSectionActive(section)
                        ? 'bg-primary/10 text-primary'
                        : expandedSections[section.title]
                          ? 'bg-card hover:bg-primary/5 text-text-primary'
                          : 'text-text-secondary hover:bg-primary/5 hover:text-primary'
                    } ${collapsed ? 'justify-center' : ''}`}
                    title={collapsed ? section.title : undefined}
                    whileHover={{ scale: 1.02, x: 3 }}
                    whileTap={{ scale: 0.98 }}
                  >
                  <div className={`flex items-center ${collapsed ? 'justify-center w-full' : ''}`}>
                    <motion.div
                      animate={{ scale: isSectionActive(section) ? 1.1 : 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                    >
                      {section.icon}
                    </motion.div>
                    {!collapsed && (
                      <motion.h3 
                        className={`text-sm font-semibold uppercase tracking-wider font-heading ${
                          isSectionActive(section) ? 'text-primary' : ''
                        }`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        {section.title}
                      </motion.h3>
                    )}
                  </div>
                  {!collapsed && (
                    <motion.svg
                      className="w-4 h-4 text-text-secondary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      animate={{ rotate: expandedSections[section.title] ? 180 : 0 }}
                      transition={{ duration: 0.3, type: 'spring', stiffness: 300 }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </motion.svg>
                  )}
                </motion.button>
                <AnimatePresence>
                  {expandedSections[section.title] && !collapsed && (
                    <motion.div 
                      className="overflow-hidden"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 30 }}
                    >
                      <div className="space-y-1 mt-1 pl-6">
                        {section.items.map((item, itemIndex) => (
                          <motion.div
                            key={itemIndex}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: itemIndex * 0.05 }}
                          >
                            <motion.div
                              whileHover={{ scale: 1.02, x: 3 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <Link
                                to={item.path}
                                className={`flex items-center px-2 py-2 text-sm rounded-lg transition-colors font-base ${
                                  isActive(item.path)
                                    ? 'bg-primary/20 text-primary font-medium'
                                    : 'text-text-secondary hover:bg-primary/5 hover:text-primary'
                                }`}
                                title={collapsed ? item.name : undefined}
                              >
                                <motion.span
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  {item.name}
                                </motion.span>
                              </Link>
                            </motion.div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {/* When collapsed, show section items as tooltips only on icon hover (optional, for accessibility) */}
                {collapsed && (
                  <div className="absolute left-16 z-50">
                    {/* Optionally, you could render a tooltip here if desired */}
                  </div>
                )}
              </motion.div>
            )
          ))}
          {/* Super Admin Section - only for superadmins */}
          {user?.role === 'superadmin' && (
            <motion.div 
              className="mb-2 last:mb-0"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: menuItems.length * 0.05 }}
            >
              <motion.div
                whileHover={{ scale: 1.02, x: 3 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  to="/dashboard/superadmin"
                  className={`w-full flex items-center px-2 py-2 rounded-lg transition-colors ${
                    isActive('/dashboard/superadmin')
                      ? 'bg-primary/10 text-primary'
                      : 'text-text-secondary hover:bg-primary/5 hover:text-primary'
                  } ${collapsed ? 'justify-center' : ''}`}
                  title={collapsed ? 'Super Admin' : undefined}
                >
                  <motion.div
                    animate={{ scale: isActive('/dashboard/superadmin') ? 1.1 : 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                  >
                    {/* Shield/Star icon for super admin */}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2l3 7h7l-5.5 4.5L17 21l-5-3-5 3 1.5-7.5L2 9h7z" />
                    </svg>
                  </motion.div>
                  {!collapsed && (
                    <motion.span 
                      className="text-sm font-semibold uppercase tracking-wider font-heading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      Super Admin
                    </motion.span>
                  )}
                </Link>
              </motion.div>
            </motion.div>
          )}
        </div>
      </motion.aside>
    </>
  );
};
