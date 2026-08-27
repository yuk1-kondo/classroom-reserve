import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Firebase Auth の許可ドメインは localhost。127.0.0.1 だとポップアップ前に失敗する
if (process.env.NODE_ENV === 'development' && window.location.hostname === '127.0.0.1') {
  const { protocol, port, pathname, search, hash } = window.location;
  const next = `${protocol}//localhost${port ? `:${port}` : ''}${pathname}${search}${hash}`;
  window.location.replace(next);
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
