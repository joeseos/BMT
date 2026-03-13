import { createFileRoute, Link } from '@tanstack/react-router'
import { getDeals } from '~/server/functions/deals'

export const Route = createFileRoute('/deals/')({
  component: DealsList,
  loader: () => getDeals(),
})

function DealsList() {
  const deals = Route.useLoaderData()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Deals</h1>
        <Link
          to="/deals/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + New Deal
        </Link>
      </div>

      {deals.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500 mb-4">No deals yet.</p>
          <Link to="/deals/new" className="text-blue-600 hover:text-blue-800 font-medium">
            Create your first deal
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Org Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contract</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {deals.map((deal) => (
                <tr key={deal.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">#{deal.id}</td>
                  <td className="px-4 py-3">
                    <Link
                      to="/deals/$dealId"
                      params={{ dealId: String(deal.id) }}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                    >
                      {deal.customerName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{deal.orgNumber || '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={deal.status ?? 'draft'} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{deal.contractLengthMonths} mån</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {deal.updatedAt ? new Date(deal.updatedAt).toLocaleDateString('sv-SE') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    pending_approval: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
      {status?.replace('_', ' ') || 'draft'}
    </span>
  )
}
