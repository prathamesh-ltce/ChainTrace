import { AppProvider, useApp } from './context/AppContext'
import LoginPage from './pages/LoginPage'
import AppShell from './components/AppShell'

function AppRouter() {
 const { isLoggedIn } = useApp()
 return isLoggedIn ? <AppShell /> : <LoginPage />
}

export default function App() {
 return (
  <AppProvider>
   <AppRouter />
  </AppProvider>
 )
}
