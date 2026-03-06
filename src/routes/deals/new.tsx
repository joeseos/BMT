import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { createDeal } from '~/server/functions/deals'

export const Route = createFileRoute('/deals/new')({
  component: NewDeal,
})

function NewDeal() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    customerName: '',
    orgNumber: '',
    contractLengthMonths: 36,
    accessRequestRef: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const deal = await createDeal({
        data: {
          customerName: form.customerName,
          orgNumber: form.orgNumber || undefined,
          contractLengthMonths: form.contractLengthMonths,
          accessRequestRef: form.accessRequestRef || undefined,
        },
      })
      navigate({ to: `/deals/${deal.id}` })
    } catch (err) {
      console.error('Failed to create deal:', err)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Deal</h1>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
            <input
              type="text"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g. Acme AB"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Org Number</label>
            <input
              type="text"
              value={form.orgNumber}
              onChange={(e) => setForm({ ...form, orgNumber: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="556xxx-xxxx"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contract Length (months)</label>
            <select
              value={form.contractLengthMonths}
              onChange={(e) => setForm({ ...form, contractLengthMonths: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={12}>12 months</option>
              <option value={24}>24 months</option>
              <option value={36}>36 months</option>
              <option value={48}>48 months</option>
              <option value={60}>60 months</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Access Request Reference</label>
            <input
              type="text"
              value={form.accessRequestRef}
              onChange={(e) => setForm({ ...form, accessRequestRef: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Referensnummer"
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={!form.customerName || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating...' : 'Create Deal'}
            </button>
            <button
              onClick={() => navigate({ to: '/deals' })}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
