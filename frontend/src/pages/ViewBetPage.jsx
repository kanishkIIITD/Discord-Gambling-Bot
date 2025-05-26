import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BetDetails } from './BetDetails';

const ViewBetPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const betIdParam = searchParams.get('betId') || '';
  const [searchBetId, setSearchBetId] = useState(betIdParam);
  const [betCanceled, setBetCanceled] = useState(false);

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
      setSearchParams({ betId: searchBetId.trim() });
    }
  };

  const handleClear = () => {
    setSearchBetId('');
    setSearchParams({});
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
      <h1 className="text-3xl font-bold text-text-primary mb-8 tracking-tight text-center">Find Bet by ID</h1>
      <form
        className="flex flex-col sm:flex-row gap-4 items-center justify-center mb-10 w-full"
        onSubmit={handleSearch}
      >
        <input
          type="text"
          className="w-full sm:w-80 px-3 py-2 rounded border border-border bg-background text-text-primary focus:outline-none focus:ring-primary focus:border-primary"
          placeholder="Enter Bet ID..."
          value={searchBetId}
          onChange={e => setSearchBetId(e.target.value)}
        />
        <button
          type="submit"
          className="px-6 py-2 rounded bg-primary text-white font-semibold hover:bg-primary/90"
          disabled={!searchBetId.trim()}
        >
          Search
        </button>
        <button
          type="button"
          className="px-6 py-2 rounded bg-surface text-text-primary border border-border font-semibold hover:bg-primary/5"
          onClick={handleClear}
          disabled={!searchBetId}
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
    </div>
  );
};

export default ViewBetPage; 