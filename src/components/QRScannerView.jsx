import { Scanner } from '@yudiel/react-qr-scanner'
import { createPortal } from 'react-dom'
import { useState } from 'react'

export function QRScannerView({ onScan, onClose, onManualEntry }) {
  const [showHelp, setShowHelp] = useState(false)
  const [isLightOn, setIsLightOn] = useState(false)

  const handleScan = (result) => {
    if (result && result.length > 0) {
      const scannedText = result[0].rawValue
      onScan(scannedText)
    }
  }

  return createPortal(
    // Notice the transition: It switches from Cyan to stark White when the light is activated
    <div className={`fixed inset-0 z-[9999] flex flex-col font-sans overflow-hidden transition-colors duration-300 ${isLightOn ? 'bg-white' : 'bg-cyan-200'}`}>
      
      {/* CUSTOM CSS FOR THE MOVING LASER ANIMATION */}
      <style>
        {`
          @keyframes scan-laser {
            0%, 100% { top: 5%; opacity: 0; }
            10%, 90% { opacity: 1; }
            50% { top: 95%; }
          }
          .animate-scan-laser {
            animation: scan-laser 2.5s ease-in-out infinite;
          }
        `}
      </style>

      {/* Background decoration (Neo-brutalist dot pattern) */}
      <div 
        className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${isLightOn ? 'opacity-5' : 'opacity-20'}`}
        style={{ backgroundImage: 'radial-gradient(#000 2px, transparent 2px)', backgroundSize: '24px 24px' }}
      ></div>

      {/* Top Bar - App-like Header */}
      <div className="bg-white border-b-4 border-black p-4 flex justify-between items-center z-10 shadow-[0_4px_0_0_rgba(0,0,0,1)]">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 border-4 border-black bg-yellow-300 rounded-full flex items-center justify-center font-black text-lg overflow-hidden shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                👤
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight m-0 leading-none mt-1">SCAN POSTER</h2>
        </div>
        <button
          onClick={onClose}
          className="border-4 border-black bg-red-400 text-white px-3 py-1 font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
        >
          ✕
        </button>
      </div>

      {/* Main Scanner Area */}
      <div className="flex-1 flex flex-col items-center justify-start pt-8 sm:pt-12 px-6 z-10">

        {/* Floating Instruction Bubble */}
        <div className={`border-4 border-black px-4 py-2 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -rotate-2 ${isLightOn ? 'bg-yellow-300' : 'bg-white'}`}>
          <p className="font-black text-sm uppercase">Find the poster in the lobby 👇</p>
        </div>

        {/* The Scanner Window */}
        <div className={`w-full max-w-[320px] aspect-square border-8 border-black bg-gray-900 relative shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] overflow-hidden transition-all ${isLightOn ? 'shadow-[0_0_40px_rgba(255,255,255,0.8)]' : ''}`}>
          
          <div className="absolute inset-0">
            <Scanner
              onScan={handleScan}
              styles={{
                container: { width: '100%', height: '100%' },
                video: { objectFit: 'cover' }
              }}
              components={{ finder: false }} 
            />
          </div>

          {/* Custom Brutalist Viewfinder Overlay */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
             <div className={`w-3/4 h-3/4 border-4 border-dashed transition-colors ${isLightOn ? 'border-white opacity-100' : 'border-yellow-300 opacity-80'}`}></div>
             
             {/* THE MOVING LASER LINE */}
             <div className="absolute left-[12.5%] w-3/4 h-1 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,1)] animate-scan-laser z-20"></div>
          </div>
          
        </div>

        {/* Bottom Actions Area (FamApp Style Grid) */}
        <div className="mt-auto mb-8 w-full max-w-[320px] flex flex-col gap-4">
          
          <button
            onClick={onManualEntry}
            className="w-full border-4 border-black bg-yellow-300 p-4 flex items-center justify-center gap-3 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-400 active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
          >
             <span className="text-2xl">⌨️</span>
             <span className="font-black text-lg uppercase tracking-tight pt-1">Enter Code Manually</span>
          </button>

          <div className="flex gap-4">
            
            {/* FLASHLIGHT BUTTON */}
            <button
              onClick={() => setIsLightOn(!isLightOn)}
              className={`flex-1 border-4 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-center text-center active:translate-y-1 active:translate-x-1 active:shadow-none transition-all ${isLightOn ? 'bg-white hover:bg-gray-100' : 'bg-pink-300 hover:bg-pink-400'}`}
            >
              <span className="text-2xl mb-1">{isLightOn ? '🔦' : '💡'}</span>
              <span className="font-black text-[10px] uppercase tracking-widest">{isLightOn ? 'Light On' : 'Need Light?'}</span>
            </button>

            {/* HELP BUTTON */}
            <button
              onClick={() => setShowHelp(true)}
              className="flex-1 border-4 border-black bg-green-300 hover:bg-green-400 p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-center text-center active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
            >
              <span className="text-2xl mb-1">❓</span>
              <span className="font-black text-[10px] uppercase tracking-widest">Help</span>
            </button>
          </div>
          
        </div>
      </div>

      {/* HELP POPUP MODAL */}
      {showHelp && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-blue-300 border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-xs w-full text-center">
            <div className="text-5xl mb-4">👋</div>
            <h3 className="text-2xl font-black uppercase mb-2">How to scan</h3>
            <p className="font-bold text-sm mb-6">
              Look for the printed yellow poster in your PG lobby. Hold your camera steady and align the QR code inside the dashed box!
            </p>
            <button
              onClick={() => setShowHelp(false)}
              className="w-full border-4 border-black bg-white py-3 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

    </div>,
    document.body
  )
}