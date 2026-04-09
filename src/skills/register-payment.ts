import { SkillDefinition } from "./types.js";

export const registerPaymentSkill: SkillDefinition = {
  id: "register-payment",
  title: "Registrer betaling",
  description: "Guide for recording payment received on an invoice or payment made to a supplier",
  triggers: ["betaling", "payment", "innbetaling", "utbetaling", "betalt", "mottatt betaling", "registrer betaling"],
  requiredTools: ["search_invoices", "get_invoice", "search_accounts", "create_voucher"],
  buildMessages: () => [
    {
      role: "assistant" as const,
      content: {
        type: "text" as const,
        text: `## Skill: Registrer betaling (Register Payment)

### Norsk regnskapslov / Norwegian GAAP Context
Payments are recorded as vouchers that move money between accounts:
- **Customer payment received**: reduces kundefordringer (1500), increases bank (1920)
- **Supplier payment made**: reduces leverandørgjeld (2400), reduces bank (1920)
- Payments must match against specific invoices for proper accounting

### Scenario A: Customer Payment Received (Innbetaling fra kunde)

**Step 1 — Find the invoice**
Call \`search_invoices\` with the customer name or date range.
Call \`get_invoice\` to see the outstanding amount.

**Step 2 — Verify payment amount**
Confirm with user:
- Is this full or partial payment?
- What date was the payment received?
- Does the amount match the invoice?

**Step 3 — Post the voucher**
Call \`search_accounts\` to find account IDs for 1500 and 1920.
Call \`create_voucher\` with:
- date: payment date (YYYY-MM-DD)
- description: "Innbetaling fra [customer] - faktura [invoice number]"
- postings:

| Account | Amount | Description |
|---------|--------|-------------|
| 1920 Bank | +[amount] | (debit: money in) |
| 1500 Kundefordringer | -[amount] | (credit: reduce receivable) |

### Scenario B: Payment to Supplier (Utbetaling til leverandør)

**Step 1 — Find the supplier invoice**
Call \`search_supplier_invoices\` or ask user for details.

**Step 2 — Verify payment**
Confirm: amount, date, which invoice this pays.

**Step 3 — Post the voucher**
Call \`search_accounts\` to find account IDs for 2400 and 1920.
Call \`create_voucher\` with:
- date: payment date (YYYY-MM-DD)
- description: "Betaling til [supplier] - faktura [invoice ref]"
- postings:

| Account | Amount | Description |
|---------|--------|-------------|
| 2400 Leverandørgjeld | +[amount] | (debit: reduce payable) |
| 1920 Bank | -[amount] | (credit: money out) |

### Partial Payments
If the payment doesn't cover the full invoice:
- Post only the amount actually paid
- The remaining balance stays on 1500 (customer) or 2400 (supplier)
- Note the partial payment in the voucher description

### Common Errors
- Wrong direction: Customer payments DEBIT bank, CREDIT receivables. Supplier payments DEBIT payables, CREDIT bank.
- Missing invoice reference: Always include the invoice number in the description for traceability.

### Validation Checklist
- [ ] Invoice identified and amount verified
- [ ] Payment direction is correct (debit/credit)
- [ ] Postings sum to 0
- [ ] Date is the actual payment date, not the invoice date
- [ ] Description references the invoice number`,
      },
    },
  ],
};
