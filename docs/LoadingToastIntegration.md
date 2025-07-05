# Loading Toast Integration

## Overview

This document describes the integration between the LoadingContext system and toast notifications in our application. This integration provides a unified approach to managing loading states while providing visual feedback to users through toast notifications.

## Components and Hooks

### 1. LoadingContext Integration in useToast

The `useToast` hook has been enhanced to integrate with LoadingContext, allowing toast notifications to be synchronized with loading states:

```javascript
// Example usage of promise with LoadingContext
const { promise, LOADING_KEYS } = useToast();

promise(
  fetchData(),
  {
    loading: 'Fetching data...',
    success: 'Data loaded successfully!',
    error: 'Failed to load data',
  },
  {}, // Toast options
  LOADING_KEYS.TOAST_PROMISE // Loading key
);
```

### 2. LoadingToast Component

The `LoadingToast` component provides a visual representation of loading states managed by LoadingContext:

```jsx
<LoadingToast 
  loadingKey="data.fetch" 
  message="Loading data..." 
  size="md" 
  color="primary" 
/>
```

### 3. useLoadingToast Hook

The `useLoadingToast` hook combines LoadingContext with toast notifications for a more integrated experience:

```javascript
const { withLoadingToast } = useLoadingToast();

// Execute an async function with loading state and toast notifications
withLoadingToast(
  'data.fetch',
  fetchData,
  {
    loading: 'Fetching data...',
    success: 'Data loaded successfully!',
    error: 'Failed to load data',
  }
);
```

## Best Practices

### When to Use LoadingToast vs. LoadingSpinner

- **LoadingToast**: Use for non-blocking operations where the user can continue interacting with the UI
- **LoadingSpinner**: Use for blocking operations that prevent user interaction until completion

### Defining Loading Keys

When defining loading keys for toast operations, follow these conventions:

1. Use dot notation to represent hierarchical relationships (e.g., `data.fetch`, `user.update`)
2. Keep keys descriptive but concise
3. Define constants for frequently used keys

### Error Handling

When using the integrated loading toast system, errors are automatically handled and displayed to the user. However, you may want to provide custom error messages:

```javascript
const { withLoadingToast } = useLoadingToast();

try {
  await withLoadingToast(
    'user.update',
    updateUser,
    {
      loading: 'Updating user...',
      success: 'User updated successfully!',
      // Custom error handling
      error: (err) => `Failed to update user: ${err.message}`,
    }
  );
} catch (error) {
  // Additional error handling if needed
  console.error('Error details:', error);
}
```

## Integration Examples

### Form Submission

```jsx
const { withLoadingToast } = useLoadingToast();

const handleSubmit = async (formData) => {
  await withLoadingToast(
    'form.submit',
    () => submitForm(formData),
    {
      loading: 'Submitting form...',
      success: 'Form submitted successfully!',
      error: 'Failed to submit form',
    }
  );
};
```

### Data Fetching

```jsx
const { withLoadingToast } = useLoadingToast();

const fetchUserData = async (userId) => {
  return withLoadingToast(
    'user.fetch',
    () => api.getUser(userId),
    {
      loading: 'Loading user data...',
      success: 'User data loaded!',
      error: 'Could not load user data',
    }
  );
};
```

## Conclusion

The integration between LoadingContext and toast notifications provides a powerful and consistent way to manage loading states while providing visual feedback to users. By using the components and hooks described in this document, you can create a more cohesive user experience throughout the application.