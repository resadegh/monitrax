# Monitrax - Quick Start Guide

## 🚀 Get Running in 5 Minutes

### Step 1: Install Dependencies

```bash
cd /Users/apple/Desktop/monitrax
npm install
```

### Step 2: Set Up Environment

```bash
# Copy the example environment file
cp .env.example .env
```

Edit `.env` and set your database URL:
```
DATABASE_URL="postgresql://username:password@localhost:5432/monitrax?schema=public"
JWT_SECRET="change-this-to-a-random-string"
```

### Step 3: Initialize Database

```bash
# Generate Prisma client
npx prisma generate

# Create database tables
npx prisma db push
```

### Step 4: Run the App

```bash
npm run dev
```

Visit: **http://localhost:3000**

## 📡 Test the API

### Register a User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@email.com",
    "password": "password123",
    "name": "Your Name"
  }'
```

Save the `token` from the response!

### Get Your Profile

```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Add a Property

```bash
curl -X POST http://localhost:3000/api/properties \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Home",
    "type": "HOME",
    "address": "123 Main St",
    "purchasePrice": 500000,
    "purchaseDate": "2020-01-01",
    "currentValue": 600000,
    "valuationDate": "2025-01-01"
  }'
```

### Add a Loan

```bash
curl -X POST http://localhost:3000/api/loans \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Home Loan",
    "type": "HOME",
    "principal": 400000,
    "interestRateAnnual": 0.0625,
    "rateType": "VARIABLE",
    "isInterestOnly": false,
    "termMonthsRemaining": 300,
    "minRepayment": 2500,
    "repaymentFrequency": "MONTHLY"
  }'
```

### Add Income

```bash
curl -X POST http://localhost:3000/api/income \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Salary",
    "type": "SALARY",
    "amount": 8000,
    "frequency": "MONTHLY",
    "isTaxable": true
  }'
```

### Calculate Tax

```bash
curl http://localhost:3000/api/calculate/tax \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Run Debt Planner

```bash
curl -X POST http://localhost:3000/api/calculate/debt-plan \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "strategy": "TAX_AWARE_MINIMUM_INTEREST",
      "surplusPerPeriod": 1000,
      "surplusFrequency": "MONTHLY",
      "emergencyBuffer": 5000,
      "respectFixedCaps": true,
      "rolloverRepayments": true
    }
  }'
```

## 🗄️ Explore Your Database

```bash
npx prisma studio
```

Opens a visual database browser at **http://localhost:5555**

## 🌐 Deploy to Render

1. Push to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial Monitrax build"
   git remote add origin YOUR_GITHUB_URL
   git push -u origin main
   ```

2. Go to https://dashboard.render.com

3. New → Blueprint → Connect your repo

4. Render will detect `render.yaml` and deploy automatically!

## 📚 Need More Help?

- Full docs: `README.md`
- Build details: `BUILD_SUMMARY.md`
- Database schema: `prisma/schema.prisma`

## 🎯 What's Next?

The backend is complete! Now build your frontend UI:

1. Create a dashboard in `app/dashboard/page.tsx`
2. Add property management UI
3. Add loan management UI
4. Build the debt planner interface
5. Add charts and visualizations

Happy building! 🚀
