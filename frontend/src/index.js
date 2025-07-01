import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import queryClient from './services/queryClient';
import App from "./App";
import "./index.css";

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
      <App />
      <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
    </QueryClientProvider>
  </React.StrictMode>
);
