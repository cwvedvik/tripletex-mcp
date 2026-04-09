import { SkillDefinition } from "./types.js";

export const creditNoteSkill: SkillDefinition = {
  id: "credit-note",
  title: "Kreditnota",
  description: "Guide for issuing a credit note against an existing invoice",
  triggers: ["kreditnota", "credit note", "kreditere", "kreditere faktura", "tilbakebetaling faktura"],
  requiredTools: ["search_invoices", "get_invoice", "create_invoice"],
  buildMessages: () => [
    {
      role: "assistant" as const,
      content: {
        type: "text" as const,
        text: `## Skill: Kreditnota (Credit Note)

### Norsk regnskapslov / Norwegian GAAP Context
- A credit note (kreditnota) reverses part or all of a previously issued invoice
- It must reference the original invoice
- Credit notes reduce revenue (salgsinntekt) and output VAT (utgående MVA)
- Required when: goods returned, incorrect billing, agreed discount after invoicing
- The credit note must have the same VAT treatment as the original invoice

### Steps

**Step 1 — Find the original invoice**
Call \`search_invoices\` with relevant filters (customer, date range).
Then call \`get_invoice\` with the invoice ID to see full details including line items.
Note: the original invoice number, customer ID, line items, and VAT types.

**Step 2 — Confirm with user**
Ask the user:
- Full credit or partial? If partial, which lines/amounts?
- Reason for crediting (for the description)

**Step 3 — Create the credit note**
Call \`create_invoice\` with:
- customerId: same as original invoice
- invoiceDate: today (YYYY-MM-DD)
- dueDate: same as invoiceDate (credit notes are typically due immediately)
- lines: mirror the original invoice lines but with NEGATIVE quantities or amounts
  - For full credit: negate all line quantities
  - For partial credit: only include the affected lines with adjusted amounts
- vatTypeId: MUST match the original invoice's VAT type per line
- ourReference: "Kreditnota for faktura [original invoice number]"

### Important Notes
- Negative quantities/amounts signal to Tripletex that this is a credit note
- The VAT rate on the credit note must match the original invoice exactly
- A credit note is legally a separate document with its own number
- After crediting, the customer's outstanding balance is reduced

### Example: Full credit of invoice #1234 (10,000 NOK + 25% MVA)
Lines:
- description: "Kreditering av faktura 1234 - Konsulenttimer"
  quantity: -1
  unitPriceExclVat: 10000
  vatTypeId: 3 (same as original)

### Validation Checklist
- [ ] Original invoice found and reviewed
- [ ] Customer ID matches the original invoice
- [ ] VAT types match the original invoice per line
- [ ] Amounts are negative (credit direction)
- [ ] Description references the original invoice number
- [ ] User confirmed the credit amount`,
      },
    },
  ],
};
