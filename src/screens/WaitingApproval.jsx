import { useAuth } from '../context/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function WaitingApproval() {
  const { user, signOut } = useAuth()
  const [pgName, setPgName] = useState('Loading...')
  const [requestedTime, setRequestedTime] = useState(null)

  // Fetch PG info
  useEffect(() => {
    const fetchPGInfo = async () => {
      if (!user) return

      try {
        // Get user profile with PG info
        const { data: profile } = await supabase
          .from('profiles')
          .select('pg_id')
          .eq('id', user.id)
          .single()

        if (profile?.pg_id) {
          // Get PG name
          const { data: pg } = await supabase
            .from('pgs')
            .select('name')
            .eq('id', profile.pg_id)
            .single()

          if (pg) {
            setPgName(pg.name)
          }

          // Get join request time
          const { data: joinReq } = await supabase
            .from('join_requests')
            .select('created_at')
            .eq('resident_id', user.id)
            .eq('pg_id', profile.pg_id)
            .single()

          if (joinReq) {
            setRequestedTime(new Date(joinReq.created_at).toLocaleDateString())
          }
        }
      } catch (err) {
        console.error('Error fetching PG info:', err)
      }
    }

    fetchPGInfo()
  }, [user])

  return (
    <div className="min-h-screen bg-[#f4f0ea] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Sign Out Button */}
        <div className="flex justify-end mb-6">
          <button
            onClick={signOut}
            className="border-4 border-black p-3 bg-red-300 font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-red-400"
          >
            SIGN OUT
          </button>
        </div>

        {/* Main Content */}
        <div className="border-4 border-black p-8 bg-yellow-200 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center mb-8">
          <div className="text-6xl font-black mb-4">⏳</div>
          <h1 className="text-3xl font-black tracking-tight mb-4">WAITING FOR APPROVAL</h1>
          <p className="text-lg font-bold mb-6">
            Your request to join <span className="font-black">{pgName}</span> has been sent to the property owner.
          </p>

          {requestedTime && (
            <div className="border-2 border-black p-4 bg-white inline-block font-bold">
              Requested on: {requestedTime}
            </div>
          )}
        </div>

        {/* Info Card */}
        <div className="border-4 border-black p-6 bg-blue-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-8">
          <h2 className="text-xl font-black mb-4 tracking-tight">WHAT HAPPENS NEXT?</h2>
          <ul className="space-y-3 font-bold text-sm">
            <li>✓ Your request has been created</li>
            <li>⏳ Waiting for PG owner approval</li>
            <li>📧 You'll get notified once approved</li>
            <li>🎉 Then you can book your first slot!</li>
          </ul>
        </div>

        {/* Contact Info */}
        <div className="border-4 border-black p-6 bg-green-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-8">
          <h2 className="text-xl font-black mb-3 tracking-tight">💡 TIP</h2>
          <p className="font-bold text-sm">
            Contact the property owner directly if you need urgent access. Share your email: <span className="font-black">{user?.email}</span>
          </p>
        </div>

        {/* Refresh Info */}
        <div className="text-center">
          <p className="text-sm font-bold mb-4">This page will refresh automatically</p>
          <button
            onClick={() => window.location.reload()}
            className="border-4 border-black p-4 bg-cyan-300 font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-cyan-400 w-full"
          >
            🔄 REFRESH NOW
          </button>
        </div>
      </div>
    </div>
  )
}
