import React from 'react';
import { Toaster } from 'react-hot-toast';
import MainApp from './components/MainApp';
import './App.css';
import PreviewUX from './preview/PreviewUX';

function App() {
  const isPreview = (() => {
    if (typeof window === 'undefined') return false;
    const search = new URLSearchParams(window.location.search);
    if (search.get('preview') === '1') return true;
    const path = window.location.pathname.replace(/\/+$/, '');
    return path === '/preview' || path === '/ux-preview';
  })();
  return (
    <div className="App">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            whiteSpace: 'nowrap',
            fontSize: '14px',
            padding: '8px 12px',
            maxWidth: '100%'
          }
        }}
      />
      {isPreview ? (
        <PreviewUX />
      ) : (
      <MainApp />
      )}
    </div>
  );
}

export default App;
