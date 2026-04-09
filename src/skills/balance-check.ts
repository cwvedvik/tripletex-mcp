import { SkillDefinition } from "./types.js";

export const balanceCheckSkill: SkillDefinition = {
  id: "balance-check",
  title: "Saldobalanse / kontooversikt",
  description: "Guide for reviewing balance sheet and account balances for a period",
  triggers: ["saldobalanse", "balance sheet", "kontooversikt", "regnskap oversikt", "balanse", "periode avslutning"],
  requiredTools: ["get_balance_sheet", "search_accounts"],
  buildMessages: () => [
    {
      role: "assistant" as const,
      content: {
        type: "text" as const,
        text: `## Skill: Saldobalanse / Kontooversikt (Balance Sheet Review)

### Norsk regnskapslov / Norwegian GAAP Context
The balance sheet (saldobalanse) shows all account balances for a period. In Norwegian accounting:
- **Eiendeler (Assets, 1xxx)** should have positive (debit) balances
- **Gjeld og egenkapital (Liabilities & Equity, 2xxx)** should have negative (credit) balances
- **Inntekter (Revenue, 3xxx)** should have negative (credit) balances
- **Kostnader (Expenses, 4-7xxx)** should have positive (debit) balances
- **Finansposter (Financial, 8xxx)** vary by type

Key Norwegian accounting periods:
- MVA-termin (VAT period): every 2 months (Jan-Feb, Mar-Apr, etc.)
- Årsregnskap (annual accounts): calendar year Jan 1 - Dec 31
- Skattemelding (tax return): due May 31 for previous year

### Steps

**Step 1 — Determine the period**
Ask the user or infer:
- Which period? (month, quarter, year, VAT term)
- Any filters? (specific account range, department, project)

Common periods:
- Current month: first of month to today
- Current quarter: Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec
- Year to date: Jan 1 to today
- VAT term: 2-month period

**Step 2 — Fetch the balance sheet**
Call \`get_balance_sheet\` with:
- dateFrom: period start (YYYY-MM-DD)
- dateTo: period end (YYYY-MM-DD, exclusive)
- accountNumberFrom / accountNumberTo: optional filters
- count: 1000 (to get all accounts)

**Step 3 — Present the results**
Organize by account class:

**1xxx Eiendeler (Assets)**
- 1500 Kundefordringer — what customers owe you
- 1920 Bank — cash in bank

**2xxx Gjeld & Egenkapital (Liabilities & Equity)**
- 2400 Leverandørgjeld — what you owe suppliers
- 2700 Utgående MVA — output VAT collected
- 2710 Inngående MVA — input VAT to deduct

**3xxx Inntekter (Revenue)**
- 3000 Salgsinntekt — revenue from sales

**4-7xxx Kostnader (Expenses)**
- Various cost accounts

**Step 4 — Highlight key insights**
- Total assets vs total liabilities (should balance)
- Net MVA position: 2700 + 2710 = what to pay/receive from Skatteetaten
- Kundefordringer aging: large outstanding customer balances
- Unusual balances (e.g., negative bank balance, unexpected cost spikes)

### Quick Checks for the User
- "Hva skylder kundene meg?" → Filter account 1500
- "Hva skylder jeg leverandører?" → Filter account 2400
- "Hva er MVA-posisjonen?" → Filter accounts 2700-2710
- "Hva er resultat hittil i år?" → Accounts 3000-8999

### For Deeper Analysis
If the user wants to drill into specific accounts:
- Call \`search_accounts\` to find account details
- Call \`search_vouchers\` to see individual transactions on that account
- Call \`get_voucher\` to see posting details

### Validation Checklist
- [ ] Period dates are correct and make accounting sense
- [ ] dateTo is exclusive (the day after the last day of the period)
- [ ] Results are organized by account class for readability
- [ ] Key balances are highlighted and explained in business terms`,
      },
    },
  ],
};
