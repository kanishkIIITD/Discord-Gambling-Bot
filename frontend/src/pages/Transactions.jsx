import React, { useState, useEffect } from 'react';
import { useTransactionHistory, useUserPreferences } from '../hooks/useQueryHooks';
import ReactPaginate from 'react-paginate';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDisplayNumber } from '../utils/numberFormat';
import LoadingSpinner from '../components/LoadingSpinner';
import { useUserStore, useGuildStore } from '../store';
import { useLoading } from '../hooks/useLoading';

export const Transactions = () => {
  const { user } = useUserStore();
  const { selectedGuildId, isGuildSwitching } = useGuildStore();
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [expandedRows, setExpandedRows] = useState({});
  
  // Define loading keys
  const LOADING_KEYS = {
    PREFERENCES: 'transactions-preferences',
    TRANSACTIONS: 'transactions-data',
    GUILD_SWITCHING: 'transactions-guild-switching'
  };
  
  // Get loading context
  const { isLoading, startLoading, stopLoading, setError, getError } = useLoading();
  
  // Get user preferences using React Query
  const { 
    data: userPreferences, 
    isLoading: preferencesLoading,
    error: preferencesError 
  } = useUserPreferences(user?.discordId);

  const ITEMS_PER_PAGE = 10; // Default items per page if preferences are not loaded yet
  
  // Get transaction history using React Query
  const { 
    data: transactionData, 
    isLoading: transactionsLoading, 
    error: transactionsError 
  } = useTransactionHistory(
    user?.discordId, 
    currentPage, 
    userPreferences?.itemsPerPage || ITEMS_PER_PAGE
  );
  
  // Update loading states in LoadingContext
  useEffect(() => {
    if (preferencesLoading) {
      startLoading(LOADING_KEYS.PREFERENCES);
    } else {
      stopLoading(LOADING_KEYS.PREFERENCES);
      if (preferencesError) {
        setError(LOADING_KEYS.PREFERENCES, preferencesError);
      }
    }
  }, [preferencesLoading, preferencesError, startLoading, stopLoading, setError]);
  
  useEffect(() => {
    if (transactionsLoading) {
      startLoading(LOADING_KEYS.TRANSACTIONS);
    } else {
      stopLoading(LOADING_KEYS.TRANSACTIONS);
      if (transactionsError) {
        setError(LOADING_KEYS.TRANSACTIONS, transactionsError);
      }
    }
  }, [transactionsLoading, transactionsError, startLoading, stopLoading, setError]);
  
  useEffect(() => {
    if (isGuildSwitching) {
      startLoading(LOADING_KEYS.GUILD_SWITCHING);
    } else {
      stopLoading(LOADING_KEYS.GUILD_SWITCHING);
    }
  }, [isGuildSwitching, startLoading, stopLoading]);
  
  // Determine if we're loading any data
  const isDataLoading = isLoading(LOADING_KEYS.PREFERENCES) || isLoading(LOADING_KEYS.TRANSACTIONS) || isLoading(LOADING_KEYS.GUILD_SWITCHING);
  
  // Extract data from the query result
  const transactions = transactionData?.transactions || [];
  const totalCount = transactionData?.totalCount || 0;
  
  // Calculate total pages
  const effectiveItemsPerPage = userPreferences?.itemsPerPage || ITEMS_PER_PAGE;
  const maxPages = 50;
  const totalPages = Math.min(Math.ceil(totalCount / effectiveItemsPerPage), maxPages);
  
  // Get any errors from LoadingContext
  const loadingError = getError(LOADING_KEYS.PREFERENCES) || getError(LOADING_KEYS.TRANSACTIONS);

  // react-paginate expects 0-based page index
  const handlePageChange = (selectedItem) => {
    setCurrentPage(selectedItem.selected + 1);
  };

  // Helper to toggle expanded state for a row
  const toggleExpand = (rowIndex) => {
    setExpandedRows((prev) => ({
      ...prev,
      [rowIndex]: !prev[rowIndex],
    }));
  };

  if (isDataLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" color="primary" message="Loading transactions..." />
      </div>
    );
  }

  if (loadingError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card p-6 rounded-lg shadow-lg max-w-lg w-full">
          <h2 className="text-2xl font-bold text-text-primary mb-4">Error Loading Transactions</h2>
          <div className="bg-error/10 border border-error/30 rounded-md p-4 mb-6">
            <p className="text-error font-medium">{loadingError.message || 'Failed to load transaction data'}</p>
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-8 w-full"
    >
      <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight text-center font-display">Transaction History</h1>
      <div className="bg-card rounded-lg shadow-lg overflow-x-auto mb-4 w-full">
        <div className="min-w-[500px] sm:min-w-full overflow-auto scrollbar-hide">
          <table className="min-w-full divide-y divide-border text-xs sm:text-sm">
            <thead className="bg-card">
              <tr>
                <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-base">Date</th>
                <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-base">Type</th>
                <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-base">Description</th>
                <th scope="col" className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-base">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <AnimatePresence initial={false}>
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
                        case 'timeout': return 'Timeout';
                        case 'mystery_box': return 'Mystery Box';
                        case 'question': return 'Question';
                        case 'steal': return 'Steal';
                        case 'stolen': return 'Stolen';
                        case 'penalty': return 'Penalty';
                        default: return 'Unknown';
                      }
                    };
                    const isExpanded = expandedRows[index];
                    const desc = transaction.description || '-';
                    const shouldTruncate = desc.length > 17;
                    const displayDesc = !shouldTruncate || isExpanded ? desc : desc.slice(0, 17) + '...';
                    return (
                      <motion.tr
                        key={transaction._id || index}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 16 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="hover:bg-primary/5 cursor-pointer"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary tracking-wide text-center font-base">
                          {formattedDate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary tracking-wide text-center font-base">
                          {transactionTypeLabel()}
                        </td>
                        <td className="px-6 py-4 text-sm text-text-primary tracking-wide text-center font-base">
                           {/* {transaction.description || '---'} */}
                           {displayDesc}
                           {shouldTruncate && (
                            <button
                              className="ml-2 text-primary underline text-xs focus:outline-none font-base"
                              onClick={() => toggleExpand(index)}
                              aria-label={isExpanded ? 'Show less' : 'Show more'}
                            >
                              {isExpanded ? 'Show less' : 'Show more'}
                            </button>
                          )}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${amountColorClass} tracking-wide text-right font-mono`}>
                           {formatDisplayNumber(transaction.amount, true)} points
                        </td>
                      </motion.tr>
                    );
                  })
                ) : (
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <td colSpan="4" className="px-6 py-4 text-center text-sm text-text-secondary font-base">No transactions found.</td>
                  </motion.tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      {totalPages > 1 && !isDataLoading && !loadingError && (
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
    </motion.div>
  );
};