import { createFileRoute, Link } from '@tanstack/react-router'
import { getDeal } from '~/server/functions/deals'
import { formatSEK, formatPercent, getStatusColor, getPaybackColor } from '~/lib/pricing-types'

export const Route = createFileRoute('/deals/$dealId')({
  component: DealDetail,
  loader: ({ params }) => getDeal({ data: { id: Number(params.dealId) } }),
})

function DealDetail() {
  const { deal, lines, totalPnl, approvals } = Route.useLoaderData()

  const totalRevenueMonthly = totalPnl.revenueMonthly
  const totalCogsMonthly = totalPnl.cogsMonthly
  const cm1 = totalRevenueMonthly - totalCogsMonthly
  const cm1Pct = totalRevenueMonthly > 0 ? cm1 / totalRevenueMonthly : 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{deal.customerName}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(deal.status as any ?? 'draft')}`}>
              {deal.status?.replace('_', ' ') || 'draft'}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            {deal.orgNumber && `Org: ${deal.orgNumber} · `}
            Contract: {deal.contractLengthMonths} months
            {deal.accessRequestRef && ` · Ref: ${deal.accessRequestRef}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + Add Site
          </button>
          <button className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            Export
          </button>
        </div>
      </div>

      {/* P&L Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Deal P&L Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          <PnlCard label="Revenue (OT)" value={formatSEK(totalPnl.revenueOneTime)} />
          <PnlCard label="Revenue (Monthly)" value={formatSEK(totalRevenueMonthly)} />
          <PnlCard label="COGS (OT)" value={formatSEK(totalPnl.cogsOneTime)} negative />
          <PnlCard label="COGS (Monthly)" value={formatSEK(totalCogsMonthly)} negative />
          <PnlCard label="TB1" value={formatSEK(cm1)} highlight />
          <PnlCard label="TB1 %" value={formatPercent(cm1Pct)} highlight />
        </div>
      </div>

      {/* Site Lines Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-900">
            Site Lines ({lines.length})
          </h2>
        </div>

        {lines.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm mb-2">No site lines yet.</p>
            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              + Add first site
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Site</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Capacity</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Price OT</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Price/mån</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Zone</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payback</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">TB1 %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lines.map((line) => {
                  const lineCm1Pct = (line.revenueMonthly ?? 0) > 0
                    ? ((line.revenueMonthly ?? 0) - (line.cogsMonthly ?? 0)) / (line.revenueMonthly ?? 0)
                    : 0
                  return (
                    <tr key={line.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm">
                        <div className="font-medium text-gray-900">{line.city || line.address || `Site ${line.id}`}</div>
                        <div className="text-gray-500 text-xs">{line.country} · Qty {line.quantity}</div>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">{line.serviceName || '—'}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{line.capacity ? `${line.capacity} Mbit` : '—'}</td>
                      <td className="px-3 py-2 text-sm text-right font-mono">{formatSEK(line.finalPriceOneTime ?? 0)}</td>
                      <td className="px-3 py-2 text-sm text-right font-mono">{formatSEK(line.finalPriceMonthly ?? 0)}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">{line.zone || '—'}</td>
                      <td className="px-3 py-2">
                        {line.paybackStatus && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPaybackColor(line.paybackStatus as any)}`}>
                            {line.paybackMonths !== null ? `${line.paybackMonths} mån` : line.paybackStatus}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-right font-mono">{formatPercent(lineCm1Pct)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approval History */}
      {approvals.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Approval History</h2>
          <div className="space-y-2">
            {approvals.map((a) => (
              <div key={a.id} className="flex items-center gap-3 text-sm">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  a.action === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {a.action}
                </span>
                <span className="text-gray-700 font-medium">{a.approverName}</span>
                <span className="text-gray-400">({a.level})</span>
                {a.comments && <span className="text-gray-500">— {a.comments}</span>}
                <span className="text-gray-400 text-xs ml-auto">
                  {a.timestamp ? new Date(a.timestamp).toLocaleString('sv-SE') : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PnlCard({
  label, value, negative, highlight,
}: {
  label: string; value: string; negative?: boolean; highlight?: boolean
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-lg font-semibold font-mono ${
        highlight ? 'text-blue-700' : negative ? 'text-red-600' : 'text-gray-900'
      }`}>
        {value}
      </p>
    </div>
  )
}
