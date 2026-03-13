import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core'

// ═══════════════════════════════════════════════
// PRODUCT CATALOG (≈ "Product prices & costs" sheet)
// ═══════════════════════════════════════════════

export const productFamilies = sqliteTable('product_families', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(), // e.g. "network_services"
  country: text('country').notNull().default('SE'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
})

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  familyId: integer('family_id').references(() => productFamilies.id),

  // Identity
  country: text('country').notNull(),
  familyCode: text('family_code').notNull(),
  displayName: text('display_name').notNull(),
  priceToolCode: text('price_tool_code').notNull(),
  accessType: text('access_type'),
  lookupKey: text('lookup_key').notNull().unique(),

  // Classification
  zoneType: integer('zone_type'), // 1 = xDSL ≤10M, 2 = Fiber ≥10M
  hasBandwidth: integer('has_bandwidth', { mode: 'boolean' }).default(false),
  bandwidth: integer('bandwidth'), // Mbit/s

  // List prices
  defaultAccessOneTime: real('default_access_one_time').default(0),
  defaultAccessMonthly: real('default_access_monthly').default(0),
  listPriceOneTime: real('list_price_one_time').default(0),
  listPriceMonthly: real('list_price_monthly').default(0),

  // COGS
  cogsOneTime: real('cogs_one_time').default(0),
  cogsAnnual: real('cogs_annual').default(0),

  // CPE Equipment
  cpeInstallation: real('cpe_installation').default(0),
  cpeCapex: real('cpe_capex').default(0),

  // Site costs
  siteInstallation: real('site_installation').default(0),
  siteCapex: real('site_capex').default(0),

  // Network costs
  backboneCostAnnual: real('backbone_cost_annual').default(0),
  gtCostAnnual: real('gt_cost_annual').default(0),

  // OPEX
  opexOneTime: real('opex_one_time').default(0),
  opexAnnual: real('opex_annual').default(0),

  // Access breakpoints
  breakpointAccessOneTime: real('breakpoint_access_one_time').default(0),
  breakpointAccessAnnual: real('breakpoint_access_annual').default(0),
  marginalSurcharge: real('marginal_surcharge').default(0),

  // Flags
  isAddonService: integer('is_addon_service', { mode: 'boolean' }).default(false),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),

  // Audit
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  updatedBy: text('updated_by'),
}, (table) => [
  index('idx_lookup_key').on(table.lookupKey),
  index('idx_family_code').on(table.familyCode),
  index('idx_country_family').on(table.country, table.familyCode),
])

// ═══════════════════════════════════════════════
// PARAMETERS (≈ "Parameters" sheet)
// ═══════════════════════════════════════════════

export const globalConfig = sqliteTable('global_config', {
  key: text('key').primaryKey(),
  value: real('value').notNull(),
  label: text('label'),
  category: text('category').notNull(), // "currency" | "model" | "depreciation" | "zone"
  notes: text('notes'),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  updatedBy: text('updated_by'),
})

export const bandwidthCosts = sqliteTable('bandwidth_costs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  costType: text('cost_type').notNull(), // "backbone" | "gt"
  bandwidthMbit: real('bandwidth_mbit').notNull(),
  utilization: real('utilization'),
  costPerMbitMonthly: real('cost_per_mbit_monthly'),
  annualCost: real('annual_cost'),
})

export const slaCosts = sqliteTable('sla_costs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  technology: text('technology').notNull(),
  costComponent: text('cost_component').notNull(),
  slaBas: real('sla_bas').default(0),
  sla1: real('sla1').default(0),
  sla2: real('sla2').default(0),
  sla3: real('sla3').default(0),
  sla4: real('sla4').default(0),
  sla43: real('sla43').default(0),
  sla48: real('sla48').default(0),
  sla49: real('sla49').default(0),
  sla5: real('sla5').default(0),
  sla5Sek: real('sla5_sek').default(0),
  sla53: real('sla53').default(0),
  sla53Sek: real('sla53_sek').default(0),
  sla6: real('sla6').default(0),
  sla6Sek: real('sla6_sek').default(0),
})

export const zoneBreakpoints = sqliteTable('zone_breakpoints', {
  zone: text('zone').primaryKey(),
  maxQuarterlyAccessCost: real('max_quarterly_access_cost').notNull(),
  displayOrder: integer('display_order'),
})

