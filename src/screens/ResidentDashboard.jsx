import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { ScheduleView } from '../components/ScheduleView'
import { ProfileView } from '../components/ProfileView'
import { WaitingApproval } from './WaitingApproval'
import { PullToRefresh } from '../components/PullToRefresh'
import { LeaderboardView } from '../components/LeaderboardView'
import { AlertPopup } from '../components/AlertPopup'
import {
  GRACE_PERIOD_MINUTES,
  COMPLETION_BONUS_POINTS,
  START_WASH_BUFFER_MINUTES,
  MAX_WASH_SCORE,
} from '../lib/constants'

export function ResidentDashboard() {
  const { user, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState('home')
  const [userProfile, setUserProfile] = useState(null)

  const [upcomingBookings, setUpcomingBookings] = useState([])
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [hasFetched, setHasFetched] = useState(false)
  const [alertMessage, setAlertMessage] = useState("")
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return
      try {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, phone, role, pg_id, is_approved, wash_score')
          .eq('id', user.id)
          .single()
        if (data) setUserProfile(data)
      } catch (err) {
        console.error('Error fetching profile:', err)
      }
    }
    fetchProfile()
  }, [user])

  const fetchMyBookings = async () => {
    if (!userProfile?.pg_id) return
    try {
      setLoadingBookings(true)
      const now = new Date()

      // Expiration and score deduction are now handled server-side by the
      // lazy-sweeper edge function. This query only fetches live bookings.
      const { data, error } = await supabase
        .from('schedule')
        .select('*, machines(machine_number)')
        .eq('resident_id', user.id)
        .in('status', ['scheduled', 'active'])
        .order('start_time', { ascending: true })

      if (error) throw error

      // Soft-filter: hide bookings the edge function will expire on its next
      // run so the UI stays accurate between 5-minute cron intervals.
      const liveBookings = (data || []).filter(b => {
        const start = new Date(b.start_time)
        const end = new Date(b.end_time)
        if (b.status === 'active') return end > now
        return start.getTime() + GRACE_PERIOD_MINUTES * 60_000 > now.getTime()
      })

      setUpcomingBookings(liveBookings)
    } catch (err) {
      console.error('Error fetching your bookings:', err)
    } finally {
      setLoadingBookings(false)
    }
  }

  useEffect(() => {
    // Only fetch if we have a pg_id and we haven't fetched yet!
    if (userProfile?.pg_id && !hasFetched) {
      fetchMyBookings()
      setHasFetched(true)
    }
  }, [userProfile?.pg_id, hasFetched])

  // Scroll to top when tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [activeTab])


  const handleUpdateStatus = async (bookingId, newStatus) => {
    try {
      const { error } = await supabase.from('schedule').update({ status: newStatus }).eq('id', bookingId)
      if (error) throw error

      if (newStatus === 'completed') {
        const currentScore = parseInt(userProfile.wash_score ?? MAX_WASH_SCORE)
        const newScore = Math.min(MAX_WASH_SCORE, currentScore + COMPLETION_BONUS_POINTS)

        await supabase.from('profiles').update({ wash_score: newScore }).eq('id', user.id)
        setUserProfile(prev => ({ ...prev, wash_score: newScore }))
      }

      await fetchMyBookings()
    } catch (err) {
      console.error(`Error updating to ${newStatus}:`, err)
      setAlertMessage("Failed to update status.")
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
      setAlertMessage("Failed to cancel booking.")
    }
  }

  const formatTime = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const renderHomeTab = () => {
    const seenMachines = new Set()
    const nextBookingsPerMachine = upcomingBookings.filter((booking) => {
      if (seenMachines.has(booking.machine_id)) return false
      seenMachines.add(booking.machine_id)
      return true
    })

    return (
      <PullToRefresh onRefresh={fetchMyBookings}>
        <AlertPopup message={alertMessage} onClose={()=>setAlertMessage("")} />
        <div className="p-2 sm:p-2">
          <div className="max-w-2xl mx-auto">
            <div className="border-4 border-black p-6 sm:p-8 bg-yellow-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-8 text-center">
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">WASH STATS</h1>
              <p className="font-bold text-sm sm:text-base">Welcome, {userProfile?.full_name?.split(' ')[0] || 'Resident'}!</p>
            </div>

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
              <div className="space-y-6 mb-8">
                {nextBookingsPerMachine.map((booking) => {
                  const startTime = new Date(booking.start_time)
                  const bufferBefore = new Date(startTime.getTime() - START_WASH_BUFFER_MINUTES * 60_000)
                  const isTimeToStart = currentTime >= bufferBefore

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
        </div>
      </PullToRefresh>
    )
  }

  // Loaders
  if (!userProfile) {
    return (
      <div className="min-h-screen bg-[#f4f0ea] flex items-center justify-center p-4">
        <div className="border-4 border-black p-8 bg-yellow-200 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h1 className="text-3xl font-black">LOADING...</h1>
        </div>
      </div>
    )
  }

  // FIXED: If they are not approved, render the actual WaitingApproval component!
  if (!userProfile.is_approved) {
    return <WaitingApproval />
  }

  return (
    <div className="min-h-screen bg-[#f4f0ea] pb-32">

      {/* RENDER ALL TABS, BUT HIDE INACTIVE ONES */}
      <div className={activeTab === 'home' ? 'block' : 'hidden'}>
        {renderHomeTab()}
      </div>

      <div className={activeTab === 'schedule' ? 'block' : 'hidden'}>
        <ScheduleView user={user} pgId={userProfile.pg_id} />
      </div>

      <div className={activeTab === 'profile' ? 'block' : 'hidden'}>
        <ProfileView
          user={user}
          userProfile={userProfile}
          signOut={signOut}
          onProfileUpdate={setUserProfile}
        />
      </div>

      <div className={activeTab === 'score' ? 'block' : 'hidden'}>
        {userProfile?.pg_id && (
          <LeaderboardView pgId={userProfile.pg_id} currentUserId={user.id} />
        )}
      </div>

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 border-t-4 border-black bg-[#f4f0ea] z-50">
        <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2 grid grid-cols-4 gap-2">
          <button
            onClick={() => setActiveTab('home')}
            className={`border-4 border-black p-3 sm:p-4 font-black tracking-tight transition-all text-xs sm:text-base ${activeTab === 'home'
              ? 'bg-yellow-200 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.2)] translate-y-1'
              : 'bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100'
              }`}
          >
            HOME
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`border-4 border-black p-3 sm:p-4 font-black tracking-tight transition-all text-xs sm:text-base ${activeTab === 'schedule'
              ? 'bg-yellow-200 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.2)] translate-y-1'
              : 'bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100'
              }`}
          >
            SCHEDULE
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`border-4 border-black p-3 sm:p-4 font-black tracking-tight transition-all text-xs sm:text-base ${activeTab === 'profile'
              ? 'bg-yellow-200 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.2)] translate-y-1'
              : 'bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100'
              }`}
          >
            PROFILE
          </button>

          <button
            onClick={() => setActiveTab('score')}
            className={`border-4 border-black p-3 sm:p-4 font-black tracking-tight transition-all text-xs sm:text-base ${activeTab === 'score'
              ? 'bg-yellow-200 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.2)] translate-y-1'
              : 'bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100'
              }`}
          >
            RANK
          </button>
        </div>

      </div>
    </div>
  )
}