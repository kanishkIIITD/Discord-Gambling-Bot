import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getTransactionHistory, getUserPreferences } from '../services/api';
import ReactPaginate from 'react-paginate';
import axios from 'axios';

// --- TEMP: Main Guild ID for single-guild mode ---
const MAIN_GUILD_ID = process.env.REACT_APP_MAIN_GUILD_ID;

export const Transactions = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [userPreferences, setUserPreferences] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [filter, setFilter] = useState('all');

  const ITEMS_PER_PAGE = 10; // Default items per page if preferences are not loaded yet
  const MAX_TOTAL_ITEMS = 500; // Set the maximum number of items to display from the top

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
    const fetchTransactions = async (page, limit) => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(
          `${process.env.REACT_APP_API_URL}/api/users/${user.discordId}/transactions`,
          { params: { page: page, limit: limit, type: filter, guildId: MAIN_GUILD_ID }, headers: { 'x-guild-id': MAIN_GUILD_ID } }
        );
        setTransactions(res.data.transactions);
        // Total count from backend is not needed for frontend pagination limit
        // Calculate total pages based on the maximum number of items to display on the frontend
        const effectiveItemsPerPage = userPreferences?.itemsPerPage || ITEMS_PER_PAGE;
        setTotalPages(Math.ceil(MAX_TOTAL_ITEMS / effectiveItemsPerPage)); // Corrected calculation
      } catch (err) {
        setError('Failed to fetch transactions.');
      } finally {
        setLoading(false);
      }
    };
    if (user?.discordId && userPreferences) {
      // Pass the current page and the adjusted limit (up to MAX_TOTAL_ITEMS)
      fetchTransactions(currentPage, Math.min(userPreferences.itemsPerPage || ITEMS_PER_PAGE, MAX_TOTAL_ITEMS));
    }
  }, [user, currentPage, filter, userPreferences]);

  // react-paginate expects 0-based page index
  const handlePageChange = (selectedItem) => {
    setCurrentPage(selectedItem.selected + 1);
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
    <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-8 w-full">
      <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight text-center">Transaction History</h1>
      <div className="bg-card rounded-lg shadow-lg overflow-x-auto mb-4 w-full">
        <div className="min-w-[500px] sm:min-w-full">
          <table className="min-w-full divide-y divide-border text-xs sm:text-sm">
            <thead className="bg-card">
              <tr>
                <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Date</th>
                <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Type</th>
                <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Description</th>
                <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transactions.length > 0 ? (
                transactions.map((transaction, index) => {
                  const transactionDate = new Date(transaction.timestamp);
                  const formattedDate = transactionDate instanceof Date && !isNaN(transactionDate) ? transactionDate.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'Invalid Date';

                  const amountColorClass = transaction.amount >= 0 ? 'text-success' : 'text-error';

                  const transactionTypeLabel = () => {
                    switch (transaction.type) {
                      case 'bet': return 'Bet Placed';
                      case 'win': return 'Win';
                      case 'lose': return 'Loss';
                      case 'daily': return 'Daily Bonus';
                      case 'gift_sent': return 'Gift Sent';
                      case 'gift_received': return 'Gift Received';
                      case 'jackpot': return 'Jackpot Win';
                      case 'jackpot_contribution': return 'Jackpot Contribution';
                      case 'initial_balance': return 'Initial Balance';
                      case 'meowbark': return 'Meowbark';
                      case 'refund': return 'Refund';
                      case 'trade_sent': return 'Trade Sent';
                      case 'trade_received': return 'Trade Received';
                      case 'sell': return 'Sell';
                      case 'bail': return 'Bail';
                      case 'giveaway': return 'Giveaway';
                      default: return 'Unknown';
                    }
                  };

                  return (
                    <tr key={index} className="hover:bg-primary/5">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary tracking-wide text-center">
                        {formattedDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary tracking-wide text-center">
                        {transactionTypeLabel()}
                      </td>
                      <td className="px-6 py-4 text-sm text-text-primary tracking-wide text-center">
                         {transaction.description || '---'}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${amountColorClass} tracking-wide text-right`}>
                         {transaction.amount.toLocaleString()} points
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4" className="px-6 py-4 text-center text-sm text-text-secondary">No transactions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {totalPages > 1 && (
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
            forcePage={currentPage - 1}
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
      )}
    </div>
  );
}; 