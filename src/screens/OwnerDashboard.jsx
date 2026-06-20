import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { MachineManager } from '../components/MachineManager'
import { ManageResidents } from '../components/ManageResidents'

export function OwnerDashboard() {
  const { user, signOut } = useAuth()
  
  // State for data
  const [pgDetails, setPgDetails] = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('home')

  // Fetch all dashboard data on load
  useEffect(() => {
    if (user) {
      fetchDashboardData()
    }
  }, [user])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // 1. Fetch the Owner's Profile to get their pg_id
      const { data: profileData } = await supabase
        .from('profiles')
        .select('pg_id')
        .eq('id', user.id)
        .single()

      if (!profileData?.pg_id) return

      // 2. Fetch the PG details to populate the top card
      const { data: pgData } = await supabase
        .from('pgs')
        .select('*')
        .eq('id', profileData.pg_id)
        .single()
        
      if (pgData) setPgDetails(pgData)

      // 3. Fetch Pending Join Requests (and magically join the resident's profile info!)
      const { data: requestData, error: requestError } = await supabase
        .from('join_requests')
        .select(`
          id,
          resident_id,
          created_at,
          profiles (
            full_name,
            phone
          )
        `)
        .eq('pg_id', profileData.pg_id)
        .eq('status', 'pending')

      if (requestError) throw requestError
      
      setRequests(requestData || [])
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handle Approving a Resident
  const handleApprove = async (requestId, residentId) => {
    try {
      // 1. Mark request as approved
      await supabase
        .from('join_requests')
        .update({ status: 'approved' })
        .eq('id', requestId)

      // 2. Officially approve the resident in their profile
      await supabase
        .from('profiles')
        .update({ is_approved: true })
        .eq('id', residentId)

      // 3. Remove from local UI state
      setRequests((prev) => prev.filter((req) => req.id !== requestId))
      
      // Optional: Update active residents count if you implement it later
      alert("Resident Approved!")
    } catch (error) {
      console.error("Error approving resident:", error)
      alert("Failed to approve resident.")
    }
  }

  // Handle Rejecting a Resident
  const handleReject = async (requestId, residentId) => {
    try {
      // 1. Mark request as rejected
      await supabase
        .from('join_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId)

      // 2. Clear their pg_id so they are free to join a different PG
      await supabase
        .from('profiles')
        .update({ pg_id: null, is_approved: false })
        .eq('id', residentId)

      // 3. Remove from local UI state
      setRequests((prev) => prev.filter((req) => req.id !== requestId))
    } catch (error) {
      console.error("Error rejecting resident:", error)
      alert("Failed to reject resident.")
    }
  }

  // View Renderers
  const renderHomeTab = () => {
    return (
      <div className="p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="border-4 border-black p-8 bg-green-300 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-8">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-4xl font-black tracking-tight mb-2">OWNER DASHBOARD</h1>
                <p className="font-bold text-lg">{user?.email}</p>
              </div>
              <button
                onClick={signOut}
                className="border-4 border-black p-3 bg-red-300 font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-red-400 active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
              >
                SIGN OUT
              </button>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* PG Info Card */}
            <div className="border-4 border-black p-6 bg-blue-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
              <div>
                <h2 className="text-2xl font-black mb-4 tracking-tight">YOUR PG</h2>
                <div className="space-y-3 font-bold">
                  <p>📍 Address: {pgDetails?.address || 'Loading...'}</p>
                  <p>🔗 Invite Code: <span className="bg-white px-2 py-1 border-2 border-black tracking-widest">{pgDetails?.invite_code || '---'}</span></p>
                </div>
              </div>
            </div>
          </div>

          {/* Machine Manager Component */}
          {pgDetails && <MachineManager pgId={pgDetails.id} />}

          {/* Join Requests Card */}
          <div className="border-4 border-black p-6 bg-pink-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black tracking-tight">PENDING APPROVALS</h2>
              <span className="bg-black text-white font-black px-3 py-1 text-lg">{requests.length}</span>
            </div>
            
            {loading ? (
              <div className="text-center p-8 border-4 border-black bg-white">
                <p className="text-xl font-bold">Loading requests...</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center p-8 border-4 border-black bg-white">
                <p className="text-xl font-bold">No pending requests right now.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((req) => (
                  <div key={req.id} className="border-4 border-black p-4 bg-white flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                      <p className="font-black text-lg">{req.profiles?.full_name || 'Unknown User'}</p>
                      <p className="font-bold text-gray-600">{req.profiles?.phone || 'No phone provided'}</p>
                      <p className="text-xs font-bold text-gray-500 mt-1">Requested: {new Date(req.created_at).toLocaleDateString()}</p>
                    </div>
                    
                    <div className="flex gap-3 w-full sm:w-auto">
                      <button 
                        onClick={() => handleReject(req.id, req.resident_id)}
                        className="flex-1 sm:flex-none border-4 border-black px-4 py-2 bg-red-300 font-black hover:bg-red-400 active:translate-y-1 active:translate-x-1 active:shadow-none transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                      >
                        REJECT
                      </button>
                      <button 
                        onClick={() => handleApprove(req.id, req.resident_id)}
                        className="flex-1 sm:flex-none border-4 border-black px-4 py-2 bg-green-300 font-black hover:bg-green-400 active:translate-y-1 active:translate-x-1 active:shadow-none transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                      >
                        APPROVE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderManageResidentsTab = () => {
    if (!pgDetails) return null
    return (
      <div className="p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="border-4 border-black p-6 bg-purple-100 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-2xl font-black tracking-tight mb-6">MANAGE RESIDENTS</h2>
            <ManageResidents pgId={pgDetails.id} ownerId={user.id} />
          </div>
        </div>
      </div>
    )
  }

  const renderSettingsTab = () => {
    return (
      <div className="p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="border-4 border-black p-8 bg-cyan-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-center">
            <h2 className="text-3xl font-black tracking-tight mb-4">⚙️ SETTINGS</h2>
            <p className="text-xl font-bold">Settings Coming Soon</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f4f0ea] pb-32">
      {activeTab === 'home' && renderHomeTab()}
      {activeTab === 'manage' && renderManageResidentsTab()}
      {activeTab === 'settings' && renderSettingsTab()}

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 border-t-4 border-black bg-[#f4f0ea] z-50">
        <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2 grid grid-cols-3 gap-2">
          <button
            onClick={() => setActiveTab('home')}
            className={`border-4 border-black p-3 sm:p-4 font-black tracking-tight transition-all text-xs sm:text-base ${activeTab === 'home'
                ? 'bg-yellow-200 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.2)] translate-y-1'
                : 'bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100'
              }`}
          >
            📊 HOME
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`border-4 border-black p-3 sm:p-4 font-black tracking-tight transition-all text-xs sm:text-base ${activeTab === 'manage'
                ? 'bg-yellow-200 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.2)] translate-y-1'
                : 'bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100'
              }`}
          >
            👁️ MANAGE RESIDENTS
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`border-4 border-black p-3 sm:p-4 font-black tracking-tight transition-all text-xs sm:text-base ${activeTab === 'settings'
                ? 'bg-yellow-200 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.2)] translate-y-1'
                : 'bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100'
              }`}
          >
            ⚙️ SETTINGS
          </button>
        </div>
      </div>
    </div>
  )
}