export const equipmentCosts = sqliteTable('equipment_costs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  category: text('category').notNull(),
  code: text('code').notNull().unique(),
  description: text('description').notNull(),
  listPriceUsd: real('list_price_usd'),
  discountPercent: real('discount_percent'),
  netPriceSek: real('net_price_sek').notNull(),
  notes: text('notes'),
})

export const accessBreakpoints = sqliteTable('access_breakpoints', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  accessType: text('access_type').notNull(),
  breakpointOneTime: real('breakpoint_one_time').notNull(),
  breakpointMonthly: real('breakpoint_monthly').notNull(),
})

// ═══════════════════════════════════════════════
// PRODUCT RELATIONS (Addons & Hardware links)
// ═══════════════════════════════════════════════

export const productAddons = sqliteTable('product_addons', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  mainProductId: integer('main_product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  addonProductId: integer('addon_product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  displayOrder: integer('display_order').default(0),
}, (table) => [
  index('idx_product_addons_main').on(table.mainProductId),
  index('idx_product_addons_addon').on(table.addonProductId),
])

export const productHardware = sqliteTable('product_hardware', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  hardwareId: integer('hardware_id').notNull().references(() => equipmentCosts.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').default(1),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  isRequired: integer('is_required', { mode: 'boolean' }).default(false),
  displayOrder: integer('display_order').default(0),
}, (table) => [
  index('idx_product_hardware_product').on(table.productId),
  index('idx_product_hardware_hw').on(table.hardwareId),
])

// ═══════════════════════════════════════════════
// PRODUCT COST PARAMETERS (flexible cost line items)
// ═══════════════════════════════════════════════

export const productCostParams = sqliteTable('product_cost_params', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  amount: real('amount').notNull().default(0),
  frequency: text('frequency').notNull(), // "one_time" | "monthly"
  costType: text('cost_type').notNull(), // "COGS" | "CAPEX" | "OPEX"
  currency: text('currency').notNull().default('SEK'),
}, (table) => [
  index('idx_product_cost_params_product').on(table.productId),
])

// ═══════════════════════════════════════════════
// DEALS & PRICING
// ═══════════════════════════════════════════════

export const deals = sqliteTable('deals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customerName: text('customer_name').notNull(),
  orgNumber: text('org_number'),
  contractLengthMonths: integer('contract_length_months').notNull().default(36),
  version: text('version'),
  accessRequestRef: text('access_request_ref'),
  salesRepId: text('sales_rep_id'),
  status: text('status').default('draft'), // "draft" | "pending_approval" | "approved" | "rejected"
  approvalLevel: text('approval_level'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
})

export const dealLines = sqliteTable('deal_lines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  dealId: integer('deal_id').references(() => deals.id, { onDelete: 'cascade' }),

  // Site info
  klaraId: text('klara_id'),
  siteId: text('site_id'),
  quantity: integer('quantity').default(1),
  address: text('address'),
  streetNumber: text('street_number'),
  zipCode: text('zip_code'),
  city: text('city'),
  country: text('country').default('SE'),
  xCoord: text('x_coord'),
  yCoord: text('y_coord'),

  // Service selection
  productId: integer('product_id').references(() => products.id),
  serviceName: text('service_name'),
  capacity: integer('capacity'),
  slaRedundancy: text('sla_redundancy'),
  qos: text('qos'),
  pNetwork: text('p_network'),
  comments: text('comments'),
  contractTerm: integer('contract_term'),
  accessType: text('access_type'),

  // User inputs
  accessCostOneTime: real('access_cost_one_time').default(0),
  accessCostQuarterly: real('access_cost_quarterly').default(0),
  discountOneTime: real('discount_one_time').default(0),
  discountMonthly: real('discount_monthly').default(0),

  // Calculated prices (server-computed, stored for audit)
  recommendedPriceOneTime: real('recommended_price_one_time'),
  recommendedPriceMonthly: real('recommended_price_monthly'),
  finalPriceOneTime: real('final_price_one_time'),
  finalPriceMonthly: real('final_price_monthly'),

  // P&L
  revenueOneTime: real('revenue_one_time'),
  revenueMonthly: real('revenue_monthly'),
  cogsOneTime: real('cogs_one_time'),
  cogsMonthly: real('cogs_monthly'),
  networkCost: real('network_cost'),
  opex: real('opex'),
  capex: real('capex'),
  contributionMargin1: real('contribution_margin_1'),
  contributionMargin2: real('contribution_margin_2'),
  paybackMonths: real('payback_months'),
  paybackStatus: text('payback_status'), // "profitable" | "unprofitable" | "exceeds_contract"

  isRenewal: integer('is_renewal', { mode: 'boolean' }).default(false),
  zone: text('zone'),
  onOffNet: text('on_off_net'),
}, (table) => [
  index('idx_deal_lines_deal_id').on(table.dealId),
])

