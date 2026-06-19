import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { BottomNav } from '../components/BottomNav'

export function ResidentDashboard() {
  const { user } = useAuth()
  const [currentTab, setCurrentTab] = useState('home')
  const [machines] = useState([
    { id: 1, name: 'Machine 1', status: 'free', timeLeft: null },
    { id: 2, name: 'Machine 2', status: 'in-use', timeLeft: 25 },
    { id: 3, name: 'Machine 3', status: 'broken', timeLeft: null },
    { id: 4, name: 'Machine 4', status: 'free', timeLeft: null },
  ])

  const getStatusColor = (status) => {
    switch (status) {
      case 'free':
        return 'bg-green-300'
      case 'in-use':
        return 'bg-yellow-300'
      case 'broken':
        return 'bg-red-300'
      default:
        return 'bg-gray-300'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'free':
        return 'FREE'
      case 'in-use':
        return 'IN USE'
      case 'broken':
        return 'BROKEN'
      default:
        return 'UNKNOWN'
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f0ea] pb-24">
      <div className="max-w-md mx-auto p-4">
        {/* Header */}
        <div className="border-4 border-black p-4 bg-yellow-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-6">
          <h1 className="text-2xl font-black tracking-tight">RINSE</h1>
          <p className="text-sm font-bold">Available Machines</p>
        </div>

        {/* Machines Grid */}
        <div className="space-y-3 mb-8">
          {machines.map((machine) => (
            <div
              key={machine.id}
              className={`border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${getStatusColor(machine.status)}`}
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-black text-lg">{machine.name}</h3>
                <span className="border-2 border-black px-2 py-1 font-black text-xs bg-white">
                  {getStatusText(machine.status)}
                </span>
              </div>

              {machine.timeLeft && (
                <p className="font-bold mb-3">Finishes in {machine.timeLeft}m</p>
              )}

              <button
                disabled={machine.status !== 'free'}
                className={`w-full border-3 border-black p-3 font-black tracking-tight active:translate-x-1 active:translate-y-1 active:shadow-none transition-all ${
                  machine.status === 'free'
                    ? 'bg-lime-300 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-lime-400'
                    : 'bg-gray-400 opacity-50 cursor-not-allowed'
                }`}
              >
                {machine.status === 'free' ? 'CLAIM' : 'UNAVAILABLE'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <BottomNav currentTab={currentTab} onTabChange={setCurrentTab} />
    </div>
  )
}
