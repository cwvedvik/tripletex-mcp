import { SkillDefinition } from "./types.js";

export const bankReconciliationSkill: SkillDefinition = {
  id: "bank-reconciliation",
  title: "Bankavstemming",
  description: "Guide for reconciling bank statements against accounting records",
  triggers: ["bankavstemming", "bank reconciliation", "avstemming", "bank vs regnskap", "bankbalanse"],
  requiredTools: ["get_balance_sheet", "search_accounts", "search_vouchers", "get_voucher", "create_voucher"],
  buildMessages: () => [
    {
      role: "assistant" as const,
      content: {
        type: "text" as const,
        text: `## Skill: Bankavstemming (Bank Reconciliation)

### Context
Bank reconciliation verifies that the bank balance in your accounting (account 1920) matches the actual bank statement. Differences indicate:
- Transactions posted in accounting but not yet cleared by the bank (or vice versa)
- Missing postings
- Errors

Should be performed at least monthly.

### Steps

**Step 1 — Get the accounting balance**
Call \`get_balance_sheet\` with:
- dateFrom: start of period (e.g., first of month)
- dateTo: reconciliation date + 1 day (exclusive)
- accountNumberFrom: "1920", accountNumberTo: "1920"

Note the closing balance for account 1920.

**Step 2 — Get the bank statement balance**
Ask the user for the bank statement balance as of the reconciliation date.
(Tripletex may have bank integration that provides this automatically.)

**Step 3 — Compare balances**
- Accounting balance (1920) vs bank statement balance
- If they match: reconciliation is complete
- If they differ: proceed to step 4

**Step 4 — Identify differences**
Call \`search_vouchers\` for the period to review recent transactions on account 1920.
Call \`get_voucher\` on suspicious entries.

Common causes of differences:
1. **Utestående sjekker / payments in transit** — posted in accounting, not yet cleared by bank
2. **Bankgebyrer / bank fees** — on bank statement, not yet posted in accounting
3. **Renteinntekter / interest** — credited by bank, not yet posted
4. **Feilposteringer / errors** — wrong amount or wrong account
5. **Tidsdifferanser / timing** — transactions around period end

**Step 5 — Post adjustments**
For items on the bank statement not in accounting:

Bank fee example:
| Account | Amount | Description |
|---------|--------|-------------|
| 7770 Bankgebyr | +150 | Bank fees for [month] |
| 1920 Bank | -150 | Bank fee deducted |

Interest income example:
| Account | Amount | Description |
|---------|--------|-------------|
| 1920 Bank | +250 | Interest income [month] |
| 8000 Renteinntekt | -250 | Bank interest received |

**Step 6 — Verify**
After adjustments, re-check that accounting balance matches bank statement.
Document the reconciliation (date, balances, differences, adjustments made).

### Reconciliation Summary Template
\`\`\`
Bankavstemming per [date]
Saldo regnskap (konto 1920):    [amount]
Saldo bankkontoutskrift:         [amount]
Differanse:                      [amount]

Forklaring av differanse:
- [Item 1]: [amount]
- [Item 2]: [amount]
Sum forklart:                    [amount]
Uforklart differanse:            [amount]
\`\`\`

### Validation Checklist
- [ ] Accounting balance retrieved for correct date
- [ ] Bank statement balance confirmed by user
- [ ] All differences identified and explained
- [ ] Adjusting entries posted for missing items
- [ ] Final balances match after adjustments`,
      },
    },
  ],
};
