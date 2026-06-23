import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { MachineManager } from '../components/MachineManager'
import { ManageResidents } from '../components/ManageResidents'
import { ScheduleView } from '../components/ScheduleView'
import { PullToRefresh } from '../components/PullToRefresh'
import { LeaderboardView } from '../components/LeaderboardView'

export function OwnerDashboard() {
  const { user, signOut } = useAuth()

  // Tab State
  const [activeTab, setActiveTab] = useState('home')

  // Data States
  const [pgDetails, setPgDetails] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Edit PG Details States
  const [isEditingPG, setIsEditingPG] = useState(false)
  const [editPgName, setEditPgName] = useState('')
  const [editPgAddress, setEditPgAddress] = useState('')
  const [updatingPG, setUpdatingPG] = useState(false)

  // NEW: Edit Owner Profile States
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [editOwnerName, setEditOwnerName] = useState('')
  const [editOwnerPhone, setEditOwnerPhone] = useState('')
  const [updatingProfile, setUpdatingProfile] = useState(false)

  // Booking States
  const [upcomingBookings, setUpcomingBookings] = useState([])
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [hasFetched, setHasFetched] = useState(false)

  // Keep time ticking every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Scroll to top when tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [activeTab])

  // Fetch Dashboard & Profile Data
  useEffect(() => {
    if (user) {
      fetchDashboardData()
    }
  }, [user])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, phone, role, pg_id, is_approved, wash_score')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError
      if (!profileData?.pg_id) return

      setUserProfile(profileData)

      const { data: pgData, error: pgError } = await supabase
        .from('pgs')
        .select('*')
        .eq('id', profileData.pg_id)
        .single()

      if (pgError) throw pgError
      if (pgData) setPgDetails(pgData)

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  // --- EDIT OWNER PROFILE LOGIC ---
  const startEditingProfile = () => {
    setEditOwnerName(userProfile?.full_name || '')
    setEditOwnerPhone(userProfile?.phone || '')
    setIsEditingProfile(true)
  }

  const handleUpdateProfileDetails = async (e) => {
    e.preventDefault()
    try {
      setUpdatingProfile(true)
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: editOwnerName, phone: editOwnerPhone })
        .eq('id', user.id)

      if (error) throw error

      setUserProfile(prev => ({ ...prev, full_name: editOwnerName, phone: editOwnerPhone }))
      setIsEditingProfile(false)
    } catch (err) {
      console.error('Error updating profile:', err)
      alert('Failed to update profile details.')
    } finally {
      setUpdatingProfile(false)
    }
  }

  // --- EDIT PG DETAILS LOGIC ---
  const startEditingPG = () => {
    setEditPgName(pgDetails?.name || '')
    setEditPgAddress(pgDetails?.address || '')
    setIsEditingPG(true)
  }

  const handleUpdatePGDetails = async (e) => {
    e.preventDefault()
    try {
      setUpdatingPG(true)
      const { error } = await supabase
        .from('pgs')
        .update({ name: editPgName, address: editPgAddress })
        .eq('id', pgDetails.id)

      if (error) throw error

      setPgDetails(prev => ({ ...prev, name: editPgName, address: editPgAddress }))
      setIsEditingPG(false)
    } catch (err) {
      console.error('Error updating PG details:', err)
      alert('Failed to update PG details.')
    } finally {
      setUpdatingPG(false)
    }
  }

  // --- THE LAZY SWEEPER & BOOKING FETCH LOGIC ---
  const fetchMyBookings = async () => {
    if (!userProfile?.pg_id) return
    try {
      setLoadingBookings(true)
      const now = new Date()

      const { data, error } = await supabase
        .from('schedule')
        .select('*, machines(machine_number)')
        .eq('resident_id', user.id)
        .order('start_time', { ascending: true })

      if (error) throw error

      let needsRefetch = false

      for (const booking of data || []) {
        const startTime = new Date(booking.start_time)
        const endTime = new Date(booking.end_time)

        if (booking.status === 'active' && now > endTime) {
          await supabase.from('schedule').update({ status: 'completed' }).eq('id', booking.id)
          needsRefetch = true
        }

        const gracePeriod = new Date(startTime.getTime() + 15 * 60000)
        if (booking.status === 'scheduled' && now > gracePeriod) {
          await supabase.from('schedule').update({ status: 'expired' }).eq('id', booking.id)

          const currentScore = parseInt(userProfile.wash_score ?? 100)
          const newScore = Math.max(0, currentScore - 10)

          await supabase.from('profiles').update({ wash_score: newScore }).eq('id', user.id)
          setUserProfile(prev => ({ ...prev, wash_score: newScore }))
          needsRefetch = true
        }
      }

      if (needsRefetch) {
        const { data: freshData } = await supabase
          .from('schedule')
          .select('*, machines(machine_number)')
          .eq('resident_id', user.id)
          .gte('end_time', now.toISOString())
          .order('start_time', { ascending: true })
        setUpcomingBookings(freshData || [])
      } else {
        setUpcomingBookings(data.filter(b => new Date(b.end_time) > now) || [])
      }

    } catch (err) {
      console.error('Error fetching your bookings:', err)
    } finally {
      setLoadingBookings(false)
    }
  }

  useEffect(() => {
    if (userProfile?.pg_id && !hasFetched) {
      fetchMyBookings()
      setHasFetched(true)
    }
  }, [userProfile?.pg_id, hasFetched])

  const handleUpdateStatus = async (bookingId, newStatus) => {
    try {
      const { error } = await supabase.from('schedule').update({ status: newStatus }).eq('id', bookingId)
      if (error) throw error

      if (newStatus === 'completed') {
        const currentScore = parseInt(userProfile.wash_score ?? 100)
        const newScore = Math.min(100, currentScore + 2)

        await supabase.from('profiles').update({ wash_score: newScore }).eq('id', user.id)
        setUserProfile(prev => ({ ...prev, wash_score: newScore }))
      }
      await fetchMyBookings()
    } catch (err) {
      console.error(`Error updating to ${newStatus}:`, err)
      alert('Failed to update status.')
    }
  }

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm("Are you sure you want to cancel this wash?")) return
    try {
      const { error } = await supabase.from('schedule').delete().eq('id', bookingId)
      if (error) throw error
      await fetchMyBookings()
    } catch (err) {
      console.error('Error canceling booking:', err)
      alert('Failed to cancel booking.')
    }
  }

  const formatTime = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  // --- TAB RENDERERS ---

  const renderHomeTab = () => {
    const seenMachines = new Set()
    const nextBookingsPerMachine = upcomingBookings.filter((booking) => {
      if (seenMachines.has(booking.machine_id)) return false
      seenMachines.add(booking.machine_id)
      return true
    })

    return (
      <PullToRefresh onRefresh={fetchMyBookings}>
        <div className="space-y-6 p-2 sm:p-4 min-h-screen">

          <div className="border-4 border-black p-6 bg-blue-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-black mb-2 tracking-tight uppercase truncate">
                {pgDetails?.name || 'YOUR PG'}
              </h2>
              <p className="font-bold text-sm sm:text-base mb-2">📍 {pgDetails?.address || 'Address not set'}</p>
              <p className="flex flex-wrap items-center gap-2 font-bold text-sm sm:text-base">
                🔗 Invite Code:
                <span className="bg-white px-2 py-1 border-2 border-black tracking-widest">{pgDetails?.invite_code || '---'}</span>
              </p>
            </div>
            <button
              onClick={signOut}
              className="w-full sm:w-auto border-4 border-black p-3 bg-red-300 font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-red-400 active:translate-y-1 active:translate-x-1 active:shadow-none transition-all text-sm sm:text-base shrink-0"
            >
              SIGN OUT
            </button>
          </div>

          <div className="border-4 border-black p-6 sm:p-8 bg-yellow-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-center relative overflow-hidden">

            <div className={`absolute top-4 right-4 border-4 border-black p-1 sm:p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${parseInt(userProfile?.wash_score ?? 100) >= 80 ? 'bg-green-300' :
                parseInt(userProfile?.wash_score ?? 100) >= 50 ? 'bg-yellow-300' : 'bg-red-400'
              }`}>
              <p className="font-black text-[8px] sm:text-[10px] uppercase leading-none mb-1 text-black">Wash Score</p>
              <div className="flex items-center justify-center gap-1">
                <span className="font-black text-lg sm:text-2xl leading-none text-black">
                  {parseInt(userProfile?.wash_score ?? 100)}
                </span>
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 pr-12">WASH STATS</h1>
            <p className="font-bold text-sm sm:text-base pr-12">👑 Welcome, {userProfile?.full_name?.split(' ')[0] || 'Owner'}!</p>
          </div>

          <h2 className="text-2xl font-black mb-4 tracking-tight">YOUR UPCOMING WASHES</h2>

          {loadingBookings ? (
            <div className="border-4 border-black p-8 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <p className="font-black text-center">Checking machines...</p>
            </div>
          ) : nextBookingsPerMachine.length === 0 ? (
            <div className="border-4 border-black p-8 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center text-center">
              <p className="text-xl font-black mb-2">No upcoming washes</p>
              <p className="font-bold text-gray-600 mb-6">Need to wash the PG curtains? Book a slot!</p>
              <button
                onClick={() => setActiveTab('schedule')}
                className="border-4 border-black px-6 py-3 bg-cyan-300 font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-cyan-400 active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
              >
                BOOK A SLOT
              </button>
            </div>
          ) : (
            <div className="space-y-6 mb-8">
              {nextBookingsPerMachine.map((booking) => {
                const startTime = new Date(booking.start_time)
                // NOTE MAKING DEBUG CHANGES SHOULD BE REVERTED
                const fiveMinsBefore = new Date(startTime.getTime() - 15 * 60000)
                const isTimeToStart = currentTime >= fiveMinsBefore

                return (
                  <div key={booking.id} className={`border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-colors ${booking.status === 'active' ? 'bg-yellow-300' : 'bg-blue-200'}`}>
                    <div className="flex justify-between items-start border-b-4 border-black pb-4 mb-4">
                      <div>
                        <p className="font-black text-sm tracking-widest mb-1">
                          MACHINE {booking.machines?.machine_number}
                        </p>
                        <p className="text-3xl sm:text-4xl font-black">
                          {formatTime(booking.start_time)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="bg-white border-2 border-black px-3 py-1 font-black text-xs sm:text-sm uppercase tracking-wider">
                          {booking.status}
                        </span>
                        <p className="font-bold text-xs mt-2">
                          {new Date(booking.start_time).toDateString() === new Date().toDateString()
                            ? 'TODAY'
                            : new Date(booking.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
                          }
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      {booking.status === 'scheduled' && (
                        <>
                          <button
                            onClick={() => handleCancelBooking(booking.id)}
                            className="flex-1 border-4 border-black p-3 bg-white font-black hover:bg-gray-100 active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
                          >
                            CANCEL
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(booking.id, 'active')}
                            disabled={!isTimeToStart}
                            className={`flex-[2] border-4 border-black p-3 font-black transition-all ${isTimeToStart
                              ? 'bg-green-300 hover:bg-green-400 active:translate-y-1 active:translate-x-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-70'
                              }`}
                          >
                            {isTimeToStart ? 'START WASH ▶' : 'TOO EARLY TO START'}
                          </button>
                        </>
                      )}

                      {booking.status === 'active' && (
                        <button
                          onClick={() => handleUpdateStatus(booking.id, 'completed')}
                          className="w-full border-4 border-black p-4 bg-green-300 font-black text-lg hover:bg-green-400 active:translate-y-1 active:translate-x-1 active:shadow-none transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                        >
                          MARK COMPLETED ✓
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </PullToRefresh>
    )
  }

  const renderSettingsTab = () => (
    <div className="space-y-6 p-2 sm:p-4">
      <div className="border-4 border-black p-6 sm:p-8 bg-purple-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-6 text-center">
        <h2 className="text-3xl sm:text-4xl font-black mb-2 uppercase tracking-tight">⚙️ PG SETTINGS</h2>
        <p className="font-bold text-sm sm:text-base">Manage your system configurations here.</p>
      </div>

      {/* NEW: OWNER PROFILE EDITOR CARD (WITH DICEBEAR & MISSING PHONE WARNING) */}
      {userProfile && (
        <div className="border-4 border-black p-6 bg-pink-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row gap-6 items-start md:items-center">

          <div className="flex flex-col items-center shrink-0 w-full md:w-auto relative">
            <img
              src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${userProfile?.full_name || 'Owner'}`}
              alt="Owner Avatar"
              className="w-24 h-24 sm:w-32 sm:h-32 border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] object-contain"
            />

            {/* The Missing Phone Warning Alert */}
            {!userProfile?.phone && (
              <div className="mt-4 border-4 border-black bg-red-400 p-2 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-w-[200px] animate-pulse">
                <p className="font-black text-xs uppercase text-white tracking-widest">⚠️ Missing!</p>
                <p className="font-bold text-[10px] text-white leading-tight mt-1">Please enter your phone number. This is the last task!</p>
              </div>
            )}
          </div>

          <div className="flex-1 w-full">
            <h3 className="text-2xl font-black mb-4 uppercase tracking-tight border-b-4 border-black pb-2">Your Profile</h3>

            {isEditingProfile ? (
              <form onSubmit={handleUpdateProfileDetails} className="space-y-4">
                <div>
                  <label className="block font-black text-sm uppercase mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editOwnerName}
                    onChange={(e) => setEditOwnerName(e.target.value)}
                    className="w-full border-4 border-black p-3 font-bold text-lg focus:outline-none focus:bg-yellow-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-colors"
                  />
                </div>
                <div>
                  <label className="block font-black text-sm uppercase mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 XXXXX XXXXX"
                    value={editOwnerPhone}
                    onChange={(e) => setEditOwnerPhone(e.target.value)}
                    className="w-full border-4 border-black p-3 font-bold text-lg focus:outline-none focus:bg-yellow-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-colors"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="flex-1 border-4 border-black p-3 bg-white font-black hover:bg-gray-100 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={updatingProfile}
                    className="flex-[2] border-4 border-black p-3 bg-lime-300 font-black hover:bg-lime-400 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
                  >
                    {updatingProfile ? 'SAVING...' : 'SAVE PROFILE'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="font-black text-sm text-gray-700 uppercase">Full Name</p>
                  <p className="font-bold text-xl">{userProfile.full_name || 'Not set'}</p>
                </div>
                <div>
                  <p className="font-black text-sm text-gray-700 uppercase">Phone Number</p>
                  <p className={`font-bold text-lg ${!userProfile.phone ? 'text-red-600 italic' : ''}`}>
                    {userProfile.phone || 'Not set'}
                  </p>
                </div>
                <button
                  onClick={startEditingProfile}
                  className={`w-full mt-4 border-4 border-black p-3 font-black active:translate-y-[2px] active:translate-x-[2px] active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all ${!userProfile.phone ? 'bg-red-300 hover:bg-red-400 animate-pulse' : 'bg-cyan-300 hover:bg-cyan-400'
                    }`}
                >
                  ✏️ UPDATE PROFILE
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PG DETAILS EDITOR CARD */}
      {pgDetails && (
        <div className="border-4 border-black p-6 bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="text-2xl font-black mb-4 uppercase tracking-tight border-b-4 border-black pb-2">PG Details</h3>

          {isEditingPG ? (
            <form onSubmit={handleUpdatePGDetails} className="space-y-4">
              <div>
                <label className="block font-black text-sm uppercase mb-1">PG Name</label>
                <input
                  type="text"
                  required
                  value={editPgName}
                  onChange={(e) => setEditPgName(e.target.value)}
                  className="w-full border-4 border-black p-3 font-bold text-lg focus:outline-none focus:bg-yellow-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-colors"
                />
              </div>
              <div>
                <label className="block font-black text-sm uppercase mb-1">Address</label>
                <textarea
                  required
                  rows="3"
                  value={editPgAddress}
                  onChange={(e) => setEditPgAddress(e.target.value)}
                  className="w-full border-4 border-black p-3 font-bold text-lg focus:outline-none focus:bg-yellow-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-colors"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingPG(false)}
                  className="flex-1 border-4 border-black p-3 bg-gray-200 font-black hover:bg-gray-300 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={updatingPG}
                  className="flex-[2] border-4 border-black p-3 bg-green-300 font-black hover:bg-green-400 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
                >
                  {updatingPG ? 'SAVING...' : 'SAVE DETAILS'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="font-black text-sm text-gray-500 uppercase">PG Name</p>
                <p className="font-bold text-xl">{pgDetails.name || 'Not set'}</p>
              </div>
              <div>
                <p className="font-black text-sm text-gray-500 uppercase">Address</p>
                <p className="font-bold text-lg">{pgDetails.address || 'Not set'}</p>
              </div>
              <button
                onClick={startEditingPG}
                className="w-full mt-4 border-4 border-black p-3 bg-cyan-300 font-black hover:bg-cyan-400 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                ✏️ EDIT PG DETAILS
              </button>
            </div>
          )}
        </div>
      )}

      {pgDetails && <MachineManager pgId={pgDetails.id} />}
    </div>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f0ea] flex items-center justify-center p-4">
        <div className="border-4 border-black p-8 bg-yellow-200 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h1 className="text-3xl font-black">LOADING DASHBOARD...</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f4f0ea] pb-32">
      <div className="max-w-4xl mx-auto">

        {/* RENDER ALL TABS, BUT HIDE INACTIVE ONES */}
        <div className={activeTab === 'home' ? 'block' : 'hidden'}>
          {renderHomeTab()}
        </div>

        <div className={activeTab === 'schedule' ? 'block' : 'hidden'}>
          {pgDetails && (
            <div className="p-2 sm:p-4">
              <ScheduleView user={user} pgId={pgDetails.id} />
            </div>
          )}
        </div>

        <div className={activeTab === 'residents' ? 'block' : 'hidden'}>
          {pgDetails && (
            <div className="p-2 sm:p-4">
              <ManageResidents pgId={pgDetails.id} ownerId={user.id} />
            </div>
          )}
        </div>

        <div className={activeTab === 'settings' ? 'block' : 'hidden'}>
          {renderSettingsTab()}
        </div>

        <div className={activeTab === 'score' ? 'block' : 'hidden'}>
          {userProfile?.pg_id && (
            <LeaderboardView pgId={userProfile.pg_id} currentUserId={user.id} />
          )}
        </div>


      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t-4 border-black bg-[#f4f0ea] z-50">
        <div className="max-w-6xl mx-auto px-1 sm:px-4 py-2 grid grid-cols-5 gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('home')}
            className={`border-4 border-black p-2 sm:p-4 font-black tracking-tight transition-all text-[10px] sm:text-base ${activeTab === 'home'
                ? 'bg-yellow-200 shadow-[inset_3px_3px_0px_0px_rgba(0,0,0,0.2)] translate-y-1'
                : 'bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100'
              }`}
          >
            HOME
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`border-4 border-black p-2 sm:p-4 font-black tracking-tight transition-all text-[10px] sm:text-base ${activeTab === 'schedule'
                ? 'bg-yellow-200 shadow-[inset_3px_3px_0px_0px_rgba(0,0,0,0.2)] translate-y-1'
                : 'bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100'
              }`}
          >
            SCHEDULE
          </button>
          <button
            onClick={() => setActiveTab('residents')}
            className={`border-4 border-black p-2 sm:p-4 font-black tracking-tight transition-all text-[10px] sm:text-base ${activeTab === 'residents'
                ? 'bg-yellow-200 shadow-[inset_3px_3px_0px_0px_rgba(0,0,0,0.2)] translate-y-1'
                : 'bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100'
              }`}
          >
            PEOPLE
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`border-4 border-black p-2 sm:p-4 font-black tracking-tight transition-all text-[10px] sm:text-base ${activeTab === 'settings'
                ? 'bg-yellow-200 shadow-[inset_3px_3px_0px_0px_rgba(0,0,0,0.2)] translate-y-1'
                : 'bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100'
              }`}
          >
            SETTINGS
          </button>
          <button
            onClick={() => setActiveTab('score')}
            className={`border-4 border-black p-2 sm:p-4 font-black tracking-tight transition-all text-[10px] sm:text-base ${activeTab === 'score'
                ? 'bg-yellow-200 shadow-[inset_3px_3px_0px_0px_rgba(0,0,0,0.2)] translate-y-1'
                : 'bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100'
              }`}
          >
            RANK
          </button>
        </div>
      </div>
    </div>
  )
}