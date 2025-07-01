import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect, lazy, Suspense } from 'react';
import React from 'react';
import {
  getTransactionHistory,
  getUpcomingBets,
  getUserStats
} from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import { useDashboard } from '../contexts/DashboardContext';
import { AnimatePresence, motion } from 'framer-motion';
import { formatDisplayNumber } from '../utils/numberFormat';
// import LiveBettingUpdates from '../components/LiveBettingUpdates';

// Import components
const ChartTicker = lazy(() => import('../components/ChartTicker'));

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [upcomingBets, setUpcomingBets] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [chartsLoaded, setChartsLoaded] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const { walletBalance, activeBets } = useDashboard();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // First load essential data for the UI
        const [stats, historyResponse, upcoming] = await Promise.all([
          getUserStats(user.discordId),
          getTransactionHistory(user.discordId, 1, 5),
          getUpcomingBets()
        ]);

        setTransactions(historyResponse.transactions);
        setUpcomingBets(upcoming);
        setUserStats(stats);
        setDataLoaded(true);
        
        // Signal that charts can start loading after essential data is displayed
        setTimeout(() => {
          setChartsLoaded(true);
        }, 100);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setDataLoaded(true); // Still mark as loaded to show UI even if there's an error
      }
    };

    if (user?.discordId) {
      fetchData();
    }
  }, [user, activeBets]);

  // Loading Spinner
  if (!dataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  const toggleExpand = (rowIndex) => {
    setExpandedRows((prev) => ({
      ...prev,
      [rowIndex]: !prev[rowIndex],
    }));
  };

  return (
    <AnimatePresence>
      <motion.div
        key="dashboard"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
      >
        <motion.h1
          className="text-3xl font-bold text-text-primary tracking-tight mb-2 font-display"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Welcome back, {user?.username}!
        </motion.h1>
        <p className="text-text-secondary leading-relaxed tracking-wide mb-8 font-base">
          Manage your bets, view your balance, and track your activity.
        </p>

        {/* Stats Summary Grid */}
        {userStats && (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { delayChildren: 0.2, staggerChildren: 0.15 }
              }
            }}
          >
            {[
              {
                label: 'Active Bets',
                value: activeBets.length
              },
              {
                label: 'Betting Win Rate',
                value: `${userStats.betting?.winRate ?? '0.0'}%`
              },
              {
                label: 'Gambling Win Rate',
                value: `${userStats.gambling?.winRate ?? '0.0'}%`
              }
            ].map(({ label, value }, idx) => (
              <motion.div
                key={idx}
                className="bg-card p-6 rounded-lg shadow-lg"
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 }
                }}
              >
                <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide font-heading">
                  {label}
                </h3>
                <p className="text-3xl font-bold text-primary tracking-tight font-heading">{value}</p>
              </motion.div>
            ))}
          </motion.div>
        )}
        
        {/* Live Betting Updates */}
        <motion.div
          className="mb-8"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { delay: 0.2 }
            }
          }}
        >
          {/* <LiveBettingUpdates /> */}
        </motion.div>
        
        {/* Dashboard Charts with Ticker */}
        <motion.div
          className="mb-8"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { delay: 0.3 }
            }
          }}
        >
          <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight font-display">Your Stats</h2>
          <Suspense fallback={
            <div className="flex justify-center items-center h-32 bg-card rounded-lg shadow-lg p-4">
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mb-2" />
                <p className="text-text-secondary text-sm">Loading charts...</p>
              </div>
            </div>
          }>
            {/* Only render charts when essential data is loaded */}
            {chartsLoaded && <ChartTicker duration={15} pauseOnHover={true} />}
          </Suspense>
        </motion.div>

        {/* Active Bets Table */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight font-display">Active Bets</h2>
          {activeBets.length > 0 ? (
            <div className="bg-card rounded-lg shadow-lg overflow-hidden">
              <div className="overflow-x-auto scrollbar-hide">
                <table className="min-w-full divide-y divide-border text-xs sm:text-sm">
                  <thead className="bg-card">
                    <tr>
                      {['#', 'Bet ID', 'Description', 'Options', 'Status', 'Actions'].map((heading, idx) => (
                        <th key={idx} className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-heading">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {activeBets.slice(0, 3).map((bet, idx) => {
                      const statusColorClass = bet.status === 'open'
                        ? 'bg-success/20 text-success'
                        : bet.status === 'closed'
                        ? 'bg-warning/20 text-warning'
                        : bet.status === 'resolved'
                        ? 'bg-info/20 text-info'
                        : 'bg-text-secondary/20 text-text-secondary';

                      return (
                        <motion.tr
                          key={bet._id}
                          className="hover:bg-primary/5 cursor-pointer"
                          whileHover={{ scale: 1.01, y: -1 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        >
                          <td className="px-6 py-4 text-center font-base">{idx + 1}</td>
                          <td className="px-6 py-4 font-mono text-xs text-left text-text-secondary">{bet._id}</td>
                          <td className="px-6 py-4 font-medium text-left font-accent">{bet.description}</td>
                          <td className="px-6 py-4 text-left font-base">{bet.options.join(', ')}</td>
                          <td className="px-6 py-4 text-center capitalize">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColorClass} font-heading`}>
                              {bet.status.charAt(0).toUpperCase() + bet.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              className="text-primary underline text-sm font-base"
                              onClick={() => navigate(`/dashboard/betting/view?betId=${bet._id}`)}
                            >
                              View
                            </motion.button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {activeBets.length > 3 && (
                <motion.div
                  className="px-6 py-4 text-center bg-card"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                >
                  <Link to="/dashboard/betting/active" className="text-primary underline text-sm font-medium tracking-wide font-base">
                    View All Active Bets ({activeBets.length})
                  </Link>
                </motion.div>
              )}
            </div>
          ) : (
            <motion.p
              className="text-text-secondary leading-relaxed tracking-wide font-base"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              No active bets at the moment.
            </motion.p>
          )}
        </div>

        {/* Recent Transactions */}
        <div>
          <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight font-display">Recent Activity</h2>
          <div className="bg-card rounded-lg shadow-lg overflow-hidden">
            <div className="overflow-x-auto scrollbar-hide">
              <table className="min-w-full divide-y divide-border text-xs sm:text-sm">
                <thead className="bg-card">
                  <tr>
                    {['Date', 'Type', 'Description', 'Amount'].map((h, i) => (
                      <th key={i} className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider font-heading">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.slice(0, 5).map((tx, index) => {
                    const date = new Date(tx.timestamp);
                    const formattedDate = !isNaN(date) ? date.toLocaleString() : 'Invalid Date';
                    const amountClass = tx.amount >= 0 ? 'text-success' : 'text-error';

                    const typeMap = {
                      bet: 'Bet Placed',
                      win: 'Win',
                      lose: 'Loss',
                      daily: 'Daily Bonus',
                      gift_sent: 'Gift Sent',
                      gift_received: 'Gift Received',
                      jackpot: 'Jackpot Win',
                      jackpot_contribution: 'Jackpot Contribution',
                      initial_balance: 'Initial Balance',
                      meowbark: 'Meowbark',
                      refund: 'Refund',
                      trade_sent: 'Trade Sent',
                      trade_received: 'Trade Received',
                      sell: 'Sell',
                      bail: 'Bail',
                      giveaway: 'Giveaway',
                      timeout: 'Timeout',
                      mystery_box: 'Mystery Box',
                      question: 'Question',
                      steal: 'Steal',
                      stolen: 'Stolen',
                      penalty: 'Penalty'
                    };
                    const isExpanded = expandedRows[index];
                    const desc = tx.description || '-';
                    const shouldTruncate = desc.length > 17;
                    const displayDesc = !shouldTruncate || isExpanded ? desc : desc.slice(0, 17) + '...';
                    return (
                      <motion.tr
                        key={index}
                        className="hover:bg-primary/5"
                        whileHover={{ scale: 1.01, y: -1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      >
                        <td className="px-6 py-4 text-center font-base">{formattedDate}</td>
                        <td className="px-6 py-4 text-center font-accent">{typeMap[tx.type] || 'Unknown'}</td>
                        <td className="px-6 py-4 text-center font-base">
                          {/* {tx.description || '---'} */}
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
                        <td className={`px-6 py-4 text-right font-medium ${amountClass} font-heading`}>
                          {formatDisplayNumber(tx.amount, true)} points
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <motion.div
              className="px-6 py-4 text-center bg-card mt-4 rounded-lg shadow-lg"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
            >
              <Link to="/dashboard/wallet/transactions" className="text-primary hover:text-primary/90 text-sm font-medium tracking-wide font-base">
                View All Activity
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
