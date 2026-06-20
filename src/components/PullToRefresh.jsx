import { useState } from 'react'

export function PullToRefresh({ onRefresh, children }) {
  const [startY, setStartY] = useState(0)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  // How far they have to pull before it triggers a refresh
  const triggerThreshold = 80 

  const handleTouchStart = (e) => {
    // Only allow pulling if we are at the absolute top of the page
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY)
    }
  }

  const handleTouchMove = (e) => {
    if (startY === 0) return

    const currentY = e.touches[0].clientY
    const diff = currentY - startY

    // If dragging downwards and at the top of the page
    if (diff > 0 && window.scrollY === 0) {
      // Prevent the browser's default pull-to-refresh behavior
      if (e.cancelable) e.preventDefault() 
      
      // Cap the visual drag distance so it doesn't pull down infinitely
      setPullDistance(Math.min(diff, 120))
    }
  }

  const handleTouchEnd = async () => {
    if (pullDistance >= triggerThreshold && !refreshing) {
      setRefreshing(true)
      setPullDistance(triggerThreshold) // Lock it open while refreshing
      
      // Run the refresh function passed in from the parent
      await onRefresh()
      
      setRefreshing(false)
    }
    
    // Snap back to top
    setPullDistance(0)
    setStartY(0)
  }

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative w-full h-full"
    >
      {/* The Hidden Drag Indicator */}
      <div 
        className="absolute top-0 w-full flex justify-center items-center overflow-hidden transition-all duration-200 ease-out z-0"
        style={{ height: `${pullDistance}px` }}
      >
        {pullDistance > 0 && (
          <div className="border-4 border-black px-6 py-2 bg-yellow-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-black text-sm uppercase tracking-widest flex items-center gap-2">
            {refreshing ? (
              <><span>🔄</span> FETCHING...</>
            ) : pullDistance >= triggerThreshold ? (
              <><span>🔥</span> RELEASE TO REFRESH</>
            ) : (
              <><span>⬇️</span> PULL DOWN</>
            )}
          </div>
        )}
      </div>

      {/* The Main Content (Pushed down when dragging) */}
      <div 
        className="relative w-full h-full z-10 bg-[#f4f0ea] transition-transform duration-200 ease-out"
        style={{ transform: `translateY(${pullDistance}px)` }}
      >
        {children}
      </div>
    </div>
  )
}