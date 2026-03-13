import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db } from '../db'
import { products, productFamilies, productAddons, productHardware, equipmentCosts, productCostParams, auditLog } from '../db/schema'
import { eq, and, like, desc, SQL } from 'drizzle-orm'

// ── List Products ──

export const getProducts = createServerFn({ method: 'GET' })
  .inputValidator(z.object({
    familyCode: z.string().optional(),
    country: z.string().optional(),
    search: z.string().optional(),
    activeOnly: z.boolean().optional(),
    isAddonService: z.boolean().optional(),
  }))
  .handler(async ({ data }) => {
    const filters = data ?? {}
    const country = filters.country ?? 'SE'
    const activeOnly = filters.activeOnly ?? true
    const conditions: SQL[] = []

    if (country) conditions.push(eq(products.country, country))
    if (filters.familyCode) conditions.push(eq(products.familyCode, filters.familyCode))
    if (activeOnly) conditions.push(eq(products.isActive, true))
    if (filters.search) conditions.push(like(products.displayName, `%${filters.search}%`))
    if (filters.isAddonService !== undefined) conditions.push(eq(products.isAddonService, filters.isAddonService))

    const result = await db.select().from(products)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(products.familyCode, products.bandwidth)

    return result
  })

// ── Get Single Product ──

export const getProduct = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    return db.select().from(products).where(eq(products.id, data.id)).get()
  })

// ── Create Product ──

const CreateProductInput = z.object({
  country: z.string().default('SE'),
  familyId: z.number().optional(),
  familyCode: z.string(),
  displayName: z.string(),
  priceToolCode: z.string(),
  accessType: z.string().optional(),
  lookupKey: z.string(),
  zoneType: z.number().optional(),
  hasBandwidth: z.boolean().default(false),
  bandwidth: z.number().optional(),
  listPriceOneTime: z.number().default(0),
  listPriceMonthly: z.number().default(0),
  defaultAccessOneTime: z.number().default(0),
  defaultAccessMonthly: z.number().default(0),
  cogsOneTime: z.number().default(0),
  cogsAnnual: z.number().default(0),
  cpeInstallation: z.number().default(0),
  cpeCapex: z.number().default(0),
  siteInstallation: z.number().default(0),
  siteCapex: z.number().default(0),
  backboneCostAnnual: z.number().default(0),
  gtCostAnnual: z.number().default(0),
  opexOneTime: z.number().default(0),
  opexAnnual: z.number().default(0),
  breakpointAccessOneTime: z.number().default(0),
  breakpointAccessAnnual: z.number().default(0),
  marginalSurcharge: z.number().default(0),
  isAddonService: z.boolean().default(false),
})

export const createProduct = createServerFn({ method: 'POST' })
  .inputValidator(CreateProductInput)
  .handler(async ({ data }) => {
    const result = await db.insert(products).values(data).returning()
    const created = result[0]

    await db.insert(auditLog).values({
      tableName: 'products',
      recordId: created.id,
      action: 'create',
      newValue: JSON.stringify(data),
    })

    return created
  })

// ── Update Product ──

export const updateProduct = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    id: z.number(),
    updates: z.record(z.string(), z.union([z.number(), z.string(), z.boolean(), z.null()])),
  }))
  .handler(async ({ data }) => {
    const existing = await db.select().from(products).where(eq(products.id, data.id)).get()
    if (!existing) throw new Error('Product not found')

    await db.update(products)
      .set({ ...data.updates, updatedAt: new Date().toISOString() })
      .where(eq(products.id, data.id))

    await db.insert(auditLog).values({
      tableName: 'products',
      recordId: data.id,
      action: 'update',
      oldValue: JSON.stringify(existing),
      newValue: JSON.stringify(data.updates),
    })

    return db.select().from(products).where(eq(products.id, data.id)).get()
  })

// ── Delete Product (soft) ──

export const deleteProduct = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    await db.update(products)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(products.id, data.id))

    await db.insert(auditLog).values({
      tableName: 'products',
      recordId: data.id,
      action: 'delete',
    })

    return { success: true }
  })

// ── Product Families ──

export const getProductFamilies = createServerFn({ method: 'GET' })
  .handler(async () => {
    return db.select().from(productFamilies).where(eq(productFamilies.isActive, true))
  })

export const createProductFamily = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    code: z.string(),
    name: z.string(),
    category: z.string(),
    country: z.string().default('SE'),
  }))
  .handler(async ({ data }) => {
    const result = await db.insert(productFamilies).values(data).returning()
    return result[0]
  })

// ── Product Relations (Addons) ──