export const dealLineAddons = sqliteTable('deal_line_addons', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  dealLineId: integer('deal_line_id').notNull().references(() => dealLines.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // "addon" | "hardware"
  referenceId: integer('reference_id').notNull(), // product id or hardware id
  quantity: integer('quantity').default(1),
  priceOneTime: real('price_one_time').default(0),
  priceMonthly: real('price_monthly').default(0),
  costOneTime: real('cost_one_time').default(0),
  costMonthly: real('cost_monthly').default(0),
  capex: real('capex').default(0),
}, (table) => [
  index('idx_deal_line_addons_line').on(table.dealLineId),
])

export const dealAdditionalCosts = sqliteTable('deal_additional_costs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  dealId: integer('deal_id').references(() => deals.id, { onDelete: 'cascade' }),
  costType: text('cost_type').notNull(),
  description: text('description'),
  year1: real('year1').default(0),
  year2: real('year2').default(0),
  year3: real('year3').default(0),
  year4: real('year4').default(0),
  year5: real('year5').default(0),
})

// ═══════════════════════════════════════════════
// APPROVAL RULES
// ═══════════════════════════════════════════════

export const approvalRules = sqliteTable('approval_rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  level: text('level').notNull(),
  displayName: text('display_name').notNull(),
  maxPaybackMonths: integer('max_payback_months'),
  minContributionMargin: real('min_contribution_margin'),
  maxContractValueMsek: real('max_contract_value_msek'),
  displayOrder: integer('display_order'),
  ruleType: text('rule_type').default('existing_customer'),
})

export const approvalLog = sqliteTable('approval_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  dealId: integer('deal_id').references(() => deals.id),
  level: text('level').notNull(),
  approverName: text('approver_name'),
  action: text('action').notNull(),
  comments: text('comments'),
  timestamp: text('timestamp').$defaultFn(() => new Date().toISOString()),
})

// ═══════════════════════════════════════════════
// AUDIT TRAIL
// ═══════════════════════════════════════════════

export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tableName: text('table_name').notNull(),
  recordId: integer('record_id'),
  action: text('action').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  userId: text('user_id'),
  timestamp: text('timestamp').$defaultFn(() => new Date().toISOString()),
})

export const priceListVersions = sqliteTable('price_list_versions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  versionCode: text('version_code').notNull(),
  snapshotJson: text('snapshot_json'),
  changedBy: text('changed_by'),
  notes: text('notes'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
})

// ── Constants ──
export const AVAILABLE_SPEEDS = [10, 100, 200, 400, 600, 1000, 2000] as const

// ── Inferred Types ──
export type Product = typeof products.$inferSelect
export type ProductInsert = typeof products.$inferInsert
export type ProductFamily = typeof productFamilies.$inferSelect
export type EquipmentCost = typeof equipmentCosts.$inferSelect
export type EquipmentCostInsert = typeof equipmentCosts.$inferInsert
export type ProductAddon = typeof productAddons.$inferSelect
export type ProductHardwareLink = typeof productHardware.$inferSelect
export type Deal = typeof deals.$inferSelect
export type DealLine = typeof dealLines.$inferSelect
export type DealLineAddon = typeof dealLineAddons.$inferSelect
export type ApprovalRule = typeof approvalRules.$inferSelect
export type ApprovalLogEntry = typeof approvalLog.$inferSelect
export type ProductCostParam = typeof productCostParams.$inferSelect
export type ProductCostParamInsert = typeof productCostParams.$inferInsert
