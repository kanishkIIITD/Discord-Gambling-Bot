import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Outlet } from 'react-router-dom'; // Import Outlet
import { Sidebar } from '../components/Sidebar';
import { DashboardNavigation } from '../components/DashboardNavigation';
import PerformanceDashboard from '../components/PerformanceDashboard';
import useDashboardData from '../hooks/useDashboardData';
import LoadingSpinner from '../components/LoadingSpinner';

export const DashboardLayout = () => {
  // Use the optimized dashboard data hook
  const { 
    isLoading,
    isInitialLoadComplete,
    isGuildSwitching,
    loadingKeys,
  } = useDashboardData();
  
  const navRef = useRef(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth < 768); // Start collapsed on mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768); // Track mobile state

  // Listen for nav height changes on resize - simplified
  useEffect(() => {
    if (!navRef.current) return;
    
    // Simple height update without complex calculations
    const updateNavHeight = () => {
      const height = navRef.current.offsetHeight;
      // We're not using navHeight anymore, but keeping the ref for potential future use
    };
    
    // Initial set
    updateNavHeight();
    
    // Update on window resize
    window.addEventListener('resize', updateNavHeight);
    
    return () => {
      window.removeEventListener('resize', updateNavHeight);
    };
  }, []);
  
  // Handle window resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      const isMobileView = window.innerWidth < 768;
      setIsMobile(isMobileView);
      
      // Only auto-collapse if switching from desktop to mobile for the first time
      if (isMobileView && !isMobile && !sidebarCollapsed) {
        setSidebarCollapsed(true);
      }
      
      // Update CSS variable for sidebar width
      document.documentElement.style.setProperty('--sidebar-width', sidebarCollapsed ? '4rem' : '16rem');
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Call once on mount
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarCollapsed, isMobile]);

  // Update CSS variable when sidebar collapse state changes
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', sidebarCollapsed ? '4rem' : '16rem');
  }, [sidebarCollapsed]);
  
  // Track if we've shown the dashboard at least once
  const [hasShownDashboard, setHasShownDashboard] = useState(false);
  
  // Once we've shown the dashboard, don't go back to the loading screen
  // unless we're switching guilds
  useEffect(() => {
    if (isInitialLoadComplete && !hasShownDashboard) {
      setHasShownDashboard(true);
    }
  }, [isInitialLoadComplete, hasShownDashboard]);
  
  // Only show loading screen for initial load, not during guild switching
  const shouldShowLoadingScreen = 
    (!hasShownDashboard && isLoading) && !isGuildSwitching;
  
  // Add loading screen for the layout
  if (shouldShowLoadingScreen) {
    // console.log('[DashboardLayout] Showing loading spinner - dashboard loading');
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner 
          size="lg" 
          color="primary" 
          message="Loading dashboard..." 
        />
      </div>
    );
  }

  return (
    <motion.div 
      className="min-h-screen bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ 
        duration: 0.6,
        ease: "easeOut",
        delay: 0.1
      }}
    >
      {/* Navigation bar at the top */}
      <header ref={navRef} className="w-full sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border shadow-sm">
        <DashboardNavigation 
          suppressWalletBalance={false}
          onProfileMenuToggle={() => {}}
          onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </header>
      
      <div className="flex flex-1 relative">

        {/* Sidebar */}
        <aside 
          className={`overflow-x-hidden fixed left-0 z-40 overflow-y-auto transition-all duration-300 ease-in-out bg-surface ${isMobile ? (sidebarCollapsed ? '-translate-x-full' : 'translate-x-0') : ''}`}
          style={{ 
            width: isMobile ? '16rem' : 'var(--sidebar-width)',
            top: '64px', // Use fixed height instead of dynamic
            height: 'calc(100vh - 64px)', // Use fixed height instead of dynamic
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          }}
        >
          <Sidebar 
            onCollapse={setSidebarCollapsed} 
            collapsed={sidebarCollapsed}
            isMobile={isMobile}
          />
        </aside>
      
        {/* Overlay for mobile sidebar */}
        {isMobile && !sidebarCollapsed && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-30 transition-opacity duration-300"
            onClick={() => setSidebarCollapsed(true)}
            aria-hidden="true"
            style={{ 
              top: '64px' // Use fixed height instead of dynamic
            }}
          />
        )}
        
        {/* Content area */}
        <div 
          className="flex-1 transition-all duration-300 ease-in-out" 
          style={{ 
            marginLeft: isMobile ? '0' : 'var(--sidebar-width)',
            width: isMobile ? '100%' : 'calc(100% - var(--sidebar-width))',
          }}
        >
          {/* Main content area */}
          <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 bg-background min-h-screen">
            <motion.div 
              className="h-full rounded-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}>
              {/* Using Zustand stores directly instead of DashboardContext.Provider */}
              <Outlet />
            </motion.div>
          </main>
        </div>
      </div>
      
      {/* Mobile sidebar toggle button */}
      {isMobile && sidebarCollapsed && (
        <button 
          className="fixed bottom-6 right-6 z-50 bg-primary text-white p-3 rounded-full shadow-lg hover:bg-primary-dark transition-colors duration-200"
          onClick={() => setSidebarCollapsed(false)}
          aria-label="Open sidebar"
          style={{
            bottom: '1.5rem',
            right: '1.5rem',
            zIndex: 50
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}
      
      {/* Performance Dashboard (only in development mode) */}
      {process.env.NODE_ENV === 'development' && <PerformanceDashboard />}
    </motion.div>
  );
};