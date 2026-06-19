export function BottomNav({ currentTab, onTabChange }) {
  const tabs = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'schedule', label: 'Schedule', icon: '📅' },
    { id: 'profile', label: 'Profile', icon: '👤' },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-black">
      <div className="max-w-md mx-auto">
        <div className="flex justify-around">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 border-r-4 border-black p-4 font-black text-center transition-all last:border-r-0 ${
                currentTab === tab.id ? 'bg-yellow-300 shadow-inner' : 'bg-white hover:bg-gray-100'
              }`}
            >
              <div className="text-2xl mb-1">{tab.icon}</div>
              <div className="text-xs tracking-tight">{tab.label}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
