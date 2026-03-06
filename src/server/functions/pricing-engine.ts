import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db } from '../db'
import { products, globalConfig, zoneBreakpoints } from '../db/schema'
import { eq, and, lte, gte } from 'drizzle-orm'

// ── Input validation ──

export const SiteLineInput = z.object({
  country: z.string().default('SE'),
  productId: z.number().optional(),
  lookupKey: z.string().optional(),
  accessCostOneTime: z.number().default(0),
  accessCostQuarterly: z.number().default(0),
  discountOneTime: z.number().min(0).max(1).default(0),
  discountMonthly: z.number().min(0).max(1).default(0),
  contractLengthMonths: z.number().min(1).max(60).default(36),
  isRenewal: z.boolean().default(false),
  quantity: z.number().min(1).default(1),
})

export type SiteLineInputType = z.infer<typeof SiteLineInput>

// ── Helpers ──

function roundUpTo10(value: number): number {
  return Math.ceil(value / 10) * 10
}

async function getFxRate(country: string): Promise<number> {
  const currencyMap: Record<string, string> = {
    SE: 'fx_sek',
    FI: 'fx_eur',
    NO: 'fx_nok',
    DK: 'fx_dkk',
  }
  if (country === 'SE') return 1
  const key = currencyMap[country]
  if (!key) return 1
  const row = await db.select().from(globalConfig).where(eq(globalConfig.key, key)).get()
  return row?.value ?? 1
}

async function getConfigValue(key: string, fallback: number = 0): Promise<number> {
  const row = await db.select().from(globalConfig).where(eq(globalConfig.key, key)).get()
  return row?.value ?? fallback
}

function classifyZone(accessCostQuarterly: number, zoneType: number | null): string {
  // Zone type determines which set of breakpoints to use
  // Type 1: Z1, Z2, Z3 (xDSL/SDH ≤10M)
  // Type 2: ZZ, ZA, ZB, ZC, ZD, ZE, ZF, ZG (Fiber ≥10M)
  // We look up breakpoints ordered by displayOrder, find first zone where cost fits
  return 'ZZ' // Will be resolved from DB at runtime
}

// ── Payback Calculator ──

interface PaybackResult {
  months: number | null
  status: 'profitable' | 'unprofitable' | 'exceeds_contract'
  label: string
}

function calculatePayback(
  revenueOT: number,
  revenueMo: number,
  cogsOT: number,
  cogsMo: number,
  capex: number,
  opexOT: number,
  networkCost: number,
  contractMonths: number,
): PaybackResult {
  const initialNet = revenueOT - cogsOT - capex - opexOT
  const monthlyNet = revenueMo - cogsMo - networkCost

  if (monthlyNet > 0 && initialNet >= 0) {
    return { months: 0, status: 'profitable', label: '0 mån' }
  }
  if (monthlyNet > 0 && initialNet < 0) {
    const months = Math.ceil(1 - initialNet / monthlyNet)
    if (months > contractMonths) {
      return { months, status: 'exceeds_contract', label: `${months} mån (> avtal)` }
    }
    return { months, status: 'profitable', label: `${months} mån` }
  }
  if (monthlyNet <= 0 && initialNet < 0) {
    return { months: null, status: 'unprofitable', label: 'Olönsam' }
  }
  // monthlyNet < 0, initialNet > 0 — eventually unprofitable
  return { months: null, status: 'unprofitable', label: 'Negativt löpande' }
}

// ── Depreciation (PMT equivalent) ──

function calculateDepreciation(totalCapex: number, ratePerMonth: number, months: number): number {
  if (totalCapex === 0) return 0
  if (ratePerMonth === 0) {
    // Zero interest = straight-line
    return totalCapex / months
  }
  // PMT formula
  return (totalCapex * ratePerMonth * Math.pow(1 + ratePerMonth, months))
    / (Math.pow(1 + ratePerMonth, months) - 1)
}

// ── Main Pricing Calculation ──

