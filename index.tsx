
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import LoginPage from './pages/LoginPage';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
const url = new URL(window.location.href);
const showLogin = url.searchParams.has('login') || !localStorage.getItem('sessionUser');
root.render(
  <React.StrictMode>
    {showLogin ? <LoginPage /> : <App />}
  </React.StrictMode>
);
