import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'

// Mock schedule data
const mockSchedule = [
  { id: '1', startTime: new Date(2026, 5, 19, 8, 0), endTime: new Date(2026, 5, 19, 8, 40), status: 'completed', resident_id: 'user1', machineId: 1 },
  { id: '2', startTime: new Date(2026, 5, 19, 10, 0), endTime: new Date(2026, 5, 19, 10, 40), status: 'active', resident_id: 'user2', machineId: 1 },
  { id: '3', startTime: new Date(2026, 5, 19, 16, 0), endTime: new Date(2026, 5, 19, 16, 35), status: 'scheduled', resident_id: 'user3', machineId: 2 },
]

// Time slot generation logic
function generateTimeSlots(selectedDate, machineId) {
  const slots = []
  const startHour = 6 // 6 AM
  const endHour = 22 // 10 PM
  const cycleDuration = machineId === 1 ? 40 : 35 // Machine durations
  const gapTime = 10 // 10 minute gap between slots

  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += cycleDuration + gapTime) {
      const slotStart = new Date(selectedDate)
      slotStart.setHours(hour, minute, 0, 0)

      const slotEnd = new Date(slotStart)
      slotEnd.setMinutes(slotEnd.getMinutes() + cycleDuration)

      // Don't add slot if it goes beyond operating hours
      if (slotEnd.getHours() >= endHour) break

      slots.push({
        id: `slot-${hour}-${minute}`,
        startTime: slotStart,
        endTime: slotEnd,
        machineId,
        isAvailable: true,
      })
    }
  }

  return slots
}

// Check if slot is in the past
function isSlotInPast(slotStart) {
  const now = new Date()
  return slotStart < now
}

// Format time as HH:MM
function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

// Format date as "Today", "Tomorrow", or full date
function formatDate(date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const dateToCheck = new Date(date)
  dateToCheck.setHours(0, 0, 0, 0)

  if (dateToCheck.getTime() === today.getTime()) {
    return 'TODAY'
  } else if (dateToCheck.getTime() === tomorrow.getTime()) {
    return 'TOMORROW'
  } else {
    return dateToCheck.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
  }
}

// Calculate time stick position
function getTimeStickPosition() {
  const now = new Date()
  const startOfDay = new Date(now)
  startOfDay.setHours(6, 0, 0, 0)
  const endOfDay = new Date(now)
  endOfDay.setHours(22, 0, 0, 0)

  if (now < startOfDay || now > endOfDay) {
    return null
  }

  const totalMinutes = endOfDay.getHours() - startOfDay.getHours()
  const elapsedMinutes = (now.getHours() - startOfDay.getHours()) * 60 + now.getMinutes()
  const percentage = (elapsedMinutes / (totalMinutes * 60)) * 100

  return Math.max(0, Math.min(100, percentage))
}

