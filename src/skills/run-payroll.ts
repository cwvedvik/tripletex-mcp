import { SkillDefinition } from "./types.js";

export const runPayrollSkill: SkillDefinition = {
  id: "run-payroll",
  title: "Kjør lønnsberegning",
  description: "Guide for posting payroll entries with Norwegian tax and social security requirements",
  triggers: ["lønn", "payroll", "lønnskjøring", "salary", "lønnsberegning", "utbetale lønn"],
  requiredTools: ["search_employees", "search_accounts", "create_voucher"],
  buildMessages: () => [
    {
      role: "assistant" as const,
      content: {
        type: "text" as const,
        text: `## Skill: Kjør lønnsberegning (Run Payroll)

### Norsk regnskapslov / Norwegian Payroll Context
Norwegian payroll involves several mandatory deductions and employer costs:

**Employee deductions (trekk):**
- Skattetrekk (tax withholding) — based on employee's tax card (skattekort), typically 30-45%
- Trygdeavgift (social security) — included in the tax deduction via the tax card

**Employer costs (arbeidsgiveravgift):**
- Arbeidsgiveravgift — 14.1% of gross salary (varies by zone: 0-14.1%)
  - Sone I (Oslo, etc.): 14.1%
  - Sone Ia: 10.6%
  - Sone II: 10.6%
  - Sone III: 6.4%
  - Sone IV: 5.1%
  - Sone V: 0%
- Feriepenger (holiday pay) — 10.2% of gross salary (12% for employees over 60)

### Key Accounts (NS 4102)
- 5000 Lønn (salary expense) — debit
- 5001 Feriepenger (holiday pay accrual) — debit
- 5400 Arbeidsgiveravgift (employer social security) — debit
- 5420 Arbeidsgiveravgift av feriepenger — debit
- 1920 Bank (payment) — credit
- 2600 Skattetrekk (tax withholding liability) — credit
- 2770 Arbeidsgiveravgift skyldig (employer tax payable) — credit
- 2960 Feriepenger skyldig (holiday pay payable) — credit
- 2780 Påleggstrekk (wage garnishment) — credit, if applicable

### Steps

**Step 1 — Gather payroll information**
Ask the user:
- Which employee(s)?
- Gross salary amount(s)?
- Pay period (month)?
- Tax deduction percentage (from tax card)?
- Any overtime, bonuses, or deductions?

**Step 2 — Calculate**
For each employee:
- Gross salary: as specified
- Skattetrekk: gross × tax percentage (e.g., 35%)
- Net pay: gross - skattetrekk
- Arbeidsgiveravgift: gross × 14.1% (adjust for zone)
- Feriepenger accrual: gross × 10.2%
- AGA on feriepenger: feriepenger × 14.1%

**Step 3 — Look up account IDs**
Call \`search_accounts\` for accounts 5000, 2600, 2770, 2960, 1920, 5400, 5001.

**Step 4 — Post salary voucher**
Call \`create_voucher\` with:
- date: last day of pay period or pay date
- description: "Lønn [month] [year] - [employee name]"

Example for 50,000 NOK gross, 35% tax, sone I (14.1%):

| Account | Amount | Description |
|---------|--------|-------------|
| 5000 Lønn | +50,000 | Gross salary |
| 1920 Bank | -32,500 | Net pay to employee |
| 2600 Skattetrekk | -17,500 | Tax withholding (35%) |

**Step 5 — Post employer cost voucher**
Separate voucher for employer costs:

| Account | Amount | Description |
|---------|--------|-------------|
| 5400 Arbeidsgiveravgift | +7,050 | AGA 14.1% of 50,000 |
| 2770 AGA skyldig | -7,050 | AGA payable |

**Step 6 — Post holiday pay accrual**

| Account | Amount | Description |
|---------|--------|-------------|
| 5001 Feriepenger | +5,100 | 10.2% of 50,000 |
| 2960 Feriepenger skyldig | -5,100 | Holiday pay payable |

**Step 7 — Confirm**
Show breakdown: gross, tax, net pay, employer costs, total cost to company.
Total company cost = gross + AGA + AGA on feriepenger + feriepenger = ~62,370 NOK.

### Important Notes
- Skattetrekk is paid to Skatteetaten bi-monthly (every 2 months)
- AGA is paid to Skatteetaten bi-monthly
- Feriepenger is typically paid out in June the following year
- A-melding (employer report) must be filed monthly to Skatteetaten

### Validation Checklist
- [ ] Tax percentage matches employee's tax card
- [ ] AGA rate matches the company's geographic zone
- [ ] Each voucher balances to 0
- [ ] Gross, deductions, and net pay are mathematically correct
- [ ] Holiday pay accrual is calculated correctly (10.2% or 12%)`,
      },
    },
  ],
};