export const calculateSitePrice = createServerFn({ method: 'POST' })
  .validator(SiteLineInput)
  .handler(async ({ data }) => {
    // 1. Find the product
    let product
    if (data.productId) {
      product = await db.select().from(products).where(eq(products.id, data.productId)).get()
    } else if (data.lookupKey) {
      product = await db.select().from(products).where(eq(products.lookupKey, data.lookupKey)).get()
    }
    if (!product) {
      throw new Error(`Product not found: ${data.productId || data.lookupKey}`)
    }

    // 2. Currency conversion
    const fxRate = await getFxRate(data.country)
    const accessOneTimeSek = data.accessCostOneTime * fxRate
    const accessQuarterlySek = data.accessCostQuarterly * fxRate

    // 3. Access breakpoint surcharge logic
    // If actual access cost exceeds the breakpoint, calculate surcharge
    const breakpointOT = product.breakpointAccessOneTime ?? 0
    const breakpointAnnual = product.breakpointAccessAnnual ?? 0
    const marginalRate = product.marginalSurcharge ?? 0

    const diffOneTime = accessOneTimeSek - breakpointOT
    const accessAnnual = accessQuarterlySek * 4
    const diffAnnual = accessAnnual - breakpointAnnual

    // 4. Customer price calculation
    let priceOneTime = product.listPriceOneTime ?? 0
    let priceMonthly = product.listPriceMonthly ?? 0

    if (diffOneTime > 0) {
      priceOneTime = roundUpTo10((product.listPriceOneTime ?? 0) + diffOneTime)
    } else {
      priceOneTime = roundUpTo10(product.listPriceOneTime ?? 0)
    }

    if (diffAnnual > 0) {
      const surchargeMonthly = (diffAnnual / 12) * (1 + marginalRate)
      priceMonthly = roundUpTo10((product.listPriceMonthly ?? 0) + surchargeMonthly)
    } else {
      priceMonthly = roundUpTo10(product.listPriceMonthly ?? 0)
    }

    // 5. Renewal adjustment
    const renewalFactor = await getConfigValue('renewal_capex_factor', 0.15)
    let capexAdjustment = 1
    if (data.isRenewal) {
      capexAdjustment = renewalFactor * (data.contractLengthMonths / 12)
    }

    // 6. Apply discounts
    const finalOneTime = roundUpTo10((1 - data.discountOneTime) * priceOneTime)
    const finalMonthly = roundUpTo10((1 - data.discountMonthly) * priceMonthly)

    // 7. P&L per site line
    const qty = data.quantity

    // Revenue
    const revenueOneTime = qty * finalOneTime
    const revenueMonthly = qty * finalMonthly

    // COGS
    const cogsOneTime = qty * (accessOneTimeSek + (product.cogsOneTime ?? 0))
    const cogsMonthly = qty * (accessAnnual + (product.cogsAnnual ?? 0)) / 12

    // Network costs
    const backboneMonthlyCost = (product.backboneCostAnnual ?? 0) / 12
    const gtMonthlyCost = (product.gtCostAnnual ?? 0) / 12
    const networkCostMonthly = qty * (backboneMonthlyCost + gtMonthlyCost)

    // OPEX
    const opexOneTime = qty * (product.opexOneTime ?? 0)
    const opexMonthly = qty * (product.opexAnnual ?? 0) / 12

    // CAPEX
    const cpeCapex = (product.cpeCapex ?? 0) * capexAdjustment
    const siteCapex = (product.siteCapex ?? 0) * capexAdjustment
    const totalCapex = qty * (cpeCapex + siteCapex)

    // Depreciation
    const internalRate = await getConfigValue('internal_rate', 0)
    const depreciationMonths = await getConfigValue('depreciation_months', 36)
    const monthlyDepreciation = calculateDepreciation(totalCapex, internalRate / 12, depreciationMonths)

    // Contribution margins
    const cm1 = revenueMonthly - cogsMonthly
    const cm1Pct = revenueMonthly > 0 ? cm1 / revenueMonthly : 0
    const cm2 = cm1 - networkCostMonthly - opexMonthly - monthlyDepreciation
    const cm2Pct = revenueMonthly > 0 ? cm2 / revenueMonthly : 0

    // 8. Zone classification
    const allZones = await db.select().from(zoneBreakpoints).orderBy(zoneBreakpoints.displayOrder)
    let zone = 'Unknown'
    for (const z of allZones) {
      if (accessQuarterlySek <= z.maxQuarterlyAccessCost) {
        zone = z.zone
        break
      }
    }

    // 9. Payback
    const payback = calculatePayback(
      revenueOneTime,
      revenueMonthly,
      cogsOneTime,
      cogsMonthly,
      totalCapex,
      opexOneTime,
      networkCostMonthly,
      data.contractLengthMonths,
    )

    return {
      // Recommended / list prices
      pricing: {
        listPriceOneTime: product.listPriceOneTime ?? 0,
        listPriceMonthly: product.listPriceMonthly ?? 0,
        priceOneTime,
        priceMonthly,
        finalOneTime,
        finalMonthly,
      },
      // P&L breakdown
      pnl: {
        revenueOneTime,
        revenueMonthly,
        cogsOneTime,
        cogsMonthly,
        networkCostMonthly,
        opexOneTime,
        opexMonthly,
        totalCapex,
        monthlyDepreciation,
        contributionMargin1: cm1,
        contributionMargin1Pct: cm1Pct,
        contributionMargin2: cm2,
        contributionMargin2Pct: cm2Pct,
      },
      payback,
      zone,
      product: {
        id: product.id,
        displayName: product.displayName,
        lookupKey: product.lookupKey,
      },
    }
  })

// ── Approval Check ──

export const checkApproval = createServerFn({ method: 'POST' })
  .validator(z.object({
    paybackMonths: z.number().nullable(),
    contributionMargin2Pct: z.number(),
    totalContractValueMsek: z.number(),
  }))
  .handler(async ({ data }) => {
    const rules = await db.select().from(
      (await import('../db/schema')).approvalRules
    ).orderBy(
      (await import('../db/schema')).approvalRules.displayOrder
    )

    for (const rule of rules) {
      const paybackOk = rule.maxPaybackMonths === null
        || (data.paybackMonths !== null && data.paybackMonths <= rule.maxPaybackMonths)
      const marginOk = rule.minContributionMargin === null
        || data.contributionMargin2Pct >= rule.minContributionMargin
      const valueOk = rule.maxContractValueMsek === null
        || data.totalContractValueMsek <= rule.maxContractValueMsek

      if (paybackOk && marginOk && valueOk) {
        return {
          requiredLevel: rule.level,
          displayName: rule.displayName,
          reason: `Payback ${data.paybackMonths ?? '∞'} mån, TB2 ${(data.contributionMargin2Pct * 100).toFixed(1)}%, Värde ${data.totalContractValueMsek.toFixed(2)} MSEK`,
        }
      }
    }

    return {
      requiredLevel: 'ceo',
      displayName: 'VD',
      reason: 'Överstiger alla tröskelvärden',
    }
  })
