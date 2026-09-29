import { useApp } from '../context/AppContext'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'trace', label: 'Start New Case' },
  { id: 'reports', label: 'Investigations Data' },
  { id: 'vasp', label: 'VASP Database' },
  { id: 'intel', label: 'Risk Attributions' },
  { id: 'settings', label: 'Settings' },
]

export default function Sidebar() {
  const { currentView, setCurrentView, sidebarCollapsed, setSidebarCollapsed } = useApp()

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
      <div style={{ padding: '20px 16px 0' }}>
        {/* Logo & Platform Name */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          paddingBottom: '16px',
          borderBottom: '1.5px solid rgba(255, 255, 255, 0.2)',
          marginBottom: '20px'
        }}>
          <img
            src="/Logo(white).png"
            alt="ChainTrace Logo"
            style={{ width: '42px', height: '42px', objectFit: 'contain', flexShrink: 0 }}
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

        {/* Navigation Items (Exact 1:1 match to Investigations.png & Dashboard(Home).png) */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {NAV_ITEMS.map(item => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 18px',
                  borderRadius: '10px',
                  backgroundColor: isActive ? '#38bdf8' : 'transparent',
                  color: isActive ? '#030441' : '#ffffff',
                  fontWeight: isActive ? 800 : 600,
                  fontSize: '15px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                onMouseOver={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                }}
                onMouseOut={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {sidebarCollapsed ? item.label.charAt(0) : item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Official Horizontal MHA Logo (Exact match to Investigations.png) */}
      <div style={{ padding: '0 16px 24px' }}>
        {!sidebarCollapsed && (
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
        )}
      </div>
    </aside>
  )
}
