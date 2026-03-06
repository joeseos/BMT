import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { getProducts, getProductFamilies, createProduct } from '~/server/functions/products'
import { formatSEK } from '~/lib/pricing-types'

export const Route = createFileRoute('/admin/products')({
  component: AdminProducts,
  loader: async () => {
    const [products, families] = await Promise.all([
      getProducts({ data: { activeOnly: true } }),
      getProductFamilies(),
    ])
    return { products, families }
  },
})

function AdminProducts() {
  const { products, families } = Route.useLoaderData()
  const [search, setSearch] = useState('')
  const [familyFilter, setFamilyFilter] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const filtered = products.filter((p) => {
    const matchesSearch = !search || p.displayName.toLowerCase().includes(search.toLowerCase())
    const matchesFamily = !familyFilter || p.familyCode === familyFilter
    return matchesSearch && matchesFamily
  })

  // Column groups for visual clarity
  const colGroups = [
    { label: 'Product', cols: ['Display Name', 'Family', 'Access Type', 'BW'] },
    { label: 'List Prices', cols: ['OT', 'Monthly'], color: 'bg-blue-50' },
    { label: 'COGS', cols: ['OT', 'Annual'], color: 'bg-orange-50' },
    { label: 'CPE', cols: ['Install', 'CAPEX'], color: 'bg-green-50' },
    { label: 'Network', cols: ['BB', 'GT'], color: 'bg-purple-50' },
    { label: 'OPEX', cols: ['OT', 'Annual'], color: 'bg-amber-50' },
    { label: 'Breakpoints', cols: ['OT', 'Annual', 'Surcharge'], color: 'bg-red-50' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Product Catalog</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={familyFilter}
          onChange={(e) => setFamilyFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Families</option>
          {families.map((f) => (
            <option key={f.id} value={f.code}>{f.code} — {f.name}</option>
          ))}
        </select>
        <span className="flex items-center text-sm text-gray-500">
          {filtered.length} products
        </span>
      </div>

      {/* Products table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-xs">
          {/* Column group headers */}
          <thead>
            <tr>
              {colGroups.map((group) => (
                <th
                  key={group.label}
                  colSpan={group.cols.length}
                  className={`px-2 py-1 text-center text-xs font-semibold text-gray-700 border-b border-r border-gray-200 ${group.color || 'bg-gray-50'}`}
                >
                  {group.label}
                </th>
              ))}
            </tr>
            <tr className="bg-gray-50">
              {colGroups.flatMap((group) =>
                group.cols.map((col) => (
                  <th
                    key={`${group.label}-${col}`}
                    className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap border-r border-gray-100"
                  >
                    {col}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50">
                {/* Product info */}
                <td className="px-2 py-1.5 font-medium text-gray-900 max-w-[200px] truncate" title={product.displayName}>
                  {product.displayName}
                </td>
                <td className="px-2 py-1.5 text-gray-600">{product.familyCode}</td>
                <td className="px-2 py-1.5 text-gray-600">{product.accessType || '—'}</td>
                <td className="px-2 py-1.5 text-gray-600 text-right">{product.bandwidth || '—'}</td>
                {/* List prices */}
                <td className="px-2 py-1.5 text-right font-mono bg-blue-50/30">{fmt(product.listPriceOneTime)}</td>
                <td className="px-2 py-1.5 text-right font-mono bg-blue-50/30">{fmt(product.listPriceMonthly)}</td>
                {/* COGS */}
                <td className="px-2 py-1.5 text-right font-mono bg-orange-50/30">{fmt(product.cogsOneTime)}</td>
                <td className="px-2 py-1.5 text-right font-mono bg-orange-50/30">{fmt(product.cogsAnnual)}</td>
                {/* CPE */}
                <td className="px-2 py-1.5 text-right font-mono bg-green-50/30">{fmt(product.cpeInstallation)}</td>
                <td className="px-2 py-1.5 text-right font-mono bg-green-50/30">{fmt(product.cpeCapex)}</td>
                {/* Network */}
                <td className="px-2 py-1.5 text-right font-mono bg-purple-50/30">{fmt(product.backboneCostAnnual)}</td>
                <td className="px-2 py-1.5 text-right font-mono bg-purple-50/30">{fmt(product.gtCostAnnual)}</td>
                {/* OPEX */}
                <td className="px-2 py-1.5 text-right font-mono bg-amber-50/30">{fmt(product.opexOneTime)}</td>
                <td className="px-2 py-1.5 text-right font-mono bg-amber-50/30">{fmt(product.opexAnnual)}</td>
                {/* Breakpoints */}
                <td className="px-2 py-1.5 text-right font-mono bg-red-50/30">{fmt(product.breakpointAccessOneTime)}</td>
                <td className="px-2 py-1.5 text-right font-mono bg-red-50/30">{fmt(product.breakpointAccessAnnual)}</td>
                <td className="px-2 py-1.5 text-right font-mono bg-red-50/30">{product.marginalSurcharge ? `${(product.marginalSurcharge * 100).toFixed(0)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* TODO: Create product modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Add Product</h2>
            <p className="text-sm text-gray-500 mb-4">
              Product creation form will go here. You'll fill in all 26 fields from the Excel product catalog.
            </p>
            <button
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function fmt(val: number | null | undefined): string {
  if (val === null || val === undefined || val === 0) return '—'
  return new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(val)
}
