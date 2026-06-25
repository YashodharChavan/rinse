import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { toPng, toBlob } from 'html-to-image'
import { Share } from '@capacitor/share'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'

export function QRPosterModal({ pgDetails, userProfile, onClose }) {
  const posterRef = useRef(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleShare = async () => {
    try {
      setIsProcessing(true)
      
      const shareTitle = `Join ${pgDetails.name} on Rinse`
      const shareText = `Scan the QR code or use invite code: ${pgDetails.invite_code}`

      // --- NATIVE MOBILE BEHAVIOR (Android/iOS) ---
      if (Capacitor.isNativePlatform()) {
        // toPng directly gives us the Base64 string we need. No canvas middle-man required!
        const dataUrl = await toPng(posterRef.current, {
          backgroundColor: '#fde047',
          pixelRatio: 2 // Crisp for printing, but safe for mobile memory
        })

        // Strip the data:image prefix to get raw base64
        const rawBase64 = dataUrl.split(',')[1]
        
        // Write file to device's temporary cache
        const savedFile = await Filesystem.writeFile({
          path: `rinse-invite-${Date.now()}.png`,
          data: rawBase64,
          directory: Directory.Cache
        })

        // Use native Share plugin
        await Share.share({
          title: shareTitle,
          text: shareText,
          url: savedFile.uri,
          dialogTitle: 'Share or Print Poster'
        })
      } 
      // --- WEB/BROWSER FALLBACK (Testing on PC) ---
      else {
        // toBlob is perfect for the web navigator share API
        const blob = await toBlob(posterRef.current, {
          backgroundColor: '#fde047',
          pixelRatio: 2
        })

        const file = new File([blob], 'rinse-invite.png', { type: 'image/png' })
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: shareTitle,
            text: shareText,
            files: [file],
          })
        } else {
          // If the browser doesn't support sharing, fallback to an instant download
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.download = `Rinse-QR-${pgDetails.name.replace(/\s+/g, '-')}.png`
          link.href = url
          link.click()
          URL.revokeObjectURL(url)
        }
      }
    } catch (error) {
      console.error('Error sharing:', error)
      alert('Failed to generate the poster. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/80 z-[9999] flex flex-col items-center justify-start p-4 overflow-y-auto backdrop-blur-sm">
      
      {/* Action Buttons Container */}
      <div className="sticky top-0 w-full max-w-[500px] flex justify-between items-center gap-2 mb-6 bg-white border-4 border-black p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-10 shrink-0">
        <button
          onClick={onClose}
          className="px-3 py-2 border-2 border-black font-black hover:bg-gray-100 active:translate-y-1 active:translate-x-1 uppercase text-xs sm:text-sm"
        >
          ✕ CLOSE
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleShare}
            disabled={isProcessing}
            className="bg-lime-300 border-2 border-black px-3 py-2 font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none uppercase text-xs sm:text-sm disabled:opacity-50"
          >
            {isProcessing ? '⏳ PROCESSING...' : '📤 SHARE / SAVE POSTER'}
          </button>
        </div>
      </div>

      {/* THE PRINT POSTER */}
      <div 
        ref={posterRef} 
        className="bg-yellow-300 border-[8px] border-black p-6 sm:p-10 w-full max-w-[500px] min-h-[700px] shrink-0 flex flex-col items-center justify-between text-center relative shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] mx-auto mb-8"
      >
        {/* Decorative Tape Element */}
        <div className="absolute -top-4 bg-white/50 w-32 h-8 border-4 border-black rotate-[-3deg] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"></div>

        {/* Top Header Section */}
        <div className="w-full flex flex-col items-center mt-6">
          <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tighter mb-4 leading-none">
            {pgDetails.name}
          </h1>
          <p className="font-bold text-sm sm:text-base border-b-4 border-black pb-4 w-full uppercase break-words">
            {pgDetails.address}
          </p>
        </div>

        {/* Middle QR Section */}
        <div className="flex flex-col items-center my-6 w-full">
          <div className="bg-white border-[6px] border-black p-4 sm:p-6 mb-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] inline-block">
            <QRCodeCanvas 
              value={pgDetails.invite_code} 
              size={240} 
              level="H" 
              bgColor="#ffffff" 
              fgColor="#000000"
              className="w-48 h-48 sm:w-64 sm:h-64" 
            />
          </div>
          <p className="font-black text-3xl sm:text-4xl uppercase tracking-tight mb-2">
            SCAN TO JOIN
          </p>
        </div>

        {/* Bottom Manual Entry Section */}
        <div className="w-full flex flex-col items-center mt-auto">
          <p className="font-bold text-sm sm:text-base mb-3 uppercase">
            OR ENTER CODE MANUALLY:
          </p>
          <div className="bg-white border-4 border-black px-6 py-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-full mb-6">
            <span className="font-black text-4xl tracking-widest">{pgDetails.invite_code}</span>
          </div>

          {userProfile?.phone && (
            <div className="border-t-4 border-black w-full pt-4 pb-2">
              <p className="font-black text-[10px] sm:text-xs uppercase tracking-widest text-gray-700 mb-1">OWNER CONTACT</p>
              <p className="font-black text-2xl">{userProfile.phone}</p>
            </div>
          )}
        </div>
      </div>

    </div>,
    document.body
  )
}