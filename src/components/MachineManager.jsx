import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function MachineManager({ pgId }) {
  const [machines, setMachines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Form state
  const [machineNumber, setMachineNumber] = useState('')
  const [cycleDuration, setCycleDuration] = useState('')
  const [detergentType, setDetergentType] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
    
    if (!machineNumber.trim() || !cycleDuration.trim() || !detergentType.trim()) {
      alert('Please fill in all fields.')
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
            detergent_type: detergentType.trim(),
            status: 'free'
          }
        ])
        .select()

      if (insertError) throw insertError
      
      // Add new machine to state
      setMachines((prev) => [...prev, data[0]].sort((a, b) => parseInt(a.machine_number) - parseInt(b.machine_number)))
      
      // Reset form
      setMachineNumber('')
      setCycleDuration('')
      setDetergentType('')
    } catch (err) {
      console.error('Error adding machine:', err)
      alert('Failed to add machine.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteMachine = async (machineId) => {
    if (!confirm('Are you sure you want to delete this machine?')) return

    try {
      const { error: deleteError } = await supabase
        .from('machines')
        .delete()
        .eq('id', machineId)

      if (deleteError) throw deleteError
      
      setMachines((prev) => prev.filter((m) => m.id !== machineId))
    } catch (err) {
      console.error('Error deleting machine:', err)
      alert('Failed to delete machine.')
    }
  }

  const handleToggleStatus = async (machineId, currentStatus) => {
    const statuses = ['free', 'occupied', 'out_of_order']
    const currentIndex = statuses.indexOf(currentStatus)
    const nextStatus = statuses[(currentIndex + 1) % statuses.length]

    try {
      const { error: updateError } = await supabase
        .from('machines')
        .update({ status: nextStatus })
        .eq('id', machineId)

      if (updateError) throw updateError
      
      setMachines((prev) =>
        prev.map((m) => (m.id === machineId ? { ...m, status: nextStatus } : m))
      )
    } catch (err) {
      console.error('Error updating machine status:', err)
      alert('Failed to update machine status.')
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
    <div className="border-4 border-black p-8 bg-cyan-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-8">
      {/* Add Machine Form Section */}
      <div className="mb-12">
        <h2 className="text-3xl font-black mb-6 tracking-tight">ADD NEW MACHINE</h2>
        
        <form onSubmit={handleAddMachine} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-black mb-2">Machine Number</label>
              <input
                type="text"
                value={machineNumber}
                onChange={(e) => setMachineNumber(e.target.value)}
                placeholder="e.g., M-001"
                className="w-full border-4 border-black p-3 font-bold bg-white focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            
            <div>
              <label className="block font-black mb-2">Cycle Duration (mins)</label>
              <input
                type="number"
                value={cycleDuration}
                onChange={(e) => setCycleDuration(e.target.value)}
                placeholder="45"
                min="1"
                className="w-full border-4 border-black p-3 font-bold bg-white focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            
            <div>
              <label className="block font-black mb-2">Detergent Type</label>
              <input
                type="text"
                value={detergentType}
                onChange={(e) => setDetergentType(e.target.value)}
                placeholder="e.g., Liquid / Powder"
                className="w-full border-4 border-black p-3 font-bold bg-white focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={submitting}
            className="w-full border-4 border-black p-4 bg-lime-300 font-black text-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-lime-400 active:translate-y-1 active:translate-x-1 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '⏳ ADDING...' : '➕ ADD MACHINE'}
          </button>
        </form>
      </div>

      {/* Machine Roster Section */}
      <div>
        <h2 className="text-3xl font-black mb-6 tracking-tight">MACHINE ROSTER</h2>
        
        {loading ? (
          <div className="text-center p-8 border-4 border-black bg-white">
            <p className="text-xl font-bold">⏳ Loading machines...</p>
          </div>
        ) : error ? (
          <div className="text-center p-8 border-4 border-black bg-red-100">
            <p className="text-xl font-bold text-red-700">{error}</p>
          </div>
        ) : machines.length === 0 ? (
          <div className="text-center p-8 border-4 border-black bg-white">
            <p className="text-xl font-bold">No machines yet. Add one above!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {machines.map((machine) => (
              <div
                key={machine.id}
                className={`border-4 border-black p-6 ${getStatusColor(machine.status)} shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col`}
              >
                <div className="mb-4 flex-1">
                  <h3 className="text-2xl font-black mb-3 tracking-tight">{machine.machine_number}</h3>
                  <div className="space-y-2 font-bold text-sm">
                    <p>⏱️ Cycle: {machine.cycle_duration} mins</p>
                    <p>🧼 Detergent: {machine.detergent_type}</p>
                    <p className="pt-2 text-lg font-black">{getStatusLabel(machine.status)}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleStatus(machine.id, machine.status)}
                    className="flex-1 border-4 border-black p-2 bg-blue-300 font-black text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-blue-400 active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
                  >
                    CHANGE STATUS
                  </button>
                  <button
                    onClick={() => handleDeleteMachine(machine.id)}
                    className="flex-1 border-4 border-black p-2 bg-red-300 font-black text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-red-400 active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
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
  )
}
