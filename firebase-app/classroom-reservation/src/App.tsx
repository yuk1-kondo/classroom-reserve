import React from 'react';
import { Toaster } from 'react-hot-toast';
import MainApp from './components/MainApp';
import './App.css';
// PreviewUX は廃止し、本番/プレビューともに同一UIを表示する

function App() {
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
      <MainApp />
    </div>
  );
}

export default App;
