import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { PullToRefresh } from './PullToRefresh'
import { createPortal } from 'react-dom'
import { AlertPopup } from './AlertPopup'

export function ScheduleView({ user, pgId }) {
    const [selectedDate, setSelectedDate] = useState(() => new Date())
    const [machines, setMachines] = useState([])
    const [selectedMachine, setSelectedMachine] = useState(null)
    const [bookings, setBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [currentTime, setCurrentTime] = useState(new Date())
    const [inserting, setInserting] = useState(false)
    const [error, setError] = useState(null)
    const [alertMessage, setAlertMessage] = useState('')

    // Modals state
    const [bookingToDelete, setBookingToDelete] = useState(null)
    const [selectedBooking, setSelectedBooking] = useState(null)

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
                .select('*, profiles(*)')
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

        while (currentMinute + cycleDuration <= 1440) {
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

        return (slot.startMinute + 5) <= currentMinute
    }

    const handleSlotClick = async (slot) => {
        const booking = getBookingForSlot(slot)

        if (booking) {
            // Check if they are clicking a cancelled slot
            if (booking.status === 'cancelled') {
                setAlertMessage("This wash was cancelled by the owner due to machine maintenance. No points were deducted.")
                return
            }
            // Otherwise, open the normal details modal
            setSelectedBooking({ booking, slot })
            return
        }

        // Hard block to prevent booking empty slots when broken
        if (selectedMachine?.status === 'out_of_order') {
            setAlertMessage("This machine is out of order. You cannot schedule new washes.")
            return
        }

        if (isSlotPast(slot) || inserting) return

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
            setAlertMessage("Failed to book slot.")
        } finally {
            setInserting(false)
        }
    }

    const handleFullRefresh = async () => {
        // Fetch both the machines and the bookings simultaneously
        await Promise.all([
            fetchMachines(),
            fetchBookings()
        ])
    }

    const requestCancelBooking = (e, bookingId) => {
        e.stopPropagation()
        setBookingToDelete(bookingId)
    }

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
            setBookingToDelete(null)
        } catch (err) {
            console.error('Error canceling booking:', err)
            setAlertMessage("Failed to cancel wash.")
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
                <p className="text-xl font-black">No machines available. Add machines in the dashboard.</p>
            </div>
        )
    }

    return (
        <PullToRefresh onRefresh={handleFullRefresh}>
            <AlertPopup
                message={alertMessage}
                onClose={() => setAlertMessage('')}
            />
            <div className="space-y-6 relative">

                {/* BOOKING DETAILS MODAL */}
                {selectedBooking && createPortal(
                    <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 backdrop-blur-sm mb-0">
                        <div className="border-4 border-black p-6 sm:p-8 bg-cyan-200 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-w-sm w-full relative">
                            <button
                                onClick={() => setSelectedBooking(null)}
                                className="absolute -top-4 -right-4 border-4 border-black w-10 h-10 bg-white font-black text-xl hover:bg-red-400 active:translate-y-1 active:translate-x-1 transition-all flex items-center justify-center z-10 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                            >
                                ✕
                            </button>

                            <div className="text-center mb-6 flex flex-col items-center">
                                <img
                                    src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${selectedBooking.booking.profiles?.full_name || 'Resident'}`}
                                    alt="User Avatar"
                                    className="w-18 h-18 sm:w-24 sm:h-24 border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-4 mt-8 sm:mt-4 object-contain"
                                />
                                <h3 className="text-2xl font-black uppercase tracking-tight truncate border-b-4 border-black pb-2 w-full">
                                    {selectedBooking.booking.profiles?.full_name || 'Resident'}
                                </h3>
                            </div>

                            <div className="space-y-4 mb-6 border-4 border-black p-4 bg-white">
                                <div>
                                    <p className="font-black text-[10px] text-gray-500 uppercase">Wash Block</p>
                                    <p className="font-bold text-lg">
                                        {formatMinutes(selectedBooking.slot.startMinute)} - {formatMinutes(selectedBooking.slot.endMinute)}
                                    </p>
                                </div>
                                <div>
                                    <p className="font-black text-[10px] text-gray-500 uppercase">Phone</p>
                                    <p className="font-bold text-lg">{selectedBooking.booking.profiles?.phone || 'N/A'}</p>
                                </div>
                                <div className="flex justify-between items-center bg-yellow-200 border-2 border-black p-2 mt-2">
                                    <p className="font-black text-[10px] uppercase">Current Wash Score</p>
                                    <p className="font-black text-xl">{selectedBooking.booking.profiles?.wash_score ?? 100}</p>
                                </div>

                                {/* SCORE PENALTY/REWARD BANNERS */}
                                {selectedBooking.booking.status === 'expired' && (
                                    <div className="bg-red-500 border-2 border-black p-2 mt-2 text-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                        <p className="font-black text-xs uppercase tracking-widest">Ghost Penalty Applied (-10)</p>
                                    </div>
                                )}
                                {selectedBooking.booking.status === 'completed' && (
                                    <div className="bg-green-400 border-2 border-black p-2 mt-2 text-center text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                        <p className="font-black text-xs uppercase tracking-widest">Wash Completed (+2)</p>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => setSelectedBooking(null)}
                                className="w-full border-4 border-black py-4 bg-white font-black hover:bg-gray-100 active:translate-y-1 active:translate-x-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-lg"
                            >
                                CLOSE DETAILS
                            </button>
                        </div>
                    </div>,
                    document.body
                )}

                {/* RETRO CONFIRMATION MODAL */}
                {bookingToDelete && createPortal(
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
                                    className="w-full border-4 border-black py-4 bg-red-400 font-black hover:bg-red-500 active:translate-y-1 active:translate-x-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-lg disabled:opacity-50 text-white"
                                >
                                    {inserting ? 'DELETING...' : 'YES, DELETE IT'}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* Header */}
                <div className="sticky top-0 z-[100] border-4 border-black p-3 sm:p-4 bg-blue-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="flex justify-between items-center gap-2 mb-3">
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight m-0 leading-none">
                            SCHEDULE
                        </h2>

                        <select
                            value={selectedMachine?.id || ''}
                            onChange={(e) => {
                                const machine = machines.find((m) => m.id === e.target.value)
                                setSelectedMachine(machine)
                            }}
                            className="border-4 border-black p-1 sm:p-2 font-bold bg-white focus:outline-none focus:ring-2 focus:ring-black cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs sm:text-sm max-w-[150px] sm:max-w-none"
                        >
                            {machines.map((machine) => (
                                <option key={machine.id} value={machine.id}>
                                    {machine.machine_number} ({machine.cycle_duration}m)
                                </option>
                            ))}
                        </select>
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

                    {selectedMachine?.status === 'out_of_order' && (
                        <div className="border-4 border-black bg-red-500 p-2 sm:p-3 mt-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-center text-center">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xl sm:text-2xl leading-none">🚧</span>
                                <span className="font-black text-lg sm:text-xl text-white uppercase tracking-widest leading-none">OUT OF ORDER</span>
                            </div>
                            <div className="bg-white border-2 border-black px-2 py-1 w-full max-w-sm">
                                <p className="font-black text-[9px] text-gray-500 uppercase tracking-widest leading-none mb-1">Owner Update</p>
                                <p className="font-bold text-xs sm:text-sm text-black uppercase leading-tight">
                                    {selectedMachine.maintenance_eta || "Maintenance in progress. Please check back later."}
                                </p>
                            </div>
                        </div>
                    )}
                </div>



                {error && (
                    <div className="border-4 border-black p-4 bg-red-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <p className="font-black text-red-800">{error}</p>
                    </div>
                )}

                {/* Calendar Grid */}
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

                            {slots.map((slot) => {
                                const booking = getBookingForSlot(slot)
                                const isBooked = !!booking
                                const isPast = isSlotPast(slot)

                                const isOwnerBooking = isBooked && booking.profiles?.role === 'owner'

                                let bgColor = 'bg-white'
                                let borderStyle = 'border-4 border-dashed border-black'
                                let cursor = 'cursor-pointer'
                                let hoverClass = 'hover:bg-cyan-100 hover:border-solid hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all'

                                if (isPast && !isBooked) {
                                    bgColor = 'bg-gray-200'
                                    borderStyle = 'border-2 border-black opacity-60'
                                    cursor = 'cursor-not-allowed'
                                    hoverClass = ''
                                }
                                else if (selectedMachine?.status === 'out_of_order' && !isBooked) {
                                    // NEW: Make empty slots look dead if machine is broken
                                    bgColor = 'bg-gray-100'
                                    borderStyle = 'border-4 border-dashed border-gray-400'
                                    cursor = 'cursor-not-allowed'
                                    hoverClass = ''
                                }
                                else if (isBooked) {
                                    const status = booking.status || 'scheduled'

                                    if (status === 'scheduled') bgColor = isOwnerBooking ? 'bg-purple-300' : 'bg-blue-300'
                                    if (status === 'active') bgColor = 'bg-yellow-300'
                                    if (status === 'completed') bgColor = 'bg-green-300'
                                    if (status === 'expired') bgColor = 'bg-red-300' // NEW: Expired styling

                                    if (status === 'cancelled') {
                                        bgColor = 'bg-gray-400'
                                        borderStyle = 'border-4 border-black'
                                        cursor = 'cursor-not-allowed'
                                    } else {
                                        borderStyle = 'border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                                        cursor = 'cursor-pointer'
                                        hoverClass = 'active:translate-y-[1px] active:translate-x-[1px] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all'
                                    }
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
                                                <div className="flex flex-1 justify-end items-center gap-1 sm:gap-2 pr-5 sm:pr-6 overflow-hidden">

                                                    {/* SCORE INDICATORS ON THE SCHEDULE BLOCKS */}
                                                    {booking.status === 'expired' && (
                                                        <span className="bg-red-600 text-white px-1 py-0.5 border-2 border-black tracking-wider text-[8px] sm:text-[9px] shrink-0 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]" title="Score Penalty">
                                                            -10
                                                        </span>
                                                    )}
                                                    {booking.status === 'completed' && (
                                                        <span className="bg-green-600 text-white px-1 py-0.5 border-2 border-black tracking-wider text-[8px] sm:text-[9px] shrink-0 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]" title="Score Reward">
                                                            +2
                                                        </span>
                                                    )}

                                                    <span className="bg-white px-1 py-0.5 border-2 border-black tracking-wider uppercase text-[8px] sm:text-[9px] shrink-0">
                                                        {booking.status}
                                                    </span>
                                                    <span className="truncate max-w-[60px] sm:max-w-[100px]">
                                                        {isOwnerBooking && '👑 '}
                                                        {booking.profiles?.full_name?.split(' ')[0] || 'Resident'}
                                                    </span>
                                                </div>
                                            )}

                                            {isBooked && booking.resident_id === user.id && booking.status === 'scheduled' && (
                                                <button
                                                    onClick={(e) => requestCancelBooking(e, booking.id)}
                                                    className="absolute right-1 top-1/2 -translate-y-1/2 bg-red-400 hover:bg-red-500 border-2 border-black w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all text-[8px] sm:text-[10px] text-white"
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

                {/* Legend - Updated with EXPIRED */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mt-4">
                    <div className="border-4 border-dashed border-black py-2 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <p className="font-black text-[9px] sm:text-[10px] text-center">AVAILABLE</p>
                    </div>
                    <div className="border-4 border-black py-2 bg-blue-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <p className="font-black text-[9px] sm:text-[10px] text-center">SCHEDULED</p>
                    </div>
                    <div className="border-4 border-black py-2 bg-purple-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <p className="font-black text-[9px] sm:text-[10px] text-center">OWNER</p>
                    </div>
                    <div className="border-4 border-black py-2 bg-green-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <p className="font-black text-[9px] sm:text-[10px] text-center">COMPLETED</p>
                    </div>
                    <div className="border-4 border-black py-2 bg-yellow-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <p className="font-black text-[9px] sm:text-[10px] text-center">ACTIVE</p>
                    </div>
                    <div className="border-4 border-black py-2 bg-gray-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <p className="font-black text-[9px] sm:text-[10px] text-center">CANCELLED</p>
                    </div>
                    <div className="border-4 border-black py-2 bg-red-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <p className="font-black text-[9px] sm:text-[10px] text-center">EXPIRED</p>
                    </div>
                    <div className="border-4 border-black py-2 bg-gray-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] opacity-60">
                        <p className="font-black text-[9px] sm:text-[10px] text-center">PAST</p>
                    </div>
                </div>
            </div>
        </PullToRefresh>
    )
}