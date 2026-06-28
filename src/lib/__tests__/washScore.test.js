import { describe, it, expect } from 'vitest'
import {
  isExpiredBooking,
  applyGhostPenalty,
  applyCompletionBonus,
  isWithinStartWindow,
  isBookingLive,
} from '../washScore'

// ─── isExpiredBooking ─────────────────────────────────────────────────────────

describe('isExpiredBooking', () => {
  it('returns false when still inside the grace window', () => {
    const start = new Date('2025-01-01T10:00:00Z')
    const now   = new Date('2025-01-01T10:10:00Z') // 10 mins after — still within 15
    expect(isExpiredBooking(start, now)).toBe(false)
  })

  it('returns true when past the grace window', () => {
    const start = new Date('2025-01-01T10:00:00Z')
    const now   = new Date('2025-01-01T10:20:00Z') // 20 mins after — expired
    expect(isExpiredBooking(start, now)).toBe(true)
  })

  it('returns false at exactly the grace deadline', () => {
    const start = new Date('2025-01-01T10:00:00Z')
    const now   = new Date('2025-01-01T10:15:00Z') // exactly 15 mins — not yet expired
    expect(isExpiredBooking(start, now)).toBe(false)
  })

  it('returns true one millisecond after the grace deadline', () => {
    const start    = new Date('2025-01-01T10:00:00Z')
    const deadline = new Date(start.getTime() + 15 * 60_000)
    const justAfter = new Date(deadline.getTime() + 1)
    expect(isExpiredBooking(start, justAfter)).toBe(true)
  })

  it('accepts a string start_time (ISO format from Supabase)', () => {
    const now = new Date('2025-01-01T10:20:00Z')
    expect(isExpiredBooking('2025-01-01T10:00:00Z', now)).toBe(true)
  })

  it('returns false for a future booking', () => {
    const future = new Date(Date.now() + 60 * 60_000) // 1 hour from now
    expect(isExpiredBooking(future)).toBe(false)
  })
})

// ─── applyGhostPenalty ────────────────────────────────────────────────────────

describe('applyGhostPenalty', () => {
  it('deducts 10 points for one missed booking', () => {
    expect(applyGhostPenalty(100)).toBe(90)
    expect(applyGhostPenalty(50)).toBe(40)
    expect(applyGhostPenalty(10)).toBe(0)
  })

  it('deducts 10 points per missed booking when missedCount > 1', () => {
    expect(applyGhostPenalty(100, 2)).toBe(80)
    expect(applyGhostPenalty(100, 5)).toBe(50)
  })

  it('clamps to 0 — score never goes negative', () => {
    expect(applyGhostPenalty(5)).toBe(0)   // 5 - 10 would be -5
    expect(applyGhostPenalty(0)).toBe(0)
    expect(applyGhostPenalty(9)).toBe(0)
  })

  it('clamps to 0 when multiple penalties exceed the score', () => {
    expect(applyGhostPenalty(15, 3)).toBe(0) // 15 - 30 = -15 → 0
  })

  it('handles a score already at 0 with no change', () => {
    expect(applyGhostPenalty(0, 5)).toBe(0)
  })
})

// ─── applyCompletionBonus ────────────────────────────────────────────────────

describe('applyCompletionBonus', () => {
  it('adds 2 points when score has headroom', () => {
    expect(applyCompletionBonus(80)).toBe(82)
    expect(applyCompletionBonus(0)).toBe(2)
    expect(applyCompletionBonus(50)).toBe(52)
  })

  it('clamps to 100 — score never exceeds max', () => {
    expect(applyCompletionBonus(99)).toBe(100)
    expect(applyCompletionBonus(100)).toBe(100)
  })

  it('handles partial headroom correctly', () => {
    expect(applyCompletionBonus(99)).toBe(100) // only 1 point of room, still caps at 100
  })
})

// ─── isWithinStartWindow ─────────────────────────────────────────────────────

describe('isWithinStartWindow', () => {
  it('returns false when more than 5 minutes before start', () => {
    const start     = new Date('2025-01-01T10:00:00Z')
    const tooEarly  = new Date('2025-01-01T09:50:00Z') // 10 mins before
    expect(isWithinStartWindow(start, tooEarly)).toBe(false)
  })

  it('returns true when within the 5-minute buffer', () => {
    const start     = new Date('2025-01-01T10:00:00Z')
    const justRight = new Date('2025-01-01T09:56:00Z') // 4 mins before
    expect(isWithinStartWindow(start, justRight)).toBe(true)
  })

  it('returns true at exactly the buffer boundary', () => {
    const start  = new Date('2025-01-01T10:00:00Z')
    const buffer = new Date('2025-01-01T09:55:00Z') // exactly 5 mins before
    expect(isWithinStartWindow(start, buffer)).toBe(true)
  })

  it('returns true after the start time has already passed', () => {
    const start = new Date('2025-01-01T10:00:00Z')
    const after = new Date('2025-01-01T10:15:00Z')
    expect(isWithinStartWindow(start, after)).toBe(true)
  })

  it('accepts a string start_time', () => {
    const now = new Date('2025-01-01T09:56:00Z')
    expect(isWithinStartWindow('2025-01-01T10:00:00Z', now)).toBe(true)
  })
})

// ─── isBookingLive ────────────────────────────────────────────────────────────

describe('isBookingLive', () => {
  const makeBooking = (status, startMinsOffset, endMinsOffset) => ({
    status,
    start_time: new Date(Date.now() + startMinsOffset * 60_000).toISOString(),
    end_time:   new Date(Date.now() + endMinsOffset  * 60_000).toISOString(),
  })

  describe('active bookings', () => {
    it('is live when end_time is in the future', () => {
      const booking = makeBooking('active', -20, +25)
      expect(isBookingLive(booking)).toBe(true)
    })

    it('is not live when end_time has already passed', () => {
      const booking = makeBooking('active', -60, -10)
      expect(isBookingLive(booking)).toBe(false)
    })
  })

  describe('scheduled bookings', () => {
    it('is live when still within the grace window', () => {
      const booking = makeBooking('scheduled', -5, +40)  // started 5 mins ago — within grace
      expect(isBookingLive(booking)).toBe(true)
    })

    it('is not live when past the grace window', () => {
      const booking = makeBooking('scheduled', -20, +25) // started 20 mins ago — expired
      expect(isBookingLive(booking)).toBe(false)
    })

    it('is live for a future booking', () => {
      const booking = makeBooking('scheduled', +30, +75)
      expect(isBookingLive(booking)).toBe(true)
    })
  })
})
