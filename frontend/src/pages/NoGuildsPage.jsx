import React, { useState } from 'react';
import { useUserStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { Navigation } from '../components/Navigation';
import { motion } from 'framer-motion';
import { prefetchHeartbeat } from '../services/heartbeat';
import queryClient from '../services/queryClient';
import { persistQueryCache } from '../utils/cacheHydration';
import { useLoading } from '../hooks/useLoading';
import LoadingSpinner from '../components/LoadingSpinner';

export const NoGuildsPage = () => {
  const user = useUserStore(state => state.user);
  const logout = useUserStore(state => state.logout);
  const navigate = useNavigate();
  const [refreshMessage, setRefreshMessage] = useState('');
  const { startLoading, stopLoading, isLoading, setError, getError } = useLoading();
  
  // Define loading key for guild refresh
  const LOADING_KEY = 'guild-refresh';
  
  // Discord OAuth2 invite URL with bot permissions
  const discordBotInviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.REACT_APP_DISCORD_CLIENT_ID || 'YOUR_CLIENT_ID'}&permissions=8&scope=bot%20applications.commands`;
  
  // Function to manually refresh guild data
  const refreshGuilds = async () => {
    startLoading(LOADING_KEY);
    setRefreshMessage('Checking for Discord servers...');
    
    try {
      // Try to fetch guilds directly
      const heartbeatData = await prefetchHeartbeat();
      
      if (heartbeatData?.guilds?.length > 0) {
        // Update the cache with the fetched guilds
        queryClient.setQueryData(['userGuilds'], heartbeatData.guilds);
        persistQueryCache(queryClient);
        
        setRefreshMessage('Found servers! Redirecting...');
        
        // Short delay before redirecting to dashboard
        setTimeout(() => {
          navigate('/');
        }, 1500);
        
        return;
      }
      
      setRefreshMessage('No servers found. Please make sure the bot is in your server.');
    } catch (error) {
      console.error('Error refreshing guilds:', error);
      setError(LOADING_KEY, 'Failed to check for servers. Please try again.');
      setRefreshMessage('Failed to check for servers. Please try again.');
    } finally {
      setTimeout(() => {
        stopLoading(LOADING_KEY);
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3 }}
        className="max-w-3xl mx-auto px-4 py-16 text-center"
      >
        <div className="bg-card-bg rounded-xl shadow-xl p-8 border border-border-light">
          <div className="mb-6">
            <svg
              className="mx-auto h-24 w-24 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold mb-4">No Discord Servers Found</h2>
          
          <p className="text-gray-400 mb-8">
            You don't have access to any servers where our bot is installed. To use this application, you need to either:
          </p>
          
          <div className="space-y-6">
            <div className="bg-card-hover rounded-lg p-4">
              <h3 className="font-medium mb-2">Option 1: Invite the Bot to Your Server</h3>
              <p className="text-sm text-gray-400 mb-4">
                If you have permission to add bots to a Discord server, you can invite our bot to get started.
              </p>
              <a
                href={discordBotInviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
              >
                Invite Bot to Server
              </a>
            </div>
            
            <div className="bg-card-hover rounded-lg p-4">
              <h3 className="font-medium mb-2">Option 2: Join a Server with the Bot</h3>
              <p className="text-sm text-gray-400 mb-4">
                Ask a server admin to invite you to a Discord server where our bot is already installed.
              </p>
            </div>
          </div>
          
          <div className="bg-card-hover rounded-lg p-4 mt-6">
            <h3 className="font-medium mb-2">Option 3: Refresh Server List</h3>
            <p className="text-sm text-gray-400 mb-4">
              If you've already invited the bot to your server or joined a server with the bot, try refreshing the server list.
            </p>
            <button
              onClick={refreshGuilds}
              disabled={isLoading(LOADING_KEY)}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${isLoading(LOADING_KEY) ? 'bg-gray-500' : 'bg-primary hover:bg-primary-dark'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors`}
            >
              {isLoading(LOADING_KEY) ? (
                <>
                  <LoadingSpinner size="sm" className="-ml-1 mr-2" />
                  Refreshing...
                </>
              ) : 'Refresh Server List'}
            </button>
            {refreshMessage && (
              <p className={`mt-2 text-sm ${refreshMessage.includes('Found') ? 'text-green-500' : 'text-yellow-500'}`}>
                {refreshMessage}
              </p>
            )}
          </div>
          
          <div className="mt-8 pt-6 border-t border-border-light">
            <p className="text-sm text-gray-500 mb-4">
              After adding the bot to a server or joining a server with the bot, click the refresh button above or log out and log back in.
            </p>
            
            <div className="flex justify-center space-x-4">
              <button
                onClick={logout}
                className="px-4 py-2 border border-border-light rounded-md text-sm font-medium hover:bg-card-hover transition-colors"
              >
                Log Out
              </button>
              
              <a
                href='https://discord.com/users/294497956348821505'
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-md text-sm font-medium text-primary hover:text-primary-light transition-colors"
              >
                Get Help
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default NoGuildsPage;