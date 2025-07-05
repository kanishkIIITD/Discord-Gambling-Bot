import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import queryClient from './services/queryClient';
import { hydrateQueryCache } from './utils/cacheHydration';
import './services/axiosConfig'; // Import axios configuration
import App from "./App";
import "./index.css";
import { BrowserRouter } from 'react-router-dom';
import { AnimationProvider } from './contexts/AnimationContext';
import { PerformanceProvider } from './contexts/PerformanceContext';

// Hydrate React Query cache from localStorage on app startup
// This prevents cold loading states when the app refreshes
hydrateQueryCache(queryClient);

// Initialize chart performance monitoring in development mode
if (process.env.NODE_ENV === 'development') {
  import('./utils/chartPerformanceIntegration')
    .then(({ initChartPerformanceIntegration }) => {
      initChartPerformanceIntegration();
    })
    .catch(err => console.warn('Failed to initialize chart performance monitoring:', err));
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AnimationProvider>
          <PerformanceProvider>
            <App />
            <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
          </PerformanceProvider>
        </AnimationProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
