# 🧱 **PHASE 01 — FOUNDATIONS**  
### *Core Setup, Base Principles, Initial Infrastructure*

---

# **1. Purpose of Phase 01**

Phase 01 establishes the **base platform** for all future Monitrax development.  
Nothing fancy. Nothing complex. Just:

- A clean repository  
- A stable tech stack  
- A predictable folder structure  
- Strong architecture principles  
- Early engines and services set up  
- First seeds of system coherence  

Everything past Phase 01 sits on this foundation.

---

# **2. Deliverables Overview**

Phase 01 produces the following:

- Next.js + TypeScript project baseline  
- Tailwind CSS + shadcn/ui setup  
- Component architecture standards  
- API folder structure  
- Lib folder structure  
- Hooks / Contexts standards  
- Environment variable framework  
- Database connection baseline  
- Prisma initialisation  
- Global error boundary  
- Global layout shell  
- Design tokens + UI theme system  
- Logging scaffolding  
- Base utilities + helpers  

This is the “zero-to-one” foundation.

---

# **3. Repository Structure**

By end of Phase 01, Monitrax MUST have the following structure:

```
/app
   /api
   /dashboard
/components
   /ui
/contexts
/hooks
/lib
   /utils
   /validation
   /services
   /models
/prisma
/styles
/tests
/docs
```

Uniformity is essential — this structure is the backbone of the entire platform.

---

# **4. Tech Stack Setup**

### **4.1 Framework**
- Next.js (App Router)  
- React 18+  
- Node.js 20+  

### **4.2 Language**
- TypeScript strict mode  
- ESLint + Prettier  
- TSConfig path aliases  

### **4.3 UI Library**
- TailwindCSS  
- shadcn/ui  
- Lucide icons  

### **4.4 Data Layer**
- Prisma ORM  
- PostgreSQL (primary DB)  

### **4.5 Deployment**
- Vercel (frontend)  
- Render/Fly.io (backend optional)  
- OR single unified deployment  

---

# **5. Core Architecture Rules Defined in Phase 01**

### **5.1 State Management Rules**
- Use React Server Components by default  
- Use Contexts sparingly  
- Custom hooks for all UI logic  
- No Redux, Zustand, Recoil, unless future phases require  

### **5.2 UI Component Rules**
- Must follow atomic/componentized patterns  
- Presentational components = server components  
- Interactive components = client components  
- Every component documented  

### **5.3 API Design Rules**
- Every endpoint must have:
  - Schema validation  
  - Typed responses  
  - Unified API envelope  
  - Clear error codes  

### **5.4 Service Layer Rules**
- All backend logic lives in `/lib/services`  
- No logic allowed in API routes  
- All heavy work delegated to engine modules  

---

# **6. Environment Variables Setup**

Phase 01 defines the `.env` pattern:

```
DATABASE_URL=
NEXT_PUBLIC_APP_ENV=
AUTH_PROVIDER_KEY=
ENCRYPTION_SECRET=
```

Rules:

- No defaults  
- No secrets in repo  
- `.env.example` must mirror `.env`  

---

# **7. Base Utilities Created**

The following utilities must exist:

### **7.1 Error Utility**
```
createError(code, message, details?)
```

### **7.2 Logger**
```
log.info()
log.warn()
log.error()
```

### **7.3 Date/Number Helpers**
- formatCurrency  
- formatPercentage  
- formatDate  

### **7.4 HTTP Client Wrapper**
Unified fetch wrapper with:

- Timeout  
- Retry  
- JSON parsing  
- Error envelope enforcement  

---

# **8. Base Layout & UI Shell**

Phase 01 delivers:

### **8.1 Root Layout**
- Global theme  
- Global fonts  
- Global CSS  
- Light/Dark system (theme config only)  

### **8.2 Dashboard Shell**
Basic structure:

```
<DashboardLayout>
   <Sidebar />
   <Topbar />
   <Content />
</DashboardLayout>
```

Not functional yet — only scaffolding.

---

# **9. Database Setup**

### **9.1 Initial Schema Created**
Minimum definition:

- users  
- accounts (auth-provider side)  
- simple test entity (placeholder)  

### **9.2 Prisma Commands**
- prisma init  
- prisma migrate dev  
- prisma generate  

---

# **10. Global Error Handling**

Phase 01 must implement:

- error.ts redirects  
- Global error boundary  
- API try/catch wrappers  
- Logging of unexpected errors  

---

# **11. Acceptance Criteria for Phase 01**

Phase 01 is complete when:

- The repo is stable and deployable  
- TS, ESLint, Prettier clean  
- Folder structure complete  
- Base UI theming in place  
- Prisma is initialised  
- Global layout renders  
- First dummy API route works  
- No undefined behaviours  
- Logging utilities work  
- Environment variables validated  

Everything must be **structurally clean, predictable, and ready for Phase 02**.

---

