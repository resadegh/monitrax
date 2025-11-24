01 — ARCHITECTURE OVERVIEW
Monitrax Enterprise Architecture — System-Level Blueprint
1. Purpose

This document provides a high-level architectural map of the Monitrax platform.
It defines how the system is structured, how its components interact, and the architectural conventions that every future phase must follow.

This is the master reference for:

Engineers

System architects

Product designers

AI copilots

Future contributors

2. System Architecture Summary

Monitrax is a modular financial intelligence platform built as a structured modular monolith, designed for:

high consistency

strict relational integrity

cross-module cohesion

AI-ready data flows

long-term extensibility

It consists of the following major layers:

UI Layer (Next.js + React)

Navigation Layer (CMNF + NavigationContext)

API Layer (REST module APIs)

Canonicalisation Layer (GRDCS)

Intelligence Layer (Snapshot Engine, Insights Engine, LinkageHealth)

Domain Engines (Depreciation, Lending, Offset, etc.)

ORM Layer (Prisma)

Database Layer (PostgreSQL)

Security Layer (Phase 10)

AI Systems Layer (Phase 11)

Financial Health Layer (Phase 12)

3. Conceptual Architecture Diagram
                           ┌──────────────────────────────┐
                           │         UI LAYER             │
                           │   Next.js + React Client     │
                           └─────────────┬────────────────┘
                                         │
                     CMNF + UI Sync Engine + Navigation Context
                                         │
              ┌──────────────────────────┴──────────────────────────┐
              │                                                     │
 ┌────────────▼────────────┐                       ┌──────────────────────────┐
 │   Financial Modules     │                       │ Cross-Module Intelligence │
 │ (properties, loans...)  │                       │ Snapshot / Insights / LHS │
 └────────────┬────────────┘                       └───────────────┬──────────┘
              │                                                    │
        GRDCS Canonical Layer                             Data Engines Layer
              │                                                    │
 ┌────────────▼────────────┐                       ┌──────────────▼──────────┐
 │       ORM Layer         │                       │    Domain Engines        │
 │       Prisma Client     │                       │ Depreciation, Lending... │
 └────────────┬────────────┘                       └──────────────┬──────────┘
              │                                                    │
           PostgreSQL                                   External Integrations

4. Architectural Layers
4.1 UI Layer

The UI is implemented using:

Next.js App Router (v15+)

React Server & Client Components

Component composition model

TailwindCSS

Radix UI primitives

Custom Monitrax UI components

Responsibilities:

Dashboard pages

Dialogs for every financial entity

Data visualisation

Insight feeds

Navigation patterns

Error and warning ribbons

4.2 Navigation Layer

Navigation is entirely handled through:

NavigationContext

useCrossModuleNavigation hook

navStack

breadcrumb generator

context restoration engine

deep relational navigation

Rules:

No direct router.push from components

All entity navigation routed through CMNF

Breadcrumbs always reflect relational ancestry

Back button manipulates navStack (NOT browser history)

This ensures no broken context and persistent state across modules.

4.3 API Layer

Each module exposes a REST namespace:

/api/properties

/api/loans

/api/accounts

/api/expenses

/api/income

/api/investments/accounts

/api/investments/holdings

/api/investments/transactions

System intelligence APIs:

/api/portfolio/snapshot

/api/insights

/api/linkage/health

/api/calculate/*

All API responses must return GRDCS-compliant canonical entity shapes.

4.4 Canonicalisation Layer (GRDCS)

The Global Relational Data Consistency System standardises:

entity types

entity core fields

linkedEntities[]

relation metadata

canonical IDs

canonical href patterns

cross-module referential integrity

GRDCS is the single source of truth for:

UI dialogs

tables

insights

linkage-health

navigation

snapshot engine inputs

Every engine must consume GRDCS-formatted entities only.

4.5 Intelligence Layer

Contains the data-driven logic that powers Monitrax’s “brain”.

Includes:

4.5.1 Snapshot Engine v2

Produces the full financial profile:

Net worth

Cashflow position

Loan exposure

Asset depreciation

Investment performance

Offsets, accounts, valuations

Used by dashboard KPIs & forecasting.

4.5.2 Insights Engine v2

Computes:

relational issues

financial warnings

optimisation suggestions

entity-level insights

module-level insights

global dashboard suggestions

Outputs grouped insight feeds.

4.5.3 LinkageHealth Service

Evaluates relational quality:

missing links

orphans

incorrect relationships

cross-module mismatches

completeness scoring

Outputs a global healthScore (0–100).

4.6 UI Sync Engine

Runs every 15 seconds.

Pulls:

snapshot

insights

linkageHealth

Pushes updates to:

global header

insight feeds

entity dialog insights

dashboard metrics

ribbon warnings

module summary blocks

Core requirement: no page reload needed.

4.7 Domain Engines

These are pure computation engines:

Depreciation Engine

Lending Engine

Offset Engine

Cashflow Engine

Investment Engine

CGT Engine

Tax Engine

Constraints:

Cannot fetch data directly

Must accept canonical GRDCS entities

Must be fully deterministic

4.8 ORM Layer

Prisma schema defines all:

models

relations

enums

cascading rules

unique constraints

Functions purely as:

persistence

querying

relation resolution

No business logic allowed here.

4.9 Database Layer

Primary data store:

PostgreSQL

Supports:

foreign keys

relational integrity

composite indexes

efficient joins

Future support planned:

tenant segregation

audit tables

event sourcing

encryption policies

4.10 Security & Authentication Layer (Phase 10)

Modular and provider-agnostic.

Supports:

Clerk / Supabase / Auth0

MFA

Passwordless

Session security

RBAC

Per-entity access policy

User security settings

Audit logs

This layer will enforce all cross-application access control rules.

4.11 AI Strategy Engine (Phase 11)

Provides:

buy/hold/sell intelligence

multi-year projections

risk scoring

financial optimisation

automated wealth plans

scenario modelling

Built on top of:

Snapshot Engine v2

GRDCS canonical formats

4.12 Financial Health Engine (Phase 12)

Computes a unified “Financial Health Score” based on:

debt risk

investment health

diversification

liquidity

stability metrics

spending efficiency

savings rate

asset performance

Outputs:

a single global score

module-specific sub-scores

AI recommendations for improvement

5. Data Lifecycle

User interacts

Module API fetches data

GRDCS canonicalises

Snapshot Engine recalculates state

Insights Engine + LinkageHealth produce intelligence

UI Sync Engine propagates changes

Navigation layer maintains relational context

This flow is consistent and must remain unchanged across all future phases.

6. Deployment Architecture

Current:

Render.com

Next.js serverless

Postgres managed DB

Prisma generate at build-time

Future:

Vercel

Multi-region

Per-tenant DB shards

Enhanced audit logs

Background workers

7. Extensibility Model

The architecture supports future capabilities:

multi-tenant mode

team-based access

AI-driven workflows

external bank feeds

investment brokerage APIs

rule engines

tax modelling

portfolio optimisation

Monitrax is designed as a long-term financial operating system.
