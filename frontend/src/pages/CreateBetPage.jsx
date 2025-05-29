import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { InformationCircleIcon, PlusCircleIcon, TrashIcon } from '@heroicons/react/24/outline';

// --- TEMP: Main Guild ID for single-guild mode ---
const MAIN_GUILD_ID = process.env.REACT_APP_MAIN_GUILD_ID;

const MAX_DESCRIPTION_LENGTH = 100;
const MAX_OPTION_LENGTH = 100;

const CreateBetPage = () => {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['']);
  const [closingTime, setClosingTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return <div className="max-w-2xl mx-auto px-4 py-8 text-center text-error text-lg font-semibold">Access denied. Admins only.</div>;
  }

  const handleOptionChange = (idx, value) => {
    if (value.length > MAX_OPTION_LENGTH) return;
    setOptions(prev => prev.map((opt, i) => (i === idx ? value : opt)));
  };

  const handleAddOption = () => {
    setOptions(prev => [...prev, '']);
  };

  const handleRemoveOption = (idx) => {
    setOptions(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  };

  const handleClear = () => {
    setDescription('');
    setOptions(['']);
    setClosingTime('');
  };

  const validate = () => {
    if (!description.trim()) {
      toast.error('Description is required.', { icon: '⚠️' });
      return false;
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      toast.error('Description is too long.', { icon: '⚠️' });
      return false;
    }
    const cleanOptions = options.map(opt => opt.trim()).filter(opt => opt);
    if (cleanOptions.length < 2) {
      toast.error('At least two options are required.', { icon: '⚠️' });
      return false;
    }
    if (cleanOptions.some(opt => opt.length > MAX_OPTION_LENGTH)) {
      toast.error('Option is too long.', { icon: '⚠️' });
      return false;
    }
    const uniqueOptions = new Set(cleanOptions);
    if (uniqueOptions.size !== cleanOptions.length) {
      toast.error('Options must be unique.', { icon: '⚠️' });
      return false;
    }
    if (closingTime) {
      const closing = new Date(closingTime);
      if (isNaN(closing.getTime()) || closing <= new Date()) {
        toast.error('Closing time must be in the future.', { icon: '⚠️' });
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setShowConfirm(false);
    setLoading(true);
    try {
      let durationMinutes;
      if (closingTime) {
        const diffMs = new Date(closingTime) - Date.now();
        durationMinutes = diffMs > 0 ? Math.round(diffMs / 60000) : undefined;
      }
      const cleanOptions = options.map(opt => opt.trim()).filter(opt => opt);
      const payload = {
        description,
        options: cleanOptions,
        creatorDiscordId: user.discordId,
        ...(durationMinutes ? { durationMinutes } : {}),
        guildId: MAIN_GUILD_ID
      };
      await axios.post(
        `${process.env.REACT_APP_API_URL}/api/bets`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'x-guild-id': MAIN_GUILD_ID
          }
        }
      );
      toast.success('Bet created successfully!');
      handleClear();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create bet.');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    description.trim() &&
    description.length <= MAX_DESCRIPTION_LENGTH &&
    options.filter(opt => opt.trim()).length >= 2 &&
    new Set(options.map(opt => opt.trim()).filter(opt => opt)).size === options.map(opt => opt.trim()).filter(opt => opt).length &&
    !options.some(opt => opt.length > MAX_OPTION_LENGTH) &&
    (!closingTime || (new Date(closingTime) > new Date()));

  const getOptionError = (opt, idx) => {
    if (!opt.trim()) return 'Option cannot be empty.';
    if (opt.length > MAX_OPTION_LENGTH) return 'Option too long.';
    if (options.filter((o) => o.trim() === opt.trim()).length > 1) return 'Duplicate option.';
    return '';
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight text-center">Create Bet</h1>
      <form onSubmit={handleSubmit} className="bg-card rounded-2xl shadow-2xl p-8 space-y-8 border border-border relative" aria-label="Create Bet Form">
        <div>
          <h2 className="text-lg font-semibold text-primary mb-2 flex items-center gap-2">Bet Description</h2>
          <hr className="mb-3 border-border" />
          <label className="block text-sm font-medium text-text-secondary mb-1" htmlFor="description">Description <span className="text-error">*</span></label>
          <input
            id="description"
            type="text"
            className="w-full px-3 py-2 rounded border border-border bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
            value={description}
            onChange={e => e.target.value.length <= MAX_DESCRIPTION_LENGTH && setDescription(e.target.value)}
            required
            placeholder="Describe the bet..."
            maxLength={MAX_DESCRIPTION_LENGTH}
            aria-required="true"
            aria-label="Bet Description"
          />
          <div className="text-xs text-text-secondary mt-1 flex justify-between">
            <span>{description.length}/{MAX_DESCRIPTION_LENGTH} characters</span>
            {!description.trim() && <span className="text-error">Required</span>}
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-primary mb-2 flex items-center gap-2">Bet Options</h2>
          <hr className="mb-3 border-border" />
          <label className="block text-sm font-medium text-text-secondary mb-1">Options <span className="text-error">*</span></label>
          <div className="space-y-2 transition-all">
            {options.map((opt, idx) => {
              const error = getOptionError(opt, idx);
              return (
                <div key={idx} className="flex items-center gap-2 group transition-all">
                  <input
                    type="text"
                    className={`flex-1 px-3 py-2 rounded border bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all ${error ? 'border-error' : 'border-border'}`}
                    value={opt}
                    onChange={e => handleOptionChange(idx, e.target.value)}
                    required
                    placeholder={`Option ${idx + 1}`}
                    maxLength={MAX_OPTION_LENGTH}
                    aria-label={`Option ${idx + 1}`}
                    aria-invalid={!!error}
                  />
                  {options.length > 1 && (
                    <button type="button" onClick={() => handleRemoveOption(idx)} className="text-error p-1 rounded hover:bg-error/10 transition-colors" aria-label={`Remove Option ${idx + 1}`}> <TrashIcon className="h-5 w-5" /> </button>
                  )}
                  {error && <span className="text-xs text-error ml-2">{error}</span>}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={handleAddOption}
            className="mt-3 px-3 py-1 rounded bg-primary text-white hover:bg-primary/90 flex items-center gap-1 font-medium transition-transform duration-150 active:scale-95"
            aria-label="Add Option"
          >
            <PlusCircleIcon className="h-5 w-5" /> Add Option
          </button>
          <div className="text-xs text-text-secondary mt-1">{options.filter(opt => opt.trim()).length}/2+ options required, {MAX_OPTION_LENGTH} chars max each, must be unique.</div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-primary mb-2 flex items-center gap-2">Closing Time <span className="text-xs text-text-secondary font-normal">(optional)</span>
            <span className="ml-1" title="If set, users can only bet until this time."><InformationCircleIcon className="h-4 w-4 text-info inline" /></span>
          </h2>
          <hr className="mb-3 border-border" />
          <label className="block text-sm font-medium text-text-secondary mb-1" htmlFor="closingTime">Closing Time</label>
          <input
            id="closingTime"
            type="datetime-local"
            className="w-full px-3 py-2 rounded border border-border bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
            value={closingTime}
            onChange={e => setClosingTime(e.target.value)}
            aria-label="Closing Time"
          />
          {closingTime && (
            <div className="text-xs text-info mt-1">Closes: {new Date(closingTime).toLocaleString()}</div>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <button
            type="submit"
            disabled={loading || !canSubmit}
            className={`flex-1 py-2 px-4 rounded bg-primary text-white font-semibold flex items-center justify-center ${loading || !canSubmit ? 'opacity-60 cursor-not-allowed' : 'hover:bg-primary/90'} transition-all`}
            aria-label="Create Bet"
          >
            {loading ? <span className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-white rounded-full"></span> : null}
            {loading ? 'Creating...' : 'Create Bet'}
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={loading}
            className="flex-1 py-2 px-4 rounded bg-surface text-text-secondary border border-border font-semibold hover:bg-primary/5 transition-colors"
            aria-label="Clear Form"
          >
            Clear
          </button>
        </div>
        <div className="text-xs text-text-secondary mt-2">Fields marked <span className="text-error">*</span> are required.</div>
        <ConfirmModal
          open={showConfirm}
          title="Confirm Bet Creation"
          message={
            <div className="space-y-2 text-left">
              <div><span className="font-semibold text-text-primary">Description:</span> {description}</div>
              <div><span className="font-semibold text-text-primary">Options:</span>
                <ul className="list-disc ml-6">
                  {options.filter(opt => opt.trim()).map((opt, idx) => (
                    <li key={idx}>{opt}</li>
                  ))}
                </ul>
              </div>
              {closingTime && <div><span className="font-semibold text-text-primary">Closing Time:</span> {new Date(closingTime).toLocaleString()}</div>}
            </div>
          }
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
          confirmText={loading ? 'Creating...' : 'Confirm'}
          cancelText="Cancel"
          loading={loading}
        />
      </form>
    </div>
  );
};
export default CreateBetPage; 