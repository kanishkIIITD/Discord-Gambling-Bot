import React, { useState } from 'react';
import { useUserStore, useGuildStore } from '../store';
import { useUserPreferences, useUpdateUserPreferences } from '../hooks/useQueryHooks';
import { useLoading } from '../hooks/useLoading';
import { toast } from 'react-hot-toast';
import { Checkbox } from '../components/Checkbox';
import { motion } from 'framer-motion';
import ElasticSlider from '../components/ElasticSlider';
import LoadingSpinner from '../components/LoadingSpinner';

export const Preferences = () => {
  const user = useUserStore(state => state.user);
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  const [isSaving, setIsSaving] = useState(false);
  const { startLoading, stopLoading, setError, isLoading, getError, withLoading } = useLoading();

  // Define loading keys
  const LOADING_KEYS = {
    PREFERENCES: 'user-preferences',
    SAVE_PREFERENCES: 'save-preferences'
  };

  // Fetch user preferences using the React Query hook with LoadingContext integration
  const { data: preferences, isLoading: queryLoading, error: queryError } = useUserPreferences(user?.discordId);
  const updatePreferencesMutation = useUpdateUserPreferences();
  
  // Start loading when query is loading or guild is switching
  React.useEffect(() => {
    if (queryLoading || isGuildSwitching) {
      startLoading(LOADING_KEYS.PREFERENCES);
    } else {
      stopLoading(LOADING_KEYS.PREFERENCES);
    }
    
    // Set error if query has error
    if (queryError) {
      setError(LOADING_KEYS.PREFERENCES, queryError);
    }
  }, [queryLoading, isGuildSwitching, queryError, startLoading, stopLoading, setError]);
  
  // Combined loading state
  const isPageLoading = isLoading(LOADING_KEYS.PREFERENCES);
  
  // State for form inputs
  const [itemsPerPage, setItemsPerPage] = useState(preferences?.itemsPerPage || 10);
  const [confirmBetPlacement, setConfirmBetPlacement] = useState(preferences?.confirmBetPlacement ?? true);
  // Slot machine advanced settings
  const [slotAutoSpinDelay, setSlotAutoSpinDelay] = useState(preferences?.slotAutoSpinDelay ?? 300); // ms
  const [slotAutoSpinDefaultCount, setSlotAutoSpinDefaultCount] = useState(preferences?.slotAutoSpinDefaultCount ?? 1);
  // Sound settings
  const [defaultSoundVolume, setDefaultSoundVolume] = useState(preferences?.defaultSoundVolume ?? 50); // 0-100 scale
  
  // Update form state when preferences data changes
  React.useEffect(() => {
    if (preferences) {
      setItemsPerPage(preferences.itemsPerPage);
      setConfirmBetPlacement(preferences.confirmBetPlacement);
      setSlotAutoSpinDelay(preferences.slotAutoSpinDelay ?? 300);
      setSlotAutoSpinDefaultCount(preferences.slotAutoSpinDefaultCount ?? 1);
      setDefaultSoundVolume(preferences.defaultSoundVolume ?? 50);
    }
  }, [preferences]);

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    if (!user?.discordId) {
      toast.error('User not authenticated.');
      return;
    }
    
    try {
      // Use withLoading to wrap the save operation
      await withLoading(LOADING_KEYS.SAVE_PREFERENCES, async () => {
        setIsSaving(true);
        const updatedPrefs = {
          itemsPerPage,
          confirmBetPlacement,
          slotAutoSpinDelay,
          slotAutoSpinDefaultCount,
          defaultSoundVolume,
        };
        await updatePreferencesMutation.mutateAsync({
          discordId: user.discordId,
          preferences: updatedPrefs
        });
        toast.success('Preferences saved successfully!');
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      const errorMessage = error.response?.data?.message || 'Failed to save preferences.';
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (isPageLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" color="primary" message="Loading preferences..." />
      </div>
    );
  }

  const preferencesError = getError(LOADING_KEYS.PREFERENCES);
  if (preferencesError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card p-6 rounded-lg shadow-lg max-w-lg w-full">
          <h2 className="text-2xl font-bold text-text-primary mb-4">Error Loading Preferences</h2>
          <div className="bg-error/10 border border-error/30 rounded-md p-4 mb-6">
            <p className="text-error font-medium">{preferencesError.message || 'Failed to load preferences'}</p>
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

  if (!preferences) {
      return <div className="min-h-screen bg-background text-text-secondary flex items-center justify-center">Preferences data not found.</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full"
    >
      <h1 className="text-3xl font-bold text-text-primary mb-8 tracking-tight text-center font-display">Preferences</h1>

      <div className="bg-card rounded-lg shadow-lg p-4 sm:p-6 space-y-6">
        <form onSubmit={handleSavePreferences} className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary mb-4 tracking-wide font-heading">Display Settings</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="itemsPerPage" className="block text-sm font-medium text-text-secondary mb-1 font-base">Items per page (Tables)</label>
                <input
                  type="number"
                  id="itemsPerPage"
                  name="itemsPerPage"
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(parseInt(e.target.value, 10))}
                  min="5"
                  max="100"
                  className="mt-1 block w-full md:w-auto px-3 py-2 text-base bg-background border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm no-spinners font-base"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary mb-4 tracking-wide font-heading">Transaction/Betting Settings</h2>
            <div className="flex items-center">
              <Checkbox
                checked={confirmBetPlacement}
                onCheckedChange={setConfirmBetPlacement}
                label="Require confirmation before placing a bet."
              />
            </div>
          </div>

          {/* Slot Machine Settings - Professional Card Section */}
          <div className="mt-8">
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl shadow p-6 border border-primary/20">
              <h2 className="text-xl font-bold text-primary mb-4 tracking-wide flex items-center gap-2 font-heading">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" /></svg>
                Slot Machine Settings
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="slotAutoSpinDelay" className="block text-sm font-medium text-text-secondary mb-1 font-base">Auto-Spin Delay (ms)</label>
                  <input
                    type="number"
                    id="slotAutoSpinDelay"
                    name="slotAutoSpinDelay"
                    value={slotAutoSpinDelay}
                    onChange={e => setSlotAutoSpinDelay(Number(e.target.value))}
                    min={0}
                    max={5000}
                    step={50}
                    className="mt-1 block w-full px-3 py-2 text-base bg-background border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm no-spinners font-base"
                  />
                </div>
                <div>
                  <label htmlFor="slotAutoSpinDefaultCount" className="block text-sm font-medium text-text-secondary mb-1 font-base">Default Auto-Spin Count</label>
                  <input
                    type="number"
                    id="slotAutoSpinDefaultCount"
                    name="slotAutoSpinDefaultCount"
                    value={slotAutoSpinDefaultCount}
                    onChange={e => setSlotAutoSpinDefaultCount(Number(e.target.value))}
                    min={1}
                    max={50}
                    className="mt-1 block w-full px-3 py-2 text-base bg-background border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm no-spinners font-base"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sound Settings */}
          <div className="mt-8">
            <div className="bg-gradient-to-r from-secondary/10 to-secondary/5 rounded-xl shadow p-6 border border-secondary/20">
              <h2 className="text-xl font-bold text-secondary mb-4 tracking-wide flex items-center gap-2 font-heading">
                <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
                Sound Settings
              </h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="defaultSoundVolume" className="block text-sm font-medium text-text-secondary mb-1 font-base">Default Sound Volume</label>
                  <div className="flex items-center gap-4 mt-4">
                    <div className="w-full">
                      <ElasticSlider
                        leftIcon={<span className="text-lg">🔈</span>}
                        rightIcon={<span className="text-lg">🔊</span>}
                        startingValue={0}
                        defaultValue={defaultSoundVolume}
                        maxValue={100}
                        isStepped
                        stepSize={5}
                        className="mx-auto"
                        onChange={value => setDefaultSoundVolume(value)}
                        key={`volume-slider-${defaultSoundVolume}`} // Add key to force re-render when defaultValue changes
                      />
                    </div>
                    <span className="text-text-primary font-mono w-12 text-right">{defaultSoundVolume}%</span>
                  </div>
                  <p className="mt-6 text-sm text-text-secondary">This volume setting will be used as the default for all game sounds.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Save button at the bottom */}
          <div className="mt-8">
            <button
              type="submit"
              disabled={isSaving || isPageLoading || isLoading(LOADING_KEYS.SAVE_PREFERENCES)}
              className={`w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white font-base ${isSaving || isLoading(LOADING_KEYS.SAVE_PREFERENCES) ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary`}
            >
              {isLoading(LOADING_KEYS.SAVE_PREFERENCES) ? (
                <>
                  <span className="mr-2">Saving</span>
                  <span className="flex items-center">
                    <span className="h-4 w-4 rounded-full animate-pulse bg-white/70 mr-1"></span>
                    <span className="h-4 w-4 rounded-full animate-pulse bg-white/70 mr-1" style={{ animationDelay: '0.2s' }}></span>
                    <span className="h-4 w-4 rounded-full animate-pulse bg-white/70" style={{ animationDelay: '0.4s' }}></span>
                  </span>
                </>
              ) : (
                'Save Preferences'
              )}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
};