import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { Scanner } from '@yudiel/react-qr-scanner'
import { QRScannerView } from '../components/QRScannerView'
export function Onboarding() {
  const { user, signOut } = useAuth()
  const [choice, setChoice] = useState(null) // 'join' or 'create'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Scanner State
  const [isScanning, setIsScanning] = useState(false)

  // Join PG form state
  const [inviteCode, setInviteCode] = useState('')

  // Create PG form state
  const [pgName, setPgName] = useState('')
  const [pgAddress, setPgAddress] = useState('')
  const [pgPhone, setPgPhone] = useState('')

  // Generate invite code in format "RINSE-XXXXXX"
  const generateInviteCode = () => {
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `RINSE-${randomPart}`
  }

  const handleQRScan = (scannedText) => {
    if (scannedText.startsWith('RINSE-')) {
      setInviteCode(scannedText)
      setIsScanning(false)
    } else {
      alert('Invalid Rinse QR Code. Make sure you are scanning a valid PG Poster.')
    }
  }

  // Handle Join PG
  const handleJoinPG = async (e) => {
    if (e) e.preventDefault()
    if (!inviteCode.trim()) {
      setError('Please enter an invite code')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: pgData, error: pgError } = await supabase
        .from('pgs')
        .select('id')
        .ilike('invite_code', inviteCode.toUpperCase())
        .single()

      if (pgError || !pgData) {
        setError('Invalid invite code. Please check and try again.')
        setLoading(false)
        return
      }

      const pgId = pgData.id

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: user?.user_metadata?.full_name || user?.user_metadata?.name || 'Resident',
          role: 'resident',
          pg_id: pgId,
          is_approved: false,
        })

      if (profileError) throw profileError

      const { error: joinError } = await supabase
        .from('join_requests')
        .insert({
          pg_id: pgId,
          resident_id: user.id,
          status: 'pending',
        })

      if (joinError) throw joinError

      setSuccess(true)
      window.location.reload()
    } catch (err) {
      console.error('Error joining PG:', err)
      setError(err.message || 'Failed to join PG. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Handle Create PG
  const handleCreatePG = async (e) => {
    e.preventDefault()
    if (!pgName.trim() || !pgAddress.trim()) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error: profileError1 } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: 'PG Owner',
          phone: pgPhone,
          role: 'owner',
          is_approved: true,
        })

      if (profileError1) throw profileError1

      const newInviteCode = generateInviteCode()

      const { data: newPG, error: pgError } = await supabase
        .from('pgs')
        .insert({
          name: pgName,
          address: pgAddress,
          invite_code: newInviteCode,
          owner_id: user.id,
        })
        .select()
        .single()

      if (pgError) throw pgError

      // STEP 3: Link the new PG ID back to the owner's profile
      const { error: profileError2 } = await supabase
        .from('profiles')
        .update({
          pg_id: newPG.id,
        })
        .eq('id', user.id)

      if (profileError2) throw profileError2

      setSuccess(true)

      // NEW: Wait 1.5 seconds so they can read the success message, then force a state refresh
      setTimeout(() => {
        window.location.reload()
      }, 1500)

    } catch (err) {
      console.error('Error creating PG:', err)
      setError(err.message || 'Failed to create PG. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // --- THE FAM-STYLE SCANNER UI ---
  if (isScanning) {
    return (
      <QRScannerView
        onScan={handleQRScan}
        onClose={() => setIsScanning(false)}
        onManualEntry={() => setIsScanning(false)}
      />
    )
  }

  // Initial choice screen
  if (!choice) {
    return (
      <div className="min-h-screen bg-[#f4f0ea] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-12 border-4 border-black p-8 bg-yellow-200 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h1 className="text-5xl font-black tracking-tight mb-2">RINSE</h1>
            <p className="text-xl font-bold tracking-tight">Let's get you set up</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => setChoice('join')}
              className="border-4 border-black p-8 bg-blue-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all text-left"
            >
              <h2 className="text-2xl font-black mb-2 tracking-tight">JOIN A PG</h2>
              <p className="text-sm font-bold leading-snug">
                Have an invite code? Join an existing Paying Guest community
              </p>
            </button>

            <button
              onClick={() => setChoice('create')}
              className="border-4 border-black p-8 bg-green-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all text-left"
            >
              <h2 className="text-2xl font-black mb-2 tracking-tight">CREATE A PG</h2>
              <p className="text-sm font-bold leading-snug">
                Are you a PG owner? Create a new community
              </p>
            </button>
          </div>

          <div className="mt-12 text-center flex flex-col items-center gap-4">
            <p className="text-sm font-bold">Not sure? You can always change your mind later</p>

            {/* NEW LOGOUT BUTTON */}
            <button
              onClick={signOut}
              className="border-4 border-black px-8 py-3 bg-red-300 font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-red-400 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all text-sm uppercase"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Join PG Screen
  if (choice === 'join') {
    return (
      <div className="min-h-screen bg-[#f4f0ea] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 border-4 border-black p-6 bg-blue-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-3xl font-black tracking-tight mb-2">JOIN A PG</h2>
            <p className="font-bold">Enter your invitation code</p>
          </div>

          {error && (
            <div className="mb-6 border-4 border-black p-4 bg-red-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <p className="font-black text-red-900">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 border-4 border-black p-4 bg-green-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <p className="font-black text-green-900">✓ Request submitted! Waiting for approval...</p>
            </div>
          )}

          {/* THE NEW SCAN QR BUTTON */}
          <button
            onClick={() => setIsScanning(true)}
            className="w-full border-4 border-black p-5 bg-purple-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-black text-xl hover:bg-purple-400 active:translate-y-1 active:translate-x-1 active:shadow-none transition-all mb-6 flex items-center justify-center gap-3"
          >
            SCAN POSTER QR
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-4 border-black"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#f4f0ea] px-4 font-black uppercase tracking-widest text-sm">Or Enter Manually</span>
            </div>
          </div>

          <form onSubmit={handleJoinPG} className="space-y-4 mb-6">
            <div>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="RINSE-XXXXXX"
                className="w-full border-4 border-black p-4 font-black text-2xl tracking-widest text-center focus:outline-none focus:bg-yellow-100 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.1)]"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full border-4 border-black p-4 bg-yellow-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-black text-lg hover:bg-yellow-300 disabled:opacity-50 active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
            >
              {loading ? 'JOINING...' : 'JOIN PG'}
            </button>
          </form>

          <button
            onClick={() => setChoice(null)}
            className="w-full border-4 border-black p-3 bg-white font-black hover:bg-gray-100 active:translate-y-1 active:translate-x-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            ← BACK
          </button>
        </div>
      </div>
    )
  }

  // --- NEW: Pending Approval Screen ---
  if (choice === 'join' && success) {
    return (
      <div className="min-h-screen bg-[#f4f0ea] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="mb-8 border-4 border-black p-8 bg-yellow-200 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="text-6xl mb-6 animate-pulse">⏳</div>
            <h2 className="text-3xl font-black tracking-tight mb-4 uppercase">Waiting for Approval</h2>
            <p className="font-bold text-lg mb-2">
              Your request has been securely sent to the PG owner.
            </p>
            <p className="font-bold text-gray-700 bg-white border-2 border-black p-3 inline-block shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mt-2">
              Invite Code: {inviteCode}
            </p>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full border-4 border-black p-5 bg-green-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-black text-xl hover:bg-green-400 active:translate-y-1 active:translate-x-1 active:shadow-none transition-all uppercase flex items-center justify-center gap-3"
          >
            <span>🔄</span> Refresh Status
          </button>
        </div>
      </div>
    )
  }

  // Create PG Screen
  if (choice === 'create') {
    return (
      <div className="min-h-screen bg-[#f4f0ea] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 border-4 border-black p-6 bg-green-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-3xl font-black tracking-tight mb-2">CREATE A PG</h2>
            <p className="font-bold">Tell us about your property</p>
          </div>

          {error && (
            <div className="mb-6 border-4 border-black p-4 bg-red-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <p className="font-black text-red-900">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 border-4 border-black p-4 bg-green-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <p className="font-black text-green-900">✓ PG created! Welcome to Rinse</p>
            </div>
          )}

          <form onSubmit={handleCreatePG} className="space-y-4 mb-6">
            <div>
              <label className="block font-black mb-2 tracking-tight">PG NAME *</label>
              <input
                type="text"
                value={pgName}
                onChange={(e) => setPgName(e.target.value)}
                placeholder="e.g., Sharma PG House"
                className="w-full border-4 border-black p-4 font-bold focus:outline-none focus:bg-yellow-100"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label className="block font-black mb-2 tracking-tight">ADDRESS *</label>
              <textarea
                value={pgAddress}
                onChange={(e) => setPgAddress(e.target.value)}
                placeholder="123 Main Street, City"
                className="w-full border-4 border-black p-4 font-bold focus:outline-none focus:bg-yellow-100 resize-none"
                rows="3"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label className="block font-black mb-2 tracking-tight">PHONE NUMBER</label>
              <input
                type="tel"
                value={pgPhone}
                onChange={(e) => setPgPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full border-4 border-black p-4 font-bold focus:outline-none focus:bg-yellow-100"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full border-4 border-black p-4 bg-yellow-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-black text-lg hover:bg-yellow-300 active:translate-y-1 active:translate-x-1 active:shadow-none transition-all disabled:opacity-50"
            >
              {loading ? 'CREATING...' : 'CREATE PG'}
            </button>
          </form>

          <button
            onClick={() => setChoice(null)}
            className="w-full border-4 border-black p-3 bg-white font-black hover:bg-gray-100 active:translate-y-1 active:translate-x-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            ← BACK
          </button>
        </div>
      </div>
    )
  }
}