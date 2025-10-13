import React, { useState } from 'react';
import { health, login, listCustomers } from '../services/api';

const box: React.CSSProperties = {
  maxWidth: 400,
  margin: '48px auto',
  padding: 24,
  borderRadius: 12,
  background: '#fff',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
};

export default function LoginPage() {
  const [username, setUsername] = useState('telesale1');
  const [password, setPassword] = useState('telesale123');
  const [status, setStatus] = useState<string>('');
  const [user, setUser] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);

  const onPing = async () => {
    setStatus('Pinging API...');
    try {
      const res = await health();
      setStatus(`API OK: ${res.status}`);
    } catch (e: any) {
      setStatus(`API Error: ${e.status || ''} ${(e.data && e.data.error) || e.message}`);
    }
  };

  const onLogin = async () => {
    setStatus('Logging in...');
    try {
      const res = await login(username, password);
      if (!res.ok) throw new Error(res.error || 'Login failed');
      setUser(res.user);
      setStatus(`Logged in as ${res.user!.username} (${res.user!.role})`);
      // Persist session and navigate to app
      localStorage.setItem('sessionUser', JSON.stringify(res.user));
      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete('login');
        url.searchParams.delete('api');
        window.location.replace(url.toString());
      }, 400);
    } catch (e: any) {
      setStatus(`Login Error: ${e.status || ''} ${(e.data && e.data.error) || e.message}`);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onLogin();
    }
  };

  const onLoadCustomers = async () => {
    setStatus('Loading customers...');
    try {
      const data = await listCustomers({ companyId: user?.company_id });
      setCustomers(data);
      setStatus(`Loaded ${data.length} customers`);
    } catch (e: any) {
      setStatus(`Customers Error: ${e.status || ''} ${(e.data && e.data.error) || e.message}`);
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={box}>
        <h2 style={{ margin: '0 0 12px', fontSize: 22 }}>Login (API Demo)</h2>
        <p style={{ margin: '0 0 16px', color: '#555' }}>ทดสอบเชื่อมต่อ API และเข้าสู่ระบบด้วยผู้ใช้ตัวอย่าง</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button onClick={onPing} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>Ping API</button>
          <span style={{ color: '#666', fontSize: 13 }}>{status}</span>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <input 
            placeholder="username" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            onKeyPress={handleKeyPress}
            style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} 
          />
          <input 
            placeholder="password" 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            onKeyPress={handleKeyPress}
            style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} 
          />
          <button onClick={onLogin} style={{ padding: 10, borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer' }}>Login</button>
        </div>

        {user && (
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 8, color: '#444' }}>
              เข้าสู่ระบบเป็น: <b>{user.first_name} {user.last_name}</b> ({user.role})
            </div>
            <button onClick={onLoadCustomers} style={{ padding: 8, borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>โหลดรายชื่อลูกค้า</button>
            {customers.length > 0 && (
              <ul style={{ marginTop: 8, paddingLeft: 16 }}>
                {customers.slice(0, 5).map((c: any) => (
                  <li key={c.id}>{c.id} - {c.first_name} {c.last_name} ({c.phone})</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div style={{ marginTop: 20, fontSize: 13, color: '#333' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Test Accounts</div>
          <ul style={{ lineHeight: 1.6, paddingLeft: 16 }}>
            <li>Super Admin — user: <code>superadmin</code> pass: <code>superadmin123</code></li>
            <li>Admin Control — user: <code>owner1</code> pass: <code>owner123</code></li>
            <li>Admin Page — user: <code>admin1</code> pass: <code>admin123</code></li>
            <li>Telesale — user: <code>telesale1</code> pass: <code>telesale123</code></li>
            <li>Supervisor Telesale — user: <code>supervisor1</code> pass: <code>supervisor123</code></li>
            <li>Backoffice — user: <code>backoffice1</code> pass: <code>backoffice123</code></li>
          </ul>
          <div style={{ marginTop: 6, color: '#666' }}>เปิดหน้านี้ด้วยพารามิเตอร์ <code>?login</code> เช่น <code>http://localhost/CRM_ERP_V4/?login</code></div>
        </div>
      </div>
    </div>
  );
}