export function ResidentDashboard() {
  const { user, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState('home')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedMachine, setSelectedMachine] = useState(1)
  const [timeSlots, setTimeSlots] = useState([])
  const [userProfile, setUserProfile] = useState(null)

  // Fetch user profile data
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return
      try {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', user.id)
          .single()
        if (data) setUserProfile(data)
      } catch (err) {
        console.error('Error fetching profile:', err)
      }
    }
    fetchProfile()
  }, [user])

  // Generate time slots when date or machine changes
  useEffect(() => {
    const slots = generateTimeSlots(selectedDate, selectedMachine)
    setTimeSlots(slots)
  }, [selectedDate, selectedMachine])

  // Navigate date
  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() - 1)
    setSelectedDate(newDate)
  }

  const goToNextDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + 1)
    setSelectedDate(newDate)
  }

  // Get booking color
  const getBookingColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-300'
      case 'active':
        return 'bg-yellow-300'
      case 'rejected':
        return 'bg-red-300'
      default:
        return 'bg-blue-200'
    }
  }

  // Check if booking overlaps with slot
  const getBookingAtTime = (slotStart, slotEnd) => {
    return mockSchedule.find(booking => {
      if (booking.machineId !== selectedMachine) return false
      if (booking.startTime.toDateString() !== slotStart.toDateString()) return false
      return booking.startTime < slotEnd && booking.endTime > slotStart
    })
  }

  const timeStickPosition = getTimeStickPosition()
  const isToday = selectedDate.toDateString() === new Date().toDateString()

  return (
    <div className="min-h-screen bg-[#f4f0ea] pb-32">
      {/* TAB 1: HOME */}
      {activeTab === 'home' && (
        <div className="p-6">
          <div className="max-w-2xl mx-auto">
            {/* Welcome Header */}
            <div className="border-4 border-black p-8 bg-yellow-200 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-8 text-center">
              <h1 className="text-4xl font-black tracking-tight mb-2">WASH STATS</h1>
              <p className="font-bold">Welcome, {userProfile?.full_name || user?.email}!</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Total Washes Card */}
              <div className="border-4 border-black p-8 bg-green-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <p className="font-bold text-sm mb-2">TOTAL WASHES</p>
                <div className="text-5xl font-black tracking-tight">12</div>
                <p className="text-xs font-bold mt-2">Last 30 days</p>
              </div>

              {/* Next Wash Card */}
              <div className="border-4 border-black p-8 bg-blue-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <p className="font-bold text-sm mb-2">NEXT WASH</p>
                <div className="text-2xl font-black tracking-tight mb-1">TODAY, 4:00 PM</div>
                <p className="text-xs font-bold">Machine 2 • 35 min</p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="border-4 border-black p-6 bg-pink-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="text-xl font-black mb-4 tracking-tight">STREAK</h2>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black">3</span>
                <span className="font-bold">weeks on schedule 🔥</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SCHEDULE */}
      {activeTab === 'schedule' && (
        <div className="p-6">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="border-4 border-black p-6 bg-blue-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-6">
              <h2 className="text-3xl font-black tracking-tight mb-4">SCHEDULE</h2>

              {/* Date Navigation */}
              <div className="flex items-center justify-between gap-4 mb-6">
                <button
                  onClick={goToPreviousDay}
                  className="border-4 border-black px-4 py-2 bg-white font-black hover:bg-gray-100"
                >
                  ← PREV
                </button>
                <div className="border-4 border-black px-6 py-2 bg-white font-black text-center flex-1">
                  {formatDate(selectedDate)}
                </div>
                <button
                  onClick={goToNextDay}
                  className="border-4 border-black px-4 py-2 bg-white font-black hover:bg-gray-100"
                >
                  NEXT →
                </button>
              </div>

              {/* Machine Selector */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedMachine(1)}
                  className={`border-4 border-black p-3 font-black ${selectedMachine === 1
                      ? 'bg-green-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                      : 'bg-white hover:bg-gray-100'
                    }`}
                >
                  🔧 MACHINE 1 (40 min)
                </button>
                <button
                  onClick={() => setSelectedMachine(2)}
                  className={`border-4 border-black p-3 font-black ${selectedMachine === 2
                      ? 'bg-green-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                      : 'bg-white hover:bg-gray-100'
                    }`}
                >
                  🔧 MACHINE 2 (35 min)
                </button>
              </div>
            </div>

            {/* Time Grid */}
            <div className="border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
              {/* Time scale */}
              <div className="flex">
                {/* Hour labels column */}
                <div className="w-16 border-r-4 border-black bg-gray-100">
                  {Array.from({ length: 16 }).map((_, i) => {
                    const hour = 6 + i
                    if (hour >= 22) return null
                    return (
                      <div
                        key={hour}
                        className="h-16 border-b-2 border-gray-300 flex items-start justify-center pt-1 font-black text-xs"
                      >
                        {String(hour).padStart(2, '0')}:00
                      </div>
                    )
                  })}
                </div>

                {/* Slots grid */}
                <div className="flex-1 relative">
                  {/* Hour dividers */}
                  {Array.from({ length: 16 }).map((_, i) => {
                    const hour = 6 + i
                    if (hour >= 22) return null
                    return (
                      <div
                        key={`divider-${hour}`}
                        className="absolute w-full h-16 border-b-2 border-gray-300"
                        style={{ top: `${i * 64}px` }}
                      />
                    )
                  })}

                  {/* Time stick (current time indicator) */}
                  {isToday && timeStickPosition !== null && (
                    <div
                      className="absolute left-0 right-0 z-10 flex items-center"
                      style={{ top: `${timeStickPosition}%` }}
                    >
                      <div className="w-3 h-3 bg-red-500 border-2 border-black rounded-full" />
                      <div className="flex-1 h-1 bg-red-500 border-t-2 border-red-600" />
                    </div>
                  )}

                  {/* Slots */}
                  <div className="relative">
                    {timeSlots.map(slot => {
                      const booking = getBookingAtTime(slot.startTime, slot.endTime)
                      const isPast = isSlotInPast(slot.startTime) && isToday
                      const isBooked = !!booking

                      const minutesSinceStart = (slot.startTime.getHours() - 6) * 60 + slot.startTime.getMinutes()
                      const topPercent = (minutesSinceStart / (16 * 60)) * 100
                      const slotDuration = slot.endTime.getMinutes() - slot.startTime.getMinutes()
                      const heightPercent = (slotDuration / (16 * 60)) * 100

                      return (
                        <div
                          key={slot.id}
                          className={`absolute left-2 right-2 border-4 border-black flex flex-col items-center justify-center cursor-pointer transition-all ${isBooked
                              ? getBookingColor(booking.status) + ' shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                              : isPast
                                ? 'bg-gray-200 border-dashed opacity-50 cursor-not-allowed'
                                : 'bg-white border-dashed hover:bg-yellow-100'
                            }`}
                          style={{
                            top: `${topPercent}%`,
                            height: `${heightPercent}%`,
                            minHeight: '40px',
                          }}
                        >
                          <div className="text-xs font-black text-center">
                            {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                          </div>
                          {isBooked && (
                            <div className="text-xs font-bold mt-1 bg-white px-2 py-1 border border-black rounded">
                              {booking.status.toUpperCase()}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
              <div className="border-2 border-black p-3 bg-green-300 font-bold text-xs text-center">
                ✓ COMPLETED
              </div>
              <div className="border-2 border-black p-3 bg-yellow-300 font-bold text-xs text-center">
                ◉ ACTIVE
              </div>
              <div className="border-2 border-black p-3 bg-gray-200 font-bold text-xs text-center">
                ⊘ PAST
              </div>
              <div className="border-2 border-black p-3 bg-white border-dashed font-bold text-xs text-center">
                ◯ AVAILABLE
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PROFILE */}
      {activeTab === 'profile' && (
        <div className="p-6">
          <div className="max-w-lg mx-auto">
            {/* Profile Card */}
            <div className="border-4 border-black p-8 bg-cyan-300 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-8">
              <div className="text-center">
                <div className="text-6xl mb-4">👤</div>
                <h2 className="text-2xl font-black tracking-tight mb-2">
                  {userProfile?.full_name || 'User'}
                </h2>
                <p className="font-bold mb-4 text-sm">{user?.email}</p>
                <div className="border-2 border-black px-4 py-2 bg-white inline-block font-black">
                  RESIDENT
                </div>
              </div>
            </div>

            {/* Info Cards */}
            <div className="space-y-4 mb-8">
              <div className="border-4 border-black p-6 bg-blue-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <p className="font-bold text-sm mb-1">ROLE</p>
                <p className="text-lg font-black">Resident</p>
              </div>
              <div className="border-4 border-black p-6 bg-green-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <p className="font-bold text-sm mb-1">STATUS</p>
                <p className="text-lg font-black">✓ Approved</p>
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={signOut}
              className="w-full border-4 border-black p-6 bg-red-400 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] font-black text-xl tracking-tight hover:bg-red-500 active:translate-x-1 active:translate-y-1 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              SIGN OUT
            </button>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 border-t-4 border-black bg-[#f4f0ea] shadow-[0px_-4px_0px_0px_rgba(0,0,0,1)]">
        <div className="max-w-6xl mx-auto px-4 py-2 grid grid-cols-3 gap-2">
          <button
            onClick={() => setActiveTab('home')}
            className={`border-4 border-black p-4 font-black tracking-tight transition-all ${activeTab === 'home'
                ? 'bg-yellow-200 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] translate-y-1'
                : 'bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100'
              }`}
          >
            📊 HOME
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`border-4 border-black p-4 font-black tracking-tight transition-all ${activeTab === 'schedule'
                ? 'bg-yellow-200 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] translate-y-1'
                : 'bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100'
              }`}
          >
            📅 SCHEDULE
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`border-4 border-black p-4 font-black tracking-tight transition-all ${activeTab === 'profile'
                ? 'bg-yellow-200 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] translate-y-1'
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

export default ResidentDashboard
