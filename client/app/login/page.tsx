'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { RiCustomerService2Fill } from 'react-icons/ri';

const QUICK_ACCOUNTS = [
  {
    label: 'Support Staff 1',
    email: 'staff1@support.com',
    password: 'password123',
  },
  {
    label: 'Support Staff 2',
    email: 'staff2@support.com',
    password: 'password123',
  },
  {
    label: 'Support Staff 3',
    email: 'staff3@support.com',
    password: 'password123',
  },
  {
    label: 'Support Staff 4',
    email: 'staff4@support.com',
    password: 'password123',
  },
  {
    label: 'Support Staff 5',
    email: 'staff5@support.com',
    password: 'password123',
  },
  { label: 'Admin', email: 'admin@support.com', password: 'password123' },
] as const;

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const router = useRouter();

  const redirectByRole = () => {
    const role = localStorage.getItem('role');
    if (role === 'admin') {
      router.push('/admin/dashboard');
    } else {
      router.push('/staff/dashboard');
    }
  };

  const performLogin = async (nextEmail: string, nextPassword: string) => {
    await login(nextEmail, nextPassword);
    redirectByRole();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await performLogin(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (nextEmail: string, nextPassword: string) => {
    setError('');
    setLoading(true);
    setEmail(nextEmail);
    setPassword(nextPassword);

    try {
      await performLogin(nextEmail, nextPassword);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='login-page'>
      <div className='login-card'>
        <div className='login-header'>
          <RiCustomerService2Fill size={40} className='login-icon' />
          <h1>Staff Login</h1>
          <p>Sign in to your support dashboard</p>
        </div>

        <div className='quick-login-box'>
          <div className='quick-login-header'>
            <p className='quick-login-title'>Quick Login</p>
            <span className='quick-login-badge'>Testing only</span>
          </div>
          <div className='quick-login-grid'>
            {QUICK_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type='button'
                className='quick-login-btn'
                disabled={loading}
                onClick={() =>
                  handleQuickLogin(account.email, account.password)
                }
              >
                <span className='quick-login-btn-label'>{account.label}</span>
                <span className='quick-login-btn-arrow'>→</span>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className='login-form'>
          {error && <div className='login-error'>{error}</div>}

          <div className='form-group'>
            <label htmlFor='email'>Email</label>
            <input
              id='email'
              type='email'
              placeholder='you@company.com'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className='form-group'>
            <label htmlFor='password'>Password</label>
            <input
              id='password'
              type='password'
              placeholder='Enter your password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type='submit' className='login-submit' disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
