import './App.css'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Login } from './screens/Login'
import { Onboarding } from './screens/Onboarding'
import { ResidentDashboard } from './screens/ResidentDashboard'

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f0ea] flex items-center justify-center">
        <div className="border-4 border-black p-8 bg-yellow-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <p className="font-black text-2xl tracking-tight">LOADING...</p>
        </div>
      </div>
    )
  }

  // Not logged in - show login screen
  if (!user) {
    return <Login />
  }

  // Logged in - show dashboard (placeholder for now)
  // In future, check if user has PG assigned
  return <ResidentDashboard />
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
