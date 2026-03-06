import { createFileRoute, Link } from '@tanstack/react-router'
import { getDeals } from '~/server/functions/deals'
import { getProducts } from '~/server/functions/products'

export const Route = createFileRoute('/')({
  component: Dashboard,
  loader: async () => {
    const [deals, products] = await Promise.all([
      getDeals(),
      getProducts({ data: {} }),
    ])
    return { deals, products }
  },
})

function Dashboard() {
  const { deals, products } = Route.useLoaderData()

  const draftCount = deals.filter((d) => d.status === 'draft').length
  const pendingCount = deals.filter((d) => d.status === 'pending_approval').length
  const approvedCount = deals.filter((d) => d.status === 'approved').length

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Products" value={products.length} color="blue" />
        <StatCard label="Draft Deals" value={draftCount} color="gray" />
        <StatCard label="Pending Approval" value={pendingCount} color="amber" />
        <StatCard label="Approved" value={approvedCount} color="green" />
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 mb-8">
        <Link
          to="/deals/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + New Deal
        </Link>
        <Link
          to="/admin/products"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Manage Products
        </Link>
      </div>

      {/* Recent deals */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Deals</h2>
      {deals.length === 0 ? (
        <p className="text-gray-500 text-sm">No deals yet. Create your first deal to get started.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contract</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {deals.slice(0, 10).map((deal) => (
                <tr key={deal.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/deals/${deal.id}`} className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                      {deal.customerName}
                    </Link>
                  </td>
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

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    green: 'bg-green-50 text-green-700 border-green-200',
  }
  return (
    <div className={`rounded-lg border p-4 ${colorMap[color] || colorMap.gray}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
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
  const labels: Record<string, string> = {
    draft: 'Draft',
    pending_approval: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
      {labels[status] || status}
    </span>
  )
}
