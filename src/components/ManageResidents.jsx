import { useState, useEffect, useMemo, useCallback } from 'react'
import { PullToRefresh } from './PullToRefresh'
import { supabase } from '../lib/supabaseClient'
import { createPortal } from 'react-dom'
import { AlertPopup } from './AlertPopup'


export function ManageResidents({ pgId, ownerId }) {
  const [residents, setResidents] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedResident, setSelectedResident] = useState(null)
  const [actionModal, setActionModal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [requests, setRequests] = useState([])
  const [alertMessage, setAlertMessage] = useState('')

  useEffect(() => {
    fetchData()
  }, [pgId, ownerId])

  async function fetchData() {
    try {
      setLoading(true)

      const { data: residentsData, error: residentsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('pg_id', pgId)
        .eq('is_deleted', false)
        .eq('role', 'resident')
        .neq('id', ownerId)
        .order('full_name')

      if (residentsError) throw residentsError
      setResidents(residentsData || [])

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
        .eq('pg_id', pgId)
        .eq('status', 'pending')

      if (requestError) throw requestError
      setRequests(requestData || [])

    } catch (error) {
      console.error('Error fetching data:', error)
      setAlertMessage("Failed to fetch data")
    } finally {
      setLoading(false)
    }
  }

  const handleApproveRequest = useCallback(async (requestId, residentId) => {
    try {
      setUpdating(true)
      await supabase.from('join_requests').update({ status: 'approved' }).eq('id', requestId)
      await supabase.from('profiles').update({ is_approved: true }).eq('id', residentId)
      await fetchData()
    } catch (error) {
      console.error("Error approving request:", error)
    } finally {
      setUpdating(false)
    }
  })

  // FIXED: Clean Slate Wipe for Rejected Requests
  const handleRejectRequest = async (requestId, residentId) => {
    try {
      setUpdating(true)
      // Delete the request entirely
      await supabase.from('join_requests').delete().eq('id', requestId)

      // Wipe pg_id AND role so they are instantly routed to the Onboarding screen
      await supabase.from('profiles').update({
        pg_id: null,
        role: null,
        is_approved: false
      }).eq('id', residentId)

      await fetchData()
    } catch (error) {
      console.error("Error rejecting request:", error)
    } finally {
      setUpdating(false)
    }
  }

  const handleDisapprove = async (residentId) => {
    try {
      setUpdating(true)
      await supabase.from('profiles').update({ is_approved: false }).eq('id', residentId)
      await fetchData()
      setSelectedResident(null)
      setActionModal(null)
    } catch (error) {
      console.error('Error revoking access:', error)
    } finally {
      setUpdating(false)
    }
  }

  const handleApprove = async (residentId) => {
    try {
      setUpdating(true)
      await supabase.from('profiles').update({ is_approved: true }).eq('id', residentId)
      await fetchData()
      setSelectedResident(null)
    } catch (error) {
      console.error('Error approving resident:', error)
    } finally {
      setUpdating(false)
    }
  }

  // FIXED: Clean Slate Wipe for Deleted Residents
  const handleSoftDelete = async (residentId) => {
    try {
      setUpdating(true)

      // Completely wipe the user from the PG and clear their role
      await supabase.from('profiles').update({
        pg_id: null,
        role: null,
        is_approved: false,
        is_deleted: false // Reset so they aren't permanently invisible if they join a new PG
      }).eq('id', residentId)

      await fetchData()
      setSelectedResident(null)
      setActionModal(null)
    } catch (error) {
      console.error('Error deleting record:', error)
    } finally {
      setUpdating(false)
    }
  }

  const triggerRemovalModal = (resident) => setActionModal({ type: 'remove', resident })
  const triggerDeletionModal = (resident) => setActionModal({ type: 'delete', resident })

  const confirmAction = () => {
    if (!actionModal) return
    if (actionModal.type === 'remove') handleDisapprove(actionModal.resident.id)
    else if (actionModal.type === 'delete') handleSoftDelete(actionModal.resident.id)
  }

  const filteredResidents = useMemo(() => {
    return residents.filter((resident) => {
      const query = searchQuery.toLowerCase();
      return (
        resident.full_name?.toLowerCase().includes(query) ||
        resident.phone?.toLowerCase().includes(query)
      );
    });
  }, [residents, searchQuery]);

  if (loading) {
    return (
      <div className="border-4 border-black p-8 bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-center">
        <p className="text-xl font-black">Loading People Manager...</p>
      </div>
    )
  }

  return (
    <PullToRefresh onRefresh={fetchData}>
      <AlertPopup message={alertMessage} onClose={() => setAlertMessage("")} />

      <div className="space-y-6 relative">

        {/* 1. PENDING APPROVALS SECTION - COMPACT BAR UI */}
        <div className="border-4 border-black p-3 sm:p-4 bg-pink-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg sm:text-xl font-black tracking-tight uppercase">Pending Approvals</h2>
            <span className="bg-black text-white font-black px-2 py-0.5 text-sm">{requests.length}</span>
          </div>

          {requests.length === 0 ? (
            <div className="text-center p-4 border-4 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-sm font-bold">No pending requests.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map((req) => (
                <div key={req.id} className="border-4 border-black p-2 sm:p-3 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex flex-row justify-between items-center gap-2">

                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm sm:text-base truncate">{req.profiles?.full_name || 'Unknown User'}</p>
                    <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-gray-600 truncate">
                      <span>{req.profiles?.phone || 'No phone'}</span>
                      <span>•</span>
                      <span>{new Date(req.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <button
                      disabled={updating}
                      onClick={() => handleRejectRequest(req.id, req.resident_id)}
                      className="border-2 border-black w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-red-300 font-black hover:bg-red-400 active:translate-y-[1px] active:translate-x-[1px] active:shadow-none transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
                      title="Reject"
                    >
                      ✕
                    </button>
                    <button
                      disabled={updating}
                      onClick={() => handleApproveRequest(req.id, req.resident_id)}
                      className="border-2 border-black w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-green-300 font-black hover:bg-green-400 active:translate-y-[1px] active:translate-x-[1px] active:shadow-none transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
                      title="Approve"
                    >
                      ✓
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. EXISTING RESIDENTS SECTION - COMPACT BAR UI */}
        <div className="border-4 border-black p-3 sm:p-4 bg-blue-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">

          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight">
              Residents ({filteredResidents.length})
            </h2>
          </div>

          <div className="mb-4">
            <input
              type="text"
              placeholder="🔍 Search name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border-4 border-black p-2 font-bold text-sm focus:outline-none focus:bg-yellow-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-colors"
            />
          </div>

          {filteredResidents.length === 0 ? (
            <div className="text-center p-4 border-4 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-sm font-bold">
                {residents.length === 0 ? 'No residents yet.' : 'No matches found.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredResidents.map((resident) => (
                <div
                  key={resident.id}
                  className={`border-4 border-black p-2 sm:p-3 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex flex-row justify-between items-center gap-2 transition-colors cursor-pointer ${resident.is_approved ? 'hover:bg-cyan-50' : 'opacity-75 hover:opacity-100 bg-gray-50'
                    }`}
                  onClick={() => setSelectedResident(resident)}
                >

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-black text-sm sm:text-base truncate">{resident.full_name}</p>
                      {resident.is_approved ? (
                        <span className="bg-green-100 border border-green-600 text-green-700 font-black px-1 py-[1px] text-[8px] sm:text-[10px] uppercase tracking-wider shrink-0">Active</span>
                      ) : (
                        <span className="bg-orange-100 border border-orange-600 text-orange-700 font-black px-1 py-[1px] text-[8px] sm:text-[10px] uppercase tracking-wider shrink-0">Revoked</span>
                      )}
                    </div>
                    <p className="font-bold text-gray-600 text-[10px] sm:text-xs truncate">{resident.phone || 'No phone'}</p>
                  </div>

                  <div className="flex gap-1 shrink-0">
                    {resident.is_approved ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); triggerRemovalModal(resident); }}
                        className="border-2 border-black w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-orange-300 font-black hover:bg-orange-400 active:translate-y-[1px] active:translate-x-[1px] active:shadow-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                        title="Revoke Access"
                      >
                        ✕
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleApprove(resident.id); }}
                          className="border-2 border-black w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-green-300 font-black hover:bg-green-400 active:translate-y-[1px] active:translate-x-[1px] active:shadow-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                          title="Approve Resident"
                        >
                          ✓
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); triggerDeletionModal(resident); }}
                          className="border-2 border-black w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-red-400 font-black hover:bg-red-500 active:translate-y-[1px] active:translate-x-[1px] active:shadow-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                          title="Delete Record"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Profile Info Modal */}
        {selectedResident && (
          <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 backdrop-blur-sm mt-0">
            <div className="border-4 border-black p-6 sm:p-8 bg-white shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-w-sm w-full">
              <h2 className="text-2xl font-black mb-6 uppercase tracking-tight truncate">
                {selectedResident.full_name}
              </h2>

              <div className="space-y-4 mb-8 border-4 border-black p-4 bg-gray-100">
                <div>
                  <p className="font-black text-sm text-gray-600">PHONE</p>
                  <p className="font-bold text-lg">{selectedResident.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="font-black text-sm text-gray-600">STATUS</p>
                  <p className={`font-bold text-lg ${selectedResident.is_approved ? 'text-green-600' : 'text-orange-600'}`}>
                    {selectedResident.is_approved ? 'APPROVED' : 'DISAPPROVED'}
                  </p>
                </div>
                <div className="flex justify-between items-center bg-yellow-200 border-2 border-black p-2 mt-2">
                  <p className="font-black text-sm uppercase">Wash Score</p>
                  <p className="font-black text-2xl">{selectedResident.wash_score ?? 100}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {selectedResident.is_approved && (
                  <button
                    onClick={() => triggerRemovalModal(selectedResident)}
                    disabled={updating}
                    className="w-full border-4 border-black py-3 bg-orange-300 font-black hover:bg-orange-400 active:translate-y-1 active:translate-x-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
                  >
                    REVOKE ACCESS
                  </button>
                )}

                {!selectedResident.is_approved && (
                  <>
                    <button
                      onClick={() => handleApprove(selectedResident.id)}
                      disabled={updating}
                      className="w-full border-4 border-black py-3 bg-green-300 font-black hover:bg-green-400 active:translate-y-1 active:translate-x-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
                    >
                      APPROVE ACCESS
                    </button>
                    <button
                      onClick={() => triggerDeletionModal(selectedResident)}
                      disabled={updating}
                      className="w-full border-4 border-black py-3 bg-red-400 font-black hover:bg-red-500 active:translate-y-1 active:translate-x-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 text-white"
                    >
                      DELETE RECORD
                    </button>
                  </>
                )}

                <button
                  onClick={() => setSelectedResident(null)}
                  className="w-full border-4 border-black py-3 bg-gray-300 font-black hover:bg-gray-400 active:translate-y-1 active:translate-x-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Retro Warning Modal */}
        {actionModal && createPortal(
          <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 backdrop-blur-sm mb-0">
            <div className="border-4 border-black p-6 sm:p-8 bg-yellow-200 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-w-sm w-full text-center">
              <div className="text-5xl mb-4">⚠️</div>
              <h3 className="text-3xl font-black mb-4 uppercase tracking-tight">Hold Up!</h3>

              {actionModal.type === 'remove' && (
                <p className="font-bold mb-8 text-sm sm:text-base leading-snug">
                  Are you sure you want to revoke access for this resident? They will not be able to book machines.
                </p>
              )}

              {actionModal.type === 'delete' && (
                <p className="font-bold mb-8 text-sm sm:text-base leading-snug">
                  Are you sure you want to permanently hide this record? This action cannot be undone.
                </p>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setActionModal(null)}
                  className="w-full border-4 border-black py-4 bg-white font-black hover:bg-gray-100 active:translate-y-1 active:translate-x-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-lg"
                >
                  NEVERMIND
                </button>
                <button
                  onClick={confirmAction}
                  disabled={updating}
                  className={`w-full border-4 border-black py-4 font-black active:translate-y-1 active:translate-x-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-lg disabled:opacity-50 ${actionModal.type === 'remove'
                    ? 'bg-orange-400 hover:bg-orange-500'
                    : 'bg-red-500 hover:bg-red-600 text-white'
                    }`}
                >
                  {updating
                    ? 'PROCESSING...'
                    : actionModal.type === 'remove'
                      ? 'YES, REVOKE'
                      : 'YES, DELETE'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </PullToRefresh>
  )
}