import { useAuth } from '../context/AuthContext'
import { useState } from 'react'

export function Login() {
  const { signInWithGoogle, error } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  const handleSignIn = async () => {
    try {
      setIsLoading(true)
      await signInWithGoogle()
    } catch (err) {
      console.error('Sign in failed:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f0ea] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Hero Section */}
        <div className="text-center mb-12 border-4 border-black p-8 bg-yellow-200 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h1 className="text-5xl font-black tracking-tight mb-2">RINSE</h1>
          <p className="text-xl font-bold tracking-tight">Manage your laundry</p>
        </div>

        {/* Value Proposition */}
        <div className="space-y-4 mb-8">
          <div className="border-4 border-black p-6 bg-green-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-lg font-black">✓ Know which machines are free</p>
          </div>
          <div className="border-4 border-black p-6 bg-blue-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-lg font-black">✓ Book your slot instantly</p>
          </div>
          <div className="border-4 border-black p-6 bg-pink-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-lg font-black">✓ Avoid conflicts</p>
          </div>
        </div>

        {/* Auth Section */}
        <div className="space-y-4">
          {error && (
            <div className="border-4 border-black p-4 bg-red-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <p className="font-bold text-red-900">{error}</p>
            </div>
          )}
          
          <button
            onClick={handleSignIn}
            disabled={isLoading}
            className="w-full border-4 border-black p-6 bg-yellow-300 font-black text-xl tracking-tight shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-400 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing in...' : '→ CONTINUE WITH GOOGLE'}
          </button>

          <p className="text-center text-sm font-bold">
            By continuing, you agree to our Terms of Service
          </p>
        </div>
      </div>
    </div>
  )
}
