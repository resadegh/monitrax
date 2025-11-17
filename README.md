# Monitrax - Personal Finance & Debt Planning

A comprehensive personal finance application focused on property investment, loan management, and strategic debt planning.

## Features

- **Property Management**: Track home and investment properties with valuations, equity, and LVR calculations
- **Loan Management**: Manage home and investment loans with offset account linking
- **Australian Tax Calculator**: Estimate tax position based on income and deductible expenses
- **Smart Debt Planner**: Three strategies to optimize debt repayment:
  - Tax-Aware Minimum Interest (pay off non-deductible home loans first)
  - Avalanche (highest interest rate first)
  - Snowball (smallest balance first)
- **Income & Expense Tracking**: Categorize and track recurring income and expenses
- **Account Management**: Track offset, savings, transactional accounts, and credit cards

## Tech Stack

- **Framework**: Next.js 15 with TypeScript
- **Database**: PostgreSQL (Prisma ORM)
- **Authentication**: JWT with bcrypt
- **Styling**: Tailwind CSS
- **Hosting**: Render (Web Service + Postgres)

## Architecture

- **Single Monolithic Service**: Next.js handles both frontend and API
- **Database-First**: All data persisted in Postgres, no browser storage for core data
- **Clean Separation**: Business logic in `lib/`, API routes in `app/api/`, UI in `app/`

## Local Development

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (local or cloud)

### Setup

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd monitrax
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and set:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `JWT_SECRET`: A secure random string for JWT signing

5. Initialize the database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

6. Run the development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000)

## Database Schema

The application uses a fully relational schema with these core entities:

- **User**: Authentication and user data
- **Property**: HOME or INVESTMENT properties with valuations
- **Loan**: Mortgages with interest rates, offset linking, and repayment details
- **Account**: Offset, savings, transactional accounts, credit cards
- **Income**: Salary, rent, and other income sources
- **Expense**: Property expenses, personal expenses with tax deductibility
- **Transaction**: Actual money movements (optional for MVP)
- **DebtPlan**: Saved debt repayment plans

All entities have proper foreign key relationships and cascade deletes.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires auth)

### Data Management
- `GET /api/properties` - List user properties
- `POST /api/properties` - Create property
- `GET /api/loans` - List user loans
- `POST /api/loans` - Create loan
- `GET /api/accounts` - List user accounts
- `POST /api/accounts` - Create account
- `GET /api/income` - List user income
- `POST /api/income` - Create income
- `GET /api/expenses` - List user expenses
- `POST /api/expenses` - Create expense

### Calculations
- `GET /api/calculate/tax` - Calculate Australian tax position
- `POST /api/calculate/debt-plan` - Run debt planner simulation

### Health
- `GET /api/health` - Health check and database connectivity

## Deployment to Render

### Using Blueprint (Recommended)

1. Push your code to GitHub

2. Go to [Render Dashboard](https://dashboard.render.com)

3. Click "New" → "Blueprint"

4. Connect your GitHub repository

5. Render will automatically detect `render.yaml` and create:
   - PostgreSQL database (`monitrax-db`)
   - Web service (`monitrax`) with environment variables configured

6. Wait for deployment to complete (~5-10 minutes)

7. Your app will be live at `https://monitrax-<random-id>.onrender.com`

### Manual Deployment

If you prefer manual setup:

1. Create PostgreSQL database on Render
2. Create Web Service:
   - Build Command: `npm install && npx prisma generate && npx prisma db push && npm run build`
   - Start Command: `npm start`
   - Add environment variables:
     - `DATABASE_URL` (from your Postgres)
     - `JWT_SECRET` (generate secure random string)
     - `NODE_ENV=production`

## Project Structure

```
monitrax/
├── app/                  # Next.js App Router
│   ├── api/             # API routes
│   │   ├── auth/       # Authentication endpoints
│   │   ├── properties/ # Property CRUD
│   │   ├── loans/      # Loan CRUD
│   │   ├── accounts/   # Account CRUD
│   │   ├── income/     # Income CRUD
│   │   ├── expenses/   # Expense CRUD
│   │   ├── calculate/  # Tax & debt planner
│   │   └── health/     # Health check
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Home page
│   └── globals.css     # Global styles
├── lib/                  # Business logic
│   ├── auth.ts          # JWT & password hashing
│   ├── db.ts            # Prisma client
│   ├── middleware.ts    # Auth middleware
│   ├── tax/
│   │   └── auTax.ts     # Australian tax calculator
│   ├── planning/
│   │   └── debtPlanner.ts # Debt repayment simulator
│   └── utils/
│       ├── calculations.ts # LVR, yield, equity calculations
│       └── frequencies.ts  # Frequency conversions
├── prisma/
│   └── schema.prisma    # Database schema
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── render.yaml          # Render deployment config
└── README.md
```

## Key Design Principles

1. **No Browser Storage**: All critical data in PostgreSQL, accessed via API routes
2. **Type Safety**: TypeScript everywhere with strict checking
3. **Clean Architecture**: Business logic separate from API routes and UI
4. **Relational Integrity**: All foreign keys enforced, cascade deletes configured
5. **Security**: JWT authentication, password hashing, user data isolation

## Extending the Application

### Adding New Entities

1. Update `prisma/schema.prisma` with new model
2. Run `npx prisma generate && npx prisma db push`
3. Create API routes in `app/api/<entity>/route.ts`
4. Add business logic in `lib/` if needed
5. Create UI components in `app/` or `components/`

### Adding Frontend UI

The application currently has a minimal frontend. To build full UI:

1. Create components in `components/` directory
2. Add pages in `app/` directory
3. Use API routes to fetch/mutate data
4. Consider using React Query or SWR for data fetching
5. Build forms with validation (Zod recommended)

### Testing

```bash
# Run Prisma Studio to inspect database
npx prisma studio

# Test API endpoints with curl or Postman
curl http://localhost:3000/api/health
```

## Troubleshooting

### Database Connection Issues

- Verify `DATABASE_URL` is correctly set in `.env`
- Ensure PostgreSQL is running
- Check Prisma connection: `npx prisma db pull`

### Build Failures on Render

- Check build logs in Render dashboard
- Ensure all dependencies are in `package.json`
- Verify `DATABASE_URL` environment variable is set

### Authentication Issues

- Verify `JWT_SECRET` is set
- Check token format in Authorization header: `Bearer <token>`
- Ensure passwords meet minimum length (6 characters)

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.
