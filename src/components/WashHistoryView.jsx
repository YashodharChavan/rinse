import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { PullToRefresh } from './PullToRefresh'
import { GHOST_PENALTY_POINTS, COMPLETION_BONUS_POINTS, MAX_WASH_SCORE } from '../lib/constants'

const FILTER_OPTIONS = ['all', 'completed', 'missed', 'cancelled']

export function WashHistoryView({ userId, pgId }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')

  const fetchHistory = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('schedule')
        .select('*, machines(machine_number)')
        .eq('resident_id', userId)
        .in('status', ['completed', 'expired', 'incomplete', 'cancelled'])
        .order('start_time', { ascending: false })

      if (error) throw error
      setHistory(data || [])
    } catch (err) {
      console.error('Error fetching wash history:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userId) fetchHistory()
  }, [userId])

  // --- COMPUTED STATS ---
  const completedCount = history.filter(h => h.status === 'completed').length
  const missedCount = history.filter(h => h.status === 'expired' || h.status === 'incomplete').length
  const cancelledCount = history.filter(h => h.status === 'cancelled').length
  const totalCount = completedCount + missedCount + cancelledCount
  const completionRate = totalCount > 0 ? Math.round((completedCount / (completedCount + missedCount)) * 100) : 0

  // Best streak — longest consecutive completed washes (sorted chronologically)
  const computeBestStreak = () => {
    const chronological = [...history]
      .filter(h => h.status === 'completed' || h.status === 'expired' || h.status === 'incomplete')
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))

    let best = 0
    let current = 0
    for (const entry of chronological) {
      if (entry.status === 'completed') {
        current++
        best = Math.max(best, current)
      } else {
        current = 0
      }
    }
    return best
  }

  const bestStreak = computeBestStreak()

  // --- FILTERED HISTORY ---
  const filteredHistory = history.filter(entry => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'completed') return entry.status === 'completed'
    if (activeFilter === 'missed') return entry.status === 'expired' || entry.status === 'incomplete'
    if (activeFilter === 'cancelled') return entry.status === 'cancelled'
    return true
  })

  // --- HELPERS ---
  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return 'TODAY'
    if (date.toDateString() === yesterday.toDateString()) return 'YESTERDAY'
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
  }

  const getStatusConfig = (status) => {
    switch (status) {
      case 'completed':
        return { bg: 'bg-green-300', label: 'COMPLETED', score: `+${COMPLETION_BONUS_POINTS}`, scoreBg: 'bg-green-600' }
      case 'expired':
        return { bg: 'bg-red-300', label: 'EXPIRED', score: `-${GHOST_PENALTY_POINTS}`, scoreBg: 'bg-red-600' }
      case 'incomplete':
        return { bg: 'bg-orange-300', label: 'INCOMPLETE', score: `-${GHOST_PENALTY_POINTS}`, scoreBg: 'bg-orange-600' }
      case 'cancelled':
        return { bg: 'bg-gray-400', label: 'CANCELLED', score: '0', scoreBg: 'bg-gray-600' }
      default:
        return { bg: 'bg-white', label: status?.toUpperCase(), score: '0', scoreBg: 'bg-gray-500' }
    }
  }

  const getCompletionColor = () => {
    if (completionRate >= 80) return 'bg-green-300'
    if (completionRate >= 50) return 'bg-yellow-300'
    return 'bg-red-400'
  }

  if (loading && history.length === 0) {
    return (
      <div className="p-4 flex justify-center items-center h-64">
        <div className="border-4 border-black p-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-black text-xl">
          LOADING HISTORY...
        </div>
      </div>
    )
  }

  return (
    <PullToRefresh onRefresh={fetchHistory}>
      <div className="space-y-6 p-2 sm:p-4 min-h-screen">

        {/* Header */}
        <div className="border-4 border-black p-6 bg-pink-300 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-center">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight uppercase">📊 Wash History</h2>
          <p className="font-bold text-sm mt-1">Your complete laundry track record.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">

          {/* Total Washes */}
          <div className="border-4 border-black p-4 bg-blue-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center transition-transform hover:-translate-y-1">
            <p className="text-4xl sm:text-5xl font-black">{totalCount}</p>
            <p className="font-black text-[10px] sm:text-xs uppercase tracking-widest text-gray-700 mt-1">Total Washes</p>
          </div>

          {/* Completion Rate */}
          <div className={`border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center transition-transform hover:-translate-y-1 ${getCompletionColor()}`}>
            <p className="text-4xl sm:text-5xl font-black">{completionRate}%</p>
            <p className="font-black text-[10px] sm:text-xs uppercase tracking-widest text-gray-700 mt-1">Completion Rate</p>
          </div>

          {/* Best Streak */}
          <div className="border-4 border-black p-4 bg-yellow-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center transition-transform hover:-translate-y-1">
            <p className="text-4xl sm:text-5xl font-black">{bestStreak}</p>
            <p className="font-black text-[10px] sm:text-xs uppercase tracking-widest text-gray-700 mt-1">Best Streak 🔥</p>
          </div>

          {/* Missed Count */}
          <div className="border-4 border-black p-4 bg-red-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center transition-transform hover:-translate-y-1">
            <p className="text-4xl sm:text-5xl font-black">{missedCount}</p>
            <p className="font-black text-[10px] sm:text-xs uppercase tracking-widest text-gray-700 mt-1">Missed 💀</p>
          </div>
        </div>

        {/* Score Bar */}
        <div className="border-4 border-black p-4 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex justify-between items-center mb-3">
            <p className="font-black text-sm uppercase tracking-widest">Score Breakdown</p>
            <div className="flex gap-2 text-[9px] font-black uppercase">
              <span className="bg-green-300 border-2 border-black px-2 py-0.5">{completedCount} ✓</span>
              <span className="bg-red-300 border-2 border-black px-2 py-0.5">{missedCount} ✕</span>
              <span className="bg-gray-300 border-2 border-black px-2 py-0.5">{cancelledCount} ⊘</span>
            </div>
          </div>

          {/* Visual bar */}
          <div className="w-full h-6 border-4 border-black bg-gray-200 relative overflow-hidden">
            {totalCount > 0 && (
              <>
                <div
                  className="absolute top-0 left-0 h-full bg-green-400 transition-all duration-500"
                  style={{ width: `${(completedCount / totalCount) * 100}%` }}
                />
                <div
                  className="absolute top-0 h-full bg-red-400 transition-all duration-500"
                  style={{
                    left: `${(completedCount / totalCount) * 100}%`,
                    width: `${(missedCount / totalCount) * 100}%`
                  }}
                />
                <div
                  className="absolute top-0 h-full bg-gray-400 transition-all duration-500"
                  style={{
                    left: `${((completedCount + missedCount) / totalCount) * 100}%`,
                    width: `${(cancelledCount / totalCount) * 100}%`
                  }}
                />
              </>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTER_OPTIONS.map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`border-4 border-black px-4 py-2 font-black text-xs sm:text-sm uppercase tracking-wider transition-all whitespace-nowrap ${
                activeFilter === filter
                  ? 'bg-yellow-300 shadow-[inset_3px_3px_0px_0px_rgba(0,0,0,0.2)] translate-y-[1px]'
                  : 'bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100 active:translate-y-[1px] active:translate-x-[1px] active:shadow-none'
              }`}
            >
              {filter === 'missed' ? 'MISSED' : filter.toUpperCase()}
            </button>
          ))}
        </div>

        {/* History List */}
        {filteredHistory.length === 0 ? (
          <div className="border-4 border-black p-8 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center">
            <p className="text-xl font-black mb-2">
              {totalCount === 0 ? 'No wash history yet' : 'No results for this filter'}
            </p>
            <p className="font-bold text-gray-600">
              {totalCount === 0
                ? 'Book your first slot and start building your record!'
                : 'Try selecting a different filter above.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((entry) => {
              const config = getStatusConfig(entry.status)

              return (
                <div
                  key={entry.id}
                  className={`border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${config.bg} transition-all`}
                >
                  <div className="flex justify-between items-start">
                    {/* Left: Machine + Time */}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-[10px] sm:text-xs tracking-widest text-gray-700 mb-1">
                        MACHINE {entry.machines?.machine_number || '?'}
                      </p>
                      <p className="font-black text-lg sm:text-xl leading-tight">
                        {formatTime(entry.start_time)} — {formatTime(entry.end_time)}
                      </p>
                      <p className="font-bold text-xs text-gray-600 mt-1">
                        {formatDate(entry.start_time)}
                      </p>
                    </div>

                    {/* Right: Status + Score */}
                    <div className="flex flex-col items-end gap-2 shrink-0 ml-3">
                      <span className="bg-white border-2 border-black px-2 py-0.5 font-black text-[9px] sm:text-[10px] uppercase tracking-wider">
                        {config.label}
                      </span>
                      {config.score !== '0' && (
                        <span className={`${config.scoreBg} text-white px-2 py-0.5 border-2 border-black font-black text-[9px] sm:text-[10px] tracking-wider shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]`}>
                          {config.score}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer note */}
        {totalCount > 0 && (
          <div className="text-center py-4">
            <p className="font-bold text-xs text-gray-500 uppercase tracking-widest">
              Showing {filteredHistory.length} of {totalCount} total entries
            </p>
          </div>
        )}
      </div>
    </PullToRefresh>
  )
}
