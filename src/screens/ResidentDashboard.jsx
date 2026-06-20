import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { ScheduleView } from '../components/ScheduleView'
import { ProfileView } from '../components/ProfileView'

export function ResidentDashboard() {
const { user, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState('home')
  const [userProfile, setUserProfile] = useState(null)

  // New States for Home Tab
  const [upcomingBookings, setUpcomingBookings] = useState([])
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Keep time ticking every minute to update the "Start" button logic
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Fetch Profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return
      try {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, phone, role, pg_id, is_approved')
          .eq('id', user.id)
          .single()
        if (data) setUserProfile(data)
      } catch (err) {
        console.error('Error fetching profile:', err)
      }
    }
    fetchProfile()
  }, [user])

  // Fetch Resident's Specific Bookings
  const fetchMyBookings = async () => {
    if (!userProfile?.pg_id) return
    try {
      setLoadingBookings(true)
      const now = new Date().toISOString()

      // Fetch bookings that haven't ended yet, along with machine details
      const { data, error } = await supabase
        .from('schedule')
        .select('*, machines(machine_number)')
        .eq('resident_id', user.id)
        .gte('end_time', now)
        .order('start_time', { ascending: true }) // Sorted chronologically!

      if (error) throw error
      setUpcomingBookings(data || [])
    } catch (err) {
      console.error('Error fetching your bookings:', err)
    } finally {
      setLoadingBookings(false)
    }
  }

  // Refetch bookings when tab changes to 'home'
  useEffect(() => {
    if (activeTab === 'home') {
      fetchMyBookings()
    }
  }, [activeTab, userProfile])

  // Actions
  const handleUpdateStatus = async (bookingId, newStatus) => {
    try {
      const { error } = await supabase
        .from('schedule')
        .update({ status: newStatus })
        .eq('id', bookingId)

      if (error) throw error
      await fetchMyBookings() // Refresh UI
    } catch (err) {
      console.error(`Error updating to ${newStatus}:`, err)
      alert('Failed to update status.')
    }
  }

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm("Are you sure you want to cancel this wash?")) return
    try {
      const { error } = await supabase
        .from('schedule')
        .delete()
        .eq('id', bookingId)

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

  // View Renderers
  const renderHomeTab = () => {

    // NEW LOGIC: Filter down to ONLY the next upcoming wash per machine
    const seenMachines = new Set()
    const nextBookingsPerMachine = upcomingBookings.filter((booking) => {
      // Since the array is sorted chronologically, the first time we see a machine_id, 
      // it is guaranteed to be the earliest/next wash for that machine.
      if (seenMachines.has(booking.machine_id)) {
        return false // We already have the next wash for this machine, ignore this one
      }
      seenMachines.add(booking.machine_id)
      return true
    })

    return (
      <div className="p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          {/* Welcome Header */}
          <div className="border-4 border-black p-6 sm:p-8 bg-yellow-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-8 text-center">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">WASH STATS</h1>
            <p className="font-bold text-sm sm:text-base">Welcome, {userProfile?.full_name?.split(' ')[0] || 'Resident'}!</p>
          </div>

          {/* Action Center - Pluralized for multiple bookings */}
          <h2 className="text-2xl font-black mb-4 tracking-tight">YOUR UPCOMING WASHES</h2>

          {loadingBookings ? (
            <div className="border-4 border-black p-8 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <p className="font-black text-center">Checking machines...</p>
            </div>
          ) : nextBookingsPerMachine.length === 0 ? (
            <div className="border-4 border-black p-8 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center text-center">
              <p className="text-xl font-black mb-2">No upcoming washes</p>
              <p className="font-bold text-gray-600 mb-6">Your basket is looking full. Time to book a machine?</p>
              <button
                onClick={() => setActiveTab('schedule')}
                className="border-4 border-black px-6 py-3 bg-cyan-300 font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-cyan-400 active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
              >
                BOOK A SLOT
              </button>
            </div>
          ) : (
            /* MAP OVER THE FILTERED LIST */
            <div className="space-y-6 mb-8">
              {nextBookingsPerMachine.map((booking) => {

                // Calculate time logic for EACH individual booking
                const startTime = new Date(booking.start_time)
                const fiveMinsBefore = new Date(startTime.getTime() - 5 * 60000)
                const isTimeToStart = currentTime >= fiveMinsBefore

                return (
                  <div key={booking.id} className={`border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-colors ${booking.status === 'active' ? 'bg-yellow-300' : 'bg-blue-200'
                    }`}>
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

                    {/* Dynamic Controls based on status and time */}
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
      </div>
    )
  }

  // Return Loading State if profile isn't ready
  if (!userProfile) {
    return (
      <div className="min-h-screen bg-[#f4f0ea] flex items-center justify-center p-4">
        <div className="border-4 border-black p-8 bg-yellow-200 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h1 className="text-3xl font-black">LOADING...</h1>
        </div>
      </div>
    )
  }

  // Return Waiting Screen if not approved
  if (!userProfile.is_approved) {
    return (
      <div className="min-h-screen bg-[#f4f0ea] flex items-center justify-center p-4">
        <div className="max-w-md w-full border-4 border-black p-8 bg-blue-200 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center">
          <h1 className="text-3xl font-black mb-4">HANG TIGHT</h1>
          <p className="font-bold mb-6">Waiting for the PG Owner to accept your join request.</p>
          <button onClick={signOut} className="border-4 border-black px-6 py-2 bg-red-300 font-black hover:bg-red-400 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            SIGN OUT
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f4f0ea] pb-32">

      {activeTab === 'home' && renderHomeTab()}
      {activeTab === 'schedule' && <ScheduleView user={user} pgId={userProfile.pg_id} />}

      {activeTab === 'profile' && (
        <ProfileView
          user={user}
          userProfile={userProfile}
          signOut={signOut}
          onProfileUpdate={setUserProfile}
        />
      )}

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 border-t-4 border-black bg-[#f4f0ea] z-50">
        <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2 grid grid-cols-3 gap-2">
          <button
            onClick={() => setActiveTab('home')}
            className={`border-4 border-black p-3 sm:p-4 font-black tracking-tight transition-all text-xs sm:text-base ${activeTab === 'home'
                ? 'bg-yellow-200 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.2)] translate-y-1'
                : 'bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100'
              }`}
          >
            📊 HOME
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`border-4 border-black p-3 sm:p-4 font-black tracking-tight transition-all text-xs sm:text-base ${activeTab === 'schedule'
                ? 'bg-yellow-200 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.2)] translate-y-1'
                : 'bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100'
              }`}
          >
            📅 SCHEDULE
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`border-4 border-black p-3 sm:p-4 font-black tracking-tight transition-all text-xs sm:text-base ${activeTab === 'profile'
                ? 'bg-yellow-200 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.2)] translate-y-1'
                : 'bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100'
              }`}
          >
            👤 PROFILE
          </button>
        </div>
      </div>
    </div>
  )
}