import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function LoginPage() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useApp();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter your username or email');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      await login(username, password);
    } catch (err) {
      setError(err?.message || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemo = (user, pass) => {
    setUsername(user);
    setPassword(pass);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#030441',
      color: '#ffffff',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      {/* Top Header - Matching Login Page.png */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '24px 64px 16px',
        backgroundColor: '#030441'
      }}>
        {/* Left: VASP Emblem & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img 
            src="/Logo(white).png" 
            alt="VASP Engine Logo" 
            style={{ width: '56px', height: '56px', objectFit: 'contain' }}
            onError={(e) => { e.currentTarget.src = '/vasp-logo-white.png'; }}
          />
          <div>
            <div style={{
              fontSize: '22px',
              fontWeight: 800,
              letterSpacing: '-0.01em',
              color: '#ffffff',
              lineHeight: 1.2
            }}>
              ChainTrace
            </div>
            <div style={{
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.75)',
              marginTop: '2px'
            }}>
              Blockchain Attribution & Investigation Platform
            </div>
          </div>
        </div>

        {/* Right: Ministry of Home Affairs Logo */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img 
            src="/Ministry-of-Home-Affairs2.png" 
            alt="Ministry of Home Affairs Logo" 
            style={{ 
              height: '56px', 
              width: 'auto', 
              objectFit: 'contain'
            }}
            onError={(e) => {
              e.currentTarget.src = '/Ministry-of-Home-Affairs.png';
            }}
          />
        </div>
      </header>

      {/* Main Content Body */}
      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px 64px 40px'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '1160px',
          display: 'grid',
          gridTemplateColumns: '1.1fr 0.9fr',
          gap: '64px',
          alignItems: 'center'
        }}>
          {/* Left Column: Exactly matching Login Page.png text */}
          <div style={{ paddingRight: '20px' }}>
            <h1 style={{
              fontSize: '48px',
              fontWeight: 800,
              lineHeight: 1.15,
              marginBottom: '32px',
              letterSpacing: '-0.02em'
            }}>
              <span style={{ color: '#4b9ed1', display: 'block', marginBottom: '4px' }}>
                Secure Access
              </span>
              <span style={{ color: '#ffffff' }}>
                For Trusted Investigations
              </span>
            </h1>

            <p style={{
              fontSize: '18px',
              lineHeight: 1.6,
              color: '#ffffff',
              maxWidth: '460px',
              fontWeight: 400
            }}>
              Integrate with Sahyog. Trace blockchain flows. Identify VASPs. Support law enforcement.
            </p>
          </div>

          {/* Right Column: Welcome + Clean White Card */}
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '440px', width: '100%', justifySelf: 'end' }}>
            <h2 style={{
              fontSize: '36px',
              fontWeight: 700,
              color: '#ffffff',
              marginBottom: '16px',
              letterSpacing: '-0.02em'
            }}>
              Welcome
            </h2>

            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '28px',
              padding: '40px 36px 32px',
              color: '#0f172a',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.35)'
            }}>
              <h3 style={{
                fontSize: '26px',
                fontWeight: 700,
                color: '#030441',
                marginBottom: '6px'
              }}>
                Sign in
              </h3>

              <p style={{
                fontSize: '14px',
                color: '#64748b',
                marginBottom: '24px'
              }}>
                Access your Investigation dashboard
              </p>

              {error && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  fontSize: '13px',
                  marginBottom: '18px'
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#030441',
                    marginBottom: '8px'
                  }}>
                    Username/Email
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username or email"
                    required
                    style={{
                      width: '100%',
                      padding: '13px 16px',
                      borderRadius: '8px',
                      border: '1.5px solid #030441',
                      fontSize: '14px',
                      color: '#0f172a',
                      backgroundColor: '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#030441',
                    marginBottom: '8px'
                  }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    style={{
                      width: '100%',
                      padding: '13px 16px',
                      borderRadius: '8px',
                      border: '1.5px solid #030441',
                      fontSize: '14px',
                      color: '#0f172a',
                      backgroundColor: '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* 2 Demo buttons as requested */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '-4px'
                }}>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Quick fill:</span>
                  <button
                    type="button"
                    onClick={() => fillDemo('admin', 'password')}
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '3px 9px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#030441',
                      cursor: 'pointer'
                    }}
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemo('officer1', 'password')}
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '3px 9px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#030441',
                      cursor: 'pointer'
                    }}
                  >
                    Officer
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#030441',
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    marginTop: '6px',
                    transition: 'background-color 0.18s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0a0d63'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#030441'}
                >
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </button>

                <div style={{ textAlign: 'center', marginTop: '-4px' }}>
                  <button
                    type="button"
                    onClick={() => alert('Please contact your department nodal officer or system administrator to reset your credentials.')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#4b9ed1',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Forgot password?
                  </button>
                </div>

                <div style={{
                  fontSize: '11px',
                  color: '#64748b',
                  textAlign: 'center',
                  marginTop: '8px'
                }}>
                  Authorized users only. All actions are logged and monitored.
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Official Bottom White Bar - Matching Login Page.png */}
      <footer style={{
        backgroundColor: '#ffffff',
        color: '#030441',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        fontSize: '14px',
        fontWeight: 600
      }}>
        <img 
          src="/Ministry-of-Home-Affairs2-dark.png" 
          alt="Ministry of Home Affairs"
          style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
          onError={(e) => { e.currentTarget.src = '/mha-logo-dark.png'; }}
        />
        <span>Website content managed by Ministry of Home Affairs, Govt. of India.</span>
      </footer>
    </div>
  );
}
