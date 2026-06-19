import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

export function ScheduleView({ user, pgId }) {
    const [selectedDate, setSelectedDate] = useState(() => new Date())
    const [machines, setMachines] = useState([])
    const [selectedMachine, setSelectedMachine] = useState(null)
    const [bookings, setBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [currentTime, setCurrentTime] = useState(new Date())
    const [inserting, setInserting] = useState(false)
    const [error, setError] = useState(null)
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)

    // NEW STATE: Tracks which booking we are trying to delete for the modal
    const [bookingToDelete, setBookingToDelete] = useState(null)

    const scrollContainerRef = useRef(null)

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date())
        }, 60000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        if (pgId) {
            fetchMachines()
        }
    }, [pgId])

    useEffect(() => {
        if (selectedMachine) {
            fetchBookings()
        }
    }, [selectedMachine, selectedDate])

    useEffect(() => {
        const isToday = selectedDate.toDateString() === new Date().toDateString()
        if (isToday && scrollContainerRef.current) {
            const currentMin = (new Date().getHours() * 60) + new Date().getMinutes()
            scrollContainerRef.current.scrollTop = Math.max(0, currentMin - 60)
        } else if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0
        }
    }, [selectedDate, machines])

    const fetchMachines = async () => {
        try {
            setLoading(true)
            setError(null)

            const { data, error: fetchError } = await supabase
                .from('machines')
                .select('*')
                .eq('pg_id', pgId)
                .order('machine_number', { ascending: true })

            if (fetchError) throw fetchError

            setMachines(data || [])
            if (data && data.length > 0) {
                setSelectedMachine(data[0])
            }
        } catch (err) {
            console.error('Error fetching machines:', err)
            setError('Failed to load machines.')
        } finally {
            setLoading(false)
        }
    }

    const fetchBookings = async () => {
        try {
            if (!selectedMachine) return

            const { data, error: fetchError } = await supabase
                .from('schedule')
                .select('*, profiles(full_name)')
                .eq('machine_id', selectedMachine.id)

            if (fetchError) throw fetchError

            setBookings(data || [])
        } catch (err) {
            console.error('Error fetching bookings:', err)
            setError('Failed to load bookings.')
        }
    }

    const generateSlots = () => {
        if (!selectedMachine) return []

        const slots = []
        const cycleDuration = selectedMachine.cycle_duration
        const bufferTime = 10
        const slotDuration = cycleDuration + bufferTime
        let currentMinute = 0

        while (currentMinute < 1440) {
            const startMinute = currentMinute
            const endMinute = currentMinute + cycleDuration

            slots.push({
                id: `slot-${startMinute}`,
                startMinute,
                endMinute,
                cycleDuration
            })

            currentMinute += slotDuration
        }

        return slots
    }

    const getBookingForSlot = (slot) => {
        return bookings.find((booking) => {
            const bookingDate = new Date(booking.start_time).toDateString()
            const selectedDateStr = selectedDate.toDateString()

            if (bookingDate !== selectedDateStr) return false

            const bookingStartMinute = (new Date(booking.start_time).getHours() * 60) + new Date(booking.start_time).getMinutes()
            const bookingEndMinute = (new Date(booking.end_time).getHours() * 60) + new Date(booking.end_time).getMinutes()

            return !(slot.endMinute <= bookingStartMinute || slot.startMinute >= bookingEndMinute)
        })
    }

    const isSlotPast = (slot) => {
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const checkDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())

        if (checkDate < today) return true
        if (checkDate > today) return false

        const currentMinute = (now.getHours() * 60) + now.getMinutes()
        return slot.startMinute <= currentMinute
    }

    const handleSlotClick = async (slot) => {
        const booking = getBookingForSlot(slot)
        if (booking || isSlotPast(slot) || inserting) return

        try {
            setInserting(true)

            const startDateTime = new Date(selectedDate)
            startDateTime.setHours(0, 0, 0, 0)
            startDateTime.setMinutes(slot.startMinute)

            const endDateTime = new Date(startDateTime)
            endDateTime.setMinutes(endDateTime.getMinutes() + selectedMachine.cycle_duration)

            const { error: insertError } = await supabase
                .from('schedule')
                .insert([
                    {
                        machine_id: selectedMachine.id,
                        resident_id: user.id,
                        start_time: startDateTime.toISOString(),
                        end_time: endDateTime.toISOString(),
                        status: 'scheduled'
                    }
                ])

            if (insertError) throw insertError

            await fetchBookings()
        } catch (err) {
            console.error('Error booking slot:', err)
            alert('Failed to book slot.')
        } finally {
            setInserting(false)
        }
    }

    // UPDATED CANCEL FUNCTION: Triggers the modal instead of window.confirm
    const requestCancelBooking = (e, bookingId) => {
        e.stopPropagation() // Stop the slot from trying to click
        setBookingToDelete(bookingId) // Opens the modal
    }

    // NEW FUNCTION: Actually deletes the booking when "YES" is clicked
    const confirmCancelBooking = async () => {
        if (!bookingToDelete) return

        try {
            setInserting(true)
            const { error: deleteError } = await supabase
                .from('schedule')
                .delete()
                .eq('id', bookingToDelete)

            if (deleteError) throw deleteError
            await fetchBookings()
            setBookingToDelete(null) // Close the modal on success
        } catch (err) {
            console.error('Error canceling booking:', err)
            alert('Failed to cancel wash.')
        } finally {
            setInserting(false)
        }
    }

    const formatMinutes = (minutes) => {
        const hours = Math.floor(minutes / 60)
        const mins = minutes % 60
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
    }

    const formatDate = (date) => {
        const today = new Date()
        const isToday = date.toDateString() === today.toDateString()

        if (isToday) return 'TODAY'

        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const isTomorrow = date.toDateString() === tomorrow.toDateString()

        if (isTomorrow) return 'TOMORROW'

        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
    }

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

    const isToday = selectedDate.toDateString() === new Date().toDateString()
    const currentMinute = isToday ? (currentTime.getHours() * 60) + currentTime.getMinutes() : -1

    const slots = generateSlots()

    if (loading) {
        return (
            <div className="border-4 border-black p-8 bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-xl font-black">⏳ Loading schedule...</p>
            </div>
        )
    }

    if (machines.length === 0) {
        return (
            <div className="border-4 border-black p-8 bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-xl font-black">No machines available. Ask your PG owner to add machines.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 relative">

            {/* RETRO CONFIRMATION MODAL */}
            {bookingToDelete && (
                <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 backdrop-blur-sm mb-0">
                    <div className="border-4 border-black p-6 sm:p-8 bg-yellow-200 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-w-sm w-full text-center">
                        <div className="text-5xl mb-4">⚠️</div>
                        <h3 className="text-3xl font-black mb-4 uppercase tracking-tight">Hold Up!</h3>
                        <p className="font-bold mb-8 text-sm sm:text-base leading-snug">
                            Are you absolutely sure you want to cancel this wash? Someone else might steal your spot!
                        </p>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => setBookingToDelete(null)}
                                className="w-full border-4 border-black py-4 bg-white font-black hover:bg-gray-100 active:translate-y-1 active:translate-x-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-lg"
                            >
                                NEVERMIND, KEEP IT
                            </button>
                            <button
                                onClick={confirmCancelBooking}
                                disabled={inserting}
                                className="w-full border-4 border-black py-4 bg-red-400 font-black hover:bg-red-500 active:translate-y-1 active:translate-x-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-lg disabled:opacity-50"
                            >
                                {inserting ? 'DELETING...' : 'YES, DELETE IT'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header - Compact Version */}
            {/* Header - Compact Version with Retro Custom Dropdown */}
            <div className="border-4 border-black p-3 sm:p-4 bg-blue-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative z-50">
                <div className="flex justify-between items-center gap-2 mb-3">
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight m-0 leading-none">
                        SCHEDULE
                    </h2>

                    {/* CUSTOM RETRO DROPDOWN */}
                    <div className="relative">
                        {/* The visible button */}
                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="border-4 border-black p-1 sm:p-2 font-bold bg-white focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs sm:text-sm min-w-[140px] flex justify-between items-center gap-2 active:translate-y-[1px] active:translate-x-[1px] active:shadow-none transition-all"
                        >
                            <span>
                                {selectedMachine
                                    ? `${selectedMachine.machine_number} (${selectedMachine.cycle_duration}m)`
                                    : 'SELECT MACHINE'}
                            </span>
                            <span className="text-[10px] font-black">▼</span>
                        </button>

                        {/* The dropdown menu */}
                        {isDropdownOpen && (
                            <div className="absolute right-0 top-full mt-2 w-max min-w-full border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col z-[100]">
                                {machines.map((machine) => (
                                    <button
                                        key={machine.id}
                                        onClick={() => {
                                            setSelectedMachine(machine)
                                            setIsDropdownOpen(false)
                                        }}
                                        className={`text-left p-3 font-bold text-xs sm:text-sm border-b-4 border-black last:border-b-0 hover:bg-yellow-200 transition-colors ${selectedMachine?.id === machine.id ? 'bg-cyan-200' : 'bg-white'
                                            }`}
                                    >
                                        {machine.machine_number} ({machine.cycle_duration}m)
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                    <button
                        onClick={goToPreviousDay}
                        className="border-4 border-black px-2 py-1 bg-white font-black hover:bg-gray-100 active:translate-y-1 active:translate-x-1 transition-all text-xs sm:text-sm"
                    >
                        ← PREV
                    </button>
                    <div className="border-4 border-black px-2 py-1 bg-white font-black text-center flex-1 text-xs sm:text-sm">
                        {formatDate(selectedDate)}
                    </div>
                    <button
                        onClick={goToNextDay}
                        className="border-4 border-black px-2 py-1 bg-white font-black hover:bg-gray-100 active:translate-y-1 active:translate-x-1 transition-all text-xs sm:text-sm"
                    >
                        NEXT →
                    </button>
                </div>
            </div>

            {error && (
                <div className="border-4 border-black p-4 bg-red-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <p className="font-black text-red-800">{error}</p>
                </div>
            )}

            {/* 1440px Calendar Grid */}
            <div className="border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex overflow-hidden relative">

                <div className="w-14 sm:w-16 bg-gray-100 shrink-0">
                    {Array.from({ length: 24 }).map((_, hour) => (
                        <div
                            key={`label-${hour}`}
                            className="h-[60px] border-b-2 border-r-4 border-gray-300 border-r-black flex items-start justify-center pt-1 font-black text-[10px] sm:text-xs"
                        >
                            {String(hour).padStart(2, '0')}:00
                        </div>
                    ))}
                </div>

                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto relative scroll-smooth"
                >
                    <div className="relative w-full h-[1440px]">

                        {Array.from({ length: 24 }).map((_, hour) => (
                            <div
                                key={`divider-${hour}`}
                                className="absolute w-full border-t-2 border-gray-200"
                                style={{ top: `${hour * 60}px` }}
                            />
                        ))}

                        {currentMinute >= 0 && (
                            <div
                                className="absolute w-full z-50 flex items-center pointer-events-none"
                                style={{ top: `${currentMinute}px` }}
                            >
                                <div className="w-2 h-2 rounded-full bg-red-500 absolute -left-1"></div>
                                <div className="w-full border-t-2 border-red-500 shadow-[0_0_4px_rgba(239,68,68,0.8)]" />
                            </div>
                        )}

                        {/* Booking slots */}
                        {slots.map((slot) => {
                            const booking = getBookingForSlot(slot)
                            const isBooked = !!booking
                            const isPast = isSlotPast(slot)
                            const isAvailable = !isBooked && !isPast

                            let bgColor = 'bg-white'
                            let borderStyle = 'border-4 border-dashed border-black'
                            let textColor = 'text-black'
                            let cursor = 'cursor-pointer'
                            let hoverClass = 'hover:bg-cyan-100 hover:border-solid hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all'

                            if (isPast && !isBooked) {
                                bgColor = 'bg-gray-200'
                                borderStyle = 'border-2 border-black opacity-60'
                                textColor = 'text-gray-600'
                                cursor = 'cursor-not-allowed'
                                hoverClass = ''
                            } else if (isBooked) {
                                const status = booking.status || 'scheduled'
                                if (status === 'scheduled') bgColor = 'bg-blue-300'
                                if (status === 'active') bgColor = 'bg-yellow-300'
                                if (status === 'completed') bgColor = 'bg-green-300'

                                borderStyle = 'border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                                textColor = 'text-black'
                                cursor = 'cursor-not-allowed'
                                hoverClass = ''
                            }

                            return (
                                <div
                                    key={slot.id}
                                    onClick={() => handleSlotClick(slot)}
                                    className={`absolute left-2 right-2 ${bgColor} ${borderStyle} ${cursor} ${hoverClass} p-0 flex items-center overflow-hidden z-10`}
                                    style={{
                                        top: `${slot.startMinute}px`,
                                        height: `${slot.cycleDuration}px`
                                    }}
                                >
                                    <div className={`font-black text-[10px] sm:text-xs leading-none w-full px-2 flex flex-row items-center ${isBooked ? 'justify-between' : 'justify-center'} gap-2 h-full relative`}>

                                        <div className={`whitespace-nowrap ${isBooked ? 'opacity-80' : ''}`}>
                                            {`${formatMinutes(slot.startMinute)} - ${formatMinutes(slot.endMinute)}`}
                                        </div>

                                        {isPast && !isBooked && <span>(PAST)</span>}

                                        {isBooked && (
                                            <div className="flex flex-1 justify-end items-center gap-2 pr-5 sm:pr-6 overflow-hidden">
                                                <span className="bg-white px-1 py-0.5 border-2 border-black tracking-wider uppercase text-[8px] sm:text-[9px] shrink-0">
                                                    {booking.status}
                                                </span>
                                                <span className="truncate max-w-[60px] sm:max-w-[100px]">
                                                    {booking.profiles?.full_name?.split(' ')[0] || 'Resident'}
                                                </span>
                                            </div>
                                        )}

                                        {/* UPDATED: Delete Button calls requestCancelBooking */}
                                        {isBooked && booking.resident_id === user.id && booking.status === 'scheduled' && (
                                            <button
                                                onClick={(e) => requestCancelBooking(e, booking.id)}
                                                className="absolute right-1 top-1/2 -translate-y-1/2 bg-red-400 hover:bg-red-500 border-2 border-black w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all text-[8px] sm:text-[10px]"
                                                title="Cancel Wash"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mt-4">
                <div className="border-4 border-dashed border-black py-2 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <p className="font-black text-[10px] sm:text-xs text-center">AVAILABLE</p>
                </div>
                <div className="border-4 border-black py-2 bg-blue-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <p className="font-black text-[10px] sm:text-xs text-center">SCHEDULED</p>
                </div>
                <div className="border-4 border-black py-2 bg-green-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <p className="font-black text-[10px] sm:text-xs text-center">COMPLETED</p>
                </div>
                <div className="border-4 border-black py-2 bg-gray-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] opacity-60">
                    <p className="font-black text-[10px] sm:text-xs text-center">PAST</p>
                </div>
            </div>
        </div>
    )
}