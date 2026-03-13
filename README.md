# Pricing Tool

A B2B telecom service pricing and profitability calculator, migrated from an Excel-based tool to a full-stack web application.

## Stack

- **Framework**: TanStack Start (full-stack React with SSR)
- **Database**: SQLite via Drizzle ORM (WAL mode)
- **Styling**: Tailwind CSS v4
- **Validation**: Zod
- **Container**: Docker + Docker Compose

## Getting Started

```bash
# Install dependencies
npm install

# Generate database migrations
npm run db:generate

# Run migrations
npm run db:migrate

# Seed default config (currencies, zones, approval rules, product families)
npm run db:seed

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Docker Deployment

```bash
docker compose up -d
```

Single container, SQLite file persisted via Docker volume. No external database needed.

## Project Structure

```
src/
├── routes/               # TanStack file-based routing
│   ├── __root.tsx        # Root layout + navigation
│   ├── index.tsx         # Dashboard
│   ├── deals/            # Deal management
│   │   ├── index.tsx     # Deal list
│   │   ├── new.tsx       # Create deal
│   │   └── $dealId.tsx   # Deal detail + P&L
│   ├── admin/            # Admin interface
│   │   ├── products.tsx  # Product catalog CRUD
│   │   ├── parameters.tsx # Global config (FX, zones, etc.)
│   │   └── approval-rules.tsx
│   └── api/              # API routes
│       ├── up.ts         # Health check
│       └── export/       # Billing system exports
├── server/
│   ├── db/
│   │   ├── schema.ts     # Drizzle schema (all tables)
│   │   ├── index.ts      # DB connection
│   │   └── seed.ts       # Default data seeding
│   └── functions/
│       ├── pricing-engine.ts  # Core: price calculation + P&L + payback
│       ├── products.ts        # Product catalog CRUD
│       ├── deals.ts           # Deal + site line CRUD + approval
│       └── config.ts          # Parameters + zones + approval rules
└── lib/
    └── pricing-types.ts  # Shared types + formatting helpers
```

## Core Business Logic

The pricing engine (`src/server/functions/pricing-engine.ts`) replicates the Excel Calculations sheet:

1. **Product lookup** by composite key: `{Country}-{ServiceCode}{Capacity}-{AccessType}`
2. **Access breakpoint surcharge** when actual access cost exceeds product breakpoint
3. **Currency conversion** (SE/FI/NO/DK)
4. **Renewal adjustment** (15% CAPEX factor)
5. **Discount application**
6. **P&L calculation**: Revenue, COGS, Network costs, OPEX, CAPEX, Depreciation
7. **Payback calculation** with status classification
8. **Zone classification** based on access cost thresholds
9. **Approval level determination** based on payback, margin, and contract value