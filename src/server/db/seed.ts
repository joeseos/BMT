import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'
import { mkdirSync } from 'fs'

// Ensure data directory exists
mkdirSync('./data', { recursive: true })

const sqlite = new Database('./data/pricing.db')
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')
const db = drizzle(sqlite, { schema })

async function seed() {
  console.log('Seeding database...')

  // ── Global Config (from Parameters sheet) ──
  const configEntries = [
    // Currency rates
    { key: 'fx_eur', value: 11.49, label: 'EUR/SEK', category: 'currency' },
    { key: 'fx_usd', value: 10.34, label: 'USD/SEK', category: 'currency' },
    { key: 'fx_nok', value: 1.02, label: 'NOK/SEK', category: 'currency' },
    { key: 'fx_dkk', value: 1.54, label: 'DKK/SEK', category: 'currency' },
    // Depreciation & model
    { key: 'internal_rate', value: 0, label: 'Internränta', category: 'depreciation' },
    { key: 'depreciation_months', value: 36, label: 'Avskrivningstid (mån)', category: 'depreciation' },
    { key: 'renewal_capex_factor', value: 0.15, label: 'Omförhandling CAPEX %', category: 'model' },
    { key: 'network_cost_model', value: 0, label: 'Tillämpad Modell (0=standard)', category: 'model' },
    { key: 'no_capex_network_site', value: 0, label: 'No Capex Network Site', category: 'model' },
    { key: 'opex_percentage', value: 0.04, label: 'OPEX % av CAPEX', category: 'model' },
    { key: 'nwc_percentage', value: 0.12, label: 'NWC %', category: 'model' },
    // Backbone & GT per-Mbit costs
    { key: 'bb_cost_per_mbit', value: 15, label: 'Backbone kr/Mbit/mån', category: 'network' },
    { key: 'gt_cost_per_mbit', value: 80, label: 'GT (Int Transit) kr/Mbit/mån', category: 'network' },
  ]

  for (const entry of configEntries) {
    await db.insert(schema.globalConfig).values(entry).onConflictDoNothing()
  }
  console.log(`  ✓ ${configEntries.length} global config entries`)

  // ── Zone Breakpoints (from Parameters rows 339-349) ──
  const zones = [
    // Type 1 zones (xDSL ≤10M)
    { zone: 'Z1', maxQuarterlyAccessCost: 2000, displayOrder: 1 },
    { zone: 'Z2', maxQuarterlyAccessCost: 4000, displayOrder: 2 },
    { zone: 'Z3', maxQuarterlyAccessCost: 8000, displayOrder: 3 },
    // Type 2 zones (Fiber ≥10M)
    { zone: 'ZZ', maxQuarterlyAccessCost: 3000, displayOrder: 10 },
    { zone: 'ZA', maxQuarterlyAccessCost: 6000, displayOrder: 11 },
    { zone: 'ZB', maxQuarterlyAccessCost: 10000, displayOrder: 12 },
    { zone: 'ZC', maxQuarterlyAccessCost: 16000, displayOrder: 13 },
    { zone: 'ZD', maxQuarterlyAccessCost: 24000, displayOrder: 14 },
    { zone: 'ZE', maxQuarterlyAccessCost: 36000, displayOrder: 15 },
    { zone: 'ZF', maxQuarterlyAccessCost: 50000, displayOrder: 16 },
    { zone: 'ZG', maxQuarterlyAccessCost: 999999, displayOrder: 17 },
  ]

  for (const zone of zones) {
    await db.insert(schema.zoneBreakpoints).values(zone).onConflictDoNothing()
  }
  console.log(`  ✓ ${zones.length} zone breakpoints`)

  // ── Approval Rules (from Attest sheet) ──
  const rules = [
    {
      level: 'regional_manager',
      displayName: 'Regionchef',
      maxPaybackMonths: 14,
      minContributionMargin: 0.45,
      maxContractValueMsek: 3,
      displayOrder: 1,
      ruleType: 'existing_customer',
    },
    {
      level: 'sales_manager',
      displayName: 'Försäljningschef',
      maxPaybackMonths: 18,
      minContributionMargin: 0.40,
      maxContractValueMsek: 5,
      displayOrder: 2,
      ruleType: 'existing_customer',
    },
    {
      level: 'biz_area_manager',
      displayName: 'Affärsområdeschef',
      maxPaybackMonths: null,
      minContributionMargin: null,
      maxContractValueMsek: 25,
      displayOrder: 3,
      ruleType: 'existing_customer',
    },
    {
      level: 'ceo',
      displayName: 'VD',
      maxPaybackMonths: null,
      minContributionMargin: null,
      maxContractValueMsek: null,
      displayOrder: 4,
      ruleType: 'existing_customer',
    },
  ]

  for (const rule of rules) {
    await db.insert(schema.approvalRules).values(rule).onConflictDoNothing()
  }
  console.log(`  ✓ ${rules.length} approval rules`)

  // ── Sample Product Families ──
  const families = [
    { code: '5GBBB', name: '5G Bredband Bas', category: 'internet_connect', country: 'SE' },
    { code: 'ICSR', name: 'Internet Connect Symmetric Router', category: 'internet_connect', country: 'SE' },
    { code: 'ICSC', name: 'Internet Connect Symmetric CPE', category: 'internet_connect', country: 'SE' },
    { code: 'NCMC', name: 'Nordic Connect Managed CPE', category: 'nordic_connect', country: 'SE' },
    { code: 'NCMR', name: 'Nordic Connect Managed Router', category: 'nordic_connect', country: 'SE' },
    { code: 'NCP', name: 'Nordic Connect Partner', category: 'nordic_connect', country: 'SE' },
    { code: 'NCO', name: 'Nordic Connect Options', category: 'nordic_connect', country: 'SE' },
    { code: 'COLO', name: 'Colocation', category: 'colocation', country: 'SE' },
    { code: 'MSS', name: 'Managed Security Services', category: 'mss', country: 'SE' },
  ]

  for (const family of families) {
    await db.insert(schema.productFamilies).values(family).onConflictDoNothing()
  }
  console.log(`  ✓ ${families.length} product families`)

  console.log('\nSeed complete! You can now create products via the admin interface.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
