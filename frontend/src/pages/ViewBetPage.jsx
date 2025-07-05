import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BetDetails } from './BetDetails';
import { motion } from 'framer-motion';
import { useUIStore } from '../store/useUIStore';
import LoadingSpinner from '../components/LoadingSpinner';

const ViewBetPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  // const navigate = useNavigate();
  const betIdParam = searchParams.get('betId') || '';
  const [searchBetId, setSearchBetId] = useState(betIdParam);
  const [betCanceled, setBetCanceled] = useState(false);
  
  // Fix: Select individual functions to prevent infinite loops
  const startLoading = useUIStore(state => state.startLoading);
  const stopLoading = useUIStore(state => state.stopLoading);
  const isLoading = useUIStore(state => state.isLoading);
  
  // Define loading key for bet search
  const LOADING_KEY = 'bet-search';

  // Keep input in sync with query param
  useEffect(() => {
    setSearchBetId(betIdParam);
  }, [betIdParam]);

  // Effect to clear bet details when a bet is canceled
  useEffect(() => {
    if (betCanceled) {
      setSearchBetId('');
      setSearchParams({});
      setBetCanceled(false); // Reset the flag
    }
  }, [betCanceled, setSearchParams]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchBetId.trim()) {
      startLoading(LOADING_KEY);
      setSearchParams({ betId: searchBetId.trim() });
      // Stop loading after a short delay to allow BetDetails to take over loading state
      setTimeout(() => stopLoading(LOADING_KEY), 300);
    }
  };

  const handleClear = () => {
    startLoading(LOADING_KEY);
    setSearchBetId('');
    setSearchParams({});
    stopLoading(LOADING_KEY);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full"
    >
      <h1 className="text-3xl font-bold text-text-primary mb-8 tracking-tight text-center font-display">Find Bet by ID</h1>
      <form
        className="flex flex-col sm:flex-row gap-4 items-center justify-center mb-10 w-full"
        onSubmit={handleSearch}
      >
        <input
          type="text"
          className="w-full sm:w-80 px-3 py-2 rounded border border-border bg-background text-text-primary focus:outline-none focus:ring-primary focus:border-primary font-base"
          placeholder="Enter Bet ID..."
          value={searchBetId}
          onChange={e => setSearchBetId(e.target.value)}
        />
        <button
          type="submit"
          className="px-6 py-2 rounded bg-primary text-white font-semibold hover:bg-primary/90 font-base flex items-center justify-center"
          disabled={!searchBetId.trim() || isLoading(LOADING_KEY)}
        >
          {isLoading(LOADING_KEY) ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Searching...
            </>
          ) : 'Search'}
        </button>
        <button
          type="button"
          className="px-6 py-2 rounded bg-surface text-text-primary border border-border font-semibold hover:bg-primary/5 font-base"
          onClick={handleClear}
          disabled={!searchBetId || isLoading(LOADING_KEY)}
        >
          Clear
        </button>
      </form>
      {/* Render BetDetails below if betId is present */}
      {betIdParam && (
        <div className="mt-10 w-full">
          <div className="w-full">
            <BetDetails betId={betIdParam} onBetCanceled={() => setBetCanceled(true)} />
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ViewBetPage;