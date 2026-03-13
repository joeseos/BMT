import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getDeal, addDealLine, deleteDealLine } from '~/server/functions/deals'
import { getProducts, getProductWithRelations } from '~/server/functions/products'
import { calculateSitePrice } from '~/server/functions/pricing-engine'
import { formatSEK, formatPercent, getStatusColor, getPaybackColor } from '~/lib/pricing-types'
import type { Product, DealLineAddon, ProductAddon, ProductHardwareLink, EquipmentCost } from '~/server/db/schema'

export const Route = createFileRoute('/deals/$dealId')({
  component: DealDetail,
  loader: async ({ params }) => {
    const dealData = await getDeal({ data: { id: Number(params.dealId) } })
    return dealData
  },
})

function DealDetail() {
  const { deal, lines, totalPnl, approvals } = Route.useLoaderData()
  const router = useRouter()
  const [showAddLine, setShowAddLine] = useState(false)

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
          <button
            onClick={() => setShowAddLine(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
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
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          <PnlCard label="Revenue (OT)" value={formatSEK(totalPnl.revenueOneTime)} />
          <PnlCard label="Revenue (Monthly)" value={formatSEK(totalRevenueMonthly)} />
          <PnlCard label="COGS (OT)" value={formatSEK(totalPnl.cogsOneTime)} negative />
          <PnlCard label="COGS (Monthly)" value={formatSEK(totalCogsMonthly)} negative />
          <PnlCard label="CAPEX" value={formatSEK(totalPnl.capex)} negative />
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
            <button
              onClick={() => setShowAddLine(true)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
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
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lines.map((line) => {
                  const lineCm1Pct = (line.revenueMonthly ?? 0) > 0
                    ? ((line.revenueMonthly ?? 0) - (line.cogsMonthly ?? 0)) / (line.revenueMonthly ?? 0)
                    : 0
                  const addons = line.lineAddons?.filter((a: DealLineAddon) => a.type === 'addon') ?? []
                  const hwItems = line.lineAddons?.filter((a: DealLineAddon) => a.type === 'hardware') ?? []

                  return (
                    <>
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
                        <td className="px-3 py-2">
                          <button
                            onClick={async () => {
                              if (confirm('Delete this line?')) {
                                await deleteDealLine({ data: { id: line.id } })
                                router.invalidate()
                              }
                            }}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                      {/* Sub-items: addons */}
                      {addons.map((addon: DealLineAddon) => (
                        <tr key={`addon-${addon.id}`} className="bg-blue-50/30">
                          <td className="px-3 py-1 text-xs text-gray-500 pl-8" colSpan={2}>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs mr-1">Addon</span>
                            #{addon.referenceId} x{addon.quantity}
                          </td>
                          <td className="px-3 py-1 text-xs text-right font-mono" colSpan={1}></td>
                          <td className="px-3 py-1 text-xs text-right font-mono">{formatSEK(addon.priceOneTime ?? 0)}</td>
                          <td className="px-3 py-1 text-xs text-right font-mono">{formatSEK(addon.priceMonthly ?? 0)}</td>
                          <td colSpan={4}></td>
                        </tr>
                      ))}
                      {/* Sub-items: hardware */}
                      {hwItems.map((hw: DealLineAddon) => (
                        <tr key={`hw-${hw.id}`} className="bg-green-50/30">
                          <td className="px-3 py-1 text-xs text-gray-500 pl-8" colSpan={2}>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-xs mr-1">HW</span>
                            #{hw.referenceId} x{hw.quantity}
                          </td>
                          <td className="px-3 py-1 text-xs text-right font-mono" colSpan={1}></td>
                          <td className="px-3 py-1 text-xs text-right font-mono" colSpan={2}></td>
                          <td className="px-3 py-1 text-xs text-right font-mono" colSpan={1}>CAPEX: {formatSEK(hw.capex ?? 0)}</td>
                          <td colSpan={3}></td>
                        </tr>
                      ))}
                    </>
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

      {/* Add Line Modal */}
      {showAddLine && (
        <AddLineModal
          dealId={deal.id}
          contractLengthMonths={deal.contractLengthMonths}
          onClose={() => setShowAddLine(false)}
          onSaved={() => { setShowAddLine(false); router.invalidate() }}
        />
      )}
    </div>
  )
}

// ── Add Line Modal with Addon/Hardware Selection ──

function AddLineModal({
  dealId,
  contractLengthMonths,
  onClose,
  onSaved,
}: {
  dealId: number
  contractLengthMonths: number
  onClose: () => void
  onSaved: () => void
}) {
  const [step, setStep] = useState<'product' | 'addons'>('product')
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [productRelations, setProductRelations] = useState<{ addons: (ProductAddon & { addon: Product | undefined })[]; hardware: (ProductHardwareLink & { hardware: EquipmentCost | undefined })[] } | null>(null)
  const [selectedAddons, setSelectedAddons] = useState<Map<number, number>>(new Map())
  const [selectedHardware, setSelectedHardware] = useState<Map<number, number>>(new Map())
  const [loading, setLoading] = useState(false)
  const [lineForm, setLineForm] = useState({
    address: '',
    city: '',
    country: 'SE',
    quantity: 1,
    accessCostOneTime: 0,
    accessCostQuarterly: 0,
    discountOneTime: 0,
    discountMonthly: 0,
    isRenewal: false,
  })

  // Load products on mount
  useState(() => {
    getProducts({ data: { activeOnly: true, isAddonService: false } }).then(setAllProducts)
  })

  async function selectProduct(productId: number) {
    setSelectedProductId(productId)
    const relations = await getProductWithRelations({ data: { id: productId } })
    setProductRelations(relations)

    // Pre-select defaults
    const defaultAddons = new Map<number, number>()
    for (const a of relations.addons) {
      if (a.isDefault) defaultAddons.set(a.addonProductId, 1)
    }
    setSelectedAddons(defaultAddons)

    const defaultHw = new Map<number, number>()
    for (const h of relations.hardware) {
      if (h.isDefault || h.isRequired) defaultHw.set(h.hardwareId, h.quantity ?? 1)
    }
    setSelectedHardware(defaultHw)

    setStep('addons')
  }

  async function handleSave() {
    if (!selectedProductId) return
    setLoading(true)

    try {
      // Calculate pricing
      const addonsArray = Array.from(selectedAddons.entries()).map(([productId, quantity]) => ({ productId, quantity }))
      const hardwareArray = Array.from(selectedHardware.entries()).map(([hardwareId, quantity]) => ({ hardwareId, quantity }))

      const pricing = await calculateSitePrice({
        data: {
          productId: selectedProductId,
          country: lineForm.country,
          accessCostOneTime: lineForm.accessCostOneTime,
          accessCostQuarterly: lineForm.accessCostQuarterly,
          discountOneTime: lineForm.discountOneTime,
          discountMonthly: lineForm.discountMonthly,
          contractLengthMonths: contractLengthMonths,
          isRenewal: lineForm.isRenewal,
          quantity: lineForm.quantity,
          addons: addonsArray,
          hardware: hardwareArray,
        },
      })

      // Build lineAddons array for deal storage
      const lineAddons: { type: 'addon' | 'hardware'; referenceId: number; quantity: number; priceOneTime: number; priceMonthly: number; costOneTime: number; costMonthly: number; capex: number }[] = []
      for (const ab of pricing.addonBreakdown) {
        lineAddons.push({
          type: 'addon' as const,
          referenceId: ab.productId,
          quantity: ab.quantity,
          priceOneTime: ab.priceOneTime,
          priceMonthly: ab.priceMonthly,
          costOneTime: ab.costOneTime,
          costMonthly: ab.costMonthly,
          capex: ab.capex,
        })
      }
      for (const hb of pricing.hardwareBreakdown) {
        lineAddons.push({
          type: 'hardware' as const,
          referenceId: hb.hardwareId,
          quantity: hb.quantity,
          priceOneTime: 0,
          priceMonthly: 0,
          costOneTime: 0,
          costMonthly: 0,
          capex: hb.capex,
        })
      }

      const product = allProducts.find((p) => p.id === selectedProductId)

      await addDealLine({
        data: {
          dealId,
          address: lineForm.address,
          city: lineForm.city,
          country: lineForm.country,
          productId: selectedProductId,
          serviceName: product?.displayName,
          capacity: product?.bandwidth ?? undefined,
          accessType: product?.accessType ?? undefined,
          quantity: lineForm.quantity,
          accessCostOneTime: lineForm.accessCostOneTime,
          accessCostQuarterly: lineForm.accessCostQuarterly,
          discountOneTime: lineForm.discountOneTime,
          discountMonthly: lineForm.discountMonthly,
          isRenewal: lineForm.isRenewal,
          lineAddons,
        },
      })

      onSaved()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Add Site Line</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        {step === 'product' ? (
          <div className="space-y-4">
            {/* Site details */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Address</label>
                <input type="text" value={lineForm.address} onChange={(e) => setLineForm((f) => ({ ...f, address: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">City</label>
                <input type="text" value={lineForm.city} onChange={(e) => setLineForm((f) => ({ ...f, city: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Access Cost OT</label>
                <input type="number" value={lineForm.accessCostOneTime} onChange={(e) => setLineForm((f) => ({ ...f, accessCostOneTime: Number(e.target.value) }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Access Cost Quarterly</label>
                <input type="number" value={lineForm.accessCostQuarterly} onChange={(e) => setLineForm((f) => ({ ...f, accessCostQuarterly: Number(e.target.value) }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Quantity</label>
                <input type="number" value={lineForm.quantity} min={1} onChange={(e) => setLineForm((f) => ({ ...f, quantity: Number(e.target.value) }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm pb-1">
                  <input type="checkbox" checked={lineForm.isRenewal} onChange={(e) => setLineForm((f) => ({ ...f, isRenewal: e.target.checked }))} />
                  Renewal
                </label>
              </div>
            </div>

            {/* Product selection */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Select Product</label>
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded">
                {allProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectProduct(p.id)}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 text-sm flex justify-between"
                  >
                    <span className="font-medium text-gray-900">{p.displayName}</span>
                    <span className="text-gray-500 text-xs">{p.familyCode} · {p.bandwidth ? `${p.bandwidth}M` : ''}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <button onClick={() => setStep('product')} className="text-sm text-blue-600 hover:text-blue-800">
              &larr; Back to product selection
            </button>

            <p className="text-sm text-gray-700">
              Product: <span className="font-medium">{allProducts.find((p) => p.id === selectedProductId)?.displayName}</span>
            </p>

            {/* Addon selection */}
            {productRelations && productRelations.addons.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Available Addons</h3>
                <div className="space-y-1">
                  {productRelations.addons.map((link: ProductAddon & { addon: Product | undefined }) => {
                    const isSelected = selectedAddons.has(link.addonProductId)
                    const isRequired = false // Addons aren't required, just default
                    return (
                      <div key={link.id} className="flex items-center gap-3 bg-gray-50 rounded px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const newMap = new Map(selectedAddons)
                            if (e.target.checked) newMap.set(link.addonProductId, 1)
                            else newMap.delete(link.addonProductId)
                            setSelectedAddons(newMap)
                          }}
                        />
                        <span className="flex-1 font-medium">{link.addon?.displayName}</span>
                        {isSelected && (
                          <input
                            type="number"
                            min={1}
                            value={selectedAddons.get(link.addonProductId) ?? 1}
                            onChange={(e) => {
                              const newMap = new Map(selectedAddons)
                              newMap.set(link.addonProductId, Number(e.target.value) || 1)
                              setSelectedAddons(newMap)
                            }}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Hardware selection */}
            {productRelations && productRelations.hardware.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Hardware</h3>
                <div className="space-y-1">
                  {productRelations.hardware.map((link: ProductHardwareLink & { hardware: EquipmentCost | undefined }) => {
                    const isSelected = selectedHardware.has(link.hardwareId)
                    return (
                      <div key={link.id} className="flex items-center gap-3 bg-gray-50 rounded px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={link.isRequired ?? false}
                          onChange={(e) => {
                            const newMap = new Map(selectedHardware)
                            if (e.target.checked) newMap.set(link.hardwareId, link.quantity ?? 1)
                            else newMap.delete(link.hardwareId)
                            setSelectedHardware(newMap)
                          }}
                        />
                        <span className="flex-1">
                          <span className="font-medium">{link.hardware?.description}</span>
                          <span className="text-gray-500 ml-2">
                            {link.hardware?.netPriceSek ? formatSEK(link.hardware.netPriceSek) : ''}
                          </span>
                          {link.isRequired && <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Required</span>}
                        </span>
                        {isSelected && (
                          <input
                            type="number"
                            min={1}
                            value={selectedHardware.get(link.hardwareId) ?? 1}
                            onChange={(e) => {
                              const newMap = new Map(selectedHardware)
                              newMap.set(link.hardwareId, Number(e.target.value) || 1)
                              setSelectedHardware(newMap)
                            }}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Add Line'}
              </button>
            </div>
          </div>
        )}
      </div>
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
