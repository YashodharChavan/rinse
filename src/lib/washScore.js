// Pure gamification functions — no React, no Supabase, fully testable.
// Components and the lazy-sweeper edge function should delegate to these
// instead of inlining the math. See rules/rules.md §9.

const GRACE_PERIOD_MINUTES    = 15
const GHOST_PENALTY_POINTS    = 10
const COMPLETION_BONUS_POINTS = 2
const START_WASH_BUFFER_MINUTES = 5
const MAX_WASH_SCORE          = 100
const MIN_WASH_SCORE          = 0

/**
 * Returns true when a scheduled booking has blown past its 15-minute grace
 * window and should be marked expired.
 *
 * @param {Date|string} startTime - The booking's start_time.
 * @param {Date}        now       - Current time (defaults to new Date()).
 */
export function isExpiredBooking(startTime, now = new Date()) {
  const deadline = new Date(new Date(startTime).getTime() + GRACE_PERIOD_MINUTES * 60_000)
  return now > deadline
}

/**
 * Deducts GHOST_PENALTY_POINTS per missed booking, clamped to MIN_WASH_SCORE.
 *
 * @param {number} currentScore
 * @param {number} missedCount  - Number of bookings missed (default 1).
 * @returns {number}
 */
export function applyGhostPenalty(currentScore, missedCount = 1) {
  return Math.max(MIN_WASH_SCORE, currentScore - GHOST_PENALTY_POINTS * missedCount)
}

/**
 * Awards COMPLETION_BONUS_POINTS for finishing a wash, clamped to MAX_WASH_SCORE.
 *
 * @param {number} currentScore
 * @returns {number}
 */
export function applyCompletionBonus(currentScore) {
  return Math.min(MAX_WASH_SCORE, currentScore + COMPLETION_BONUS_POINTS)
}

/**
 * Returns true when the current time is within the START_WASH_BUFFER_MINUTES
 * window before start_time (or any time after). Used to enable the START WASH
 * button on the dashboard.
 *
 * @param {Date|string} startTime
 * @param {Date}        now
 * @returns {boolean}
 */
export function isWithinStartWindow(startTime, now = new Date()) {
  const bufferStart = new Date(new Date(startTime).getTime() - START_WASH_BUFFER_MINUTES * 60_000)
  return now >= bufferStart
}

/**
 * Returns true if a booking should still appear on the dashboard — i.e. the
 * server hasn't swept it yet but the client can filter it out early.
 *
 * @param {{ status: string, start_time: string, end_time: string }} booking
 * @param {Date} now
 * @returns {boolean}
 */
export function isBookingLive(booking, now = new Date()) {
  const start = new Date(booking.start_time)
  const end   = new Date(booking.end_time)
  if (booking.status === 'active') return end > now
  return start.getTime() + GRACE_PERIOD_MINUTES * 60_000 > now.getTime()
}
