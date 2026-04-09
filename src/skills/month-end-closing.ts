import { SkillDefinition } from "./types.js";

export const monthEndClosingSkill: SkillDefinition = {
  id: "month-end-closing",
  title: "Månedsslutt / MVA-oppgjør",
  description: "Guide for monthly closing procedures and VAT period settlement",
  triggers: ["månedsslutt", "month end", "mva-oppgjør", "mva oppgjør", "terminoppgave", "momsoppgjør", "periodeavslutning"],
  requiredTools: ["get_balance_sheet", "search_accounts", "search_vouchers", "create_voucher"],
  buildMessages: () => [
    {
      role: "assistant" as const,
      content: {
        type: "text" as const,
        text: `## Skill: Månedsslutt / MVA-oppgjør (Month-End / VAT Settlement)

### Norsk regnskapslov / Norwegian VAT Context
- MVA (VAT) is reported bi-monthly (annenhver måned) to Skatteetaten
- MVA-terminer: Jan-Feb, Mar-Apr, May-Jun, Jul-Aug, Sep-Oct, Nov-Dec
- Filing deadline: 1 month and 10 days after term end (e.g., Apr 10 for Jan-Feb)
- Small businesses may report annually (årstermin)

MVA rates:
- 25% standard (alminnelig sats)
- 15% food (næringsmiddel)
- 12% transport, hotels, cinema
- 0% exempt/zero-rated

### Monthly Closing Steps

**Step 1 — Review the period**
Call \`get_balance_sheet\` with:
- dateFrom: first day of month
- dateTo: first day of next month (exclusive)
- count: 1000

Review for:
- Missing invoices or vouchers
- Unreconciled transactions
- Unusual balances

**Step 2 — Check open items**
- Outstanding customer invoices: filter account 1500
- Outstanding supplier invoices: filter account 2400
- Ensure all received/sent invoices for the period are posted

**Step 3 — Review cost accruals**
For accurate monthly reporting:
- Are there recurring costs that haven't been posted? (rent, subscriptions)
- Any prepayments that should be allocated to this month?

### MVA-oppgjør (VAT Settlement) — Every 2 Months

**Step 4 — Calculate MVA position**
Call \`get_balance_sheet\` with:
- dateFrom: first day of MVA term
- dateTo: first day after MVA term ends
- accountNumberFrom: "2700", accountNumberTo: "2710"

Key accounts:
- 2700 Utgående MVA (output VAT — what you collected from customers)
- 2710 Inngående MVA (input VAT — what you paid to suppliers)

**Net MVA = |2700| - |2710|**
- If positive: you owe Skatteetaten
- If negative: Skatteetaten owes you (tilgode)

**Step 5 — Post MVA settlement voucher**
After filing the MVA-melding, post the settlement:

If you owe 15,000 NOK:
| Account | Amount | Description |
|---------|--------|-------------|
| 2700 Utgående MVA | +[balance] | Clear output VAT |
| 2710 Inngående MVA | -[balance] | Clear input VAT |
| 2740 Oppgjørskonto MVA | -15,000 | Net MVA payable |

When paid:
| Account | Amount | Description |
|---------|--------|-------------|
| 2740 Oppgjørskonto MVA | +15,000 | Clear MVA payable |
| 1920 Bank | -15,000 | Payment to Skatteetaten |

**Step 6 — Verify**
After posting, accounts 2700 and 2710 should be zero for the closed term.

### Monthly Reporting (Optional)
If the company produces monthly reports:
- Call \`get_balance_sheet\` for the month for a complete picture
- Compare with budget if available
- Highlight significant variances

### Validation Checklist
- [ ] All invoices for the period are posted
- [ ] No missing vouchers or unreconciled items
- [ ] MVA accounts (2700, 2710) reviewed and reconciled
- [ ] MVA settlement voucher posted (for bi-monthly terms)
- [ ] Settlement voucher zeros out MVA accounts for the term`,
      },
    },
  ],
};
