import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import { CardInfoProvider } from './ui/CardInfo.js';
import { TipProvider } from './ui/Tip.js';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root element not found');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <TipProvider>
      <CardInfoProvider>
        <App />
      </CardInfoProvider>
    </TipProvider>
  </React.StrictMode>
);
