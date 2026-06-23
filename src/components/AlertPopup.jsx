import { createPortal } from 'react-dom'

export function AlertPopup({ message, onClose }) {
  if (!message) return null

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm border-4 border-black bg-yellow-200 p-6 text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] sm:p-8">
        <p className="mb-8 text-lg font-black uppercase leading-tight tracking-tight text-black sm:text-xl">
          {message}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-full border-4 border-black bg-orange-400 hover:bg-orange-500 px-5 py-4 text-lg font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all  active:translate-x-1 active:translate-y-1 active:shadow-none"
        >
          OK BOSS
        </button>
      </div>
    </div>,
    document.body
  )
}
