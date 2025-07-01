import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserPreferences, updateUserPreferences } from '../services/api';
import { toast } from 'react-hot-toast';
import { Checkbox } from '../components/Checkbox';
import { motion } from 'framer-motion';

export const Preferences = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // State for form inputs
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [confirmBetPlacement, setConfirmBetPlacement] = useState(true);
  // Slot machine advanced settings
  const [slotAutoSpinDelay, setSlotAutoSpinDelay] = useState(300); // ms
  const [slotAutoSpinDefaultCount, setSlotAutoSpinDefaultCount] = useState(1);

  useEffect(() => {
    const fetchPreferences = async () => {
      if (!user?.discordId) return;
      try {
        setLoading(true);
        const data = await getUserPreferences(user.discordId);
        setPreferences(data);
        // Set form input states based on fetched preferences
        setItemsPerPage(data.itemsPerPage);
        setConfirmBetPlacement(data.confirmBetPlacement);
        setSlotAutoSpinDelay(data.slotAutoSpinDelay ?? 300);
        setSlotAutoSpinDefaultCount(data.slotAutoSpinDefaultCount ?? 1);
      } catch (err) {
        console.error('Error fetching user preferences:', err);
        setError('Failed to load preferences.');
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [user]);

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    if (!user?.discordId) {
      toast.error('User not authenticated.');
      return;
    }
    setIsSaving(true);
    try {
      const updatedPrefs = {
        itemsPerPage,
        confirmBetPlacement,
        slotAutoSpinDelay,
        slotAutoSpinDefaultCount,
      };
      const response = await updateUserPreferences(user.discordId, updatedPrefs);
      setPreferences(response.preferences); // Update state with saved preferences
      toast.success(response.message || 'Preferences saved successfully!');
    } catch (error) {
      console.error('Error saving preferences:', error);
      const errorMessage = error.response?.data?.message || 'Failed to save preferences.';
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
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

          {/* Save button at the bottom */}
          <div className="mt-8">
            <button
              type="submit"
              disabled={isSaving || loading}
              className={`w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white font-base ${isSaving ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary`}
            >
              {isSaving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}; 