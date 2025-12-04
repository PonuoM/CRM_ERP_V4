import React, { useEffect, useState, useRef } from 'react';
import { login } from '../services/api';

type StatusTone = 'idle' | 'info' | 'success' | 'error';

const icons = {
  success: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.75 12L10.58 14.83L16.25 9.17004" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  warning: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.9945 16H12.0035" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  info: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.9945 16H12.0035" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const loginCss = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  
  .login-screen {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #ffffff;
    position: relative;
    overflow: hidden;
    padding: 20px;
    font-family: 'Inter', sans-serif;
  }

  canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
  }

  .login-card {
    position: relative;
    width: 100%;
    max-width: 400px;
    padding: 40px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 24px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
    backdrop-filter: blur(10px);
    z-index: 10;
    border: 1px solid rgba(0,0,0,0.05);
  }

  .login-card.shake {
    animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
  }

  .login-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .login-title {
    font-size: 28px;
    font-weight: 700;
    color: #111827;
    margin: 0 0 8px;
    letter-spacing: -0.025em;
  }

  .login-subtitle {
    font-size: 14px;
    color: #6b7280;
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .input-label {
    font-size: 14px;
    font-weight: 500;
    color: #374151;
  }

  .input-field {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    font-size: 15px;
    color: #111827;
    background: #fff;
    transition: all 0.2s ease;
    outline: none;
  }

  .input-field:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
  }

  .input-field::placeholder {
    color: #9ca3af;
  }

  .remember-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: -4px;
  }

  .checkbox-input {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 1px solid #d1d5db;
    accent-color: #3b82f6;
    cursor: pointer;
  }

  .checkbox-label {
    font-size: 14px;
    color: #4b5563;
    cursor: pointer;
    user-select: none;
  }

  .submit-btn {
    width: 100%;
    padding: 14px;
    border: none;
    border-radius: 12px;
    background: #111827;
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-top: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .submit-btn:hover:not(:disabled) {
    background: #1f2937;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .submit-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .submit-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .submit-btn.success {
    background: #10b981;
    pointer-events: none;
  }

  .status-message {
    margin-top: 16px;
    padding: 12px;
    border-radius: 10px;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    animation: slideUp 0.3s ease-out;
  }

  .status-message.error {
    background: #fef2f2;
    color: #b91c1c;
    border: 1px solid #fecaca;
  }

  .status-message.success {
    background: #ecfdf5;
    color: #047857;
    border: 1px solid #a7f3d0;
  }

  .caps-warning {
    font-size: 12px;
    color: #ea580c;
    margin-top: 6px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  @keyframes shake {
    10%, 90% { transform: translate3d(-1px, 0, 0); }
    20%, 80% { transform: translate3d(2px, 0, 0); }
    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
    40%, 60% { transform: translate3d(4px, 0, 0); }
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [status, setStatus] = useState<{ tone: StatusTone; message: string }>({
    tone: 'idle',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Particle Effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    // Mouse state
    const mouse = { x: -1000, y: -1000 };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    // Particle class
    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      baseX: number;
      baseY: number;

      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.size = Math.random() * 2 + 1;
        this.baseX = this.x;
        this.baseY = this.y;
      }

      update() {
        // Move naturally
        this.x += this.vx;
        this.y += this.vy;

        // Bounce off edges
        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;

        // Mouse interaction
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 150;

        if (distance < maxDistance) {
          const forceDirectionX = dx / distance;
          const forceDirectionY = dy / distance;
          const force = (maxDistance - distance) / maxDistance;
          const directionX = forceDirectionX * force * 2;
          const directionY = forceDirectionY * force * 2;

          this.x += directionX;
          this.y += directionY;
        }
      }

      draw() {
        if (!ctx) return;
        ctx.fillStyle = '#3b82f6'; // Blue color
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const particles: Particle[] = [];
    const particleCount = Math.min(100, (width * height) / 15000); // Responsive count

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach(particle => {
        particle.update();
        particle.draw();

        // Draw lines to mouse
        const dx = mouse.x - particle.x;
        const dy = mouse.y - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 150) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(59, 130, 246, ${1 - distance / 150})`;
          ctx.lineWidth = 0.5;
          ctx.moveTo(particle.x, particle.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      });

      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('rememberedLogin');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed?.username) setUsername(parsed.username);
      if (parsed?.password) setPassword(parsed.password);
      setRememberMe(true);
    } catch {
      localStorage.removeItem('rememberedLogin');
    }
  }, []);

  useEffect(() => {
    if (rememberMe) {
      localStorage.setItem(
        'rememberedLogin',
        JSON.stringify({ username, password }),
      );
    } else {
      localStorage.removeItem('rememberedLogin');
    }
  }, [rememberMe, username, password]);

  const handleCapsLockCheck = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const caps = event.getModifierState && event.getModifierState('CapsLock');
    setCapsLockOn(Boolean(caps));
    if (event.key === 'Enter') {
      void handleLogin();
    }
  };

  const handleLogin = async () => {
    if (!username || !password) {
      setStatus({ tone: 'error', message: 'Please enter both username and password.' });
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    setLoading(true);
    setShake(false);
    setStatus({ tone: 'idle', message: '' });

    try {
      const res = await login(username, password);
      if (!res.ok) {
        throw new Error(res.error || 'Login failed');
      }

      // Success state
      setLoginSuccess(true);
      setStatus({ tone: 'success', message: 'Login successful! Redirecting...' });

      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem(
        'sessionUser',
        JSON.stringify({ ...res.user, loginDate: today }),
      );
      localStorage.removeItem('checkinPromptSeenDate');

      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete('login');
        url.searchParams.delete('api');
        window.location.replace(url.toString());
      }, 800);
    } catch (e: any) {
      const message =
        (e?.data && (e.data.error || e.data.message)) ||
        e?.message ||
        'Login failed. Please check your credentials.';
      setStatus({ tone: 'error', message });
      setShake(true);
      setTimeout(() => setShake(false), 520);
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <style>{loginCss}</style>
      <canvas ref={canvasRef} />

      <div className={`login-card${shake ? ' shake' : ''}`}>
        <div className="login-header">
          <h1 className="login-title">Welcome Back</h1>
          <p className="login-subtitle">Please sign in to your account</p>
        </div>

        <div className="login-form">
          <div className="input-group">
            <label className="input-label">Username</label>
            <input
              className="input-field"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleCapsLockCheck}
              onKeyUp={handleCapsLockCheck}
              autoFocus
              disabled={loading || loginSuccess}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <input
              className="input-field"
              placeholder="Enter your password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleCapsLockCheck}
              onKeyUp={handleCapsLockCheck}
              disabled={loading || loginSuccess}
            />
            {capsLockOn && (
              <div className="caps-warning">
                {icons.warning} Caps Lock is on
              </div>
            )}
          </div>

          <label className="remember-row">
            <input
              type="checkbox"
              className="checkbox-input"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={loading || loginSuccess}
            />
            <span className="checkbox-label">Remember me</span>
          </label>

          <button
            className={`submit-btn ${loginSuccess ? 'success' : ''}`}
            onClick={() => void handleLogin()}
            disabled={loading || loginSuccess}
          >
            {loginSuccess ? (
              <>
                {icons.success}
                <span>Success</span>
              </>
            ) : loading ? (
              'Signing in...'
            ) : (
              'Sign in'
            )}
          </button>
        </div>

        {status.message && status.tone === 'error' && (
          <div className="status-message error">
            {icons.warning}
            <span>{status.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
