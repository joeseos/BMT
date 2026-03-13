import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'

// Ensure data directory exists
mkdirSync('./data', { recursive: true })

const db = new Database('./data/pricing.db')
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

console.log('Seeding database...')

// ── Global Config ──
const insertConfig = db.prepare(`
  INSERT OR IGNORE INTO global_config (key, value, label, category, updated_at)
  VALUES (?, ?, ?, ?, datetime('now'))
`)

const configEntries = [
  ['fx_eur', 11.49, 'EUR/SEK', 'currency'],
  ['fx_usd', 10.34, 'USD/SEK', 'currency'],
  ['fx_nok', 1.02, 'NOK/SEK', 'currency'],
  ['fx_dkk', 1.54, 'DKK/SEK', 'currency'],
  ['internal_rate', 0, 'Internränta', 'depreciation'],
  ['depreciation_months', 36, 'Avskrivningstid (mån)', 'depreciation'],
  ['renewal_capex_factor', 0.15, 'Omförhandling CAPEX %', 'model'],
  ['network_cost_model', 0, 'Tillämpad Modell (0=standard)', 'model'],
  ['no_capex_network_site', 0, 'No Capex Network Site', 'model'],
  ['opex_percentage', 0.04, 'OPEX % av CAPEX', 'model'],
  ['nwc_percentage', 0.12, 'NWC %', 'model'],
  ['bb_cost_per_mbit', 15, 'Backbone kr/Mbit/mån', 'network'],
  ['gt_cost_per_mbit', 80, 'GT (Int Transit) kr/Mbit/mån', 'network'],
]

const insertConfigMany = db.transaction((entries) => {
  for (const [key, value, label, category] of entries) {
    insertConfig.run(key, value, label, category)
  }
})
insertConfigMany(configEntries)
console.log(`  ✓ ${configEntries.length} global config entries`)

// ── Zone Breakpoints ──
const insertZone = db.prepare(`
  INSERT OR IGNORE INTO zone_breakpoints (zone, max_quarterly_access_cost, display_order)
  VALUES (?, ?, ?)
`)

const zones = [
  ['Z1', 2000, 1],
  ['Z2', 4000, 2],
  ['Z3', 8000, 3],
  ['ZZ', 3000, 10],
  ['ZA', 6000, 11],
  ['ZB', 10000, 12],
  ['ZC', 16000, 13],
  ['ZD', 24000, 14],
  ['ZE', 36000, 15],
  ['ZF', 50000, 16],
  ['ZG', 999999, 17],
]

const insertZonesMany = db.transaction((entries) => {
  for (const [zone, cost, order] of entries) {
    insertZone.run(zone, cost, order)
  }
})
insertZonesMany(zones)
console.log(`  ✓ ${zones.length} zone breakpoints`)

// ── Approval Rules ──
const insertRule = db.prepare(`
  INSERT OR IGNORE INTO approval_rules (level, display_name, max_payback_months, min_contribution_margin, max_contract_value_msek, display_order, rule_type)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)

const rules = [
  ['regional_manager', 'Regionchef', 14, 0.45, 3, 1, 'existing_customer'],
  ['sales_manager', 'Försäljningschef', 18, 0.40, 5, 2, 'existing_customer'],
  ['biz_area_manager', 'Affärsområdeschef', null, null, 25, 3, 'existing_customer'],
  ['ceo', 'VD', null, null, null, 4, 'existing_customer'],
]

const insertRulesMany = db.transaction((entries) => {
  for (const [level, name, payback, margin, value, order, type] of entries) {
    insertRule.run(level, name, payback, margin, value, order, type)
  }
})
insertRulesMany(rules)
console.log(`  ✓ ${rules.length} approval rules`)

// ── Product Families ──
const insertFamily = db.prepare(`
  INSERT OR IGNORE INTO product_families (code, name, category, country, is_active, created_at, updated_at)
  VALUES (?, ?, ?, 'SE', 1, datetime('now'), datetime('now'))
`)

const families = [
  ['NS', 'Network Services', 'network_services'],
  ['5GBBB', '5G Bredband Bas', 'internet_connect'],
  ['ICSR', 'Internet Connect Symmetric Router', 'internet_connect'],
  ['ICSC', 'Internet Connect Symmetric CPE', 'internet_connect'],
  ['NCMC', 'Nordic Connect Managed CPE', 'nordic_connect'],
  ['NCMR', 'Nordic Connect Managed Router', 'nordic_connect'],
  ['NCP', 'Nordic Connect Partner', 'nordic_connect'],
  ['NCO', 'Nordic Connect Options', 'nordic_connect'],
  ['COLO', 'Colocation', 'colocation'],
  ['MSS', 'Managed Security Services', 'mss'],
]

const insertFamiliesMany = db.transaction((entries) => {
  for (const [code, name, category] of entries) {
    insertFamily.run(code, name, category)
  }
})
insertFamiliesMany(families)
console.log(`  ✓ ${families.length} product families`)

console.log('\nSeed complete! You can now create products via the admin interface.')
db.close()
