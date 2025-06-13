import { useAuth } from '../contexts/AuthContext';
import { useState, useRef, useEffect, useMemo } from 'react';
import {
  getUserProfile,
  getTransactionHistory,
  getUpcomingBets,
  placeBet,
  getUserStats
} from '../services/api';
import { Sidebar } from '../components/Sidebar';
import { DashboardNavigation } from '../components/DashboardNavigation';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { useDashboard } from '../contexts/DashboardContext';

export const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [upcomingBets, setUpcomingBets] = useState([]);
  const [userStats, setUserStats] = useState(null);

  const { walletBalance, activeBets } = useDashboard();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [stats, historyResponse, upcoming] = await Promise.all([
          getUserStats(user.discordId),
          getTransactionHistory(user.discordId, 1, 5),
          getUpcomingBets()
        ]);

        setTransactions(historyResponse.transactions);
        setUpcomingBets(upcoming);
        setUserStats(stats);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };

    if (user?.discordId) {
      fetchData();
    }
  }, [user, activeBets]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">
          Welcome back, {user?.username}!
        </h1>
        <p className="mt-2 text-text-secondary leading-relaxed tracking-wide">
          Manage your bets, view your balance, and track your activity.
        </p>
      </div>

      {/* Stats Summary Grid */}
      {userStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide">Active Bets</h3>
            <p className="text-3xl font-bold text-primary tracking-tight">{activeBets.length}</p>
          </div>
          <div className="bg-card p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide">Betting Win Rate</h3>
            <p className="text-3xl font-bold text-primary tracking-tight">{userStats.betting?.winRate ?? '0.0'}%</p>
          </div>
          <div className="bg-card p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide">Gambling Win Rate</h3>
            <p className="text-3xl font-bold text-primary tracking-tight">{userStats.gambling?.winRate ?? '0.0'}%</p>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight">Active Bets</h2>
        {activeBets.length > 0 ? (
          <div className="bg-card rounded-lg shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-xs sm:text-sm">
                <thead className="bg-card">
                  <tr>
                    <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">#</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Bet ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Options</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activeBets.slice(0, 3).map((bet, idx) => (
                    <tr key={bet._id} className="hover:bg-primary/5 cursor-pointer">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary tracking-wide text-center">{idx + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-text-secondary text-left">{bet._id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary font-medium text-left">{bet.description}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary text-left">{bet.options.join(', ')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary tracking-wide text-center capitalize">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          bet.status === 'open' ? 'bg-success/20 text-success' :
                          bet.status === 'closed' ? 'bg-warning/20 text-warning' :
                          bet.status === 'resolved' ? 'bg-info/20 text-info' : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {bet.status.charAt(0).toUpperCase() + bet.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <button
                          className="text-primary underline text-sm"
                          onClick={() => navigate(`/dashboard/betting/view?betId=${bet._id}`)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {activeBets.length > 3 && (
              <div className="px-6 py-4 text-center bg-card">
                <Link
                  to="/dashboard/betting/active"
                  className="text-primary hover:text-primary/90 text-sm font-medium tracking-wide underline"
                >
                  View All Active Bets ({activeBets.length})
                </Link>
              </div>
            )}
          </div>
        ) : (
          <p className="text-text-secondary leading-relaxed tracking-wide">No active bets at the moment.</p>
        )}
      </div>

      <div>
        <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight">Recent Activity</h2>
        <div className="bg-card rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-xs sm:text-sm">
              <thead className="bg-card">
                <tr>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.slice(0, 5).map((transaction, index) => {
                  const transactionDate = new Date(transaction.timestamp);
                  const formattedDate = transactionDate instanceof Date && !isNaN(transactionDate)
                    ? transactionDate.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'Invalid Date';

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
                         {transaction.amount.toLocaleString('en-US')} points
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="px-6 py-4 text-center bg-card mt-4 rounded-lg shadow-lg">
           <Link to="/dashboard/wallet/transactions" className="text-primary hover:text-primary/90 text-sm font-medium tracking-wide">
             View All Activity
           </Link>
         </div>
      </div>
    </div>
  );
}; 