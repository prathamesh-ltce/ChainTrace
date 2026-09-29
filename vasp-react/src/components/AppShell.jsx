import { useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { analytics } from '../utils/analytics'
import Sidebar from './Sidebar'
import Header from './Header'
import ToastContainer from './ToastContainer'
import AlertsDrawer from './AlertsDrawer'
import CookieBanner from './CookieBanner'
import DashboardPage from '../pages/DashboardPage'
import TracePage from '../pages/TracePage'
import BatchPage from '../pages/BatchPage'
import ReportsPage from '../pages/ReportsPage'
import GraphPage from '../pages/GraphPage'
import VaspRegistryPage from '../pages/VaspRegistryPage'
import IntelPage from '../pages/IntelPage'
import SettingsPage from '../pages/SettingsPage'
import PrivacyPolicyPage from '../pages/PrivacyPolicyPage'
import TermsPage from '../pages/TermsPage'
import NotFoundPage from '../pages/NotFoundPage'

const VIEWS = {
 dashboard: <DashboardPage />,
 trace:   <TracePage />,
 batch:   <BatchPage />,
 reports:  <ReportsPage />,
 graph:   <GraphPage />,
 vasp:   <VaspRegistryPage />,
 intel:   <IntelPage />,
 settings: <SettingsPage />,
 privacy:  <PrivacyPolicyPage />,
 terms:   <TermsPage />,
 notfound: <NotFoundPage />,
}

export default function AppShell() {
 const { currentView, sidebarCollapsed, setCurrentView } = useApp()

 useEffect(() => {
  analytics.trackPageView(currentView)
 }, [currentView])

 const ActiveComponent = VIEWS[currentView] || <NotFoundPage />

 return (
  <div className="app-shell">
   <div className="app-bg" />
   <Sidebar />
   <div className={"main-area" + (sidebarCollapsed ? " collapsed" : "")}>
    <Header />
    <main className="page-content" style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 65px)' }}>
     <div style={{ flex: 1 }}>
      {ActiveComponent}
     </div>
     
     {/* Production Footer with Verified Links */}
     <footer style={{
      marginTop: 40,
      paddingTop: 16,
      paddingBottom: 20,
      borderTop: '1px solid var(--border-subtle)',
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      fontSize: '0.75rem',
      color: 'var(--text-muted)'
     }}>
      <div>
       <span>ChainTrace Forensics Platform © 2026. Certified for LEA Case Submissions.</span>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
       <button
        onClick={() => setCurrentView('privacy')}
        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--indigo-light)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
       >
        Privacy Policy
       </button>
       <span>•</span>
       <button
        onClick={() => setCurrentView('terms')}
        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--indigo-light)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
       >
        Terms of Protocol
       </button>
       <span>•</span>
       <button
        onClick={() => setCurrentView('settings')}
        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--indigo-light)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
       >
        Zero-Key Security Architecture
       </button>
      </div>
     </footer>
    </main>
   </div>
   <AlertsDrawer />
   <CookieBanner />
   <ToastContainer />
  </div>
 )
}
