import './App.css'
import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { supabase } from './lib/supabaseClient'
import { Login } from './screens/Login'
import { Onboarding } from './screens/Onboarding'
import { ResidentDashboard } from './screens/ResidentDashboard'
import { OwnerDashboard } from './screens/OwnerDashboard'
import { WaitingApproval } from './screens/WaitingApproval'
function AppContent() {
  const { user, loading } = useAuth()
  const [profileData, setProfileData] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)

  // Fetch user profile data when user changes
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setProfileData(null)
        setProfileLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (error) {
          // Profile doesn't exist yet - user is newly signed in
          setProfileData(null)
        } else {
          setProfileData(data)
        }
      } catch (err) {
        console.error('Error fetching profile:', err)
        setProfileData(null)
      } finally {
        setProfileLoading(false)
      }
    }

    fetchProfile()
  }, [user])

  // Show loading state
  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-[#f4f0ea] flex items-center justify-center">
        <div className="border-4 border-black p-8 bg-yellow-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <p className="font-black text-2xl tracking-tight">LOADING...</p>
        </div>
      </div>
    )
  }

  // STATE 1: Not logged in - show login screen
  if (!user) {
    return <Login />
  }

  // STATE 2: Logged in but NO profile yet - show onboarding
  if (!profileData) {
    return <Onboarding />
  }

  // STATE 3: Logged in with profile
  // Check role and approval status
  if (profileData.role === 'owner') {
    return <OwnerDashboard />
  }

  if (profileData.role === 'resident') {
    if (profileData.is_approved) {
      return <ResidentDashboard />
    } else {
      return <WaitingApproval />
    }
  }

  if (!profileData?.role) {
    return <Onboarding /> // Or whatever your "Enter PG Code" component is named
  }

  // Fallback
  return <Login />
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
