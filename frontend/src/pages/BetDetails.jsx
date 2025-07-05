import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { closeBet, resolveBet, cancelBet, editBet, extendBet, refundBet } from '../services/api';
import { toast } from 'react-hot-toast'; // Import toast for notifications
import { ConfirmModal } from '../components/ConfirmModal';
import ReactPaginate from 'react-paginate';
import { formatDisplayNumber } from '../utils/numberFormat';
import RadixDialog from '../components/RadixDialog';
import { useQueryClient } from '@tanstack/react-query';
import LoadingSpinner from '../components/LoadingSpinner';

// Import Zustand stores
import { useUserStore } from '../store/useUserStore';
import { useWalletStore } from '../store/useWalletStore';
import { useGuildStore } from '../store/useGuildStore';
import { useUIStore } from '../store/useUIStore';

// Import Zustand-integrated React Query hooks
import { useZustandQuery, useZustandMutation } from '../hooks/useZustandQuery';
import * as api from '../services/api';

export const BetDetails = ({ betId: propBetId, onBetCanceled }) => {
  // Use Zustand stores instead of Context
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const { betId: routeBetId } = useParams();
  const betId = propBetId || routeBetId;
  const user = useUserStore(state => state.user); // Get user for discordId
  const queryClient = useQueryClient();
  
  // Debug logging for user role
  // console.log('[BetDetails] Current user:', user);
  // console.log('[BetDetails] User role:', user?.role);
  // console.log('[BetDetails] Selected guild ID:', selectedGuildId);
  // console.log('[BetDetails] Can access admin controls:', user && (user.role === 'admin' || user.role === 'superadmin'));
  
  // Define loading keys
  const LOADING_KEYS = {
    BET_DETAILS: 'bet-details',
    PLACED_BETS: 'placed-bets',
    PLACE_BET: 'place-bet'
  };
  
  // Use Zustand-integrated React Query hooks
  const [placedBetsPage, setPlacedBetsPage] = useState(1);
  const [placedBetsPageSize, setPlacedBetsPageSize] = useState(10);
  
  const { data: bet, isLoading: betLoading, error: betError } = useZustandQuery(
    ['betDetails', betId, selectedGuildId],
    () => api.getBetDetails(betId, selectedGuildId),
    {
      enabled: !!betId && !!selectedGuildId,
      staleTime: 1000 * 30, // 30 seconds
      refetchOnMount: true,
      refetchOnWindowFocus: true
    },
    LOADING_KEYS.BET_DETAILS
  );
  
  const { 
    data: placedBetsData, 
    isLoading: placedBetsLoading,
    error: placedBetsError 
  } = useZustandQuery(
    ['placedBets', betId, selectedGuildId, placedBetsPage, placedBetsPageSize],
    () => api.getPlacedBetsForBet(betId, placedBetsPage, placedBetsPageSize, selectedGuildId),
    {
      enabled: !!betId && !!selectedGuildId,
      keepPreviousData: true,
      staleTime: 1000 * 30, // 30 seconds
      refetchOnMount: true,
      refetchOnWindowFocus: true
    },
    LOADING_KEYS.PLACED_BETS
  );
  
  const { data: userPreferences } = useZustandQuery(
    ['userPreferences', user?.discordId],
    () => api.getUserPreferences(user?.discordId),
    {
      enabled: !!user?.discordId
    }
  );
  
  // Loading states are now handled automatically by useZustandQuery
  
  // Extract data from React Query results
  const placedBets = placedBetsData?.data || [];
  const placedBetsTotal = placedBetsData?.totalCount || 0;
  const isDataLoading = betLoading || placedBetsLoading;
  const loadingError = betError || placedBetsError;



  // State for placing a bet
  const [selectedOption, setSelectedOption] = useState('');
  const [betAmount, setBetAmount] = useState('');
  
  // Use the place bet mutation with Zustand integration
  const placeBetMutation = useZustandMutation(
    (params) => api.placeBet(params.betId, params.bettorDiscordId, params.option, params.amount, params.guildId),
    {
      onSuccess: () => {
        // Invalidate queries to refresh data
        // Invalidate all placed bets queries for this bet (with any pagination)
        queryClient.invalidateQueries({
          queryKey: ['placedBets', betId, selectedGuildId],
          exact: false
        });
        queryClient.invalidateQueries(['betDetails', betId, selectedGuildId]);
        queryClient.invalidateQueries(['walletBalance']);
      }
    },
    LOADING_KEYS.PLACE_BET
  );
  const isPlacingBet = placeBetMutation.isLoading;

  // Get wallet balance and actions from Zustand store
  const walletBalance = useWalletStore(state => state.balance);
  const fetchBalance = useWalletStore(state => state.fetchBalance);

  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveOption, setResolveOption] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editOptions, setEditOptions] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendMinutes, setExtendMinutes] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);

  // The backend now provides these totals directly
  const { optionTotals, totalPot } = bet || {};

  // Reset to first page if itemsPerPage changes
  useEffect(() => {
    if (userPreferences) {
      setPlacedBetsPage(1);
    }
  }, [userPreferences]);

  // Set default selected option when bet data is loaded
  useEffect(() => {
    if (bet && bet.status === 'open' && bet.options.length > 0) {
      setSelectedOption(bet.options[0]);
    }
  }, [bet]);

  // Removed wallet balance fetch as it's handled in DashboardLayout
  // useEffect(() => {
  //   const fetchBalance = async () => {
  //     try {
  //       const balanceData = await getWalletBalance();
  //       setWalletBalance(balanceData.balance);
  //     } catch (error) {
  //       console.error('Error fetching wallet balance:', error);
  //     }
  //   };
  //   fetchBalance();
  // }, []);

    const handlePlaceBet = async (e) => {
        e.preventDefault();
        if (!user?.discordId) {
            toast.error('User not authenticated.');
            return;
        }
        if (!selectedOption) {
            toast.error('Please select an option.');
            return;
        }
        const amount = parseInt(betAmount, 10);
        if (isNaN(amount) || amount <= 0) {
            toast.error('Please enter a valid positive amount.');
            return;
        }
        if (amount > walletBalance) {
            toast.error('Insufficient balance.');
             return;
        }
        if (bet.status !== 'open') {
             toast.error('Bet is not open for placing bets.');
             return;
        }
        // Optional: Check if closing time has passed if closingTime is set
         if (bet.closingTime && new Date() > new Date(bet.closingTime)) {
              toast.error('Bet is closed.');
              return;
         }

        try {
            // Loading state is handled automatically by useZustandMutation
            await placeBetMutation.mutateAsync({
                betId,
                bettorDiscordId: user.discordId,
                option: selectedOption,
                amount: amount,
                guildId: selectedGuildId
            });
            
            toast.success('Bet placed successfully!');
            setBetAmount(''); // Clear input after placing bet
            
            // Force a refetch of the placed bets data
            queryClient.refetchQueries({
              queryKey: ['placedBets', betId, selectedGuildId],
              exact: false
            });
            
            // Also invalidate the specific query with pagination
            queryClient.invalidateQueries({
              queryKey: ['placedBets', betId, selectedGuildId, placedBetsPage, placedBetsPageSize],
              exact: true
            });
            
            // Refresh wallet balance after successful bet placement
            if (user?.discordId && selectedGuildId) {
                await fetchBalance(user.discordId, selectedGuildId);
            }

        } catch (error) {
            console.error('Error placing bet:', error);
            const errorMessage = error.response?.data?.message || 'Failed to place bet.';
            toast.error(errorMessage);
            // Error handling is done automatically by useZustandMutation
        }
    };

  // Admin actions
  const handleCloseBet = async () => {
    setAdminActionLoading(true);
    try {
      await closeBet(betId, user.discordId, selectedGuildId);
      toast.success('Bet closed successfully.');
      // Invalidate queries to refresh data
      queryClient.invalidateQueries(['betDetails', betId, selectedGuildId]);
      // Data will be refreshed by React Query
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to close bet.');
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleShowResolveModal = () => {
    setResolveOption(bet.options[0] || '');
    setShowResolveModal(true);
  };
  const handleResolveBet = async () => {
    setAdminActionLoading(true);
    try {
      await resolveBet(betId, resolveOption, user.discordId, selectedGuildId);
      toast.success('Bet resolved successfully.');
      setShowResolveModal(false);
      // Invalidate queries to refresh data
      queryClient.invalidateQueries(['betDetails', betId, selectedGuildId]);
      queryClient.invalidateQueries(['walletBalance']);
      // Refresh wallet balance after resolving bet
      if (user?.discordId && selectedGuildId) {
        await fetchBalance(user.discordId, selectedGuildId);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resolve bet.');
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleCancelBet = async () => {
    setShowCancelModal(true);
  };

  const handleConfirmCancelBet = async () => {
    setShowCancelModal(false);
    setAdminActionLoading(true);
    try {
      await cancelBet(betId, user.discordId, selectedGuildId);
      toast.success('Bet cancelled successfully.');
      // Invalidate queries to refresh data
      queryClient.invalidateQueries(['betDetails', betId, selectedGuildId]);
      queryClient.invalidateQueries(['walletBalance']);
      // Refresh wallet balance after cancelling bet
      if (user?.discordId && selectedGuildId) {
        await fetchBalance(user.discordId, selectedGuildId);
      }
      // Call the callback function to signal the parent
      if (onBetCanceled) {
        onBetCanceled();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel bet.');
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleShowEditModal = () => {
    setEditDescription(bet.description);
    setEditOptions(bet.options.join(', '));
    setEditDuration('');
    setShowEditModal(true);
  };
  const handleEditBet = async () => {
    setAdminActionLoading(true);
    try {
      await editBet(betId, user.discordId, editDescription, editOptions, editDuration ? Number(editDuration) : undefined, selectedGuildId);
      toast.success('Bet edited successfully.');
      setShowEditModal(false);
      // Invalidate queries to refresh data
      queryClient.invalidateQueries(['betDetails', betId, selectedGuildId]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to edit bet.');
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleShowExtendModal = () => {
    setExtendMinutes('');
    setShowExtendModal(true);
  };
  const handleExtendBet = async () => {
    setAdminActionLoading(true);
    try {
      await extendBet(betId, user.discordId, Number(extendMinutes), selectedGuildId);
      toast.success('Bet extended successfully.');
      setShowExtendModal(false);
      // Invalidate queries to refresh data
      queryClient.invalidateQueries(['betDetails', betId, selectedGuildId]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to extend bet.');
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleRefundBet = async () => {
    setAdminActionLoading(true);
    try {
      await refundBet(betId, user.discordId, selectedGuildId);
      toast.success('Bet refunded successfully.');
      setShowRefundModal(false);
      // Invalidate queries to refresh data
      queryClient.invalidateQueries(['betDetails', betId, selectedGuildId]);
      queryClient.invalidateQueries(['walletBalance']);
      // Refresh wallet balance after refunding bet
      if (user?.discordId && selectedGuildId) {
        await fetchBalance(user.discordId, selectedGuildId);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to refund bet.');
    } finally {
      setAdminActionLoading(false);
    }
  };

  // Loading is now handled by LoadingContext
  if (isDataLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" color="primary" message="Loading bet details..." />
      </div>
    );
  }

  if (loadingError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card p-6 rounded-lg shadow-lg max-w-lg w-full">
          <h2 className="text-2xl font-bold text-text-primary mb-4">Error Loading Bet Details</h2>
          <div className="bg-error/10 border border-error/30 rounded-md p-4 mb-6">
            <p className="text-error font-medium">{loadingError.message || 'Failed to load bet details'}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-md"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!bet) {
      return <div className="min-h-screen bg-background text-text-secondary flex items-center justify-center">Bet not found.</div>;
  }

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight font-display">Bet Details</h1>
        <div className="bg-card rounded-lg shadow-lg p-6 mb-8 space-y-4">
          <h2 className="text-2xl font-semibold text-text-primary tracking-wide font-accent">{bet.description}</h2>
          <div className="text-text-secondary leading-relaxed tracking-wide grid grid-cols-1 md:grid-cols-2 gap-4 font-base">
            <p><strong>Bet ID:</strong> <span className="font-mono">{bet._id}</span></p>
            <p><strong>Status:</strong> <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full font-heading ${
                                bet.status === 'open' ? 'bg-success/20 text-success' :
                                bet.status === 'closed' ? 'bg-warning/20 text-warning' :
                                bet.status === 'resolved' ? 'bg-info/20 text-info' : 'bg-gray-500/20 text-gray-400'
                             }`}>{bet.status}</span></p>
            {bet.creator && bet.creator.username && <p><strong>Created By:</strong> {bet.creator.username}</p>}
            {bet.createdAt && <p><strong>Created At:</strong> {new Date(bet.createdAt).toLocaleString()}</p>}
            {bet.closingTime && <p><strong>Closing Time:</strong> {new Date(bet.closingTime).toLocaleString()}</p>}
            <p className="col-span-full"><strong>Options:</strong> {bet.options.join(', ')}</p>
            {bet.status === 'resolved' && bet.winningOption && <p className="col-span-full text-lg font-semibold text-success font-heading"><strong>Winning Option:</strong> {bet.winningOption}</p>}
          </div>
          {/* Pot and per-option totals - Professional, consistent style */}
          <div className="mt-4 bg-surface rounded-lg p-6 shadow flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-lg font-semibold text-text-primary font-heading">Total Pot</div>
              <div className="text-2xl font-bold text-primary font-mono">{formatDisplayNumber(totalPot)} <span className="text-base font-medium text-text-secondary font-base">points</span></div>
            </div>
            <div className="divide-y divide-border">
              {bet.options.map(option => {
                // Ensure proper type conversion for calculations
                const amount = parseFloat((optionTotals && optionTotals[option]) || 0);
                const total = parseFloat(totalPot) || 0;
                const percent = total > 0 ? ((amount / total) * 100) : 0;
                // Find the leading option
                const maxAmount = optionTotals ? Math.max(...Object.values(optionTotals).map(val => parseFloat(val) || 0)) : 0;
                const isLeading = amount === maxAmount && amount > 0;
                return (
                  <div key={option} className="py-3 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className={`font-medium text-sm font-accent ${isLeading ? 'text-primary' : 'text-text-secondary'}`}>{option}</span>
                      <span className={`font-mono text-base ${isLeading ? 'text-primary font-bold' : 'text-text-primary'}`}>{formatDisplayNumber(amount)} pts</span>
                      <span className="ml-2 text-xs text-text-secondary font-base">({percent.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full h-2 bg-border rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all duration-300"
                        style={{ 
                          width: `${Math.min(percent, 100)}%`,
                          backgroundColor: isLeading ? 'var(--primary)' : 'var(--primary)',
                          opacity: isLeading ? 1 : 0.8                        }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Admin Controls */}
          {user && (user.role === 'admin' || user.role === 'superadmin') && (
            <div className="mt-6 flex flex-wrap gap-2">
              {/* {console.log('[BetDetails] Rendering admin controls for user with role:', user.role)} */}
              <button
                className="px-3 py-1 rounded text-white font-semibold hover:opacity-90 disabled:opacity-60 transition-all duration-200 font-base"
                style={{ backgroundColor: 'var(--primary)' }}
                onClick={handleCloseBet}
                disabled={adminActionLoading || bet.status !== 'open'}
              >
                Close
              </button>
              <button
                className="px-3 py-1 rounded text-white font-semibold hover:opacity-90 disabled:opacity-60 transition-all duration-200 font-base"
                style={{ backgroundColor: 'var(--secondary)' }}
                onClick={handleShowResolveModal}
                disabled={adminActionLoading || bet.status !== 'closed'}
              >
                Resolve
              </button>
              <button
                className="px-3 py-1 rounded text-white font-semibold hover:opacity-90 disabled:opacity-60 transition-all duration-200 font-base"
                style={{ backgroundColor: '#ef4444' }}
                onClick={handleCancelBet}
                disabled={adminActionLoading || bet.status !== 'open'}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1 rounded text-text-primary border font-semibold hover:bg-primary/5 disabled:opacity-60 transition-all duration-200 font-base"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--primary)' }}
                onClick={handleShowEditModal}
                disabled={adminActionLoading || bet.status !== 'open'}
              >
                Edit
              </button>
              <button
                className="px-3 py-1 rounded text-text-primary border font-semibold hover:bg-primary/5 disabled:opacity-60 transition-all duration-200 font-base"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--primary)' }}
                onClick={handleShowExtendModal}
                disabled={adminActionLoading || bet.status !== 'open'}
              >
                Extend
              </button>
              {/* Refund button: show for open/closed, not resolved/cancelled/refunded */}
              {['open', 'closed'].includes(bet.status) && (
                <button
                  className="px-3 py-1 rounded text-white font-semibold hover:opacity-90 disabled:opacity-60 transition-all duration-200 font-base"
                  style={{ backgroundColor: '#f59e0b' }}
                  onClick={() => setShowRefundModal(true)}
                  disabled={adminActionLoading}
                >
                  Refund
                </button>
              )}
            </div>
          )}
        </div>

        {/* Place Bet Form - Only show if bet is open */}
        {bet.status === 'open' && bet.options.length > 0 && ( // Ensure there are options to bet on
            <div className="bg-card rounded-lg shadow-lg p-6 mb-8">
                <h3 className="text-xl font-semibold text-text-primary mb-4 tracking-wide font-heading">Place Your Bet</h3>
                <form onSubmit={handlePlaceBet} className="space-y-4">
                    <div>
                        <label htmlFor="betOption" className="block text-sm font-medium text-text-secondary font-base">Select Option</label>
                        <select
                            id="betOption"
                            name="betOption"
                            value={selectedOption}
                            onChange={(e) => setSelectedOption(e.target.value)}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-background border-border focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTcgMTBMMTIgMTVMMTcgMTBaIiBmaWxsPSIjQzdDOUQxIi8+Cjwvc3ZnPg==')] bg-no-repeat bg-[right_0.75rem_center] font-base"
                        >
                            {bet.options.map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                         <label htmlFor="betAmount" className="block text-sm font-medium text-text-secondary font-base">Amount</label>
                         <input
                            type="number"
                            id="betAmount"
                            name="betAmount"
                            value={betAmount}
                            onChange={(e) => setBetAmount(e.target.value)}
                            min="1"
                            className="mt-1 block w-full pl-3 pr-3 py-2 text-base bg-background border-border focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md no-spinners font-base"
                            placeholder="e.g., 100"
                         />
                     </div>
                     <div>
                         <button
                             type="submit"
                             disabled={isPlacingBet || !selectedOption || betAmount <= 0 || betAmount > walletBalance}
                             className={`w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white font-base ${isPlacingBet ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary`}
                         >
                             {isPlacingBet ? 'Placing Bet...' : 'Place Bet'}
                         </button>
                     </div>
                 </form>
             </div>
         )}

         <div className="bg-card rounded-lg shadow-lg p-6">
             <h3 className="text-xl font-semibold text-text-primary mb-4 tracking-wide font-heading">Placed Bets ({placedBetsTotal})</h3>
              {placedBets.length > 0 ? (
                 <>
                   <div className="overflow-x-auto">
                     <table className="min-w-full divide-y divide-border">
                       <thead className="bg-surface">
                           <tr>
                               <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider font-heading">Bettor</th>
                               <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider font-heading">Amount</th>
                               <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider font-heading">Option</th>
                               <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider font-heading">Placed At</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-border">
                           {placedBets.map(placedBet => (
                               <tr key={placedBet._id} className="hover:bg-primary/5">
                                   <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary font-base">{placedBet.bettor.username}</td>
                                   <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary font-mono">{formatDisplayNumber(placedBet.amount)}</td>
                                   <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary font-accent">{placedBet.option}</td>
                                   <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary font-base">{new Date(placedBet.placedAt || placedBet.createdAt).toLocaleString()}</td>
                               </tr>
                           ))}
                       </tbody>
                     </table>
                   </div>
                   {/* Only show pagination when there are more than 1 page */}
                   {Math.ceil(placedBetsTotal / (userPreferences?.itemsPerPage || 10)) > 1 && (
                   <div className="flex justify-center mt-4">
                     <ReactPaginate
                       previousLabel={"Prev"}
                       nextLabel={"Next"}
                       breakLabel={"..."}
                       breakClassName={"px-2 py-1"}
                       pageCount={Math.ceil(placedBetsTotal / (userPreferences?.itemsPerPage || 10))}
                       marginPagesDisplayed={1}
                       pageRangeDisplayed={3}
                       onPageChange={(selected) => {
                         setPlacedBetsPage(selected.selected + 1);
                         // React Query will automatically refetch with the new page
                       }}
                       forcePage={placedBetsPage - 1}
                       containerClassName={"flex gap-1 items-center"}
                       pageClassName={""}
                       pageLinkClassName={"px-2 py-1 rounded bg-card text-text-secondary hover:bg-primary/10 font-base"}
                       activeClassName={""}
                       activeLinkClassName={"bg-primary text-white"}
                       previousClassName={""}
                       previousLinkClassName={"px-3 py-1 rounded bg-primary text-white disabled:bg-gray-300 disabled:text-gray-500 font-base"}
                       nextClassName={""}
                       nextLinkClassName={"px-3 py-1 rounded bg-primary text-white disabled:bg-gray-300 disabled:text-gray-500 font-base"}
                       disabledClassName={"opacity-50 cursor-not-allowed"}
                     />
                   </div>
                   )}
                 </>
              ) : (
                 <p className="text-text-secondary leading-relaxed tracking-wide font-base">No bets have been placed yet.</p>
              )}
          </div>

      </div>
      {/* Modals for admin actions */}
      <RadixDialog
        open={showResolveModal}
        onOpenChange={setShowResolveModal}
        title="Resolve Bet"
      >
        <div>
          <label className="block mb-2 text-text-secondary font-base">Select Winning Option:</label>
          <select
            className="w-full px-3 py-2 rounded border border-border bg-background text-text-primary mb-4 font-base"
            value={resolveOption}
            onChange={e => setResolveOption(e.target.value)}
          >
            {bet.options.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleResolveBet}
              className="flex-1 py-2 px-4 rounded text-white font-semibold hover:opacity-90 transition-all duration-200 font-base"
              style={{ backgroundColor: 'var(--secondary)' }}
              disabled={adminActionLoading}
            >
              Confirm
            </button>
            <button
              onClick={() => setShowResolveModal(false)}
              className="flex-1 py-2 px-4 rounded text-text-primary border font-semibold hover:bg-primary/5 transition-all duration-200 font-base"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--primary)' }}
              disabled={adminActionLoading}
            >
              Cancel
            </button>
          </div>
        </div>
      </RadixDialog>
      <RadixDialog
        open={showEditModal}
        onOpenChange={setShowEditModal}
        title="Edit Bet"
      >
        <div>
          <label className="block mb-2 text-text-secondary font-base">Description:</label>
          <input
            className="w-full px-3 py-2 rounded border border-border bg-background text-text-primary mb-2 font-base"
            value={editDescription}
            onChange={e => setEditDescription(e.target.value)}
          />
          <label className="block mb-2 text-text-secondary font-base">Options (comma separated):</label>
          <input
            className="w-full px-3 py-2 rounded border border-border bg-background text-text-primary mb-2 font-base"
            value={editOptions}
            onChange={e => setEditOptions(e.target.value)}
          />
          <label className="block mb-2 text-text-secondary font-base">Duration (minutes, optional):</label>
          <input
            className="w-full px-3 py-2 rounded border border-border bg-background text-text-primary mb-2 font-base"
            type="number"
            min="1"
            value={editDuration}
            onChange={e => setEditDuration(e.target.value)}
          />
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleEditBet}
              className="flex-1 py-2 px-4 rounded text-white font-semibold hover:opacity-90 transition-all duration-200 font-base"
              style={{ backgroundColor: 'var(--primary)' }}
              disabled={adminActionLoading}
            >
              Save
            </button>
            <button
              onClick={() => setShowEditModal(false)}
              className="flex-1 py-2 px-4 rounded text-text-primary border font-semibold hover:bg-primary/5 transition-all duration-200 font-base"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--primary)' }}
              disabled={adminActionLoading}
            >
              Cancel
            </button>
          </div>
        </div>
      </RadixDialog>
      <RadixDialog
        open={showExtendModal}
        onOpenChange={setShowExtendModal}
        title="Extend Bet"
        className="max-w-sm w-full p-6"
      >
        <label className="block mb-2 text-text-secondary font-base">Additional Minutes:</label>
        <input
          className="w-full px-3 py-2 rounded border border-border bg-background text-text-primary mb-2 font-base"
          type="number"
          min="1"
          value={extendMinutes}
          onChange={e => setExtendMinutes(e.target.value)}
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleExtendBet}
            className="flex-1 py-2 px-4 rounded text-white font-semibold hover:opacity-90 transition-all duration-200 font-base"
            style={{ backgroundColor: 'var(--primary)' }}
            disabled={adminActionLoading || !extendMinutes}
          >
            Extend
          </button>
          <button
            onClick={() => setShowExtendModal(false)}
            className="flex-1 py-2 px-4 rounded text-text-primary border font-semibold hover:bg-primary/5 transition-all duration-200 font-base"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--primary)' }}
            disabled={adminActionLoading}
          >
            Cancel
          </button>
        </div>
      </RadixDialog>
      {showCancelModal && (
        <ConfirmModal
          open={showCancelModal}
          title="Cancel Bet"
          message="Are you sure you want to cancel this bet? This cannot be undone."
          onConfirm={handleConfirmCancelBet}
          onCancel={() => setShowCancelModal(false)}
          confirmText="Yes, Cancel"
          cancelText="No, Go Back"
          loading={adminActionLoading}
        />
      )}
      {showRefundModal && (
        <ConfirmModal
          open={showRefundModal}
          title="Refund Bet"
          message="Are you sure you want to refund all placed bets for this event? This cannot be undone."
          onConfirm={handleRefundBet}
          onCancel={() => setShowRefundModal(false)}
          confirmText="Yes, Refund"
          cancelText="No, Go Back"
          loading={adminActionLoading}
        />
      )}
    </>
  );
};