import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import MainApp from './components/MainApp';
import AdminPage from './components/AdminPage';
import { initializeDataIntegrity } from './firebase/dataIntegrity';
import './App.css';

function App() {
  useEffect(() => {
    initializeDataIntegrity().catch(() => {});
  }, []);
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
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainApp />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
