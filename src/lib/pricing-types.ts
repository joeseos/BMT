// ── Product categories ──
export const productCategories = [
  'internet_connect',
  'nordic_connect',
  'colocation',
  'mss',
] as const

export type ProductCategory = typeof productCategories[number]

// ── Countries ──
export const countries = ['SE', 'FI', 'NO', 'DK'] as const
export type Country = typeof countries[number]

// ── Deal statuses ──
export const dealStatuses = ['draft', 'pending_approval', 'approved', 'rejected'] as const
export type DealStatus = typeof dealStatuses[number]

// ── Approval levels ──
export const approvalLevels = [
  'regional_manager',
  'sales_manager',
  'biz_area_manager',
  'ceo',
] as const

// ── Payback status ──
export const paybackStatuses = ['profitable', 'unprofitable', 'exceeds_contract'] as const
export type PaybackStatus = typeof paybackStatuses[number]

// ── Formatting helpers ──
export function formatSEK(amount: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function formatMonths(months: number | null): string {
  if (months === null) return '—'
  if (months === 0) return '0 mån'
  return `${months} mån`
}

// ── Status colors ──
export function getStatusColor(status: DealStatus): string {
  switch (status) {
    case 'draft': return 'text-gray-600 bg-gray-100'
    case 'pending_approval': return 'text-amber-700 bg-amber-100'
    case 'approved': return 'text-green-700 bg-green-100'
    case 'rejected': return 'text-red-700 bg-red-100'
  }
}

export function getPaybackColor(status: PaybackStatus): string {
  switch (status) {
    case 'profitable': return 'text-green-700 bg-green-100'
    case 'exceeds_contract': return 'text-amber-700 bg-amber-100'
    case 'unprofitable': return 'text-red-700 bg-red-100'
  }
}
