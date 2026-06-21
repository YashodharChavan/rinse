import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { PullToRefresh } from './PullToRefresh'

export function LeaderboardView({ pgId, currentUserId }) {
  const [leaders, setLeaders] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchLeaders = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, wash_score')
        .eq('pg_id', pgId)
        .eq('is_approved', true)
        .eq('is_deleted', false)
        // Sort by highest score first. If tied, sort alphabetically
        .order('wash_score', { ascending: false })
        .order('full_name', { ascending: true })

      if (error) throw error
      setLeaders(data || [])
    } catch (err) {
      console.error('Error fetching leaderboard:', err)
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    if (pgId) fetchLeaders()
  }, [pgId])

  if (loading && leaders.length === 0) {
    return (
      <div className="p-4 flex justify-center items-center h-64">
        <div className="border-4 border-black p-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-black text-xl">
          TALLYING SCORES...
        </div>
      </div>
    )
  }

  // Extract Top 3 for the Olympic Podium
  const first = leaders[0]
  const second = leaders[1]
  const third = leaders[2]
  
  // Calculate Current User's Rank & Score
  const myIndex = leaders.findIndex(u => u.id === currentUserId)
  const myRank = myIndex !== -1 ? myIndex + 1 : '?'
  const myScore = myIndex !== -1 ? leaders[myIndex].wash_score : '?'

  // Reusable component for a Podium Step
  const PodiumStep = ({ user, rank, heightClass, baseColor, medal }) => {
    if (!user) return <div className="flex-1"></div> // Empty space if less than 3 people exist

    const isOwner = user.role === 'owner'
    const isMe = user.id === currentUserId
    
    // Override color if owner
    const stepColor = isOwner ? 'bg-purple-300' : baseColor

    return (
      <div className="flex-1 flex flex-col items-center justify-end relative">
        {/* Avatar hanging off the top */}
        <div className="absolute -top-10 sm:-top-12 z-50 flex flex-col items-center">
          <div className="relative">
            <img
              src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.full_name}`}
              alt={user.full_name}
              className={`w-16 h-16 sm:w-20 sm:h-20 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${isOwner ? 'bg-purple-100' : 'bg-white'}`}
            />
            {isOwner && <span className="absolute -top-3 -right-3 text-2xl drop-shadow-md">👑</span>}
            <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-2xl drop-shadow-md">{medal}</span>
          </div>
        </div>

        {/* The Olympic Block / Stair */}
        <div className={`w-full border-4 border-black border-b-0 flex flex-col items-center justify-end pb-4 transition-all shadow-[inset_0px_4px_0px_0px_rgba(255,255,255,0.4)] ${heightClass} ${stepColor}`}>
          <p className="font-black text-[10px] sm:text-xs uppercase px-1 text-center truncate w-full text-black/80">
            {user.full_name.split(' ')[0]}
          </p>
          <p className="font-black text-2xl sm:text-3xl mt-1 tracking-tighter">
            {user.wash_score}
          </p>
          {isMe && (
            <span className="bg-black text-white text-[8px] font-black px-2 py-0.5 mt-1 uppercase tracking-widest">YOU</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <PullToRefresh onRefresh={fetchLeaders}>
      <div className="space-y-8 p-2 sm:p-4 min-h-screen">
        
        {/* Header */}
        <div className="border-4 border-black p-6 bg-yellow-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-center">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight uppercase">🏆 Leaderboard</h2>
          <p className="font-bold text-sm mt-1">Who is the cleanest resident?</p>
        </div>

        {/* THE OLYMPIC PODIUM */}
        <div className="pt-16 pb-4 px-2">
          <div className="flex items-end justify-center w-full max-w-md mx-auto border-b-8 border-black">
            {/* 2nd Place (Left) */}
            <PodiumStep user={second} rank={2} heightClass="h-32 sm:h-40" baseColor="bg-gray-300" medal="🥈" />
            
            {/* 1st Place (Center - Tallest) */}
            <PodiumStep user={first} rank={1} heightClass="h-40 sm:h-52 z-10 shadow-[0px_-4px_0px_0px_rgba(0,0,0,0.1)]" baseColor="bg-yellow-400" medal="🥇" />
            
            {/* 3rd Place (Right - Shortest) */}
            <PodiumStep user={third} rank={3} heightClass="h-24 sm:h-32" baseColor="bg-orange-400" medal="🥉" />
          </div>
        </div>

        {/* YOUR RANK BANNER */}
        <div className="border-4 border-black p-4 sm:p-6 bg-cyan-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex justify-between items-center mx-2 mt-8 mb-8">
          <div>
            <p className="font-black text-sm sm:text-base uppercase text-gray-800 tracking-widest">Your Rank</p>
            <p className="font-black text-4xl sm:text-5xl tracking-tighter">#{myRank}</p>
          </div>
          <div className="text-right">
            <p className="font-black text-sm sm:text-base uppercase text-gray-800 tracking-widest">Your Score</p>
            <p className="font-black text-4xl sm:text-5xl tracking-tighter">{myScore}</p>
          </div>
        </div>

        {/* FULL RANKINGS LIST */}
        {leaders.length > 0 && (
          <div className="space-y-3 px-2">
            <h3 className="font-black text-xl uppercase tracking-tight mb-4">Full Rankings</h3>
            {leaders.map((user, index) => {
              const rank = index + 1
              const isOwner = user.role === 'owner'
              const isMe = user.id === currentUserId

              // Highlight colors based on role and if it's the current user
              let rowBg = 'bg-white'
              if (isMe && !isOwner) rowBg = 'bg-green-100' // Green tint for current resident
              if (isOwner && !isMe) rowBg = 'bg-purple-200' // Purple tint for owner
              if (isMe && isOwner) rowBg = 'bg-purple-300' // Deeper purple if current user IS the owner

              return (
                <div key={user.id} className={`border-4 border-black p-3 sm:p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-3 sm:gap-4 transition-colors ${rowBg}`}>
                  
                  {/* Rank Number */}
                  <div className="font-black text-xl sm:text-2xl w-8 text-center text-gray-500">
                    #{rank}
                  </div>

                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <img
                      src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.full_name}`}
                      alt={user.full_name}
                      className="w-12 h-12 border-2 border-black bg-white object-contain"
                    />
                    {isOwner && <span className="absolute -top-2 -right-2 text-lg">👑</span>}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-base sm:text-lg truncate uppercase">{user.full_name}</p>
                      {isMe && <span className="bg-black text-white text-[8px] font-black px-1.5 py-0.5 uppercase tracking-widest shrink-0">YOU</span>}
                    </div>
                    {isOwner && <p className="font-bold text-[10px] text-purple-700 uppercase tracking-widest">PG Owner</p>}
                  </div>

                  {/* Score */}
                  <div className="text-right shrink-0">
                    <p className="font-black text-xs text-gray-500 uppercase leading-none">Score</p>
                    <p className="font-black text-2xl sm:text-3xl leading-none">{user.wash_score}</p>
                  </div>

                </div>
              )
            })}
          </div>
        )}
      </div>
    </PullToRefresh>
  )
}