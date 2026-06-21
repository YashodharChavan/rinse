import './App.css'
import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { supabase } from './lib/supabaseClient'
import { Login } from './screens/Login'
import { Onboarding } from './screens/Onboarding'
import { ResidentDashboard } from './screens/ResidentDashboard'
import { OwnerDashboard } from './screens/OwnerDashboard'
import { WaitingApproval } from './screens/WaitingApproval'
import { App as CapacitorApp } from '@capacitor/app'

const OAUTH_REDIRECT_SCHEME = 'com.rinse.app://'
const OAUTH_REDIRECT_BASE = 'http://localhost'

function maskAuthValue(value) {
  if (!value) return value
  if (value.length <= 12) return `${value.slice(0, 3)}...`
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function getDeepLinkParams(rawUrl) {
  const normalizedUrl = rawUrl.replace(OAUTH_REDIRECT_SCHEME, OAUTH_REDIRECT_BASE + '/')
  const parsedUrl = new URL(normalizedUrl)
  const params = new URLSearchParams(parsedUrl.search)
  const hash = parsedUrl.hash.startsWith('#') ? parsedUrl.hash.slice(1) : parsedUrl.hash
  const hashParams = new URLSearchParams(hash.startsWith('/') ? hash.slice(1) : hash)

  hashParams.forEach((value, key) => {
    if (!params.has(key)) {
      params.set(key, value)
    }
  })

  return { normalizedUrl, params }
}

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

      setProfileLoading(true)

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

  useEffect(() => {
    const handleOAuthDeepLink = async (rawUrl, source) => {
      if (!rawUrl?.startsWith(OAUTH_REDIRECT_SCHEME)) {
        console.log('[OAuth Deep Link] Ignored non-Rinse URL:', rawUrl)
        return
      }

      console.log(`[OAuth Deep Link] ${source} raw URL:`, rawUrl)

      try {
        const { normalizedUrl, params } = getDeepLinkParams(rawUrl)
        const code = params.get('code')
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        const error = params.get('error')
        const errorDescription = params.get('error_description')

        console.log(`[OAuth Deep Link] ${source} normalized URL:`, normalizedUrl)
        console.log(`[OAuth Deep Link] ${source} params:`, {
          keys: Array.from(params.keys()),
          code: maskAuthValue(code),
          access_token: maskAuthValue(accessToken),
          refresh_token: maskAuthValue(refreshToken),
          error,
          error_description: errorDescription,
        })

        // Uncomment temporarily when testing a compiled Android build and Logcat is awkward.
        // alert(`[OAuth Deep Link] ${source}\n${rawUrl}\nkeys: ${Array.from(params.keys()).join(', ')}`)

        if (error) {
          throw new Error(errorDescription || error)
        }

        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError

          console.log('[OAuth Deep Link] Exchanged code for session:', {
            hasSession: Boolean(data.session),
            userId: data.session?.user?.id,
          })
          return
        }

        if (accessToken && refreshToken) {
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (sessionError) throw sessionError

          console.log('[OAuth Deep Link] Stored token session:', {
            hasSession: Boolean(data.session),
            userId: data.session?.user?.id,
          })
          return
        }

        console.warn('[OAuth Deep Link] No code or token pair found in redirect URL.')
      } catch (err) {
        console.error('[OAuth Deep Link] Failed to process redirect:', err)
        // alert(`[OAuth Deep Link] Failed: ${err.message}`)
      } finally {
        const { data: { session }, error } = await supabase.auth.getSession()
        console.log('[OAuth Deep Link] Session after processing:', {
          hasSession: Boolean(session),
          userId: session?.user?.id,
          error: error?.message,
        })
      }
    }

    let listenerHandle
    let isMounted = true

    const setupDeepLinks = async () => {
      const launchUrl = await CapacitorApp.getLaunchUrl()
      if (launchUrl?.url) {
        await handleOAuthDeepLink(launchUrl.url, 'getLaunchUrl')
      }

      listenerHandle = await CapacitorApp.addListener('appUrlOpen', (event) => {
        handleOAuthDeepLink(event.url, 'appUrlOpen')
      })
    }

    setupDeepLinks().catch((err) => {
      if (isMounted) {
        console.error('[OAuth Deep Link] Listener setup failed:', err)
      }
    })

    return () => {
      isMounted = false
      listenerHandle?.remove()
    }
  }, [])

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
