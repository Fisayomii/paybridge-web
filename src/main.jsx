import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext.jsx';
import App from './App.jsx';
// Fonts are bundled with the app (no Google Fonts request, works offline).
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/public-sans';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Money data should be fresh, but don't hammer a sleeping Render instance with retries.
      staleTime: 15_000,
      retry: (count, error) => count < 1 && error?.status !== 401 && error?.status !== 403 && error?.status !== 404,
      refetchOnWindowFocus: true,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
