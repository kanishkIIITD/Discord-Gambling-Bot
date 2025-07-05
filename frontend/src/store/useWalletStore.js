import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import * as api from '../services/api';

/**
 * Wallet store for managing wallet balance and transactions
 * Centralizes wallet state that was previously managed in individual components
 */
export const useWalletStore = create(
  devtools(
    (set, get) => ({
      // State
      balance: 0,
      previousBalance: 0,
      transactions: [],
      transactionsPagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
      },
      loading: {
        balance: false,
        transactions: false,
      },
      error: null,
      
      // Actions
      fetchBalance: async (discordId, guildId) => {
        if (!discordId || !guildId) return;
        
        try {
          set(state => ({ loading: { ...state.loading, balance: true } }));
          const data = await api.getWalletBalance(discordId, guildId);
          set(state => ({
            previousBalance: state.balance,
            balance: data.balance,
            loading: { ...state.loading, balance: false },
          }));
          return data;
        } catch (error) {
          set(state => ({
            error: error.message || 'Failed to fetch wallet balance',
            loading: { ...state.loading, balance: false },
          }));
        }
      },
      
      fetchTransactions: async (discordId, page = 1, limit = 20) => {
        if (!discordId) return;
        
        try {
          set(state => ({ loading: { ...state.loading, transactions: true } }));
          const data = await api.getTransactionHistory(discordId, page, limit);
          set(state => ({
            transactions: data.transactions,
            transactionsPagination: {
              currentPage: page,
              totalPages: data.totalPages,
              totalItems: data.totalItems,
            },
            loading: { ...state.loading, transactions: false },
          }));
          return data;
        } catch (error) {
          set(state => ({
            error: error.message || 'Failed to fetch transactions',
            loading: { ...state.loading, transactions: false },
          }));
        }
      },
      
      // Optimistic update for transactions (e.g., when placing a bet)
      updateBalanceOptimistically: (newBalance) => {
        set(state => ({
          previousBalance: state.balance,
          balance: newBalance,
        }));
      },
      
      // Add a new transaction optimistically (before API confirmation)
      addTransactionOptimistically: (transaction) => {
        set(state => ({
          transactions: [transaction, ...state.transactions],
          transactionsPagination: {
            ...state.transactionsPagination,
            totalItems: state.transactionsPagination.totalItems + 1,
          },
        }));
      },
      
      clearError: () => set({ error: null }),
    }),
    { name: 'wallet-store' }
  )
);