export const getProductWithRelations = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const product = await db.select().from(products).where(eq(products.id, data.id)).get()
    if (!product) throw new Error('Product not found')

    const addonLinks = await db.select().from(productAddons)
      .where(eq(productAddons.mainProductId, data.id))
      .orderBy(productAddons.displayOrder)

    const addonProducts = await Promise.all(
      addonLinks.map(async (link) => {
        const addon = await db.select().from(products).where(eq(products.id, link.addonProductId)).get()
        return { ...link, addon }
      })
    )

    const hardwareLinks = await db.select().from(productHardware)
      .where(eq(productHardware.productId, data.id))
      .orderBy(productHardware.displayOrder)

    const hardwareItems = await Promise.all(
      hardwareLinks.map(async (link) => {
        const hw = await db.select().from(equipmentCosts).where(eq(equipmentCosts.id, link.hardwareId)).get()
        return { ...link, hardware: hw }
      })
    )

    const costParams = await db.select().from(productCostParams)
      .where(eq(productCostParams.productId, data.id))

    return { product, addons: addonProducts, hardware: hardwareItems, costParams }
  })

export const linkAddonToProduct = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    mainProductId: z.number(),
    addonProductId: z.number(),
    isDefault: z.boolean().default(false),
    displayOrder: z.number().default(0),
  }))
  .handler(async ({ data }) => {
    const result = await db.insert(productAddons).values(data).returning()
    return result[0]
  })

export const unlinkAddonFromProduct = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    mainProductId: z.number(),
    addonProductId: z.number(),
  }))
  .handler(async ({ data }) => {
    await db.delete(productAddons).where(
      and(
        eq(productAddons.mainProductId, data.mainProductId),
        eq(productAddons.addonProductId, data.addonProductId),
      )
    )
    return { success: true }
  })

// ── Product Relations (Hardware) ──

export const linkHardwareToProduct = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    productId: z.number(),
    hardwareId: z.number(),
    quantity: z.number().default(1),
    isDefault: z.boolean().default(false),
    isRequired: z.boolean().default(false),
    displayOrder: z.number().default(0),
  }))
  .handler(async ({ data }) => {
    const result = await db.insert(productHardware).values(data).returning()
    return result[0]
  })

export const unlinkHardwareFromProduct = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    productId: z.number(),
    hardwareId: z.number(),
  }))
  .handler(async ({ data }) => {
    await db.delete(productHardware).where(
      and(
        eq(productHardware.productId, data.productId),
        eq(productHardware.hardwareId, data.hardwareId),
      )
    )
    return { success: true }
  })

// ── Hardware Catalog CRUD ──

export const getHardwareCatalog = createServerFn({ method: 'GET' })
  .handler(async () => {
    return db.select().from(equipmentCosts).orderBy(equipmentCosts.category, equipmentCosts.code)
  })

const HardwareInput = z.object({
  category: z.string(),
  code: z.string(),
  description: z.string(),
  listPriceUsd: z.number().nullable().default(null),
  discountPercent: z.number().nullable().default(null),
  netPriceSek: z.number(),
  notes: z.string().nullable().default(null),
})

export const createHardware = createServerFn({ method: 'POST' })
  .inputValidator(HardwareInput)
  .handler(async ({ data }) => {
    const result = await db.insert(equipmentCosts).values(data).returning()
    await db.insert(auditLog).values({
      tableName: 'equipment_costs',
      recordId: result[0].id,
      action: 'create',
      newValue: JSON.stringify(data),
    })
    return result[0]
  })

export const updateHardware = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    id: z.number(),
    updates: z.record(z.string(), z.union([z.number(), z.string(), z.null()])),
  }))
  .handler(async ({ data }) => {
    const existing = await db.select().from(equipmentCosts).where(eq(equipmentCosts.id, data.id)).get()
    if (!existing) throw new Error('Hardware not found')

    await db.update(equipmentCosts).set(data.updates).where(eq(equipmentCosts.id, data.id))

    await db.insert(auditLog).values({
      tableName: 'equipment_costs',
      recordId: data.id,
      action: 'update',
      oldValue: JSON.stringify(existing),
      newValue: JSON.stringify(data.updates),
    })
    return db.select().from(equipmentCosts).where(eq(equipmentCosts.id, data.id)).get()
  })

export const deleteHardware = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    await db.delete(equipmentCosts).where(eq(equipmentCosts.id, data.id))
    await db.insert(auditLog).values({
      tableName: 'equipment_costs',
      recordId: data.id,
      action: 'delete',
    })
    return { success: true }
  })

// ── Product Cost Parameters ──

export const getProductCostParams = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ productId: z.number() }))
  .handler(async ({ data }) => {
    return db.select().from(productCostParams)
      .where(eq(productCostParams.productId, data.productId))
  })

export const saveProductCostParams = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    productId: z.number(),
    params: z.array(z.object({
      id: z.number().optional(),
      name: z.string(),
      amount: z.number(),
      frequency: z.enum(['one_time', 'monthly']),
      costType: z.enum(['COGS', 'CAPEX', 'OPEX']),
      currency: z.string().default('SEK'),
    })),
  }))
  .handler(async ({ data }) => {
    // Replace all cost params for this product
    await db.delete(productCostParams).where(eq(productCostParams.productId, data.productId))

    if (data.params.length > 0) {
      await db.insert(productCostParams).values(
        data.params.map((p) => ({
          productId: data.productId,
          name: p.name,
          amount: p.amount,
          frequency: p.frequency,
          costType: p.costType,
          currency: p.currency,
        }))
      )
    }

    return db.select().from(productCostParams)
      .where(eq(productCostParams.productId, data.productId))
  })
