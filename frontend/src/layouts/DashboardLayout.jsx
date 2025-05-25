import React, { useEffect, useState, useRef } from 'react';
import { Outlet } from 'react-router-dom'; // Import Outlet
import { useAuth } from '../contexts/AuthContext';
import { Sidebar } from '../components/Sidebar';
import { DashboardNavigation } from '../components/DashboardNavigation';
import { getWalletBalance, setupWebSocket, getActiveBets } from '../services/api'; // Import necessary API functions and getActiveBets
import { DashboardContext } from '../contexts/DashboardContext'; // Assuming you have a DashboardContext

export const DashboardLayout = () => {
  const { user } = useAuth();
  const [walletBalance, setWalletBalance] = useState(0); // Wallet balance state
  const [activeBets, setActiveBets] = useState([]); // Add state for active bets
  const wsRef = useRef(null); // WebSocket ref
  // Add loading state for the layout's data fetches
  const [loading, setLoading] = useState(true);
  const [suppressWalletBalance, setSuppressWalletBalance] = useState(false);
  const [prevWalletBalance, setPrevWalletBalance] = useState(0);
  const [pendingWalletBalance, setPendingWalletBalance] = useState(null);

  // When suppression is enabled, store the previous balance
  useEffect(() => {
    if (suppressWalletBalance) {
      setPrevWalletBalance(walletBalance);
    }
    // eslint-disable-next-line
  }, [suppressWalletBalance]);

  // When suppression is turned off, apply pendingWalletBalance if set
  useEffect(() => {
    if (!suppressWalletBalance && pendingWalletBalance !== null) {
      setWalletBalance(pendingWalletBalance);
      setPendingWalletBalance(null);
    }
  }, [suppressWalletBalance, pendingWalletBalance]);

  // Fetch initial data (balance and active bets)
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.discordId) return;
      try {
        setLoading(true); // Set loading before fetching
        const [balanceData, activeBetsData] = await Promise.all([
          getWalletBalance(user.discordId),
          getActiveBets() // Fetch initial active bets
        ]);
        setWalletBalance(balanceData.balance);
        setActiveBets(activeBetsData); // Set initial active bets
      } catch (error) {
        console.error('Error fetching initial dashboard data:', error);
      } finally {
        setLoading(false); // Unset loading after fetching
      }
    };
    fetchData();
  }, [user]); // Fetch when user changes

  // Setup WebSocket connection
  useEffect(() => {
    if (!user?.discordId || wsRef.current) return;

    const handleWebSocketMessage = async (data) => { // Make handler async to allow refetching
      // console.log('WebSocket message received in DashboardLayout:', data);
      switch (data.type) {
        case 'BALANCE_UPDATE':
          if (suppressWalletBalance) {
            setPendingWalletBalance(data.balance);
          } else {
            setWalletBalance(data.balance);
          }
          break;
        case 'BET_CREATED':
        case 'BET_CLOSED':
        case 'BET_RESOLVED':
        case 'BET_UPDATED':
          // When a bet-related event occurs, refetch active bets
          try {
            const updatedActiveBets = await getActiveBets();
            setActiveBets(updatedActiveBets);
          } catch (error) {
            console.error('Error refetching active bets via WS update:', error);
          }
          break;
        case 'TRANSACTION':
           // TODO: Potentially update transaction history here if needed in layout
           // For now, we only update balance for transactions via BALANCE_UPDATE
           break;
        default:
          // // console.log('Unknown message type in DashboardLayout WS:', data.type);
          break;
      }
    };

    wsRef.current = setupWebSocket(handleWebSocketMessage, user.discordId);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [user, setWalletBalance, setActiveBets, suppressWalletBalance]); // Depend on user, and setters

  // Add loading screen for the layout
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Dashboard Navigation (receives balance state) */}
      <DashboardNavigation 
        walletBalance={walletBalance} 
        setWalletBalance={setWalletBalance} 
      />

      <div className="flex">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content Area - Renders nested routes */}
        <main className="flex-1 pl-64 pt-16">
          {/* Outlet renders the matched child route element */}
          <DashboardContext.Provider value={{ walletBalance, activeBets, suppressWalletBalance, setSuppressWalletBalance, prevWalletBalance, setPrevWalletBalance }}>
            <Outlet />
          </DashboardContext.Provider>
        </main>
      </div>
    </div>
  );
}; 