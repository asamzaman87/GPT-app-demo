import React from 'react';
import { createRoot } from 'react-dom/client';
import AuthStatus from './AuthStatus';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthStatus />
  </React.StrictMode>
);

