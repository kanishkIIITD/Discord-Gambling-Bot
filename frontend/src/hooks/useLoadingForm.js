import { useState, useCallback } from 'react';
import { useLoading } from './useLoading';

/**
 * Custom hook for managing form state with loading indicators
 * 
 * @param {Object} options - Configuration options
 * @param {Function} options.onSubmit - Form submission handler
 * @param {Object} options.initialValues - Initial form values
 * @param {Function} options.validate - Form validation function
 * @param {string} options.loadingKey - Key for the loading state
 * @returns {Object} - Form state and handlers
 */
export const useLoadingForm = (options = {}) => {
  const {
    onSubmit,
    initialValues = {},
    validate,
    loadingKey = 'formSubmission',
  } = options;
  
  const { startLoading, stopLoading, setError, clearError } = useLoading();
  const [values, setValues] = useState(initialValues);
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [submitCount, setSubmitCount] = useState(0);
  
  // Validate form values
  const validateForm = useCallback(() => {
    if (!validate) return {};
    
    const validationErrors = validate(values);
    setErrors(validationErrors || {});
    return validationErrors || {};
  }, [values, validate]);
  
  // Handle field change
  const handleChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    
    setValues((prevValues) => ({
      ...prevValues,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }, []);
  
  // Handle field blur
  const handleBlur = useCallback((event) => {
    const { name } = event.target;
    
    setTouched((prevTouched) => ({
      ...prevTouched,
      [name]: true,
    }));
    
    validateForm();
  }, [validateForm]);
  
  // Set a specific field value
  const setFieldValue = useCallback((name, value) => {
    setValues((prevValues) => ({
      ...prevValues,
      [name]: value,
    }));
  }, []);
  
  // Set a specific field error
  const setFieldError = useCallback((name, error) => {
    setErrors((prevErrors) => ({
      ...prevErrors,
      [name]: error,
    }));
  }, []);
  
  // Set a specific field as touched
  const setFieldTouched = useCallback((name, isTouched = true) => {
    setTouched((prevTouched) => ({
      ...prevTouched,
      [name]: isTouched,
    }));
  }, []);
  
  // Reset the form
  const resetForm = useCallback((newValues = initialValues) => {
    setValues(newValues);
    setTouched({});
    setErrors({});
    setSubmitCount(0);
    clearError(loadingKey);
  }, [initialValues, loadingKey, clearError]);
  
  // Handle form submission
  const handleSubmit = useCallback(async (event) => {
    if (event) {
      event.preventDefault();
    }
    
    // Validate all fields
    const validationErrors = validateForm();
    
    // Mark all fields as touched
    const allTouched = Object.keys(values).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {});
    
    setTouched(allTouched);
    setSubmitCount((count) => count + 1);
    
    // If there are validation errors, don't submit
    if (Object.keys(validationErrors).length > 0) {
      return;
    }
    
    // If no onSubmit handler, just return
    if (!onSubmit) {
      return;
    }
    
    try {
      startLoading(loadingKey);
      clearError(loadingKey);
      
      // Call the onSubmit handler with form values
      await onSubmit(values, {
        setFieldValue,
        setFieldError,
        setFieldTouched,
        resetForm,
      });
      
      stopLoading(loadingKey);
    } catch (error) {
      setError(loadingKey, error.message || 'Form submission failed');
      stopLoading(loadingKey);
      throw error;
    }
  }, [values, validateForm, onSubmit, loadingKey, startLoading, stopLoading, setError, clearError, setFieldValue, setFieldError, setFieldTouched, resetForm]);
  
  // Get field props
  const getFieldProps = useCallback((name) => {
    return {
      name,
      value: values[name] || '',
      onChange: handleChange,
      onBlur: handleBlur,
    };
  }, [values, handleChange, handleBlur]);
  
  // Check if the form is valid
  const isValid = Object.keys(errors).length === 0;
  
  // Check if the form is submitting
  const isSubmitting = useLoading().isLoading(loadingKey);
  
  return {
    values,
    touched,
    errors,
    submitCount,
    isSubmitting,
    isValid,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    setFieldError,
    setFieldTouched,
    resetForm,
    getFieldProps,
    loadingKey,
  };
};

/**
 * Custom hook for handling form submission with loading state
 * Simpler version of useLoadingForm for basic form submissions
 * 
 * @param {Function} submitFn - Function to call on form submission
 * @param {Object} options - Configuration options
 * @param {string} options.loadingKey - Key for the loading state
 * @param {Function} options.onSuccess - Callback for successful submission
 * @param {Function} options.onError - Callback for submission error
 * @returns {Object} - Form submission handlers and state
 */
