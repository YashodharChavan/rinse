import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export function Onboarding() {
  const { user } = useAuth()
  const [mode, setMode] = useState(null) // 'join' or 'create'

  if (mode === 'join') {
    return <JoinPGForm onBack={() => setMode(null)} />
  }

  if (mode === 'create') {
    return <CreatePGForm onBack={() => setMode(null)} />
  }

  return (
    <div className="min-h-screen bg-[#f4f0ea] p-4">
      <div className="max-w-md mx-auto pt-8">
        {/* Header */}
        <div className="border-4 border-black p-6 bg-yellow-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-8 text-center">
          <h1 className="text-3xl font-black tracking-tight mb-2">Welcome!</h1>
          <p className="font-bold">{user?.email}</p>
        </div>

        {/* Action Cards */}
        <div className="space-y-6">
          <div className="border-4 border-black p-6 bg-green-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-xl font-black mb-3">Join a PG</h2>
            <p className="font-bold mb-4">Already have an invite code?</p>
            <button
              onClick={() => setMode('join')}
              className="w-full border-4 border-black p-4 bg-lime-300 font-black tracking-tight shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-lime-400 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
            >
              JOIN WITH CODE
            </button>
          </div>

          <div className="border-4 border-black p-6 bg-blue-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-xl font-black mb-3">Create a PG</h2>
            <p className="font-bold mb-4">Start a new property</p>
            <button
              onClick={() => setMode('create')}
              className="w-full border-4 border-black p-4 bg-cyan-300 font-black tracking-tight shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-cyan-400 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
            >
              CREATE NEW
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function JoinPGForm({ onBack }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <div className="min-h-screen bg-[#f4f0ea] p-4">
      <div className="max-w-md mx-auto pt-8">
        <button
          onClick={onBack}
          className="mb-6 font-bold text-lg"
        >
          ← BACK
        </button>

        <div className="border-4 border-black p-6 bg-green-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-6">
          <h2 className="text-2xl font-black tracking-tight">Enter Invite Code</h2>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g., ABC123"
            className="w-full border-4 border-black p-4 font-black text-lg tracking-tight uppercase bg-white focus:outline-none focus:bg-yellow-100"
          />

          <button
            onClick={() => setLoading(true)}
            disabled={loading || !code}
            className="w-full border-4 border-black p-4 bg-lime-300 font-black tracking-tight shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-lime-400 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
          >
            {loading ? 'JOINING...' : 'JOIN PG'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreatePGForm({ onBack }) {
  const [pgName, setPgName] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <div className="min-h-screen bg-[#f4f0ea] p-4">
      <div className="max-w-md mx-auto pt-8">
        <button
          onClick={onBack}
          className="mb-6 font-bold text-lg"
        >
          ← BACK
        </button>

        <div className="border-4 border-black p-6 bg-blue-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-6">
          <h2 className="text-2xl font-black tracking-tight">Name Your PG</h2>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            value={pgName}
            onChange={(e) => setPgName(e.target.value)}
            placeholder="e.g., Parkside Residency"
            className="w-full border-4 border-black p-4 font-bold text-lg bg-white focus:outline-none focus:bg-yellow-100"
          />

          <button
            onClick={() => setLoading(true)}
            disabled={loading || !pgName}
            className="w-full border-4 border-black p-4 bg-cyan-300 font-black tracking-tight shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-cyan-400 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
          >
            {loading ? 'CREATING...' : 'CREATE'}
          </button>
        </div>
      </div>
    </div>
  )
}
