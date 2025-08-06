import React from 'react';
import MainApp from './components/MainApp';
import './App.css';

// Firebase初期データセットアップ
import './firebase/setupData';

function App() {
  return (
    <div className="App">
      <MainApp />
    </div>
  );
}

export default App;
