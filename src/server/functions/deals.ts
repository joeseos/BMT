import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db } from '../db'
import { deals, dealLines, dealAdditionalCosts, approvalLog, auditLog } from '../db/schema'
import { eq, desc } from 'drizzle-orm'

// ── List Deals ──

export const getDeals = createServerFn({ method: 'GET' })
  .handler(async () => {
    return db.select().from(deals).orderBy(desc(deals.updatedAt))
  })

// ── Get Deal with Lines ──

export const getDeal = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const deal = await db.select().from(deals).where(eq(deals.id, data.id)).get()
    if (!deal) throw new Error('Deal not found')

    const lines = await db.select().from(dealLines).where(eq(dealLines.dealId, data.id))
    const additionalCosts = await db.select().from(dealAdditionalCosts)
      .where(eq(dealAdditionalCosts.dealId, data.id))
    const approvals = await db.select().from(approvalLog)
      .where(eq(approvalLog.dealId, data.id))
      .orderBy(desc(approvalLog.timestamp))

    // Aggregate P&L across all lines
    const totalPnl = lines.reduce((acc, line) => ({
      revenueOneTime: acc.revenueOneTime + (line.revenueOneTime ?? 0),
      revenueMonthly: acc.revenueMonthly + (line.revenueMonthly ?? 0),
      cogsOneTime: acc.cogsOneTime + (line.cogsOneTime ?? 0),
      cogsMonthly: acc.cogsMonthly + (line.cogsMonthly ?? 0),
      networkCost: acc.networkCost + (line.networkCost ?? 0),
      opex: acc.opex + (line.opex ?? 0),
      capex: acc.capex + (line.capex ?? 0),
    }), {
      revenueOneTime: 0, revenueMonthly: 0, cogsOneTime: 0,
      cogsMonthly: 0, networkCost: 0, opex: 0, capex: 0,
    })

    return { deal, lines, additionalCosts, approvals, totalPnl }
  })

// ── Create Deal ──

export const createDeal = createServerFn({ method: 'POST' })
  .validator(z.object({
    customerName: z.string(),
    orgNumber: z.string().optional(),
    contractLengthMonths: z.number().default(36),
    accessRequestRef: z.string().optional(),
    salesRepId: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const result = await db.insert(deals).values({
      ...data,
      status: 'draft',
    }).returning()

    await db.insert(auditLog).values({
      tableName: 'deals',
      recordId: result[0].id,
      action: 'create',
      newValue: JSON.stringify(data),
    })

    return result[0]
  })

// ── Update Deal ──

export const updateDeal = createServerFn({ method: 'POST' })
  .validator(z.object({
    id: z.number(),
    updates: z.record(z.string(), z.any()),
  }))
  .handler(async ({ data }) => {
    await db.update(deals)
      .set({ ...data.updates, updatedAt: new Date().toISOString() })
      .where(eq(deals.id, data.id))

    return db.select().from(deals).where(eq(deals.id, data.id)).get()
  })

// ── Add Deal Line ──

export const addDealLine = createServerFn({ method: 'POST' })
  .validator(z.object({
    dealId: z.number(),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().default('SE'),
    productId: z.number().optional(),
    serviceName: z.string().optional(),
    capacity: z.number().optional(),
    accessType: z.string().optional(),
    quantity: z.number().default(1),
    accessCostOneTime: z.number().default(0),
    accessCostQuarterly: z.number().default(0),
    discountOneTime: z.number().default(0),
    discountMonthly: z.number().default(0),
    isRenewal: z.boolean().default(false),
  }))
  .handler(async ({ data }) => {
    const result = await db.insert(dealLines).values(data).returning()
    return result[0]
  })

// ── Update Deal Line ──

export const updateDealLine = createServerFn({ method: 'POST' })
  .validator(z.object({
    id: z.number(),
    updates: z.record(z.string(), z.any()),
  }))
  .handler(async ({ data }) => {
    await db.update(dealLines).set(data.updates).where(eq(dealLines.id, data.id))
    return db.select().from(dealLines).where(eq(dealLines.id, data.id)).get()
  })

// ── Delete Deal Line ──

export const deleteDealLine = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    await db.delete(dealLines).where(eq(dealLines.id, data.id))
    return { success: true }
  })

// ── Submit for Approval ──

export const submitForApproval = createServerFn({ method: 'POST' })
  .validator(z.object({ dealId: z.number() }))
  .handler(async ({ data }) => {
    await db.update(deals)
      .set({ status: 'pending_approval', updatedAt: new Date().toISOString() })
      .where(eq(deals.id, data.dealId))

    return { success: true }
  })

// ── Approve / Reject Deal ──

export const approveDeal = createServerFn({ method: 'POST' })
  .validator(z.object({
    dealId: z.number(),
    action: z.enum(['approved', 'rejected']),
    level: z.string(),
    approverName: z.string(),
    comments: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    await db.insert(approvalLog).values({
      dealId: data.dealId,
      level: data.level,
      approverName: data.approverName,
      action: data.action,
      comments: data.comments,
    })

    await db.update(deals)
      .set({
        status: data.action,
        approvalLevel: data.level,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(deals.id, data.dealId))

    return { success: true }
  })
