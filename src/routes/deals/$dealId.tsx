import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { getDeal, addDealLine, addDealAddresses, assignProductToLines, deleteDealLine } from '~/server/functions/deals'
import { getProducts, getProductWithRelations } from '~/server/functions/products'
import { calculateSitePrice } from '~/server/functions/pricing-engine'
import { formatSEK, formatPercent, getStatusColor, getPaybackColor } from '~/lib/pricing-types'
import { AVAILABLE_SPEEDS } from '~/server/db/schema'
import type { Product, DealLineAddon, ProductAddon, ProductHardwareLink, EquipmentCost } from '~/server/db/schema'

export const Route = createFileRoute('/deals/$dealId')({
  component: DealDetail,
  loader: async ({ params }) => {
    const dealData = await getDeal({ data: { id: Number(params.dealId) } })
    return dealData
  },
})

type ModalState = 'none' | 'addAddress' | 'importAddresses' | 'assignProduct'

function DealDetail() {
  const { deal, lines, totalPnl, approvals } = Route.useLoaderData()
  const router = useRouter()
  const [modal, setModal] = useState<ModalState>('none')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const totalRevenueMonthly = totalPnl.revenueMonthly
  const totalCogsMonthly = totalPnl.cogsMonthly
  const cm1 = totalRevenueMonthly - totalCogsMonthly
  const cm1Pct = totalRevenueMonthly > 0 ? cm1 / totalRevenueMonthly : 0
  const ebit = cm1 - totalPnl.networkCost
  const ebitPct = totalRevenueMonthly > 0 ? ebit / totalRevenueMonthly : 0

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === lines.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(lines.map((l) => l.id)))
    }
  }

  function closeModal() {
    setModal('none')
  }

  function onSaved() {
    closeModal()
    setSelectedIds(new Set())
    router.invalidate()
  }

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
            onClick={() => setModal('addAddress')}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Add Address
          </button>
          <button
            onClick={() => setModal('importAddresses')}
            className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Import Addresses
          </button>
        </div>
      </div>

      {/* P&L Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Deal P&L Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-4">
          <PnlCard label="Revenue (OT)" value={formatSEK(totalPnl.revenueOneTime)} />
          <PnlCard label="Revenue (Monthly)" value={formatSEK(totalRevenueMonthly)} />
          <PnlCard label="COGS (OT)" value={formatSEK(totalPnl.cogsOneTime)} negative />
          <PnlCard label="COGS (Monthly)" value={formatSEK(totalCogsMonthly)} negative />
          <PnlCard label="CAPEX" value={formatSEK(totalPnl.capex)} negative />
          <PnlCard label="TB1" value={formatSEK(cm1)} highlight />
          <PnlCard label="TB1 %" value={formatPercent(cm1Pct)} highlight />
          <PnlCard label="EBIT" value={formatSEK(ebit)} highlight />
          <PnlCard label="EBIT %" value={formatPercent(ebitPct)} highlight />
        </div>
      </div>

      {/* Addresses Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Addresses ({lines.length})
          </h2>
        </div>

        {lines.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm mb-2">No addresses yet.</p>
            <button
              onClick={() => setModal('addAddress')}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              + Add first address
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === lines.length && lines.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Zip</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cost OT</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cost/Qtr</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
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
                  const isSelected = selectedIds.has(line.id)
                  const hasProduct = !!line.productId

                  return (
                    <>
                      <tr key={line.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50/40' : ''} ${!hasProduct ? 'bg-amber-50/30' : ''}`}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(line.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-3 py-2 text-gray-900 font-medium whitespace-nowrap">{line.address || '—'}</td>
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{line.city || '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{line.zipCode || '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-700">{line.accessCostOneTime ? formatSEK(line.accessCostOneTime) : '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-700">{line.accessCostQuarterly ? formatSEK(line.accessCostQuarterly) : '—'}</td>
                        <td className="px-3 py-2">
                          {hasProduct
                            ? <span className="text-gray-800">{line.serviceName || '—'}</span>
                            : <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700">Unassigned</span>
                          }
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{hasProduct ? formatSEK(line.finalPriceOneTime ?? 0) : '—'}</td>
                        <td className="px-3 py-2 text-right font-mono">{hasProduct ? formatSEK(line.finalPriceMonthly ?? 0) : '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{line.zone || '—'}</td>
                        <td className="px-3 py-2">
                          {line.paybackStatus && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPaybackColor(line.paybackStatus as any)}`}>
                              {line.paybackMonths !== null ? `${line.paybackMonths} mån` : line.paybackStatus}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{hasProduct ? formatPercent(lineCm1Pct) : '—'}</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={async () => {
                              if (confirm('Delete this address?')) {
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
                      {addons.map((addon: DealLineAddon) => (
                        <tr key={`addon-${addon.id}`} className="bg-blue-50/30">
                          <td className="px-3 py-1" />
                          <td className="px-3 py-1 text-xs text-gray-500 pl-8" colSpan={2}>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs mr-1">Addon</span>
                            #{addon.referenceId} x{addon.quantity}
                          </td>
                          <td colSpan={3} />
                          <td className="px-3 py-1 text-xs text-right font-mono">{formatSEK(addon.priceOneTime ?? 0)}</td>
                          <td className="px-3 py-1 text-xs text-right font-mono">{formatSEK(addon.priceMonthly ?? 0)}</td>
                          <td colSpan={5} />
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

      {/* Selection action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg px-6 py-3 flex items-center justify-between z-40">
          <span className="text-sm text-gray-700 font-medium">
            {selectedIds.size} address{selectedIds.size > 1 ? 'es' : ''} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Deselect all
            </button>
            <button
              onClick={() => setModal('assignProduct')}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Add Product
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {modal === 'addAddress' && (
        <AddAddressModal
          dealId={deal.id}
          onClose={closeModal}
          onSaved={onSaved}
        />
      )}
      {modal === 'importAddresses' && (
        <ImportAddressesModal
          dealId={deal.id}
          onClose={closeModal}
          onSaved={onSaved}
        />
      )}
      {modal === 'assignProduct' && (
        <AssignProductModal
          dealId={deal.id}
          dealLineIds={Array.from(selectedIds)}
          contractLengthMonths={deal.contractLengthMonths}
          onClose={closeModal}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}

// ── Add Address Modal ──

function AddAddressModal({
  dealId,
  onClose,
  onSaved,
}: {
  dealId: number
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    address: '',
    city: '',
    zipCode: '',
    country: 'SE',
    accessCostOneTime: 0,
    accessCostQuarterly: 0,
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await addDealLine({
        data: {
          dealId,
          address: form.address,
          city: form.city,
          zipCode: form.zipCode,
          country: form.country,
          accessCostOneTime: form.accessCostOneTime,
          accessCostQuarterly: form.accessCostQuarterly,
        },
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Add Address</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Address</label>
              <input type="text" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="Street address" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">City</label>
              <input type="text" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Zip Code</label>
              <input type="text" value={form.zipCode} onChange={(e) => setForm((f) => ({ ...f, zipCode: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Country</label>
              <input type="text" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Access Cost OT</label>
              <input type="number" value={form.accessCostOneTime} onChange={(e) => setForm((f) => ({ ...f, accessCostOneTime: Number(e.target.value) }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Access Cost Quarterly</label>
              <input type="number" value={form.accessCostQuarterly} onChange={(e) => setForm((f) => ({ ...f, accessCostQuarterly: Number(e.target.value) }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Add Address'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Import Addresses Modal ──

type ParsedAddress = {
  address: string
  city: string
  zipCode: string
  country: string
  accessCostOneTime: number
  accessCostQuarterly: number
  capacity?: number
}

function ImportAddressesModal({
  dealId,
  onClose,
  onSaved,
}: {
  dealId: number
  onClose: () => void
  onSaved: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedAddress[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function parseFile(file: File) {
    setError('')
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const raw: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

        const parsed: ParsedAddress[] = raw.map((r) => {
          const gatunamn = String(r['Gatunamn'] ?? '')
          const gatunr = String(r['Gatunr'] ?? '')
          const swedishAddress = [gatunamn, gatunr].filter(Boolean).join(' ')
          const rawCapacity = Number(r['Kapacitet'] ?? 0)
          return {
            address: swedishAddress || String(r['Address'] ?? r['address'] ?? ''),
            city: String(r['Ort'] ?? r['City'] ?? r['city'] ?? ''),
            zipCode: String(r['Postnr'] ?? r['Zip Code'] ?? r['zip_code'] ?? r['ZipCode'] ?? r['zipCode'] ?? ''),
            country: String(r['Country'] ?? r['country'] ?? 'SE') || 'SE',
            accessCostOneTime: Number(r['Installationskostnad'] ?? r['Access Cost OT'] ?? r['access_cost_ot'] ?? 0) || 0,
            accessCostQuarterly: Number(r['Kvartalskostnad'] ?? r['Access Cost Quarterly'] ?? r['access_cost_quarterly'] ?? 0) || 0,
            capacity: rawCapacity || undefined,
          }
        })

        if (parsed.length === 0) {
          setError('No rows found. Make sure the file has data rows.')
        } else {
          setRows(parsed)
        }
      } catch {
        setError('Failed to parse file. Make sure it is a valid .xlsx or .xls file.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleImport() {
    setSaving(true)
    try {
      await addDealAddresses({ data: { dealId, addresses: rows } })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-3xl mx-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Import Addresses</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        {rows.length === 0 ? (
          <div>
            <p className="text-sm text-gray-600 mb-3">
              Upload an Excel file (.xlsx or .xls). Expected columns:
            </p>
            <ul className="text-sm text-gray-500 list-disc list-inside mb-4 space-y-0.5">
              <li><code>Gatunamn</code> + <code>Gatunr</code> (or <code>Address</code>)</li>
              <li><code>Ort</code> (or <code>City</code>)</li>
              <li><code>Postnr</code> (or <code>Zip Code</code>)</li>
              <li><code>Kapacitet</code> — bandwidth in Mbit (optional)</li>
              <li><code>Installationskostnad</code> (or <code>Access Cost OT</code>)</li>
              <li><code>Kvartalskostnad</code> (or <code>Access Cost Quarterly</code>)</li>
              <li><code>Country</code> (optional, defaults to SE)</li>
            </ul>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) parseFile(e.target.files[0]) }}
            />
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <button
              onClick={() => fileRef.current?.click()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Choose File
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-3">{rows.length} addresses parsed. Review before importing:</p>
            <div className="overflow-x-auto border border-gray-200 rounded mb-4">
              <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Address', 'City', 'Zip', 'Country', 'Capacity', 'Cost OT', 'Cost/Qtr'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 text-gray-800">{row.address || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-700">{row.city || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-600">{row.zipCode || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-600">{row.country}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-600">{row.capacity ? `${row.capacity} Mbit` : '—'}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-700">{row.accessCostOneTime ? formatSEK(row.accessCostOneTime) : '—'}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-700">{row.accessCostQuarterly ? formatSEK(row.accessCostQuarterly) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center">
              <button onClick={() => setRows([])} className="text-sm text-gray-500 hover:text-gray-700">Choose different file</button>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300">Cancel</button>
                <button onClick={handleImport} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Importing...' : `Import ${rows.length} Addresses`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Assign Product Modal ──

function AssignProductModal({
  dealId,
  dealLineIds,
  contractLengthMonths,
  onClose,
  onSaved,
}: {
  dealId: number
  dealLineIds: number[]
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
  const [selectedSpeed, setSelectedSpeed] = useState<number | null>(null)
  const [discountOneTime, setDiscountOneTime] = useState(0)
  const [discountMonthly, setDiscountMonthly] = useState(0)
  const [isRenewal, setIsRenewal] = useState(false)
  const [saving, setSaving] = useState(false)

  useState(() => {
    getProducts({ data: { activeOnly: true, isAddonService: false } }).then(setAllProducts)
  })

  async function selectProduct(productId: number) {
    setSelectedProductId(productId)
    const product = allProducts.find((p) => p.id === productId)
    setSelectedSpeed(product?.hasBandwidth ? (product.bandwidth ?? null) : null)
    const relations = await getProductWithRelations({ data: { id: productId } })
    setProductRelations(relations)

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
    setSaving(true)
    try {
      const product = allProducts.find((p) => p.id === selectedProductId)
      const addonsArray = Array.from(selectedAddons.entries()).map(([productId, quantity]) => ({ type: 'addon' as const, referenceId: productId, quantity }))
      const hardwareArray = Array.from(selectedHardware.entries()).map(([hardwareId, quantity]) => ({ type: 'hardware' as const, referenceId: hardwareId, quantity }))

      await assignProductToLines({
        data: {
          dealLineIds,
          contractLengthMonths,
          productId: selectedProductId,
          serviceName: product?.displayName,
          capacity: product?.hasBandwidth ? (selectedSpeed ?? undefined) : undefined,
          accessType: product?.accessType ?? undefined,
          discountOneTime,
          discountMonthly,
          isRenewal,
          lineAddons: [...addonsArray, ...hardwareArray],
        },
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            Add Product to {dealLineIds.length} address{dealLineIds.length > 1 ? 'es' : ''}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        {step === 'product' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Discount OT (%)</label>
                <input type="number" value={discountOneTime} onChange={(e) => setDiscountOneTime(Number(e.target.value))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Discount Monthly (%)</label>
                <input type="number" value={discountMonthly} onChange={(e) => setDiscountMonthly(Number(e.target.value))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm pb-1.5">
                  <input type="checkbox" checked={isRenewal} onChange={(e) => setIsRenewal(e.target.checked)} />
                  Renewal
                </label>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Select Product</label>
              <div className="max-h-72 overflow-y-auto border border-gray-200 rounded">
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

            {allProducts.find((p) => p.id === selectedProductId)?.hasBandwidth && (
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Speed (Mbit)</label>
                <select
                  value={selectedSpeed ?? ''}
                  onChange={(e) => setSelectedSpeed(e.target.value === '' ? null : Number(e.target.value))}
                  className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                >
                  <option value="">Select speed...</option>
                  {AVAILABLE_SPEEDS.map((s) => (
                    <option key={s} value={s}>{s} Mbit</option>
                  ))}
                </select>
              </div>
            )}

            {productRelations && productRelations.addons.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Available Addons</h3>
                <div className="space-y-1">
                  {productRelations.addons.map((link: ProductAddon & { addon: Product | undefined }) => {
                    const isSelected = selectedAddons.has(link.addonProductId)
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
              <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : `Assign to ${dealLineIds.length} address${dealLineIds.length > 1 ? 'es' : ''}`}
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
