import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

import { AlertPopup } from './AlertPopup'
import { supabase } from '../lib/supabaseClient'

export function MachineManager({ pgId }) {
  const [machines, setMachines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Form state
  const [machineNumber, setMachineNumber] = useState('')
  const [cycleDuration, setCycleDuration] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Modals state
  const [machineToDelete, setMachineToDelete] = useState(null)
  const [alertMessage, setAlertMessage] = useState('')
  
  // Maintenance State
  const [maintenanceModal, setMaintenanceModal] = useState(null)
  const [maintenanceEta, setMaintenanceEta] = useState('')

  // Fetch machines on component mount or when pgId changes
  useEffect(() => {
    if (pgId) {
      fetchMachines()
    }
  }, [pgId])

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
    } catch (err) {
      console.error('Error fetching machines:', err)
      setError('Failed to load machines.')
    } finally {
      setLoading(false)
    }
  }

  const handleAddMachine = async (e) => {
    e.preventDefault()

    if (!machineNumber.trim() || !cycleDuration.trim()) {
      setAlertMessage('Please fill in all fields.')
      return
    }

    try {
      setSubmitting(true)

      const { data, error: insertError } = await supabase
        .from('machines')
        .insert([
          {
            pg_id: pgId,
            machine_number: machineNumber.trim(),
            cycle_duration: parseInt(cycleDuration, 10),
            status: 'free'
          }
        ])
        .select()

      if (insertError) throw insertError

      setMachines((prev) => [...prev, data[0]].sort((a, b) => parseInt(a.machine_number) - parseInt(b.machine_number)))

      setMachineNumber('')
      setCycleDuration('')
    } catch (err) {
      console.error('Error adding machine:', err)
      setAlertMessage('Failed to add machine.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteMachine = (machineId) => {
    setMachineToDelete(machineId)
  }

  const confirmDeleteMachine = async () => {
    if (!machineToDelete) return

    try {
      setSubmitting(true) 
      const { error: deleteError } = await supabase
        .from('machines')
        .delete()
        .eq('id', machineToDelete)

      if (deleteError) throw deleteError

      setMachines((prev) => prev.filter((m) => m.id !== machineToDelete))
      setMachineToDelete(null) 
    } catch (err) {
      console.error('Error deleting machine:', err)
      setAlertMessage('Failed to delete machine.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async (machineId, currentStatus) => {
    if (currentStatus === 'occupied') {
      setAlertMessage('This machine is currently running a wash cycle. You cannot put it in maintenance right now.')
      return
    }

    const nextStatus = currentStatus === 'free' ? 'out_of_order' : 'free'

    if (nextStatus === 'out_of_order') {
      setMaintenanceEta('') // Reset time input
      setMaintenanceModal({ machineId })
      return
    }

    try {
      const { error: updateError } = await supabase
        .from('machines')
        .update({
          status: nextStatus,
          maintenance_eta: null
        })
        .eq('id', machineId)

      if (updateError) throw updateError

      setMachines((prev) =>
        prev.map((m) => (m.id === machineId ? { ...m, status: nextStatus, maintenance_eta: null } : m))
      )
    } catch (err) {
      console.error('Error updating machine status:', err)
      setAlertMessage('Failed to update machine status.')
    }
  }

  // Helper to format the relative time string
  const formatEta = (timeString) => {
    if (!timeString || !timeString.trim()) {
      return 'Maintenance in progress. Check back later.'
    }
    return `Expected Fix: ${timeString.trim()}`
  }

  const confirmBreakdown = async () => {
    if (!maintenanceModal) return

    const formattedMessage = formatEta(maintenanceEta)

    try {
      setSubmitting(true)

      // Step 1: Mark machine as out of order
      const { error: updateError } = await supabase
        .from('machines')
        .update({
          status: 'out_of_order',
          maintenance_eta: formattedMessage
        })
        .eq('id', maintenanceModal.machineId)

      if (updateError) throw updateError

      // Step 2: Instantly cancel all future scheduled washes for this machine
      const { error: cancelError } = await supabase
        .from('schedule')
        .update({ status: 'cancelled' })
        .eq('machine_id', maintenanceModal.machineId)
        .eq('status', 'scheduled')
        .gte('start_time', new Date().toISOString())

      if (cancelError) throw cancelError

      setMachines((prev) =>
        prev.map((m) =>
          m.id === maintenanceModal.machineId
            ? { ...m, status: 'out_of_order', maintenance_eta: formattedMessage }
            : m
        )
      )
      setMaintenanceModal(null)
      setMaintenanceEta('')
    } catch (err) {
      console.error('Error updating machine status:', err)
      setAlertMessage('Failed to update machine status.')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'free':
        return 'bg-green-200'
      case 'occupied':
        return 'bg-yellow-200'
      case 'out_of_order':
        return 'bg-red-200'
      default:
        return 'bg-gray-200'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'free':
        return '✓ Free'
      case 'occupied':
        return '⏳ Occupied'
      case 'out_of_order':
        return '🔨 Out of Order'
      default:
        return status
    }
  }

  if (!pgId) {
    return null
  }

  return (
    <>
      <AlertPopup message={alertMessage} onClose={() => setAlertMessage('')} />

      {/* DELETE MACHINE MODAL */}
      {machineToDelete && createPortal(
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm mb-0">
          <div className="border-4 border-black p-6 sm:p-8 bg-red-400 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-w-sm w-full text-center">
            <div className="text-5xl mb-4">🧨</div>
            <h3 className="text-3xl font-black mb-4 uppercase tracking-tight text-white">NUKE IT?</h3>
            <p className="font-bold mb-8 text-sm sm:text-base leading-snug text-white">
              Are you sure you want to permanently delete this machine? This will instantly wipe out any bookings tied to it!
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setMachineToDelete(null)}
                disabled={submitting}
                className="w-full border-4 border-black py-4 bg-white font-black hover:bg-gray-100 active:translate-y-1 active:translate-x-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-lg"
              >
                NEVERMIND, KEEP IT
              </button>
              <button
                onClick={confirmDeleteMachine}
                disabled={submitting}
                className="w-full border-4 border-black py-4 bg-black font-black hover:bg-gray-800 active:translate-y-1 active:translate-x-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-lg disabled:opacity-50 text-white"
              >
                {submitting ? 'DELETING...' : 'YES, DESTROY IT'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MAINTENANCE ETA MODAL */}
      {maintenanceModal && createPortal(
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm mb-0">
          <div className="border-4 border-black p-6 sm:p-8 bg-red-500 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-w-md w-full">
            <div className="text-5xl mb-2 text-center">🚧</div>
            <h3 className="text-3xl font-black mb-4 uppercase tracking-tight text-white text-center">REPORT BREAKDOWN</h3>

            {/* Warning Box */}
            <div className="bg-white border-4 border-black p-3 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <p className="font-bold text-sm text-black leading-snug">
                ⚠️ <span className="font-black text-red-600 uppercase">Warning:</span> Marking this machine as Out of Order will instantly cancel all future scheduled washes for it.
              </p>
            </div>

            <label className="block font-black mb-2 text-[10px] sm:text-xs tracking-tight uppercase text-white">
              How much time until it's fixed?
            </label>
            <input
              type="text"
              value={maintenanceEta}
              onChange={(e) => setMaintenanceEta(e.target.value)}
              placeholder="e.g., 2 hours, 1 day, etc."
              className="w-full border-4 border-black p-3 mb-6 font-black text-sm sm:text-base bg-white focus:outline-none focus:ring-2 focus:ring-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              autoFocus
            />

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setMaintenanceModal(null)
                  setMaintenanceEta('')
                }}
                disabled={submitting}
                className="w-full border-4 border-black py-4 bg-white font-black hover:bg-gray-100 active:translate-y-1 active:translate-x-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-base disabled:opacity-50"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={confirmBreakdown}
                disabled={submitting}
                className="w-full border-4 border-black py-4 bg-black font-black hover:bg-gray-800 active:translate-y-1 active:translate-x-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-base disabled:opacity-50 text-white"
              >
                {submitting ? 'CONFIRMING...' : 'CONFIRM BREAKDOWN'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="border-4 border-black p-4 sm:p-6 bg-cyan-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-8">

        {/* Add Machine Form Section */}
        <div className="mb-8 border-b-4 border-black pb-8">
          <h2 className="text-xl sm:text-2xl font-black mb-4 tracking-tight">ADD NEW MACHINE</h2>

          <form onSubmit={handleAddMachine} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">

              {/* Machine Number - Full width on mobile, 1/3 on desktop */}
              <div className="w-full sm:w-1/3">
                <label className="block font-black mb-1 text-[10px] sm:text-xs tracking-tight uppercase">Machine No.</label>
                <input
                  type="text"
                  value={machineNumber}
                  onChange={(e) => setMachineNumber(e.target.value)}
                  placeholder="e.g., M-001"
                  className="w-full border-4 border-black p-2 font-bold text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              {/* Side-by-Side Grid for mobile (Cycle) */}
              <div className="w-full sm:w-2/3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black mb-1 text-[10px] sm:text-xs tracking-tight uppercase">Cycle (mins)</label>
                  <input
                    type="number"
                    value={cycleDuration}
                    onChange={(e) => setCycleDuration(e.target.value)}
                    placeholder="45"
                    min="1"
                    className="w-full border-4 border-black p-2 font-bold text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full border-4 border-black p-3 mt-1 bg-lime-300 font-black text-sm sm:text-base shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-lime-400 active:translate-y-1 active:translate-x-1 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '⏳ ADDING...' : '➕ ADD MACHINE'}
            </button>
          </form>
        </div>

        {/* Machine Roster Section */}
        <div>
          <h2 className="text-xl sm:text-2xl font-black mb-4 tracking-tight">MACHINE ROSTER</h2>

          {loading ? (
            <div className="text-center p-6 border-4 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-sm sm:text-base font-bold">⏳ Loading machines...</p>
            </div>
          ) : error ? (
            <div className="text-center p-6 border-4 border-black bg-red-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-sm sm:text-base font-bold text-red-700">{error}</p>
            </div>
          ) : machines.length === 0 ? (
            <div className="text-center p-6 border-4 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-sm sm:text-base font-bold">No machines yet. Add one above!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {machines.map((machine) => (
                <div
                  key={machine.id}
                  className={`border-4 border-black p-4 sm:p-5 ${getStatusColor(machine.status)} shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col`}
                >
                  <div className="mb-4 flex-1">
                    <h3 className="text-xl sm:text-2xl font-black mb-2 tracking-tight">{machine.machine_number}</h3>
                    <div className="space-y-1 font-bold text-xs sm:text-sm">
                      <p>⏱️ Cycle: {machine.cycle_duration} mins</p>
                      <p className="pt-2 text-base font-black">{getStatusLabel(machine.status)}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleStatus(machine.id, machine.status)}
                      disabled={machine.status === 'occupied'}
                      className={`flex-1 border-4 border-black p-2 font-black text-[10px] sm:text-xs transition-all ${machine.status === 'occupied'
                        // LOCKED STATE: Flat, gray, unclickable
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none translate-x-1 translate-y-1'
                        // ACTIVE STATE: Standard neo-brutalist blue
                        : 'bg-blue-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-blue-400 active:translate-y-1 active:translate-x-1 active:shadow-none'
                        }`}
                    >
                      {machine.status === 'occupied' ? '🔒 LOCKED (IN USE)' : 'TOGGLE USABILITY'}
                    </button>
                    <button
                      onClick={() => handleDeleteMachine(machine.id)}
                      className="flex-1 border-4 border-black p-2 bg-red-300 font-black text-[10px] sm:text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-red-400 active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
                    >
                      DELETE
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}