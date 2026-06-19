import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'

export function Onboarding() {
  const { user } = useAuth()
  const [choice, setChoice] = useState(null) // 'join' or 'create'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

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

  // Handle Join PG
  const handleJoinPG = async (e) => {
    e.preventDefault()
    if (!inviteCode.trim()) {
      setError('Please enter an invite code')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Look up PG by invite code
      const { data: pgData, error: pgError } = await supabase
        .from('pgs')
        .select('id')
        .eq('invite_code', inviteCode.toUpperCase())
        .single()

      if (pgError || !pgData) {
        setError('Invalid invite code. Please check and try again.')
        setLoading(false)
        return
      }

      const pgId = pgData.id

      // STEP 1: CREATE THE PROFILE FIRST
      // The database must know this user exists before accepting their request
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: 'Resident', // Placeholder
          role: 'resident',
          pg_id: pgId,
          is_approved: false,
        })

      if (profileError) throw profileError

      // STEP 2: NOW insert the join request
      const { error: joinError } = await supabase
        .from('join_requests')
        .insert({
          pg_id: pgId,
          resident_id: user.id,
          status: 'pending',
        })

      if (joinError) throw joinError

      setSuccess(true)
      // Page will redirect automatically when profile updates trigger re-render
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
      // STEP 1: Create the profile FIRST so the database knows who the owner is
      const { error: profileError1 } = await supabase
        .from('profiles')
        .upsert({
          id: user.id, // Links to their auth account
          full_name: 'PG Owner', // Placeholder since we didn't ask for their name
          phone: pgPhone,
          role: 'owner',
          is_approved: true,
        })

      if (profileError1) throw profileError1

      // STEP 2: Now create the PG (the database will accept this because the profile exists)
      const inviteCode = generateInviteCode()

      const { data: newPG, error: pgError } = await supabase
        .from('pgs')
        .insert({
          name: pgName,
          address: pgAddress,
          invite_code: inviteCode,
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
      // Page will redirect automatically when profile updates trigger re-render
    } catch (err) {
      console.error('Error creating PG:', err)
      setError(err.message || 'Failed to create PG. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Initial choice screen
  if (!choice) {
    return (
      <div className="min-h-screen bg-[#f4f0ea] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {/* Header */}
          <div className="text-center mb-12 border-4 border-black p-8 bg-yellow-200 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h1 className="text-5xl font-black tracking-tight mb-2">RINSE</h1>
            <p className="text-xl font-bold tracking-tight">Let's get you set up</p>
          </div>

          {/* Choice Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Option A: Join PG */}
            <button
              onClick={() => setChoice('join')}
              className="border-4 border-black p-8 bg-blue-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-shadow text-left"
            >
              <div className="text-4xl font-black mb-4">🏢</div>
              <h2 className="text-2xl font-black mb-2 tracking-tight">JOIN A PG</h2>
              <p className="text-sm font-bold leading-snug">
                Have an invite code? Join an existing Paying Guest community
              </p>
            </button>

            {/* Option B: Create PG */}
            <button
              onClick={() => setChoice('create')}
              className="border-4 border-black p-8 bg-green-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-shadow text-left"
            >
              <div className="text-4xl font-black mb-4">🔑</div>
              <h2 className="text-2xl font-black mb-2 tracking-tight">CREATE A PG</h2>
              <p className="text-sm font-bold leading-snug">
                Are you a PG owner? Create a new community
              </p>
            </button>
          </div>

          {/* Info Footer */}
          <div className="mt-8 text-center text-sm font-bold">
            <p>Not sure? You can always change your mind later</p>
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
          {/* Header */}
          <div className="text-center mb-8 border-4 border-black p-6 bg-blue-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-3xl font-black tracking-tight mb-2">JOIN A PG</h2>
            <p className="font-bold">Enter your invitation code</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 border-4 border-black p-4 bg-red-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <p className="font-bold text-red-900">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-6 border-4 border-black p-4 bg-green-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <p className="font-bold text-green-900">✓ Request submitted! Waiting for approval...</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleJoinPG} className="space-y-4 mb-6">
            {/* Invite Code Input */}
            <div>
              <label className="block font-black mb-2 tracking-tight">
                INVITE CODE
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="RINSE-XXXXXX"
                className="w-full border-4 border-black p-4 font-black text-lg tracking-tight focus:outline-none focus:bg-yellow-100"
                disabled={loading}
              />
              <p className="text-xs font-bold mt-2 text-gray-700">
                Format: RINSE-XXXXXX (6 characters after RINSE-)
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full border-4 border-black p-4 bg-yellow-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-black text-lg hover:bg-yellow-300 disabled:opacity-50"
            >
              {loading ? 'JOINING...' : 'JOIN PG'}
            </button>
          </form>

          {/* QR Code Button */}
          <button
            disabled
            className="w-full border-4 border-black p-4 bg-gray-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-black text-lg opacity-50 cursor-not-allowed mb-6"
          >
            📱 SCAN QR CODE (Coming Soon)
          </button>

          {/* Back Button */}
          <button
            onClick={() => setChoice(null)}
            className="w-full border-2 border-black p-3 bg-white font-bold hover:bg-gray-100"
          >
            ← BACK
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
          {/* Header */}
          <div className="text-center mb-8 border-4 border-black p-6 bg-green-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-3xl font-black tracking-tight mb-2">CREATE A PG</h2>
            <p className="font-bold">Tell us about your property</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 border-4 border-black p-4 bg-red-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <p className="font-bold text-red-900">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-6 border-4 border-black p-4 bg-green-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <p className="font-bold text-green-900">✓ PG created! Welcome to Rinse</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleCreatePG} className="space-y-4 mb-6">
            {/* PG Name */}
            <div>
              <label className="block font-black mb-2 tracking-tight">
                PG NAME *
              </label>
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

            {/* Address */}
            <div>
              <label className="block font-black mb-2 tracking-tight">
                ADDRESS *
              </label>
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

            {/* Phone Number */}
            <div>
              <label className="block font-black mb-2 tracking-tight">
                PHONE NUMBER
              </label>
              <input
                type="tel"
                value={pgPhone}
                onChange={(e) => setPgPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full border-4 border-black p-4 font-bold focus:outline-none focus:bg-yellow-100"
                disabled={loading}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full border-4 border-black p-4 bg-yellow-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-black text-lg hover:bg-yellow-300 disabled:opacity-50"
            >
              {loading ? 'CREATING...' : 'CREATE PG'}
            </button>
          </form>

          {/* Back Button */}
          <button
            onClick={() => setChoice(null)}
            className="w-full border-2 border-black p-3 bg-white font-bold hover:bg-gray-100"
          >
            ← BACK
          </button>
        </div>
      </div>
    )
  }
}