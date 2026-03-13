import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import {
  getProducts, getProductFamilies, createProduct, updateProduct, deleteProduct,
  getHardwareCatalog, createHardware, updateHardware, deleteHardware,
  getProductWithRelations, linkAddonToProduct, unlinkAddonFromProduct,
  linkHardwareToProduct, unlinkHardwareFromProduct,
} from '~/server/functions/products'
import type { Product, ProductFamily, EquipmentCost, ProductAddon, ProductHardwareLink } from '~/server/db/schema'

export const Route = createFileRoute('/admin/products')({
  component: AdminProducts,
  loader: async () => {
    const [mainProducts, addonProducts, families, hardware] = await Promise.all([
      getProducts({ data: { activeOnly: true, isAddonService: false } }),
      getProducts({ data: { activeOnly: true, isAddonService: true } }),
      getProductFamilies(),
      getHardwareCatalog(),
    ])
    return { mainProducts, addonProducts, families, hardware }
  },
})

type Tab = 'main' | 'addon' | 'hardware'

function AdminProducts() {
  const { mainProducts, addonProducts, families, hardware } = Route.useLoaderData()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('main')
  const [search, setSearch] = useState('')
  const [familyFilter, setFamilyFilter] = useState('')

  // Modal states
  const [showProductForm, setShowProductForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showHardwareForm, setShowHardwareForm] = useState(false)
  const [editingHardware, setEditingHardware] = useState<EquipmentCost | null>(null)
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)
  const [detailRelations, setDetailRelations] = useState<{ addons: (ProductAddon & { addon: Product | undefined })[]; hardware: (ProductHardwareLink & { hardware: EquipmentCost | undefined })[] } | null>(null)

  const products = tab === 'main' ? mainProducts : addonProducts

  const filtered = products.filter((p) => {
    const matchesSearch = !search || p.displayName.toLowerCase().includes(search.toLowerCase())
    const matchesFamily = !familyFilter || p.familyCode === familyFilter
    return matchesSearch && matchesFamily
  })

  const reload = () => router.invalidate()

  async function openProductDetail(product: Product) {
    setDetailProduct(product)
    const data = await getProductWithRelations({ data: { id: product.id } })
    setDetailRelations({ addons: data.addons, hardware: data.hardware })
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'main', label: 'Main Products', count: mainProducts.length },
    { key: 'addon', label: 'Addon Products', count: addonProducts.length },
    { key: 'hardware', label: 'Hardware Catalog', count: hardware.length },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Product Catalog</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSearch(''); setFamilyFilter(''); setDetailProduct(null) }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label} <span className="text-xs text-gray-400 ml-1">({t.count})</span>
          </button>
        ))}
      </div>

      {tab === 'hardware' ? (
        <HardwareTab
          hardware={hardware}
          search={search}
          setSearch={setSearch}
          onAdd={() => { setEditingHardware(null); setShowHardwareForm(true) }}
          onEdit={(hw) => { setEditingHardware(hw); setShowHardwareForm(true) }}
          onDelete={async (id) => { await deleteHardware({ data: { id } }); reload() }}
        />
      ) : (
        <>
          {/* Filters + Add */}
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
            <div className="ml-auto">
              <button
                onClick={() => { setEditingProduct(null); setShowProductForm(true) }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                + Add {tab === 'addon' ? 'Addon' : 'Product'}
              </button>
            </div>
          </div>

          {/* Product table */}
          <ProductTable
            products={filtered}
            onRowClick={openProductDetail}
            onEdit={(p) => { setEditingProduct(p); setShowProductForm(true) }}
            onDelete={async (id) => { await deleteProduct({ data: { id } }); reload() }}
          />
        </>
      )}

      {/* Product Detail Panel */}
      {detailProduct && detailRelations && (
        <ProductDetailPanel
          product={detailProduct}
          relations={detailRelations}
          addonProducts={addonProducts}
          hardware={hardware}
          onClose={() => { setDetailProduct(null); setDetailRelations(null) }}
          onUpdate={async () => {
            const data = await getProductWithRelations({ data: { id: detailProduct.id } })
            setDetailRelations({ addons: data.addons, hardware: data.hardware })
          }}
        />
      )}

      {/* Product Create/Edit Modal */}
      {showProductForm && (
        <ProductFormModal
          product={editingProduct}
          families={families}
          isAddon={tab === 'addon'}
          onClose={() => { setShowProductForm(false); setEditingProduct(null) }}
          onSave={async (formData) => {
            if (editingProduct) {
              const { id, ...rest } = formData as Record<string, string | number | boolean | null>
              await updateProduct({ data: { id: editingProduct.id, updates: rest } })
            } else {
              await createProduct({ data: formData as Parameters<typeof createProduct>[0]['data'] })
            }
            setShowProductForm(false)
            setEditingProduct(null)
            reload()
          }}
        />
      )}

      {/* Hardware Create/Edit Modal */}
      {showHardwareForm && (
        <HardwareFormModal
          hardware={editingHardware}
          onClose={() => { setShowHardwareForm(false); setEditingHardware(null) }}
          onSave={async (formData) => {
            if (editingHardware) {
              const { id, ...rest } = formData as Record<string, string | number | null>
              await updateHardware({ data: { id: editingHardware.id, updates: rest } })
            } else {
              await createHardware({ data: formData as Parameters<typeof createHardware>[0]['data'] })
            }
            setShowHardwareForm(false)
            setEditingHardware(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

// ── Product Table ──

function ProductTable({
  products,
  onRowClick,
  onEdit,
  onDelete,
}: {
  products: Product[]
  onRowClick: (p: Product) => void
  onEdit: (p: Product) => void
  onDelete: (id: number) => void
}) {
  const colGroups = [
    { label: 'Product', cols: ['Display Name', 'Family', 'Access', 'BW'] },
    { label: 'List Prices', cols: ['OT', 'Monthly'], color: 'bg-blue-50' },
    { label: 'COGS', cols: ['OT', 'Annual'], color: 'bg-orange-50' },
    { label: 'CPE', cols: ['Install', 'CAPEX'], color: 'bg-green-50' },
    { label: 'Network', cols: ['BB', 'GT'], color: 'bg-purple-50' },
    { label: 'OPEX', cols: ['OT', 'Annual'], color: 'bg-amber-50' },
    { label: '', cols: ['Actions'] },
  ]

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-xs">
        <thead>
          <tr>
            {colGroups.map((group) => (
              <th
                key={group.label || 'actions'}
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
          {products.map((product) => (
            <tr
              key={product.id}
              className="hover:bg-gray-50 cursor-pointer"
              onClick={() => onRowClick(product)}
            >
              <td className="px-2 py-1.5 font-medium text-gray-900 max-w-[200px] truncate" title={product.displayName}>
                {product.displayName}
              </td>
              <td className="px-2 py-1.5 text-gray-600">{product.familyCode}</td>
              <td className="px-2 py-1.5 text-gray-600">{product.accessType || '—'}</td>
              <td className="px-2 py-1.5 text-gray-600 text-right">{product.bandwidth || '—'}</td>
              <td className="px-2 py-1.5 text-right font-mono bg-blue-50/30">{fmt(product.listPriceOneTime)}</td>
              <td className="px-2 py-1.5 text-right font-mono bg-blue-50/30">{fmt(product.listPriceMonthly)}</td>
              <td className="px-2 py-1.5 text-right font-mono bg-orange-50/30">{fmt(product.cogsOneTime)}</td>
              <td className="px-2 py-1.5 text-right font-mono bg-orange-50/30">{fmt(product.cogsAnnual)}</td>
              <td className="px-2 py-1.5 text-right font-mono bg-green-50/30">{fmt(product.cpeInstallation)}</td>
              <td className="px-2 py-1.5 text-right font-mono bg-green-50/30">{fmt(product.cpeCapex)}</td>
              <td className="px-2 py-1.5 text-right font-mono bg-purple-50/30">{fmt(product.backboneCostAnnual)}</td>
              <td className="px-2 py-1.5 text-right font-mono bg-purple-50/30">{fmt(product.gtCostAnnual)}</td>
              <td className="px-2 py-1.5 text-right font-mono bg-amber-50/30">{fmt(product.opexOneTime)}</td>
              <td className="px-2 py-1.5 text-right font-mono bg-amber-50/30">{fmt(product.opexAnnual)}</td>
              <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                <div className="flex gap-1">
                  <button
                    onClick={() => onEdit(product)}
                    className="px-2 py-0.5 text-blue-600 hover:bg-blue-50 rounded text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => { if (confirm('Deactivate this product?')) onDelete(product.id) }}
                    className="px-2 py-0.5 text-red-600 hover:bg-red-50 rounded text-xs"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Hardware Tab ──

function HardwareTab({
  hardware,
  search,
  setSearch,
  onAdd,
  onEdit,
  onDelete,
}: {
  hardware: EquipmentCost[]
  search: string
  setSearch: (s: string) => void
  onAdd: () => void
  onEdit: (hw: EquipmentCost) => void
  onDelete: (id: number) => void
}) {
  const filtered = hardware.filter((hw) =>
    !search || hw.description.toLowerCase().includes(search.toLowerCase()) || hw.code.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search hardware..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="flex items-center text-sm text-gray-500">{filtered.length} items</span>
        <div className="ml-auto">
          <button
            onClick={onAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Add Hardware
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">List (USD)</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Discount</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Net (SEK)</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((hw) => (
              <tr key={hw.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-600">{hw.category}</td>
                <td className="px-3 py-2 font-mono text-gray-900">{hw.code}</td>
                <td className="px-3 py-2 text-gray-700">{hw.description}</td>
                <td className="px-3 py-2 text-right font-mono">{hw.listPriceUsd ? fmt(hw.listPriceUsd) : '—'}</td>
                <td className="px-3 py-2 text-right font-mono">{hw.discountPercent ? `${hw.discountPercent}%` : '—'}</td>
                <td className="px-3 py-2 text-right font-mono font-medium">{fmt(hw.netPriceSek)}</td>
                <td className="px-3 py-2 text-gray-500 text-xs max-w-[200px] truncate">{hw.notes || '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => onEdit(hw)}
                      className="px-2 py-0.5 text-blue-600 hover:bg-blue-50 rounded text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this hardware item?')) onDelete(hw.id) }}
                      className="px-2 py-0.5 text-red-600 hover:bg-red-50 rounded text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── Product Detail Panel (slide-out) ──

function ProductDetailPanel({
  product,
  relations,
  addonProducts,
  hardware,
  onClose,
  onUpdate,
}: {
  product: Product
  relations: { addons: (ProductAddon & { addon: Product | undefined })[]; hardware: (ProductHardwareLink & { hardware: EquipmentCost | undefined })[] }
  addonProducts: Product[]
  hardware: EquipmentCost[]
  onClose: () => void
  onUpdate: () => void
}) {
  const [addingAddon, setAddingAddon] = useState(false)
  const [addingHardware, setAddingHardware] = useState(false)
  const [selectedAddonId, setSelectedAddonId] = useState<number | null>(null)
  const [selectedHardwareId, setSelectedHardwareId] = useState<number | null>(null)

  const linkedAddonIds = new Set(relations.addons.map((a) => a.addonProductId))
  const linkedHardwareIds = new Set(relations.hardware.map((h) => h.hardwareId))
  const availableAddons = addonProducts.filter((a) => !linkedAddonIds.has(a.id))
  const availableHardware = hardware.filter((h) => !linkedHardwareIds.has(h.id))

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex justify-end" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg shadow-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{product.displayName}</h2>
            <p className="text-sm text-gray-500">{product.familyCode} · {product.accessType || 'N/A'} · {product.bandwidth ? `${product.bandwidth} Mbit` : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Cost summary */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Cost Summary</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">List OT</span><span className="font-mono">{fmt(product.listPriceOneTime)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">List Monthly</span><span className="font-mono">{fmt(product.listPriceMonthly)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">COGS OT</span><span className="font-mono">{fmt(product.cogsOneTime)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">COGS Annual</span><span className="font-mono">{fmt(product.cogsAnnual)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">CPE CAPEX</span><span className="font-mono">{fmt(product.cpeCapex)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Site CAPEX</span><span className="font-mono">{fmt(product.siteCapex)}</span></div>
            </div>
          </div>

          {/* Linked Addons */}
          {!product.isAddonService && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Available Addons</h3>
                <button
                  onClick={() => setAddingAddon(true)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  + Link Addon
                </button>
              </div>

              {relations.addons.length === 0 ? (
                <p className="text-sm text-gray-400">No addons linked</p>
              ) : (
                <div className="space-y-1">
                  {relations.addons.map((link) => (
                    <div key={link.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-900">{link.addon?.displayName || `Product #${link.addonProductId}`}</span>
                        {link.isDefault && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Default</span>}
                      </div>
                      <button
                        onClick={async () => {
                          await unlinkAddonFromProduct({ data: { mainProductId: product.id, addonProductId: link.addonProductId } })
                          onUpdate()
                        }}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {addingAddon && (
                <div className="mt-2 flex gap-2">
                  <select
                    value={selectedAddonId ?? ''}
                    onChange={(e) => setSelectedAddonId(Number(e.target.value) || null)}
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                  >
                    <option value="">Select addon...</option>
                    {availableAddons.map((a) => (
                      <option key={a.id} value={a.id}>{a.displayName}</option>
                    ))}
                  </select>
                  <button
                    onClick={async () => {
                      if (!selectedAddonId) return
                      await linkAddonToProduct({ data: { mainProductId: product.id, addonProductId: selectedAddonId } })
                      setAddingAddon(false)
                      setSelectedAddonId(null)
                      onUpdate()
                    }}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setAddingAddon(false); setSelectedAddonId(null) }}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Linked Hardware */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Hardware</h3>
              <button
                onClick={() => setAddingHardware(true)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                + Link Hardware
              </button>
            </div>

            {relations.hardware.length === 0 ? (
              <p className="text-sm text-gray-400">No hardware linked</p>
            ) : (
              <div className="space-y-1">
                {relations.hardware.map((link) => (
                  <div key={link.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-900">{link.hardware?.description || `HW #${link.hardwareId}`}</span>
                      <span className="text-gray-500 ml-2">x{link.quantity}</span>
                      {link.isRequired && <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Required</span>}
                      {link.isDefault && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Default</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-500">{fmt(link.hardware?.netPriceSek)}</span>
                      <button
                        onClick={async () => {
                          await unlinkHardwareFromProduct({ data: { productId: product.id, hardwareId: link.hardwareId } })
                          onUpdate()
                        }}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {addingHardware && (
              <div className="mt-2 flex gap-2">
                <select
                  value={selectedHardwareId ?? ''}
                  onChange={(e) => setSelectedHardwareId(Number(e.target.value) || null)}
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                >
                  <option value="">Select hardware...</option>
                  {availableHardware.map((h) => (
                    <option key={h.id} value={h.id}>{h.code} — {h.description} ({fmt(h.netPriceSek)} SEK)</option>
                  ))}
                </select>
                <button
                  onClick={async () => {
                    if (!selectedHardwareId) return
                    await linkHardwareToProduct({ data: { productId: product.id, hardwareId: selectedHardwareId } })
                    setAddingHardware(false)
                    setSelectedHardwareId(null)
                    onUpdate()
                  }}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm"
                >
                  Add
                </button>
                <button
                  onClick={() => { setAddingHardware(false); setSelectedHardwareId(null) }}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Product Form Modal ──

function ProductFormModal({
  product,
  families,
  isAddon,
  onClose,
  onSave,
}: {
  product: Product | null
  families: ProductFamily[]
  isAddon: boolean
  onClose: () => void
  onSave: (data: Record<string, string | number | boolean | undefined>) => void
}) {
  const [form, setForm] = useState(() => ({
    country: product?.country ?? 'SE',
    familyCode: product?.familyCode ?? '',
    familyId: product?.familyId ?? undefined,
    displayName: product?.displayName ?? '',
    priceToolCode: product?.priceToolCode ?? '',
    lookupKey: product?.lookupKey ?? '',
    accessType: product?.accessType ?? '',
    zoneType: product?.zoneType ?? undefined,
    bandwidth: product?.bandwidth ?? undefined,
    listPriceOneTime: product?.listPriceOneTime ?? 0,
    listPriceMonthly: product?.listPriceMonthly ?? 0,
    defaultAccessOneTime: product?.defaultAccessOneTime ?? 0,
    defaultAccessMonthly: product?.defaultAccessMonthly ?? 0,
    cogsOneTime: product?.cogsOneTime ?? 0,
    cogsAnnual: product?.cogsAnnual ?? 0,
    cpeInstallation: product?.cpeInstallation ?? 0,
    cpeCapex: product?.cpeCapex ?? 0,
    siteInstallation: product?.siteInstallation ?? 0,
    siteCapex: product?.siteCapex ?? 0,
    backboneCostAnnual: product?.backboneCostAnnual ?? 0,
    gtCostAnnual: product?.gtCostAnnual ?? 0,
    opexOneTime: product?.opexOneTime ?? 0,
    opexAnnual: product?.opexAnnual ?? 0,
    breakpointAccessOneTime: product?.breakpointAccessOneTime ?? 0,
    breakpointAccessAnnual: product?.breakpointAccessAnnual ?? 0,
    marginalSurcharge: product?.marginalSurcharge ?? 0,
    isAddonService: product?.isAddonService ?? isAddon,
  }))

  const set = (key: string, value: string | number | boolean | undefined) => setForm((prev) => ({ ...prev, [key]: value }))

  const fieldGroups = [
    {
      label: 'Identity',
      fields: [
        { key: 'displayName', label: 'Display Name', type: 'text', required: true },
        { key: 'familyCode', label: 'Family Code', type: 'text', required: true },
        { key: 'priceToolCode', label: 'Price Tool Code', type: 'text', required: true },
        { key: 'lookupKey', label: 'Lookup Key', type: 'text', required: true },
        { key: 'accessType', label: 'Access Type', type: 'text' },
        { key: 'bandwidth', label: 'Bandwidth (Mbit)', type: 'number' },
        { key: 'zoneType', label: 'Zone Type', type: 'number' },
      ],
    },
    {
      label: 'List Prices',
      fields: [
        { key: 'listPriceOneTime', label: 'One-Time', type: 'number' },
        { key: 'listPriceMonthly', label: 'Monthly', type: 'number' },
        { key: 'defaultAccessOneTime', label: 'Default Access OT', type: 'number' },
        { key: 'defaultAccessMonthly', label: 'Default Access Monthly', type: 'number' },
      ],
    },
    {
      label: 'COGS',
      fields: [
        { key: 'cogsOneTime', label: 'One-Time', type: 'number' },
        { key: 'cogsAnnual', label: 'Annual', type: 'number' },
      ],
    },
    {
      label: 'CPE Equipment',
      fields: [
        { key: 'cpeInstallation', label: 'Installation', type: 'number' },
        { key: 'cpeCapex', label: 'CAPEX', type: 'number' },
      ],
    },
    {
      label: 'Site Costs',
      fields: [
        { key: 'siteInstallation', label: 'Installation', type: 'number' },
        { key: 'siteCapex', label: 'CAPEX', type: 'number' },
      ],
    },
    {
      label: 'Network',
      fields: [
        { key: 'backboneCostAnnual', label: 'Backbone Annual', type: 'number' },
        { key: 'gtCostAnnual', label: 'GT Annual', type: 'number' },
      ],
    },
    {
      label: 'OPEX',
      fields: [
        { key: 'opexOneTime', label: 'One-Time', type: 'number' },
        { key: 'opexAnnual', label: 'Annual', type: 'number' },
      ],
    },
    {
      label: 'Breakpoints',
      fields: [
        { key: 'breakpointAccessOneTime', label: 'Access OT', type: 'number' },
        { key: 'breakpointAccessAnnual', label: 'Access Annual', type: 'number' },
        { key: 'marginalSurcharge', label: 'Surcharge Rate', type: 'number' },
      ],
    },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            {product ? 'Edit' : 'Create'} {isAddon ? 'Addon' : ''} Product
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="space-y-5">
          {/* Country + Addon toggle */}
          <div className="flex gap-4 items-center">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Country</label>
              <select
                value={form.country}
                onChange={(e) => set('country', e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm"
              >
                {['SE', 'FI', 'NO', 'DK'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Family</label>
              <select
                value={form.familyId ?? ''}
                onChange={(e) => {
                  const fam = families.find((f) => f.id === Number(e.target.value))
                  set('familyId', fam?.id)
                  if (fam) set('familyCode', fam.code)
                }}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm"
              >
                <option value="">Select...</option>
                {families.map((f) => <option key={f.id} value={f.id}>{f.code} — {f.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm mt-4">
              <input
                type="checkbox"
                checked={form.isAddonService}
                onChange={(e) => set('isAddonService', e.target.checked)}
                className="rounded"
              />
              Addon Service
            </label>
          </div>

          {fieldGroups.map((group) => (
            <div key={group.label}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{group.label}</h3>
              <div className="grid grid-cols-2 gap-3">
                {group.fields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                    <input
                      type={field.type}
                      value={(form as Record<string, unknown>)[field.key] as string | number ?? ''}
                      onChange={(e) => set(field.key, field.type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value)}
                      required={field.required}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            {product ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Hardware Form Modal ──

function HardwareFormModal({
  hardware,
  onClose,
  onSave,
}: {
  hardware: EquipmentCost | null
  onClose: () => void
  onSave: (data: Record<string, string | number | boolean | null | undefined>) => void
}) {
  const [form, setForm] = useState({
    category: hardware?.category ?? '',
    code: hardware?.code ?? '',
    description: hardware?.description ?? '',
    listPriceUsd: hardware?.listPriceUsd ?? null,
    discountPercent: hardware?.discountPercent ?? null,
    netPriceSek: hardware?.netPriceSek ?? 0,
    notes: hardware?.notes ?? null,
  })

  const set = (key: string, value: string | number | null) => setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">{hardware ? 'Edit' : 'Add'} Hardware</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <input
              type="text"
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Code</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => set('code', e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">List Price (USD)</label>
              <input
                type="number"
                value={form.listPriceUsd ?? ''}
                onChange={(e) => set('listPriceUsd', e.target.value === '' ? null : Number(e.target.value))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Discount %</label>
              <input
                type="number"
                value={form.discountPercent ?? ''}
                onChange={(e) => set('discountPercent', e.target.value === '' ? null : Number(e.target.value))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Net Price (SEK)</label>
              <input
                type="number"
                value={form.netPriceSek}
                onChange={(e) => set('netPriceSek', Number(e.target.value))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <input
              type="text"
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value || null)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            {hardware ? 'Save Changes' : 'Add Hardware'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──

function fmt(val: number | null | undefined): string {
  if (val === null || val === undefined || val === 0) return '—'
  return new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(val)
}
