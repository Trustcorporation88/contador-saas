import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { queryClient } from './config/queryClient';
import './index.css';

// Após deploy novo, o browser pode ter JS antigo que aponta para chunks removidos.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const reloadKey = 'procontador-chunk-reload';
  if (!sessionStorage.getItem(reloadKey)) {
    sessionStorage.setItem(reloadKey, '1');
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
