import { useAuth } from '../context/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function WaitingApproval() {
  const { user, signOut } = useAuth()
  const [pgName, setPgName] = useState('Loading...')
  const [requestedTime, setRequestedTime] = useState(null)
  const [isCanceling, setIsCanceling] = useState(false)

  // Clean Slate payload used for both auto-eject and manual cancel
  const cleanSlate = {
    pg_id: null,
    role: null,
    is_approved: false,
    is_deleted: false,
  }

  // Shared cleanup function: delete join request, wipe profile, reload
  const performCleanupAndReload = async () => {
    try {
      // delete any join request for this user
      await supabase.from('join_requests').delete().eq('resident_id', user.id)

      // wipe profile to clean slate
      await supabase.from('profiles').update(cleanSlate).eq('id', user.id)

      // reload so routing treats the user as new
      window.location.reload()
    } catch (err) {
      console.error('Cleanup failed:', err)
      throw err
    }
  }

  // Auto-eject when an owner soft-deletes the user
  useEffect(() => {
    const fetchPGInfo = async () => {
      if (!user) return

      try {
        // 1. Get user profile
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('pg_id, is_deleted')
          .eq('id', user.id)
          .single()

        if (profileErr) throw profileErr

        // If soft-deleted by owner, perform auto-eject immediately
        if (profile?.is_deleted) {
          try {
            await performCleanupAndReload()
          } catch (err) {
            console.error('Auto-eject failed:', err)
          }
          return
        }

        // Normal fetching if not deleted
        if (profile?.pg_id) {
          const { data: pg } = await supabase
            .from('pgs')
            .select('name')
            .eq('id', profile.pg_id)
            .single()

          if (pg) setPgName(pg.name)

          const { data: joinReq } = await supabase
            .from('join_requests')
            .select('created_at')
            .eq('resident_id', user.id)
            .eq('pg_id', profile.pg_id)
            .single()

          if (joinReq) setRequestedTime(new Date(joinReq.created_at).toLocaleDateString())
        }
      } catch (err) {
        console.error('Error fetching PG info:', err)
      }
    }

    fetchPGInfo()
  }, [user])

  // Manual cancel handler
  const handleRemoveApproval = async () => {
    const ok = window.confirm('Are you sure you want to cancel your request?')
    if (!ok) return

    try {
      setIsCanceling(true)
      await performCleanupAndReload()
    } catch (err) {
      alert('Failed to cancel request.')
      setIsCanceling(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f0ea] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Sign Out Button */}
        <div className="flex justify-end mb-6">
          <button
            onClick={signOut}
            className="border-4 border-black p-3 bg-red-300 font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-red-400 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all text-sm"
          >
            SIGN OUT
          </button>
        </div>

        {/* Main Content */}
        <div className="border-4 border-black p-8 bg-yellow-200 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center mb-8 relative">
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

        {/* Action Area */}
        <div className="text-center">
          <p className="text-sm font-bold mb-4">This page will refresh automatically</p>

          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="border-4 border-black p-4 bg-cyan-300 font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-cyan-400 w-full active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all"
            >
              🔄 REFRESH STATUS
            </button>

            <button
              onClick={handleRemoveApproval}
              disabled={isCanceling}
              className={`border-4 border-black p-4 bg-orange-300 font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-orange-400 w-full active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all ${isCanceling ? 'opacity-50' : ''}`}
            >
              {isCanceling ? 'CANCELING...' : '❌ CANCEL JOIN REQUEST'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}