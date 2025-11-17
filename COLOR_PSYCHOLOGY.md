# Monitrax Color Psychology Guide

This document outlines the strategic use of color throughout the Monitrax UI, based on proven color psychology principles in financial applications.

## Color Palette & Meanings

### 🟢 Green (`green` variant)
**Emotional Response**: Growth, prosperity, success, positive outcomes
**Use Cases**:
- ✅ Monthly Income
- ✅ Interest Saved (Debt Planner)
- ✅ Total Income (Tax Calculator)
- ✅ Positive Cash Flow
- ✅ Savings & Growth metrics

**Psychology**: Green signals safety, growth, and positive financial movement. It's universally associated with "go" and success.

---

### 🔴 Red / 🟠 Orange (`orange` variant for warnings, red for critical)
**Emotional Response**: Caution, debt, expenses, attention required
**Use Cases**:
- ⚠️ Total Debt
- ⚠️ Monthly Expenses
- ⚠️ Tax Payable (red gradient)
- ⚠️ Negative Cash Flow (orange)
- ⚠️ Costs & Liabilities

**Psychology**: Warm colors (red/orange) indicate caution and grab attention. In finance, they signal money going out or obligations.

---

### 🔵 Blue (`blue` variant)
**Emotional Response**: Trust, stability, security, information
**Use Cases**:
- 🏠 Properties (assets)
- ⏱️ Time Saved (Debt Planner)
- 📊 Taxable Income (neutral information)
- 📈 General informational metrics

**Psychology**: Blue conveys trust, reliability, and stability - perfect for assets and neutral financial information.

---

### 🟣 Purple (`purple` variant)
**Emotional Response**: Wealth, luxury, prestige, sophistication
**Use Cases**:
- 💎 Net Worth (total wealth indicator)
- 👑 Premium features
- 🎯 High-value metrics

**Psychology**: Purple has historically been associated with royalty and wealth. Perfect for showcasing total net worth.

---

### 🩵 Teal (`teal` variant)
**Emotional Response**: Balance, benefit, neutral positive
**Use Cases**:
- 💡 Tax Deductions (benefits)
- ⚖️ Balanced metrics
- 🎁 Financial benefits

**Psychology**: Teal combines the trust of blue with the positivity of green - ideal for benefits and deductions.

---

### ⚫ Default (`default` variant)
**Emotional Response**: Neutral, professional, general information
**Use Cases**:
- General cards without specific emotional context
- Placeholder metrics
- Informational displays

---

## Application Guidelines

### Dashboard Stats (app/dashboard/page.tsx:148-176)
```typescript
Net Worth: purple        // Wealth indicator
Cash Flow: green/orange  // Dynamic: green if positive, orange if negative
Properties: blue         // Assets = stability
Total Debt: orange       // Debt = caution
```

### Monthly Overview (app/dashboard/page.tsx:180-209)
```typescript
Income: green gradient   // Money coming in = growth
Expenses: orange gradient // Money going out = caution
```

### Debt Planner (app/dashboard/debt-planner/page.tsx:286-299)
```typescript
Interest Saved: green    // Savings = positive outcome
Time Saved: blue         // Informational metric
```

### Tax Calculator (app/dashboard/tax/page.tsx:124-156)
```typescript
Total Income: green      // Income = growth
Deductions: teal         // Benefits = neutral positive
Taxable Income: blue     // Information = neutral
Tax Payable: red         // Cost = attention/warning
```

---

## Consistency Rules

1. **Income/Revenue/Savings** → Always green
2. **Debt/Expenses/Costs** → Always orange/red
3. **Assets/Properties** → Always blue
4. **Net Worth/Wealth** → Always purple
5. **Benefits/Deductions** → Always teal
6. **Dynamic Metrics** → Use conditional logic (green for positive, orange for negative)

---

## Visual Hierarchy

Each color variant includes:
- **Gradient background**: `from-{color}-50 to-white` (subtle depth)
- **Left border accent**: `border-l-4 border-l-{color}-500` (visual anchor)
- **Icon background**: `bg-{color}-100` (contained color pop)
- **Hover shadow**: `hover:shadow-{color}-100` (interactive feedback)
- **Text color**: `text-{color}-600/700` (readability)

---

## Accessibility Considerations

- All color contrasts meet WCAG AA standards
- Colors are supported by icons for colorblind users
- Hover states provide additional visual feedback
- Text remains readable on all background colors

---

## Future Extensions

When adding new metrics, follow this decision tree:

```
Is it income/growth/savings?
  └─ Use GREEN

Is it debt/cost/expense?
  └─ Use ORANGE/RED

Is it an asset/property?
  └─ Use BLUE

Is it total wealth?
  └─ Use PURPLE

Is it a benefit/deduction?
  └─ Use TEAL

Is it neutral information?
  └─ Use BLUE or DEFAULT
```

---

*Last updated: 2025*
*Maintained by: Monitrax Development Team*
