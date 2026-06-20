import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function ManageResidents({ pgId, ownerId }) {
  const [residents, setResidents] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedResident, setSelectedResident] = useState(null)
  const [actionModal, setActionModal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  // Fetch residents on mount
  useEffect(() => {
    fetchResidents()
  }, [pgId])

  const fetchResidents = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('pg_id', pgId)
        .eq('is_deleted', false)
        .neq('id', ownerId)
        .order('full_name')

      if (error) throw error
      setResidents(data || [])
    } catch (error) {
      console.error('Error fetching residents:', error)
      alert('Failed to fetch residents')
    } finally {
      setLoading(false)
    }
  }

  // Filter residents based on search query
  const filteredResidents = residents.filter((resident) => {
    const query = searchQuery.toLowerCase()
    return (
      resident.full_name?.toLowerCase().includes(query) ||
      resident.phone?.toLowerCase().includes(query)
    )
  })

  // Handle disapproving a resident (remove access)
  const handleDisapprove = async (residentId) => {
    try {
      setUpdating(true)
      await supabase
        .from('profiles')
        .update({ is_approved: false })
        .eq('id', residentId)

      // Refresh list and close modals
      await fetchResidents()
      setSelectedResident(null)
      setActionModal(null)
      alert('Access revoked successfully!')
    } catch (error) {
      console.error('Error revoking access:', error)
      alert('Failed to revoke access')
    } finally {
      setUpdating(false)
    }
  }

  // Handle approving a resident
  const handleApprove = async (residentId) => {
    try {
      setUpdating(true)
      await supabase
        .from('profiles')
        .update({ is_approved: true })
        .eq('id', residentId)

      // Refresh list and close modals
      await fetchResidents()
      setSelectedResident(null)
      alert('Resident approved successfully!')
    } catch (error) {
      console.error('Error approving resident:', error)
      alert('Failed to approve resident')
    } finally {
      setUpdating(false)
    }
  }

  // Handle soft-deleting a resident
  const handleSoftDelete = async (residentId) => {
    try {
      setUpdating(true)
      await supabase
        .from('profiles')
        .update({ is_deleted: true })
        .eq('id', residentId)

      // Refresh list and close modals
      await fetchResidents()
      setSelectedResident(null)
      setActionModal(null)
      alert('Record deleted successfully!')
    } catch (error) {
      console.error('Error deleting record:', error)
      alert('Failed to delete record')
    } finally {
      setUpdating(false)
    }
  }

  // Trigger the warning modal for removal
  const triggerRemovalModal = (resident) => {
    setActionModal({ type: 'remove', resident })
  }

  // Trigger the warning modal for deletion
  const triggerDeletionModal = (resident) => {
    setActionModal({ type: 'delete', resident })
  }

  // Confirm action from warning modal
  const confirmAction = () => {
    if (!actionModal) return

    if (actionModal.type === 'remove') {
      handleDisapprove(actionModal.resident.id)
    } else if (actionModal.type === 'delete') {
      handleSoftDelete(actionModal.resident.id)
    }
  }

  return (
    <div className="space-y-6 relative">
      {/* Profile Info Modal */}
      {selectedResident && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 backdrop-blur-sm mt-0">
          <div className="border-4 border-black p-6 sm:p-8 bg-white shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-w-sm w-full">
            <h2 className="text-2xl font-black mb-6 uppercase tracking-tight">
              {selectedResident.full_name}
            </h2>

            <div className="space-y-4 mb-8 border-4 border-black p-4 bg-gray-100">
              <div>
                <p className="font-black text-sm text-gray-600">PHONE</p>
                <p className="font-bold text-lg">{selectedResident.phone || 'N/A'}</p>
              </div>
              <div>
                <p className="font-black text-sm text-gray-600">EMAIL</p>
                <p className="font-bold text-lg break-all">{selectedResident.email || 'N/A'}</p>
              </div>
              <div>
                <p className="font-black text-sm text-gray-600">STATUS</p>
                <p className={`font-bold text-lg ${selectedResident.is_approved ? 'text-green-600' : 'text-orange-600'}`}>
                  {selectedResident.is_approved ? 'APPROVED' : 'DISAPPROVED'}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {selectedResident.is_approved && (
                <button
                  onClick={() => triggerRemovalModal(selectedResident)}
                  disabled={updating}
                  className="w-full border-4 border-black py-3 bg-orange-300 font-black hover:bg-orange-400 active:translate-y-1 active:translate-x-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
                >
                  DISAPPROVE
                </button>
              )}

              {!selectedResident.is_approved && (
                <>
                  <button
                    onClick={() => handleApprove(selectedResident.id)}
                    disabled={updating}
                    className="w-full border-4 border-black py-3 bg-green-300 font-black hover:bg-green-400 active:translate-y-1 active:translate-x-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
                  >
                    APPROVE
                  </button>
                  <button
                    onClick={() => triggerDeletionModal(selectedResident)}
                    disabled={updating}
                    className="w-full border-4 border-black py-3 bg-red-300 font-black hover:bg-red-400 active:translate-y-1 active:translate-x-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
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
      {actionModal && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 backdrop-blur-sm">
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
                className={`w-full border-4 border-black py-4 font-black active:translate-y-1 active:translate-x-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-lg disabled:opacity-50 ${
                  actionModal.type === 'remove'
                    ? 'bg-orange-400 hover:bg-orange-500'
                    : 'bg-red-400 hover:bg-red-500'
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
        </div>
      )}

      {/* Search Bar */}
      <div className="border-4 border-black p-4 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <input
          type="text"
          placeholder="🔍 Search by name or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full border-4 border-black p-3 font-bold text-lg focus:outline-none focus:bg-yellow-100 transition-colors"
        />
      </div>

      {/* Resident List */}
      <div className="border-4 border-black p-4 bg-blue-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h2 className="text-2xl font-black mb-6 uppercase tracking-tight">
          Residents ({filteredResidents.length})
        </h2>

        {loading ? (
          <div className="text-center p-8 border-4 border-black bg-white">
            <p className="text-xl font-bold">Loading residents...</p>
          </div>
        ) : filteredResidents.length === 0 ? (
          <div className="text-center p-8 border-4 border-black bg-white">
            <p className="text-xl font-bold">
              {residents.length === 0 ? 'No residents yet.' : 'No matches found.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredResidents.map((resident) => (
              <div
                key={resident.id}
                className="border-4 border-black p-4 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex justify-between items-center gap-4 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => setSelectedResident(resident)}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-black text-lg">{resident.full_name}</p>
                  <p className="font-bold text-gray-600 text-sm">{resident.phone || 'No phone'}</p>
                  <p className={`text-xs font-black mt-1 ${resident.is_approved ? 'text-green-600' : 'text-orange-600'}`}>
                    {resident.is_approved ? '✓ APPROVED' : '✗ DISAPPROVED'}
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    triggerRemovalModal(resident)
                  }}
                  className="border-4 border-black p-2 bg-red-300 font-black hover:bg-red-400 active:translate-y-1 active:translate-x-1 active:shadow-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all flex-shrink-0 w-10 h-10 flex items-center justify-center text-lg"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
