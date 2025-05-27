import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
// Sidebar and DashboardNavigation are now part of DashboardLayout
// import { Sidebar } from '../components/Sidebar'; // Removed
// import { DashboardNavigation } from '../components/DashboardNavigation'; // Removed
// import { getWalletBalance } from '../services/api'; // Removed getWalletBalance
import { getBetDetails, getPlacedBetsForBet, placeBet, closeBet, resolveBet, cancelBet, editBet, extendBet, getUserPreferences, refundBet } from '../services/api';
import { useDashboard } from '../contexts/DashboardContext';
import { toast } from 'react-hot-toast'; // Import toast for notifications
import { useAuth } from '../contexts/AuthContext'; // Import useAuth to get user discordId
import { ConfirmModal } from '../components/ConfirmModal';
import ReactPaginate from 'react-paginate';

export const BetDetails = ({ betId: propBetId, onBetCanceled }) => {
  const { betId: routeBetId } = useParams();
  const betId = propBetId || routeBetId;
  const { user } = useAuth(); // Get user for discordId
  const [bet, setBet] = useState(null);
  const [placedBets, setPlacedBets] = useState([]);
  const [userPreferences, setUserPreferences] = useState(null);
  const [placedBetsPage, setPlacedBetsPage] = useState(1);
  const [placedBetsTotal, setPlacedBetsTotal] = useState(0);
  const [placedBetsPageSize, setPlacedBetsPageSize] = useState(10);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // const [walletBalance, setWalletBalance] = useState(0); // Removed

  // State for placing a bet
  const [selectedOption, setSelectedOption] = useState('');
  const [betAmount, setBetAmount] = useState('');
  const [isPlacingBet, setIsPlacingBet] = useState(false);

  // Consume walletBalance and activeBets from context
  const { walletBalance, activeBets } = useDashboard();

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

  // Calculate total pot and per-option totals
  const optionTotals = bet && bet.options.reduce((acc, option) => {
    acc[option] = placedBets.filter(pb => pb.option === option).reduce((sum, pb) => sum + pb.amount, 0);
    return acc;
  }, {});
  const totalPot = placedBets.reduce((sum, pb) => sum + pb.amount, 0);

  // Fetch user preferences for pagination
  useEffect(() => {
    const fetchPreferences = async () => {
      if (user?.discordId) {
        try {
          const prefs = await getUserPreferences(user.discordId);
          setUserPreferences(prefs);
        } catch (e) {
          setUserPreferences({ itemsPerPage: 10 });
        }
      } else {
        setUserPreferences({ itemsPerPage: 10 });
      }
    };
    fetchPreferences();
    // eslint-disable-next-line
  }, [user?.discordId]);

  // Reset to first page if itemsPerPage changes
  useEffect(() => {
    setPlacedBetsPage(1);
  }, [userPreferences?.itemsPerPage]);

  useEffect(() => {
    if (!betId || !userPreferences) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        const betData = await getBetDetails(betId);
        setBet(betData);
        if (betData && betData.status === 'open' && betData.options.length > 0) {
            setSelectedOption(betData.options[0]);
        }
        // Fetch paginated placed bets
        const placedBetsRes = await getPlacedBetsForBet(betId, placedBetsPage, userPreferences.itemsPerPage || 10);
        setPlacedBets(placedBetsRes.data || placedBetsRes);
        setPlacedBetsTotal(placedBetsRes.totalCount || (placedBetsRes.data ? placedBetsRes.data.length : placedBetsRes.length));
      } catch (err) {
        console.error('Error fetching bet details:', err);
        setError('Failed to load bet details.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [betId, placedBetsPage, userPreferences]);

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

        setIsPlacingBet(true);
        try {
            const response = await placeBet(betId, amount, selectedOption, user.discordId);
            toast.success(response.message || 'Bet placed successfully!');
            setBetAmount(''); // Clear input after placing bet

            // Refetch placed bets for this specific bet to update the list
            const placedBetsRes = await getPlacedBetsForBet(betId, placedBetsPage, userPreferences.itemsPerPage || 10);
            setPlacedBets(placedBetsRes.data || placedBetsRes);
            setPlacedBetsTotal(placedBetsRes.totalCount || (placedBetsRes.data ? placedBetsRes.data.length : placedBetsRes.length));

            // Balance update is handled by WebSocket in DashboardLayout

        } catch (error) {
            console.error('Error placing bet:', error);
            const errorMessage = error.response?.data?.message || 'Failed to place bet.';
            toast.error(errorMessage);
        } finally {
            setIsPlacingBet(false);
        }
    };

  // Admin actions
  const handleCloseBet = async () => {
    setAdminActionLoading(true);
    try {
      await closeBet(betId);
      toast.success('Bet closed successfully.');
      // Refresh bet details
      const betData = await getBetDetails(betId);
      setBet(betData);
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
      await resolveBet(betId, resolveOption, user.discordId);
      toast.success('Bet resolved successfully.');
      setShowResolveModal(false);
      // Refresh bet details
      const betData = await getBetDetails(betId);
      setBet(betData);
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
      await cancelBet(betId, user.discordId);
      toast.success('Bet cancelled successfully.');
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
      await editBet(betId, user.discordId, editDescription, editOptions, editDuration ? Number(editDuration) : undefined);
      toast.success('Bet edited successfully.');
      setShowEditModal(false);
      // Refresh bet details
      const betData = await getBetDetails(betId);
      setBet(betData);
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
      await extendBet(betId, user.discordId, Number(extendMinutes));
      toast.success('Bet extended successfully.');
      setShowExtendModal(false);
      // Refresh bet details
      const betData = await getBetDetails(betId);
      setBet(betData);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to extend bet.');
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleRefundBet = async () => {
    setAdminActionLoading(true);
    try {
      await refundBet(betId);
      toast.success('Bet refunded successfully.');
      setShowRefundModal(false);
      // Refresh bet details
      const betData = await getBetDetails(betId);
      setBet(betData);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to refund bet.');
    } finally {
      setAdminActionLoading(false);
    }
  };

  // Loading is now handled by DashboardLayout, but we can keep this for local data loading
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

  if (!bet) {
      return <div className="min-h-screen bg-background text-text-secondary flex items-center justify-center">Bet not found.</div>;
  }

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight">Bet Details</h1>
        <div className="bg-card rounded-lg shadow-lg p-6 mb-8 space-y-4">
          <h2 className="text-2xl font-semibold text-text-primary tracking-wide">{bet.description}</h2>
          <div className="text-text-secondary leading-relaxed tracking-wide grid grid-cols-1 md:grid-cols-2 gap-4">
            <p><strong>Bet ID:</strong> {bet._id}</p>
            <p><strong>Status:</strong> <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                bet.status === 'open' ? 'bg-success/20 text-success' :
                                bet.status === 'closed' ? 'bg-warning/20 text-warning' :
                                bet.status === 'resolved' ? 'bg-info/20 text-info' : 'bg-gray-500/20 text-gray-400'
                             }`}>{bet.status}</span></p>
            {bet.creator && bet.creator.username && <p><strong>Created By:</strong> {bet.creator.username}</p>}
            {bet.createdAt && <p><strong>Created At:</strong> {new Date(bet.createdAt).toLocaleString()}</p>}
            {bet.closingTime && <p><strong>Closing Time:</strong> {new Date(bet.closingTime).toLocaleString()}</p>}
            <p className="col-span-full"><strong>Options:</strong> {bet.options.join(', ')}</p>
            {bet.status === 'resolved' && bet.winningOption && <p className="col-span-full text-lg font-semibold text-success"><strong>Winning Option:</strong> {bet.winningOption}</p>}
          </div>
          {/* Pot and per-option totals - Professional, consistent style */}
          <div className="mt-4 bg-surface rounded-lg p-6 shadow flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-lg font-semibold text-text-primary">Total Pot</div>
              <div className="text-2xl font-bold text-primary font-mono">{totalPot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-base font-medium text-text-secondary">points</span></div>
            </div>
            <div className="divide-y divide-border">
              {bet.options.map(option => {
                const amount = optionTotals[option] || 0;
                const percent = totalPot > 0 ? ((amount / totalPot) * 100) : 0;
                // Find the leading option
                const maxAmount = Math.max(...bet.options.map(opt => optionTotals[opt] || 0));
                const isLeading = amount === maxAmount && amount > 0;
                return (
                  <div key={option} className="py-3 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className={`font-medium text-sm ${isLeading ? 'text-primary' : 'text-text-secondary'}`}>{option}</span>
                      <span className={`font-mono text-base ${isLeading ? 'text-primary font-bold' : 'text-text-primary'}`}>{amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pts</span>
                      <span className="ml-2 text-xs text-text-secondary">({percent.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full h-2 bg-border rounded overflow-hidden">
                      <div
                        className={`h-full rounded transition-all duration-300 ${isLeading ? 'bg-primary/80' : 'bg-primary/40'}`}
                        style={{ width: `${percent}%` }}
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
              <button
                className="px-3 py-1 rounded bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-60"
                onClick={handleCloseBet}
                disabled={adminActionLoading || bet.status !== 'open'}
              >
                Close
              </button>
              <button
                className="px-3 py-1 rounded bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-60"
                onClick={handleShowResolveModal}
                disabled={adminActionLoading || bet.status !== 'closed'}
              >
                Resolve
              </button>
              <button
                className="px-3 py-1 rounded bg-error text-white font-semibold hover:bg-error/90 disabled:opacity-60"
                onClick={handleCancelBet}
                disabled={adminActionLoading || bet.status !== 'open'}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1 rounded bg-surface text-text-primary border border-border font-semibold hover:bg-primary/5 disabled:opacity-60"
                onClick={handleShowEditModal}
                disabled={adminActionLoading || bet.status !== 'open'}
              >
                Edit
              </button>
              <button
                className="px-3 py-1 rounded bg-surface text-text-primary border border-border font-semibold hover:bg-primary/5 disabled:opacity-60"
                onClick={handleShowExtendModal}
                disabled={adminActionLoading || bet.status !== 'open'}
              >
                Extend
              </button>
              {/* Refund button: show for open/closed, not resolved/cancelled/refunded */}
              {['open', 'closed'].includes(bet.status) && (
                <button
                  className="px-3 py-1 rounded bg-warning text-white font-semibold hover:bg-warning/90 disabled:opacity-60"
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
                <h3 className="text-xl font-semibold text-text-primary mb-4 tracking-wide">Place Your Bet</h3>
                <form onSubmit={handlePlaceBet} className="space-y-4">
                    <div>
                        <label htmlFor="betOption" className="block text-sm font-medium text-text-secondary">Select Option</label>
                        <select
                            id="betOption"
                            name="betOption"
                            value={selectedOption}
                            onChange={(e) => setSelectedOption(e.target.value)}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-background border-border focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTcgMTBMMTIgMTVMMTcgMTBaIiBmaWxsPSIjQzdDOUQxIi8+Cjwvc3ZnPg==')] bg-no-repeat bg-[right_0.75rem_center]"
                        >
                            {bet.options.map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                         <label htmlFor="betAmount" className="block text-sm font-medium text-text-secondary">Amount</label>
                         <input
                            type="number"
                            id="betAmount"
                            name="betAmount"
                            value={betAmount}
                            onChange={(e) => setBetAmount(e.target.value)}
                            min="1"
                            className="mt-1 block w-full pl-3 pr-3 py-2 text-base bg-background border-border focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md no-spinners"
                            placeholder="e.g., 100"
                         />
                     </div>
                     <div>
                         <button
                             type="submit"
                             disabled={isPlacingBet || !selectedOption || betAmount <= 0 || betAmount > walletBalance}
                             className={`w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${isPlacingBet ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary`}
                         >
                             {isPlacingBet ? 'Placing Bet...' : 'Place Bet'}
                         </button>
                     </div>
                 </form>
             </div>
         )}

         <div className="bg-card rounded-lg shadow-lg p-6">
             <h3 className="text-xl font-semibold text-text-primary mb-4 tracking-wide">Placed Bets ({placedBetsTotal})</h3>
              {placedBets.length > 0 ? (
                 <>
                   <div className="overflow-x-auto">
                     <table className="min-w-full divide-y divide-border">
                       <thead className="bg-surface">
                           <tr>
                               <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Bettor</th>
                               <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Amount</th>
                               <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Option</th>
                               <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Placed At</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-border">
                           {placedBets.map(placedBet => (
                               <tr key={placedBet._id} className="hover:bg-primary/5">
                                   <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">{placedBet.bettor.username}</td>
                                   <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">{placedBet.amount}</td>
                                   <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">{placedBet.option}</td>
                                   <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">{new Date(placedBet.placedAt).toLocaleString()}</td>
                               </tr>
                           ))}
                       </tbody>
                     </table>
                   </div>
                   <div className="flex justify-center mt-4">
                     <ReactPaginate
                       previousLabel={"Prev"}
                       nextLabel={"Next"}
                       breakLabel={"..."}
                       breakClassName={"px-2 py-1"}
                       pageCount={Math.ceil(placedBetsTotal / (userPreferences?.itemsPerPage || 10)) || 1}
                       marginPagesDisplayed={1}
                       pageRangeDisplayed={3}
                       onPageChange={selected => setPlacedBetsPage(selected.selected + 1)}
                       forcePage={placedBetsPage - 1}
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
              ) : (
                 <p className="text-text-secondary leading-relaxed tracking-wide">No bets have been placed yet.</p>
              )}
          </div>

      </div>
      {/* Modals for admin actions */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-lg shadow-lg p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold text-text-primary mb-4">Resolve Bet</h2>
            <label className="block mb-2 text-text-secondary">Select Winning Option:</label>
            <select
              className="w-full px-3 py-2 rounded border border-border bg-background text-text-primary mb-4"
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
                className="flex-1 py-2 px-4 rounded bg-primary text-white font-semibold hover:bg-primary/90"
                disabled={adminActionLoading}
              >
                Confirm
              </button>
              <button
                onClick={() => setShowResolveModal(false)}
                className="flex-1 py-2 px-4 rounded bg-surface text-text-primary border border-border font-semibold hover:bg-primary/5"
                disabled={adminActionLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-lg shadow-lg p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold text-text-primary mb-4">Edit Bet</h2>
            <label className="block mb-2 text-text-secondary">Description:</label>
            <input
              className="w-full px-3 py-2 rounded border border-border bg-background text-text-primary mb-2"
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
            />
            <label className="block mb-2 text-text-secondary">Options (comma separated):</label>
            <input
              className="w-full px-3 py-2 rounded border border-border bg-background text-text-primary mb-2"
              value={editOptions}
              onChange={e => setEditOptions(e.target.value)}
            />
            <label className="block mb-2 text-text-secondary">Duration (minutes, optional):</label>
            <input
              className="w-full px-3 py-2 rounded border border-border bg-background text-text-primary mb-2"
              type="number"
              min="1"
              value={editDuration}
              onChange={e => setEditDuration(e.target.value)}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleEditBet}
                className="flex-1 py-2 px-4 rounded bg-primary text-white font-semibold hover:bg-primary/90"
                disabled={adminActionLoading}
              >
                Save
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-2 px-4 rounded bg-surface text-text-primary border border-border font-semibold hover:bg-primary/5"
                disabled={adminActionLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {showExtendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-lg shadow-lg p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold text-text-primary mb-4">Extend Bet</h2>
            <label className="block mb-2 text-text-secondary">Additional Minutes:</label>
            <input
              className="w-full px-3 py-2 rounded border border-border bg-background text-text-primary mb-2"
              type="number"
              min="1"
              value={extendMinutes}
              onChange={e => setExtendMinutes(e.target.value)}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleExtendBet}
                className="flex-1 py-2 px-4 rounded bg-primary text-white font-semibold hover:bg-primary/90"
                disabled={adminActionLoading || !extendMinutes}
              >
                Extend
              </button>
              <button
                onClick={() => setShowExtendModal(false)}
                className="flex-1 py-2 px-4 rounded bg-surface text-text-primary border border-border font-semibold hover:bg-primary/5"
                disabled={adminActionLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
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