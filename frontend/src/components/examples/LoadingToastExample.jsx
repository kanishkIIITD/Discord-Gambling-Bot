import React, { useState } from 'react';
import useLoadingToast from '../../hooks/useLoadingToast';
import LoadingToast from '../LoadingToast';

/**
 * Example component demonstrating the use of LoadingToast and useLoadingToast
 */
const LoadingToastExample = () => {
  const [data, setData] = useState(null);
  const { withLoadingToast, isLoading } = useLoadingToast();
  
  // Define loading keys
  const LOADING_KEYS = {
    FETCH_DATA: 'example.fetchData',
    PROCESS_DATA: 'example.processData',
    SAVE_DATA: 'example.saveData',
  };
  
  // Simulated API call
  const fetchData = async () => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 20% chance of error for demonstration
    if (Math.random() < 0.2) {
      throw new Error('Failed to fetch data');
    }
    
    return { id: 1, name: 'Example Data', value: Math.floor(Math.random() * 1000) };
  };
  
  // Process data with a delay
  const processData = async (rawData) => {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 20% chance of error for demonstration
    if (Math.random() < 0.2) {
      throw new Error('Failed to process data');
    }
    
    return {
      ...rawData,
      processed: true,
      processedAt: new Date().toISOString(),
    };
  };
  
  // Save data with a delay
  const saveData = async (processedData) => {
    // Simulate saving delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 20% chance of error for demonstration
    if (Math.random() < 0.2) {
      throw new Error('Failed to save data');
    }
    
    return {
      ...processedData,
      saved: true,
      savedAt: new Date().toISOString(),
    };
  };
  
  // Handle the full data flow with loading states and toasts
  const handleFetchAndProcess = async () => {
    try {
      // Step 1: Fetch data
      const rawData = await withLoadingToast(
        LOADING_KEYS.FETCH_DATA,
        fetchData,
        {
          loading: 'Fetching data...',
          success: 'Data fetched successfully!',
          error: 'Failed to fetch data',
        }
      );
      
      // Step 2: Process data
      const processedData = await withLoadingToast(
        LOADING_KEYS.PROCESS_DATA,
        () => processData(rawData),
        {
          loading: 'Processing data...',
          success: 'Data processed successfully!',
          error: 'Failed to process data',
        }
      );
      
      // Step 3: Save data
      const savedData = await withLoadingToast(
        LOADING_KEYS.SAVE_DATA,
        () => saveData(processedData),
        {
          loading: 'Saving data...',
          success: 'Data saved successfully!',
          error: 'Failed to save data',
        }
      );
      
      // Update state with the final data
      setData(savedData);
    } catch (error) {
      console.error('Error in data flow:', error);
      // Error is already shown in toast by withLoadingToast
    }
  };
  
  return (
    <div className="p-6 max-w-md mx-auto bg-surface rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-text-primary">Loading Toast Example</h2>
      
      {/* Display loading toasts */}
      <LoadingToast 
        loadingKey={LOADING_KEYS.FETCH_DATA} 
        message="Fetching data..." 
        color="primary" 
      />
      <LoadingToast 
        loadingKey={LOADING_KEYS.PROCESS_DATA} 
        message="Processing data..." 
        color="secondary" 
      />
      <LoadingToast 
        loadingKey={LOADING_KEYS.SAVE_DATA} 
        message="Saving data..." 
        color="accent" 
      />
      
      {/* Action button */}
      <button
        onClick={handleFetchAndProcess}
        disabled={isLoading(LOADING_KEYS.FETCH_DATA) || 
                 isLoading(LOADING_KEYS.PROCESS_DATA) || 
                 isLoading(LOADING_KEYS.SAVE_DATA)}
        className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading(LOADING_KEYS.FETCH_DATA) || 
         isLoading(LOADING_KEYS.PROCESS_DATA) || 
         isLoading(LOADING_KEYS.SAVE_DATA) 
          ? 'Processing...'
          : 'Start Data Flow'}
      </button>
      
      {/* Display data if available */}
      {data && (
        <div className="mt-6 p-4 bg-surface-variant rounded border border-outline">
          <h3 className="text-lg font-semibold mb-2 text-text-primary">Result:</h3>
          <pre className="whitespace-pre-wrap text-sm text-text-secondary">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default LoadingToastExample;