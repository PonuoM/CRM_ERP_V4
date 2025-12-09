
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import LoginPage from './pages/LoginPage';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const isSessionValidToday = (): boolean => {
  const raw = localStorage.getItem('sessionUser');
  const token = localStorage.getItem('authToken');
  if (!raw || !token) return false;
  try {
    const parsed = JSON.parse(raw);
    const loginDate = parsed?.loginDate || parsed?.login_date;
    const today = new Date().toISOString().slice(0, 10);
    if (loginDate !== today) {
      localStorage.removeItem('sessionUser');
      localStorage.removeItem('authToken');
      return false;
    }
    return true;
  } catch {
    localStorage.removeItem('sessionUser');
    localStorage.removeItem('authToken');
    return false;
  }
};

const root = ReactDOM.createRoot(rootElement);
const url = new URL(window.location.href);
const showLogin =
  url.searchParams.has('login') || !isSessionValidToday();
root.render(
  <React.StrictMode>
    {showLogin ? <LoginPage /> : <App />}
  </React.StrictMode>
);
