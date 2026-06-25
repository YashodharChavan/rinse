import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { BottomNav } from '../components/BottomNav'

export function AdminPanel() {
  const { user, signOut } = useAuth()
  const [currentTab, setCurrentTab] = useState('home')
  
  // Real Dynamic States
  const [machines, setMachines] = useState([])
  const [totalResidents, setTotalResidents] = useState(0)
  const [loading, setLoading] = useState(true)

  const [showAddMachine, setShowAddMachine] = useState(false)
  const [newMachineName, setNewMachineName] = useState('')

  // Fetch REAL data from Supabase on load
  useEffect(() => {
    fetchAdminData()
  }, [])

  const fetchAdminData = async () => {
    try {
      setLoading(true)
      
      // 1. Fetch all machines for the list
      const { data: machineData, error: machineError } = await supabase
        .from('machines')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (machineError) throw machineError
      if (machineData) setMachines(machineData)

      // 2. Fetch total resident count across the whole app
      const { count: residentCount, error: residentError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'resident')

      if (residentError) throw residentError
      setTotalResidents(residentCount || 0)

    } catch (error) {
      console.error('Error fetching admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handle adding a machine directly to the database
  const handleAddMachine = async () => {
    if (!newMachineName.trim()) return
    
    try {
      // Note: You may need to assign a pg_id here depending on your schema rules for super-admins
      const { data, error } = await supabase
        .from('machines')
        .insert([{ machine_number: newMachineName }])
        .select()
        .single()

      if (error) throw error
      
      setMachines([...machines, data])
      setNewMachineName('')
      setShowAddMachine(false)
    } catch (error) {
      console.error('Error adding machine:', error)
      alert('Failed to add machine. Ensure it is linked to a PG.')
    }
  }

  // Handle removing a machine from the database
  const handleRemoveMachine = async (id) => {
    try {
      const { error } = await supabase
        .from('machines')
        .delete()
        .eq('id', id)

      if (error) throw error
      setMachines(machines.filter((m) => m.id !== id))
    } catch (error) {
      console.error('Error removing machine:', error)
    }
  }

  const handleSignOut = async () => {
    await signOut()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f0ea] flex items-center justify-center p-4">
        <h1 className="text-2xl font-black">LOADING ADMIN PANEL...</h1>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f4f0ea] pb-24">
      <div className="max-w-md mx-auto p-4">
        {/* Header */}
        <div className="border-4 border-black p-4 bg-purple-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-6">
          <h1 className="text-2xl font-black tracking-tight">ADMIN PANEL</h1>
          <p className="text-sm font-bold">{user?.email}</p>
        </div>

        {/* Stats Section - 100% REAL DATA */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="border-4 border-black p-4 bg-yellow-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-center">
            <p className="text-4xl font-black">{totalResidents}</p>
            <p className="text-xs font-black uppercase tracking-widest mt-1">Total Residents</p>
          </div>
          <div className="border-4 border-black p-4 bg-cyan-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-center">
            <p className="text-4xl font-black">{machines.length}</p>
            <p className="text-xs font-black uppercase tracking-widest mt-1">Total Machines</p>
          </div>
        </div>

        {/* Machines List Section */}
        <div className="border-4 border-black p-6 bg-blue-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-6">
          <h2 className="text-xl font-black mb-4 uppercase tracking-tight">Machine Registry</h2>
          
          <div className="space-y-3 mb-4 max-h-64 overflow-y-auto pr-2">
            {machines.length === 0 ? (
              <p className="font-bold text-center bg-white border-2 border-black p-4">No machines registered.</p>
            ) : (
              machines.map((machine) => (
                <div
                  key={machine.id}
                  className="border-2 border-black p-3 bg-white flex justify-between items-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  <p className="font-bold">Machine {machine.machine_number}</p>
                  <button
                    onClick={() => handleRemoveMachine(machine.id)}
                    className="border-2 border-black px-2 py-1 bg-red-300 font-bold hover:bg-red-400 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all text-sm"
                  >
                    ✕ DELETE
                  </button>
                </div>
              ))
            )}
          </div>

          {!showAddMachine ? (
            <button
              onClick={() => setShowAddMachine(true)}
              className="w-full border-4 border-black p-3 bg-green-300 font-black tracking-tight shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-green-400 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all uppercase"
            >
              + ADD NEW MACHINE
            </button>
          ) : (
            <div className="space-y-3 bg-white border-4 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mt-4">
              <input
                type="text"
                value={newMachineName}
                onChange={(e) => setNewMachineName(e.target.value)}
                placeholder="Enter Machine Number..."
                className="w-full border-2 border-black p-2 font-bold bg-gray-50 focus:outline-none focus:bg-yellow-100 transition-colors"
                onKeyPress={(e) => e.key === 'Enter' && handleAddMachine()}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowAddMachine(false)
                    setNewMachineName('')
                  }}
                  className="flex-1 border-2 border-black p-2 bg-gray-200 font-black hover:bg-gray-300 transition-colors"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleAddMachine}
                  className="flex-[2] border-2 border-black p-2 bg-green-300 font-black hover:bg-green-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:translate-x-[1px] active:shadow-none transition-all"
                >
                  SAVE MACHINE
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleSignOut}
          className="w-full border-4 border-black p-4 bg-red-300 font-black tracking-tight shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-red-400 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all uppercase"
        >
          SIGN OUT
        </button>
      </div>

      <BottomNav currentTab={currentTab} onTabChange={setCurrentTab} />
    </div>
  )
}