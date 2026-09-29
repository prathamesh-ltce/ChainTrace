import { useApp } from '../context/AppContext'

const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="20" height="20" style={{ flexShrink: 0 }}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </svg>
    )
  },
  {
    id: 'trace',
    label: 'Start New Case',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="20" height="20" style={{ flexShrink: 0 }}>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    )
  },
  {
    id: 'reports',
    label: 'Investigations Data',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="20" height="20" style={{ flexShrink: 0 }}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    )
  },
  {
    id: 'vasp',
    label: 'VASP Database',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="20" height="20" style={{ flexShrink: 0 }}>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    )
  },
  {
    id: 'intel',
    label: 'Risk Attributions',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="20" height="20" style={{ flexShrink: 0 }}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    )
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="20" height="20" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    )
  },
]

export default function Sidebar() {
  const { currentView, setCurrentView, sidebarCollapsed } = useApp()

  return (
    <aside
      className={"sidebar" + (sidebarCollapsed ? " collapsed" : "")}
      style={{
        backgroundColor: '#030441',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: sidebarCollapsed ? '72px' : '260px',
        transition: 'width 0.2s ease',
        boxSizing: 'border-box',
        zIndex: 100,
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0
      }}
    >
      {/* Top Section: Logo & Nav items */}
      <div style={{ padding: sidebarCollapsed ? '20px 10px 0' : '20px 16px 0' }}>
        {/* Logo & Platform Name */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
          gap: '12px',
          paddingBottom: '16px',
          borderBottom: '1.5px solid rgba(255, 255, 255, 0.2)',
          marginBottom: '20px'
        }}>
          <img
            src="/Logo(white).png"
            alt="ChainTrace Logo"
            style={{ width: '40px', height: '40px', objectFit: 'contain', flexShrink: 0 }}
            onError={(e) => { e.currentTarget.src = '/vasp-logo-white.png'; }}
          />
          {!sidebarCollapsed && (
            <div style={{
              fontSize: '20px',
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.01em',
              lineHeight: 1.2
            }}>
              ChainTrace
            </div>
          )}
        </div>

        {/* Navigation Items with Clean Icons */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {NAV_ITEMS.map(item => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                title={item.label}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  gap: sidebarCollapsed ? '0' : '14px',
                  padding: sidebarCollapsed ? '12px 0' : '12px 16px',
                  borderRadius: '10px',
                  backgroundColor: isActive ? '#38bdf8' : 'transparent',
                  color: isActive ? '#030441' : '#ffffff',
                  fontWeight: isActive ? 800 : 600,
                  fontSize: '15px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden'
                }}
                onMouseOver={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                }}
                onMouseOut={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {/* SVG Icon */}
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isActive ? '#030441' : '#ffffff'
                }}>
                  {item.icon}
                </span>

                {/* Text Label - Hidden when sidebar is collapsed */}
                {!sidebarCollapsed && (
                  <span style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Official Horizontal MHA Logo */}
      <div style={{ padding: sidebarCollapsed ? '0 8px 24px' : '0 16px 24px' }}>
        {!sidebarCollapsed ? (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img
              src="/Ministry-of-Home-Affairs2.png"
              alt="Ministry of Home Affairs"
              style={{
                width: '100%',
                maxWidth: '215px',
                height: 'auto',
                objectFit: 'contain',
                display: 'block'
              }}
              onError={(e) => { e.currentTarget.src = '/mha-logo2.png'; }}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <img
              src="/favicon.png"
              alt="Emblem"
              style={{ width: '28px', height: '28px', objectFit: 'contain', opacity: 0.8 }}
            />
          </div>
        )}
      </div>
    </aside>
  )
}
