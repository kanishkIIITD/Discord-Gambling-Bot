import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const Sidebar = () => {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState({});
  const [collapsed, setCollapsed] = useState(false); // Sidebar collapse state
  const { user } = useAuth();

  // Expand section if any child link is active on load
  useEffect(() => {
    const initialExpanded = {};
    menuItems.forEach(section => {
      if (section.items && section.items.some(item => isActive(item.path))) {
        initialExpanded[section.title] = true;
      }
    });
    setExpandedSections(initialExpanded);
  }, [location.pathname]); // Re-run when location changes

  const isActive = (path) => {
    // Check for exact match for single items
    if (location.pathname === path) return true;
    // Check if path is a prefix for section links (e.g., /dashboard/betting)
    if (path.endsWith('/') && location.pathname.startsWith(path)) return true;
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
        acc[item.path] = section.path; // Assuming section could have a base path too, adjust if needed
      });
    }
    return acc;
  }, {});

  // Adjust isActive to correctly identify active section based on child routes
  const isSectionActive = (section) => {
    return section.items ? section.items.some(item => location.pathname.startsWith(item.path)) : false;
  };

  return (
    <div
      className={`transition-all duration-200 h-screen fixed left-0 top-16 overflow-y-auto max-h-[calc(100vh-4rem)] border-r border-border bg-card ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Collapse/Expand Button */}
      <div className="flex items-center justify-end p-2">
        <button
          onClick={() => setCollapsed((prev) => !prev)}
          className="p-2 rounded hover:bg-primary/10 focus:outline-none"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {/* Chevron icon rotates depending on state */}
          <svg
            className={`w-5 h-5 text-text-secondary transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4l-8 8 8 8" />
          </svg>
        </button>
      </div>
      <div className="p-2">
        {menuItems.map((section, index) => (
          section.isDirect ? (
            <Link
              key={index}
              to={section.path}
              className={`flex items-center px-2 py-2 mb-2 rounded-lg transition-colors text-sm font-semibold uppercase tracking-wider ${
                location.pathname === section.path
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-secondary hover:bg-primary/5 hover:text-primary'
              } ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? section.title : undefined}
            >
              {section.icon}
              {!collapsed && section.title}
            </Link>
          ) : (
            <div key={index} className="mb-2 last:mb-0">
              <button
                onClick={() => toggleSection(section.title)}
                className={`w-full flex items-center px-2 py-2 rounded-lg transition-colors justify-between ${
                  isSectionActive(section)
                    ? 'bg-primary/10 text-primary'
                    : expandedSections[section.title]
                      ? 'bg-card hover:bg-primary/5 text-text-primary'
                      : 'text-text-secondary hover:bg-primary/5 hover:text-primary'
                } ${collapsed ? 'justify-center' : ''}`}
                title={collapsed ? section.title : undefined}
              >
                <div className={`flex items-center ${collapsed ? 'justify-center w-full' : ''}`}>
                  {section.icon}
                  {!collapsed && (
                    <h3 className={`text-sm font-semibold uppercase tracking-wider ${
                      isSectionActive(section) ? 'text-primary' : ''
                    }`}>
                      {section.title}
                    </h3>
                  )}
                </div>
                {!collapsed && (
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 text-text-secondary ${
                      expandedSections[section.title] ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                )}
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ease-in-out ${
                  expandedSections[section.title] && !collapsed ? 'max-h-96' : 'max-h-0'
                }`}
              >
                <div className={`space-y-1 mt-1 pl-6 ${collapsed ? 'hidden' : ''}`}>
                  {section.items.map((item, itemIndex) => (
                    <Link
                      key={itemIndex}
                      to={item.path}
                      className={`flex items-center px-2 py-2 text-sm rounded-lg transition-colors ${
                        isActive(item.path)
                          ? 'bg-primary/20 text-primary font-medium'
                          : 'text-text-secondary hover:bg-primary/5 hover:text-primary'
                      }`}
                      title={collapsed ? item.name : undefined}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>
              {/* When collapsed, show section items as tooltips only on icon hover (optional, for accessibility) */}
              {collapsed && (
                <div className="absolute left-16 z-50">
                  {/* Optionally, you could render a tooltip here if desired */}
                </div>
              )}
            </div>
          )
        ))}
        {/* Super Admin Section - only for superadmins */}
        {user?.role === 'superadmin' && (
          <div className="mb-2 last:mb-0">
            <Link
              to="/dashboard/superadmin"
              className={`w-full flex items-center px-2 py-2 rounded-lg transition-colors ${
                location.pathname === '/dashboard/superadmin'
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-secondary hover:bg-primary/5 hover:text-primary'
              } ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? 'Super Admin' : undefined}
            >
              <span className={`flex items-center ${collapsed ? 'justify-center w-full' : ''}`}>
                {/* Shield/Star icon for super admin */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l3 7h7l-5.5 4.5L17 21l-5-3-5 3 1.5-7.5L2 9h7z" />
                </svg>
                {!collapsed && <span className="text-sm font-semibold uppercase tracking-wider">Super Admin</span>}
              </span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}; 