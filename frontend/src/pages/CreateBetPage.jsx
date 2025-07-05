import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import axios from '../services/axiosConfig';
import { toast } from 'react-hot-toast';
import RadixDialog from '../components/RadixDialog';
import { InformationCircleIcon, PlusCircleIcon, TrashIcon } from '@heroicons/react/24/outline';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { motion } from 'framer-motion';
import LoadingSpinner from '../components/LoadingSpinner';

// Zustand stores
import { useUserStore } from '../store/useUserStore';
import { useGuildStore } from '../store/useGuildStore';
import { useUIStore } from '../store/useUIStore';
import { useZustandMutation } from '../hooks/useZustandQuery';

const MAX_DESCRIPTION_LENGTH = 100;
const MAX_OPTION_LENGTH = 100;

// Define loading keys for this component
const LOADING_KEYS = {
  CREATE_BET: 'createbet.create'
};

const CreateBetPage = () => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  const user = useUserStore(state => state.user);
  const { startLoading, stopLoading, isLoading, setError } = useUIStore();
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['']);
  const [closingTime, setClosingTime] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  // Animation variants
  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.25, 0.1, 0.25, 1.0],
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.25, 0.1, 0.25, 1.0]
      }
    }
  };

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return <Navigate to="/dashboard" replace />;
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

  // Implementation of the bet creation logic using Zustand for loading state management
  const handleConfirm = async () => {
    setShowConfirm(false);
    startLoading(LOADING_KEYS.CREATE_BET);
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
        guildId: selectedGuildId
      };
      await axios.post(
        `${process.env.REACT_APP_API_URL}/api/bets`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'x-guild-id': selectedGuildId
          }
        }
      );
      toast.success('Bet created successfully!');
      handleClear();
      stopLoading(LOADING_KEYS.CREATE_BET);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to create bet.';
      toast.error(errorMessage);
      setError(LOADING_KEYS.CREATE_BET, errorMessage);
      stopLoading(LOADING_KEYS.CREATE_BET);
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
    <motion.div 
      className="min-h-screen max-w-2xl mx-auto px-4 py-8"
      variants={pageVariants}
      initial="initial"
      animate="animate"
    >
      <motion.h1 
        className="text-3xl font-bold text-text-primary mb-6 tracking-tight text-center font-display"
        variants={itemVariants}
      >
        Create Bet
      </motion.h1>
      <motion.form 
        onSubmit={handleSubmit} 
        className="bg-card rounded-2xl shadow-2xl p-8 space-y-8 border border-border relative" 
        aria-label="Create Bet Form"
        variants={itemVariants}
      >
        <motion.div variants={itemVariants}>
          <h2 className="text-lg font-semibold text-primary mb-2 flex items-center gap-2 font-heading">Bet Description</h2>
          <hr className="mb-3 border-border" />
          <label className="block text-sm font-medium text-text-secondary mb-1 font-base" htmlFor="description">Description <span className="text-error">*</span></label>
          <input
            id="description"
            type="text"
            className="w-full px-3 py-2 rounded border border-border bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all font-base"
            value={description}
            onChange={e => e.target.value.length <= MAX_DESCRIPTION_LENGTH && setDescription(e.target.value)}
            required
            placeholder="Describe the bet..."
            maxLength={MAX_DESCRIPTION_LENGTH}
            aria-required="true"
            aria-label="Bet Description"
          />
          <div className="text-xs text-text-secondary mt-1 flex justify-between font-base">
            <span>{description.length}/{MAX_DESCRIPTION_LENGTH} characters</span>
            {!description.trim() && <span className="text-error">Required</span>}
          </div>
        </motion.div>
        <motion.div variants={itemVariants}>
          <h2 className="text-lg font-semibold text-primary mb-2 flex items-center gap-2 font-heading">Bet Options</h2>
          <hr className="mb-3 border-border" />
          <label className="block text-sm font-medium text-text-secondary mb-1 font-base">Options <span className="text-error">*</span></label>
          <div className="space-y-2 transition-all">
            {options.map((opt, idx) => {
              const error = getOptionError(opt, idx);
              return (
                <motion.div 
                  key={idx} 
                  className="flex items-center gap-2 group transition-all"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                >
                  <input
                    type="text"
                    className={`flex-1 px-3 py-2 rounded border bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all font-base ${error ? 'border-error' : 'border-border'}`}
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
                  {error && <span className="text-xs text-error ml-2 font-base">{error}</span>}
                </motion.div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={handleAddOption}
            className="mt-3 px-3 py-1 rounded bg-primary text-white hover:bg-primary/90 flex items-center gap-1 font-medium transition-transform duration-150 active:scale-95 font-base"
            aria-label="Add Option"
          >
            <PlusCircleIcon className="h-5 w-5" /> Add Option
          </button>
          <div className="text-xs text-text-secondary mt-1 font-base">{options.filter(opt => opt.trim()).length}/2+ options required, {MAX_OPTION_LENGTH} chars max each, must be unique.</div>
        </motion.div>
        <motion.div variants={itemVariants}>
          <h2 className="text-lg font-semibold text-primary mb-2 flex items-center gap-2 font-heading">Closing Time <span className="text-xs text-text-secondary font-normal font-base">(optional)</span>
            <span className="ml-1" title="If set, users can only bet until this time."><InformationCircleIcon className="h-4 w-4 text-info inline" /></span>
          </h2>
          <hr className="mb-3 border-border" />
          <label className="block text-sm font-medium text-text-secondary mb-1 font-base" htmlFor="closingTime">Closing Time</label>
          <DatePicker
            id="closingTime"
            selected={closingTime ? new Date(closingTime) : null}
            onChange={date => setClosingTime(date ? date.toISOString() : '')}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={15}
            dateFormat="yyyy-MM-dd HH:mm"
            minDate={new Date()}
            className="w-full px-3 py-2 rounded border border-border bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all font-base"
            placeholderText="Select closing date and time"
            aria-label="Closing Time"
          />
          <div className="text-xs text-text-secondary mt-1 font-base">If set, users can only bet until this time. Leave blank for no time limit.</div>
        </motion.div>

        {/* Confirmation Dialog */}
        <RadixDialog
          open={showConfirm}
          onOpenChange={setShowConfirm}
          title="Confirm Bet Creation"
          description="Are you sure you want to create this bet? This action cannot be undone."
          className="max-w-md"
        >
          <div className="mb-4 text-text-secondary">
            <p className="mb-2"><strong>Description:</strong> {description}</p>
            <p className="mb-2"><strong>Options:</strong> {options.filter(opt => opt.trim()).join(', ')}</p>
            {closingTime && (
              <p className="mb-2"><strong>Closing Time:</strong> {new Date(closingTime).toLocaleString()}</p>
            )}
            {!closingTime && (
              <p className="mb-2"><strong>No closing time set</strong></p>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
              disabled={isLoading(LOADING_KEYS.CREATE_BET)}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 rounded bg-primary text-white hover:bg-primary/90 transition-colors font-medium flex items-center justify-center gap-2"
              disabled={isLoading(LOADING_KEYS.CREATE_BET)}
            >
              {isLoading(LOADING_KEYS.CREATE_BET) ? (
                <>
                  <LoadingSpinner size="sm" color="white" />
                  Creating...
                </>
              ) : 'Create Bet'}
            </button>
          </div>
        </RadixDialog>

        <motion.div className="flex justify-end gap-3 pt-4" variants={itemVariants}>
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
            disabled={isLoading(LOADING_KEYS.CREATE_BET)}
          >
            Clear
          </button>
          <button
            type="submit"
            className={`px-4 py-2 rounded text-white transition-colors font-medium flex items-center justify-center gap-2 ${canSubmit ? 'bg-primary hover:bg-primary/90' : 'bg-gray-400 cursor-not-allowed'}`}
            disabled={!canSubmit || isLoading(LOADING_KEYS.CREATE_BET)}
          >
            {isLoading(LOADING_KEYS.CREATE_BET) ? (
              <>
                <LoadingSpinner size="sm" color="white" />
                Creating...
              </>
            ) : 'Create Bet'}
          </button>
        </motion.div>
      </motion.form>
    </motion.div>
  );
};

export default CreateBetPage;