export const useSubmitWithLoading = (submitFn, options = {}) => {
  const {
    loadingKey = 'formSubmission',
    onSuccess,
    onError,
  } = options;
  
  const { startLoading, stopLoading, setError, clearError, isLoading } = useLoading();
  const [result, setResult] = useState(null);
  
  // Handle form submission
  const handleSubmit = useCallback(async (data, event) => {
    if (event) {
      event.preventDefault();
    }
    
    try {
      startLoading(loadingKey);
      clearError(loadingKey);
      
      const response = await submitFn(data);
      setResult(response);
      
      if (onSuccess) {
        onSuccess(response, data);
      }
      
      stopLoading(loadingKey);
      return response;
    } catch (error) {
      setError(loadingKey, error.message || 'Submission failed');
      
      if (onError) {
        onError(error, data);
      }
      
      stopLoading(loadingKey);
      throw error;
    }
  }, [submitFn, loadingKey, startLoading, stopLoading, setError, clearError, onSuccess, onError]);
  
  return {
    handleSubmit,
    isSubmitting: isLoading(loadingKey),
    result,
    loadingKey,
  };
};

/**
 * Custom hook for handling multi-step forms with loading states
 * 
 * @param {Object} options - Configuration options
 * @param {Object} options.steps - Form steps configuration
 * @param {Object} options.initialValues - Initial form values
 * @param {Function} options.onComplete - Callback when all steps are complete
 * @param {string} options.loadingKey - Base key for loading states
 * @returns {Object} - Multi-step form state and handlers
 */
export const useMultiStepForm = (options = {}) => {
  const {
    steps = [],
    initialValues = {},
    onComplete,
    loadingKey = 'multiStepForm',
  } = options;
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState(initialValues);
  const [stepsCompleted, setStepsCompleted] = useState([]);
  
  // Get current step
  const currentStep = steps[currentStepIndex] || {};
  const currentStepLoadingKey = `${loadingKey}_step${currentStepIndex}`;
  
  // Create form for current step
  const {
    values,
    errors,
    touched,
    isSubmitting,
    handleSubmit,
    handleChange,
    handleBlur,
    setFieldValue,
    resetForm,
    getFieldProps,
  } = useLoadingForm({
    initialValues: { ...formData, ...currentStep.initialValues },
    validate: currentStep.validate,
    loadingKey: currentStepLoadingKey,
    onSubmit: async (stepData) => {
      // Process step data if needed
      let processedData = stepData;
      if (currentStep.processData) {
        processedData = await currentStep.processData(stepData, formData);
      }
      
      // Update form data with current step data
      const updatedFormData = {
        ...formData,
        ...processedData,
      };
      
      setFormData(updatedFormData);
      
      // Mark step as completed
      if (!stepsCompleted.includes(currentStepIndex)) {
        setStepsCompleted([...stepsCompleted, currentStepIndex]);
      }
      
      // If this is the last step, call onComplete
      if (currentStepIndex === steps.length - 1 && onComplete) {
        return onComplete(updatedFormData);
      }
      
      // Otherwise, go to next step
      setCurrentStepIndex((index) => Math.min(index + 1, steps.length - 1));
    },
  });
  
  // Go to previous step
  const goToPreviousStep = () => {
    setCurrentStepIndex((index) => Math.max(index - 1, 0));
  };
  
  // Go to next step
  const goToNextStep = () => {
    setCurrentStepIndex((index) => Math.min(index + 1, steps.length - 1));
  };
  
  // Go to specific step
  const goToStep = (stepIndex) => {
    setCurrentStepIndex(Math.max(0, Math.min(stepIndex, steps.length - 1)));
  };
  
  // Reset the entire form
  const resetMultiStepForm = () => {
    setCurrentStepIndex(0);
    setFormData(initialValues);
    setStepsCompleted([]);
    resetForm(initialValues);
  };
  
  return {
    // Current step info
    currentStep,
    currentStepIndex,
    isFirstStep: currentStepIndex === 0,
    isLastStep: currentStepIndex === steps.length - 1,
    totalSteps: steps.length,
    stepsCompleted,
    
    // Navigation
    goToPreviousStep,
    goToNextStep,
    goToStep,
    
    // Form state and handlers
    formData,
    values,
    errors,
    touched,
    isSubmitting,
    handleSubmit,
    handleChange,
    handleBlur,
    setFieldValue,
    getFieldProps,
    resetForm: resetMultiStepForm,
    
    // Loading state
    loadingKey: currentStepLoadingKey,
  };
};