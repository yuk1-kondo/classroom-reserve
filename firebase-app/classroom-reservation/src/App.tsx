import React from 'react';
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
      {isPreview ? (
        <PreviewUX />
      ) : (
      <MainApp />
      )}
    </div>
  );
}

export default App;
