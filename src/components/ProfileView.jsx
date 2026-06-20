import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function ProfileView({ user, userProfile, signOut, onProfileUpdate }) {
  // Initialize state with existing profile data
  const [fullName, setFullName] = useState(userProfile?.full_name || '')
  const [phone, setPhone] = useState(userProfile?.phone || '')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState(null)

  // Modal state
  const [showRules, setShowRules] = useState(false)

  const handleSave = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage(null)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone: phone
        })
        .eq('id', user.id)

      if (error) throw error

      setMessage({ type: 'success', text: 'PROFILE SAVED!' })

      // Update the parent component's state so the new name shows everywhere
      if (onProfileUpdate) {
        onProfileUpdate({ ...userProfile, full_name: fullName, phone: phone })
      }

      // Clear the success message after 3 seconds
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      console.error('Error updating profile:', err)
      setMessage({ type: 'error', text: 'FAILED TO SAVE' })
    } finally {
      setIsSaving(false)
    }
  }

  const isPhoneMissing = !phone || phone.trim() === ''

  return (
    <div className="p-2 sm:p-2 pb-32">
      <div className="max-w-lg mx-auto space-y-6">

        {/* Header Card - Now displays the dynamic Full Name & WASH SCORE */}
        {/* Header Card - Now displays the dynamic Avatar, Full Name & WASH SCORE */}
        <div className="border-4 border-black p-6 sm:p-8 bg-cyan-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center text-center relative overflow-hidden mb-8">

          {/* THE WASH SCORE BADGE */}
          <div className={`absolute top-4 right-4 border-4 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${parseInt(userProfile?.wash_score ?? 100) >= 80 ? 'bg-green-300' :
              parseInt(userProfile?.wash_score ?? 100) >= 50 ? 'bg-yellow-300' : 'bg-red-400'
            }`}>
            <p className="font-black text-[10px] uppercase leading-none mb-1 text-black">Wash Score</p>
            <p className="font-black text-2xl leading-none text-black">
              {parseInt(userProfile?.wash_score ?? 100)}
            </p>
          </div>

          {/* DYNAMIC PIXEL ART AVATAR */}
          <img
            src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${fullName || userProfile?.full_name || 'Resident'}`}
            alt="User Avatar"
            className="w-24 h-24 sm:w-32 sm:h-32 border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-4 mt-8 sm:mt-4 object-contain"
          />

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-2 uppercase break-words w-full px-4 sm:px-16">
            {fullName || userProfile?.full_name || 'RESIDENT'}
          </h2>
          <p className="font-bold text-sm bg-white inline-block px-3 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            {user?.email}
          </p>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSave} className="border-4 border-black p-6 bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <div className="space-y-4">

            {/* Name Input */}
            <div>
              <label className="block font-black mb-2 text-sm tracking-tight">FULL NAME</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full border-4 border-black p-3 font-bold focus:outline-none focus:bg-yellow-100 transition-colors"
                required
              />
            </div>

            {/* Phone Input with Dynamic Warning */}
            <div>
              <label className="flex justify-between items-end mb-2">
                <span className="font-black text-sm tracking-tight">PHONE NUMBER</span>
                {isPhoneMissing && (
                  <span className="bg-red-400 text-black font-black text-[10px] px-2 py-0.5 border-2 border-black animate-pulse">
                    LAST REMAINING TASK
                  </span>
                )}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full border-4 border-black p-3 font-bold focus:outline-none focus:bg-yellow-100 transition-colors"
              />
              {isPhoneMissing && (
                <p className="text-xs font-bold mt-2 text-red-600">
                  Please add your phone number so others can text you if you leave your clothes in the machine!
                </p>
              )}
            </div>

            {/* Status Message */}
            {message && (
              <div className={`p-3 font-black text-center border-4 border-black ${message.type === 'success' ? 'bg-green-300' : 'bg-red-300'
                }`}>
                {message.text}
              </div>
            )}

            {/* Save Button */}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full border-4 border-black p-4 mt-4 bg-green-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-black text-lg hover:bg-green-400 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
            >
              {isSaving ? 'SAVING...' : 'SAVE CHANGES'}
            </button>
          </div>
        </form>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setShowRules(true)}
            className="border-4 border-black p-4 bg-pink-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-black hover:bg-pink-400 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all text-sm sm:text-base"
          >
            📜 VIEW RULES
          </button>

          <button
            onClick={signOut}
            className="border-4 border-black p-4 bg-red-400 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-black hover:bg-red-500 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all text-sm sm:text-base"
          >
            🚪 SIGN OUT
          </button>
        </div>

      </div>

      {/* Retro Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="border-4 border-black p-6 sm:p-8 bg-yellow-200 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-w-md w-full relative">
            <button
              onClick={() => setShowRules(false)}
              className="absolute -top-4 -right-4 border-4 border-black w-10 h-10 bg-white font-black text-xl hover:bg-red-400 active:translate-y-1 active:translate-x-1 transition-all flex items-center justify-center z-10"
            >
              ✕
            </button>

            <h3 className="text-3xl font-black mb-6 border-b-4 border-black pb-2">WASHING RULES</h3>

            <div className="space-y-4 font-bold text-sm sm:text-base mb-8 max-h-[40vh] overflow-y-auto pr-2 scrollbar-none">
              <p>1. Empty your pockets before washing. Nobody wants paper tissues all over their clothes.</p>
              <p>2. Be on time! If your wash is done, remove it immediately so the next person can start.</p>
              <p>3. Do not overload the machine. It will break, and everyone will be mad at you.</p>
              <p>4. Clean the lint filter if your clothes were exceptionally fuzzy.</p>
              <p>5. If you cancel your slot, please do it early so someone else can claim it.</p>
            </div>

            <button
              onClick={() => setShowRules(false)}
              className="w-full border-4 border-black py-4 bg-white font-black hover:bg-gray-100 active:translate-y-1 active:translate-x-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-lg"
            >
              GOT IT, CAPTAIN
            </button>
          </div>
        </div>
      )}
    </div>
  )
}