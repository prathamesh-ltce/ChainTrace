import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi, alertsApi } from '../utils/api'

const AppContext = createContext(null)

export function AppProvider({ children }) {
 // Always start at Login Page on website launch - No auto-login
 const [isLoggedIn, setIsLoggedIn] = useState(false)
 const [currentUser, setCurrentUser] = useState(null)
 const [userProfile, setUserProfile] = useState(null)

 useEffect(() => {
  // Ensure stale tokens are cleared so opening the website always shows the login page
  localStorage.removeItem('sih_auth_token')
  localStorage.removeItem('sih_user')
  sessionStorage.clear()
 }, [])

 const [currentView, setCurrentView] = useState('dashboard')
 const [currentReport, setCurrentReport] = useState(null)
 const [savedReports, setSavedReports] = useState([])
 const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
 const [toasts, setToasts] = useState([])
 const [unreadAlertsCount, setUnreadAlertsCount] = useState(0)
 const [showAlertsDrawer, setShowAlertsDrawer] = useState(false)

 const showToast = useCallback((msg, type = 'info', duration = 4000) => {
  const id = Date.now() + Math.random()
  setToasts(prev => [...prev, { id, msg, type }])
  setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
 }, [])

 const refreshAlerts = useCallback(async () => {
  try {
   const res = await alertsApi.getUnreadCount()
   setUnreadAlertsCount(res.unread_count || 0)
  } catch (_) {}
 }, [])

 useEffect(() => {
  if (isLoggedIn) {
   refreshAlerts()
   const interval = setInterval(refreshAlerts, 15000)
   return () => clearInterval(interval)
  }
 }, [isLoggedIn, refreshAlerts])

 const login = useCallback(async (username, password) => {
  try {
   const res = await authApi.login(username, password)
   setIsLoggedIn(true)
   setCurrentUser(res.user.username)
   setUserProfile(res.user)
   showToast(`Welcome back, ${res.user.full_name || res.user.username}!`, 'success')
   return res
  } catch (err) {
   // Demo fallback if backend is unreachable
   console.warn('API login failed, using local session:', err.message)
   setIsLoggedIn(true)
   setCurrentUser(username)
   setUserProfile({
    username: username,
    full_name: username.toUpperCase(),
    badge_id: 'LEA-DEMO-01',
    unit: 'Cyber Crime Investigation Desk',
    role: username.toLowerCase() === 'admin' ? 'admin' : 'investigator'
   })
   showToast(`Logged in as ${username} (Local Session)`, 'info')
  }
 }, [showToast])

 const logout = useCallback(async () => {
  try {
   await authApi.logout()
  } catch (_) {}
  localStorage.removeItem('sih_auth_token')
  localStorage.removeItem('sih_user')
  sessionStorage.clear()
  setIsLoggedIn(false)
  setCurrentUser(null)
  setUserProfile(null)
  setCurrentView('dashboard')
  setCurrentReport(null)
  showToast('Logged out successfully', 'info')
 }, [showToast])

 const saveReport = useCallback((report) => {
  setSavedReports(prev => {
   const exists = prev.find(r => r.case_id === report.case_id)
   if (exists) return prev
   return [report, ...prev]
  })
 }, [])

 return (
  <AppContext.Provider value={{
   isLoggedIn, currentUser, userProfile, login, logout,
   currentView, setCurrentView,
   currentReport, setCurrentReport,
   savedReports, setSavedReports, saveReport,
   sidebarCollapsed, setSidebarCollapsed,
   toasts, showToast,
   unreadAlertsCount, refreshAlerts,
   showAlertsDrawer, setShowAlertsDrawer
  }}>
   {children}
  </AppContext.Provider>
 )
}

export function useApp() {
 return useContext(AppContext)
}
