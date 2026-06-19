import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { BottomNav } from '../components/BottomNav'

export function AdminPanel() {
  const { user, signOut } = useAuth()
  const [currentTab, setCurrentTab] = useState('home')
  const [machines, setMachines] = useState([
    { id: 1, name: 'Machine 1' },
    { id: 2, name: 'Machine 2' },
    { id: 3, name: 'Machine 3' },
    { id: 4, name: 'Machine 4' },
  ])
  const [showAddMachine, setShowAddMachine] = useState(false)
  const [newMachineName, setNewMachineName] = useState('')

  const handleAddMachine = () => {
    if (newMachineName.trim()) {
      setMachines([
        ...machines,
        {
          id: Math.max(...machines.map((m) => m.id), 0) + 1,
          name: newMachineName,
        },
      ])
      setNewMachineName('')
      setShowAddMachine(false)
    }
  }

  const handleRemoveMachine = (id) => {
    setMachines(machines.filter((m) => m.id !== id))
  }

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div className="min-h-screen bg-[#f4f0ea] pb-24">
      <div className="max-w-md mx-auto p-4">
        {/* Header */}
        <div className="border-4 border-black p-4 bg-purple-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-6">
          <h1 className="text-2xl font-black tracking-tight">ADMIN PANEL</h1>
          <p className="text-sm font-bold">{user?.email}</p>
        </div>

        {/* Machines Section */}
        <div className="border-4 border-black p-6 bg-blue-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-6">
          <h2 className="text-xl font-black mb-4">Machines ({machines.length})</h2>
          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
            {machines.map((machine) => (
              <div
                key={machine.id}
                className="border-2 border-black p-3 bg-white flex justify-between items-center"
              >
                <p className="font-bold">{machine.name}</p>
                <button
                  onClick={() => handleRemoveMachine(machine.id)}
                  className="border-2 border-black px-2 py-1 bg-red-300 font-bold hover:bg-red-400 active:translate-x-0.5 active:translate-y-0.5"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {!showAddMachine ? (
            <button
              onClick={() => setShowAddMachine(true)}
              className="w-full border-3 border-black p-3 bg-green-300 font-black tracking-tight shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-green-400 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
            >
              + ADD MACHINE
            </button>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={newMachineName}
                onChange={(e) => setNewMachineName(e.target.value)}
                placeholder="Machine name"
                className="w-full border-2 border-black p-2 font-bold bg-white focus:outline-none focus:bg-yellow-100"
                onKeyPress={(e) => e.key === 'Enter' && handleAddMachine()}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddMachine}
                  className="flex-1 border-2 border-black p-2 bg-green-300 font-bold hover:bg-green-400"
                >
                  ADD
                </button>
                <button
                  onClick={() => {
                    setShowAddMachine(false)
                    setNewMachineName('')
                  }}
                  className="flex-1 border-2 border-black p-2 bg-red-300 font-bold hover:bg-red-400"
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="border-4 border-black p-4 bg-yellow-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-2xl font-black">8</p>
            <p className="text-xs font-bold">Residents</p>
          </div>
          <div className="border-4 border-black p-4 bg-cyan-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-2xl font-black">ABC123</p>
            <p className="text-xs font-bold">Invite Code</p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleSignOut}
          className="w-full border-4 border-black p-4 bg-red-300 font-black tracking-tight shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-red-400 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
        >
          SIGN OUT
        </button>
      </div>

      <BottomNav currentTab={currentTab} onTabChange={setCurrentTab} />
    </div>
  )
}
