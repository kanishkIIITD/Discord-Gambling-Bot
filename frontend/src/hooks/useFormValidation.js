import { useState, useCallback, useMemo } from 'react';

/**
 * Custom hook for form validation
 * @param {Object} initialValues - Initial form values
 * @param {Object} validationRules - Validation rules for each field
 * @param {Function} onSubmit - Function to call on successful form submission
 * @returns {Object} Form validation utilities
 */
export const useFormValidation = (initialValues = {}, validationRules = {}, onSubmit = () => {}) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValid, setIsValid] = useState(false);

  // Common validation patterns
  const validationPatterns = useMemo(() => ({
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    url: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
    number: /^\d+$/,
    alphanumeric: /^[a-zA-Z0-9]+$/,
    phone: /^\+?[\d\s()-]{7,}$/,
  }), []);

  // Validate a single field
  const validateField = useCallback((name, value) => {
    if (!validationRules[name]) return '';
    
    const rules = validationRules[name];
    
    if (rules.required && (!value || (typeof value === 'string' && !value.trim()))) {
      return rules.required === true ? `${name} is required` : rules.required;
    }
    
    if (rules.minLength && value.length < rules.minLength) {
      return `${name} must be at least ${rules.minLength} characters`;
    }
    
    if (rules.maxLength && value.length > rules.maxLength) {
      return `${name} must be less than ${rules.maxLength} characters`;
    }
    
    if (rules.pattern) {
      const pattern = typeof rules.pattern === 'string' && validationPatterns[rules.pattern]
        ? validationPatterns[rules.pattern]
        : rules.pattern;
        
      if (!pattern.test(value)) {
        return rules.patternMessage || `${name} is invalid`;
      }
    }
    
    if (rules.validate && typeof rules.validate === 'function') {
      const validationResult = rules.validate(value, values);
      if (validationResult) return validationResult;
    }
    
    return '';
  }, [validationRules, validationPatterns, values]);

  // Validate all fields
  const validateForm = useCallback(() => {
    const newErrors = {};
    let formIsValid = true;
    
    Object.keys(validationRules).forEach(name => {
      const value = values[name];
      const error = validateField(name, value);
      
      if (error) {
        newErrors[name] = error;
        formIsValid = false;
      }
    });
    
    setErrors(newErrors);
    setIsValid(formIsValid);
    return formIsValid;
  }, [validateField, validationRules, values]);

  // Handle input change
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setValues(prev => ({
      ...prev,
      [name]: newValue
    }));
    
    // Mark field as touched
    if (!touched[name]) {
      setTouched(prev => ({
        ...prev,
        [name]: true
      }));
    }
    
    // Validate field on change
    const error = validateField(name, newValue);
    setErrors(prev => ({
      ...prev,
      [name]: error
    }));
    
    // Check if form is valid
    const newErrors = { ...errors, [name]: error };
    setIsValid(Object.values(newErrors).every(err => !err));
  }, [validateField, touched, errors]);

  // Handle blur event
  const handleBlur = useCallback((e) => {
    const { name, value } = e.target;
    
    // Mark field as touched
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));
    
    // Validate field on blur
    const error = validateField(name, value);
    setErrors(prev => ({
      ...prev,
      [name]: error
    }));
  }, [validateField]);

  // Handle form submission
  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();
    
    // Mark all fields as touched
    const allTouched = Object.keys(validationRules).reduce((acc, field) => {
      acc[field] = true;
      return acc;
    }, {});
    
    setTouched(allTouched);
    
    // Validate all fields
    const isFormValid = validateForm();
    
    if (isFormValid) {
      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } catch (error) {
        console.error('Form submission error:', error);
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [validateForm, validationRules, onSubmit, values]);

  // Reset form to initial values
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  // Set a specific field value programmatically
  const setFieldValue = useCallback((name, value) => {
    setValues(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Validate the field
    const error = validateField(name, value);
    setErrors(prev => ({
      ...prev,
      [name]: error
    }));
  }, [validateField]);

  // Set multiple field values programmatically
  const setMultipleValues = useCallback((newValues) => {
    setValues(prev => ({
      ...prev,
      ...newValues
    }));
    
    // Validate all updated fields
    const newErrors = { ...errors };
    let formIsValid = true;
    
    Object.entries(newValues).forEach(([name, value]) => {
      if (validationRules[name]) {
        const error = validateField(name, value);
        newErrors[name] = error;
        if (error) formIsValid = false;
      }
    });
    
    setErrors(newErrors);
    setIsValid(formIsValid);
  }, [errors, validateField, validationRules]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    setFieldValue,
    setMultipleValues,
    validateForm,
  };
};

export default useFormValidation;