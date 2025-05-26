import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserPreferences, updateUserPreferences } from '../services/api';
import { toast } from 'react-hot-toast';

export const Preferences = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // State for form inputs
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [confirmBetPlacement, setConfirmBetPlacement] = useState(true);

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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <h1 className="text-3xl font-bold text-text-primary mb-8 tracking-tight text-center">Preferences</h1>

      <div className="bg-card rounded-lg shadow-lg p-4 sm:p-6 space-y-6">
        <form onSubmit={handleSavePreferences} className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary mb-4 tracking-wide">Display Settings</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="itemsPerPage" className="block text-sm font-medium text-text-secondary mb-1">Items per page (Tables)</label>
                <input
                  type="number"
                  id="itemsPerPage"
                  name="itemsPerPage"
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(parseInt(e.target.value, 10))}
                  min="5"
                  max="100"
                  className="mt-1 block w-full md:w-auto px-3 py-2 text-base bg-background border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm no-spinners"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary mb-4 tracking-wide">Transaction/Betting Settings</h2>
            <div className="flex items-center">
              <input
                id="confirmBetPlacement"
                name="confirmBetPlacement"
                type="checkbox"
                checked={confirmBetPlacement}
                onChange={(e) => setConfirmBetPlacement(e.target.checked)}
                className="h-4 w-4 text-primary border-border rounded focus:ring-primary"
              />
              <label htmlFor="confirmBetPlacement" className="ml-2 block text-sm text-text-secondary">Require confirmation before placing a bet.</label>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSaving || loading} // Disable save button while loading or saving
              className={`w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${isSaving ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary`}
            >
              {isSaving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 