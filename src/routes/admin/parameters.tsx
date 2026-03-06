import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { getGlobalConfig, getZoneBreakpoints, updateConfigValue, updateZoneBreakpoint } from '~/server/functions/config'

export const Route = createFileRoute('/admin/parameters')({
  component: AdminParameters,
  loader: async () => {
    const [config, zones] = await Promise.all([
      getGlobalConfig(),
      getZoneBreakpoints(),
    ])
    return { config, zones }
  },
})

function AdminParameters() {
  const { config, zones } = Route.useLoaderData()

  // Group config by category
  const grouped = config.reduce<Record<string, typeof config>>((acc, item) => {
    const cat = item.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  const categoryLabels: Record<string, string> = {
    currency: 'Currency Rates',
    depreciation: 'Depreciation',
    model: 'Model Configuration',
    network: 'Network Costs',
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Parameters</h1>

      {/* Global config by category */}
      <div className="space-y-6 mb-8">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">
                {categoryLabels[category] || category}
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {items.map((item) => (
                <ConfigRow key={item.key} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Zone Breakpoints */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Zone Breakpoints</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Max quarterly access cost per zone. Used for zone classification.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Zone</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Max Quarterly Cost (SEK)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {zones.map((zone) => (
                <ZoneRow key={zone.zone} zone={zone} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ConfigRow({ item }: { item: { key: string; value: number; label: string | null; notes: string | null } }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(item.value.toString())
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateConfigValue({ data: { key: item.key, value: Number(value) } })
      setEditing(false)
    } catch (err) {
      console.error('Failed to save:', err)
    }
    setSaving(false)
  }

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <p className="text-sm font-medium text-gray-900">{item.label || item.key}</p>
        <p className="text-xs text-gray-500">{item.key}</p>
      </div>
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <input
              type="number"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-32 px-2 py-1 border border-gray-300 rounded text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => { setEditing(false); setValue(item.value.toString()) }}
              className="px-2 py-1 text-gray-500 text-xs hover:text-gray-700"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <span className="text-sm font-mono text-gray-700">{item.value}</span>
            <button
              onClick={() => setEditing(true)}
              className="px-2 py-1 text-blue-600 text-xs hover:text-blue-800"
            >
              Edit
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function ZoneRow({ zone }: { zone: { zone: string; maxQuarterlyAccessCost: number } }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(zone.maxQuarterlyAccessCost.toString())

  const handleSave = async () => {
    await updateZoneBreakpoint({ data: { zone: zone.zone, maxQuarterlyAccessCost: Number(value) } })
    setEditing(false)
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-2 text-sm font-medium text-gray-900">{zone.zone}</td>
      <td className="px-4 py-2 text-right">
        {editing ? (
          <div className="flex items-center justify-end gap-2">
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-32 px-2 py-1 border border-gray-300 rounded text-sm text-right font-mono"
            />
            <button onClick={handleSave} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">Save</button>
            <button onClick={() => setEditing(false)} className="px-2 py-1 text-gray-500 text-xs">Cancel</button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <span className="text-sm font-mono text-gray-700">
              {new Intl.NumberFormat('sv-SE').format(zone.maxQuarterlyAccessCost)}
            </span>
            <button onClick={() => setEditing(true)} className="text-blue-600 text-xs hover:text-blue-800">
              Edit
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}
