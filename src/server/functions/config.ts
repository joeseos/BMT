import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db } from '../db'
import {
  globalConfig, zoneBreakpoints, approvalRules,
  bandwidthCosts, slaCosts, equipmentCosts, auditLog,
} from '../db/schema'
import { eq } from 'drizzle-orm'

// ── Global Config ──

export const getGlobalConfig = createServerFn({ method: 'GET' })
  .handler(async () => {
    return db.select().from(globalConfig).orderBy(globalConfig.category, globalConfig.key)
  })

export const updateConfigValue = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    key: z.string(),
    value: z.number(),
  }))
  .handler(async ({ data }) => {
    const existing = await db.select().from(globalConfig).where(eq(globalConfig.key, data.key)).get()

    await db.update(globalConfig)
      .set({ value: data.value, updatedAt: new Date().toISOString() })
      .where(eq(globalConfig.key, data.key))

    await db.insert(auditLog).values({
      tableName: 'global_config',
      action: 'update',
      oldValue: JSON.stringify({ key: data.key, value: existing?.value }),
      newValue: JSON.stringify(data),
    })

    return { success: true }
  })

export const addConfigValue = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    key: z.string(),
    value: z.number(),
    label: z.string().optional(),
    category: z.string(),
    notes: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    await db.insert(globalConfig).values(data)
    return { success: true }
  })

// ── Zone Breakpoints ──

export const getZoneBreakpoints = createServerFn({ method: 'GET' })
  .handler(async () => {
    return db.select().from(zoneBreakpoints).orderBy(zoneBreakpoints.displayOrder)
  })

export const updateZoneBreakpoint = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    zone: z.string(),
    maxQuarterlyAccessCost: z.number(),
  }))
  .handler(async ({ data }) => {
    await db.update(zoneBreakpoints)
      .set({ maxQuarterlyAccessCost: data.maxQuarterlyAccessCost })
      .where(eq(zoneBreakpoints.zone, data.zone))
    return { success: true }
  })

// ── Approval Rules ──

export const getApprovalRules = createServerFn({ method: 'GET' })
  .handler(async () => {
    return db.select().from(approvalRules).orderBy(approvalRules.displayOrder)
  })

export const updateApprovalRule = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    id: z.number(),
    updates: z.record(z.string(), z.union([z.number(), z.string(), z.null()])),
  }))
  .handler(async ({ data }) => {
    await db.update(approvalRules).set(data.updates).where(eq(approvalRules.id, data.id))
    return { success: true }
  })

// ── Bandwidth Costs ──

export const getBandwidthCosts = createServerFn({ method: 'GET' })
  .handler(async () => {
    return db.select().from(bandwidthCosts).orderBy(bandwidthCosts.costType, bandwidthCosts.bandwidthMbit)
  })

// ── SLA Costs ──

export const getSlaCosts = createServerFn({ method: 'GET' })
  .handler(async () => {
    return db.select().from(slaCosts).orderBy(slaCosts.technology)
  })

// ── Equipment Costs ──

export const getEquipmentCosts = createServerFn({ method: 'GET' })
  .handler(async () => {
    return db.select().from(equipmentCosts).orderBy(equipmentCosts.category, equipmentCosts.code)
  })

// ── Audit Log ──

export const getAuditLog = createServerFn({ method: 'GET' })
  .inputValidator(z.object({
    tableName: z.string().optional(),
    limit: z.number().optional(),
  }))
  .handler(async ({ data }) => {
    const filters = data ?? {}
    const limit = filters.limit ?? 50
    const query = db.select().from(auditLog)
    if (filters.tableName) {
      return query.where(eq(auditLog.tableName, filters.tableName))
        .orderBy(auditLog.timestamp)
        .limit(limit)
    }
    return query.orderBy(auditLog.timestamp).limit(limit)
  })
