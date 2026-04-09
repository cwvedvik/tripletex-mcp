import { SkillDefinition } from "./types.js";

export const registerSupplierInvoiceSkill: SkillDefinition = {
  id: "register-supplier-invoice",
  title: "Registrer leverandørfaktura",
  description: "Step-by-step guide for registering an incoming supplier invoice with correct VAT deductions",
  triggers: ["leverandørfaktura", "supplier invoice", "innkommende faktura", "inngående faktura", "kjøpsfaktura"],
  requiredTools: ["search_suppliers", "create_supplier", "search_accounts", "create_voucher", "search_vat_types"],
  buildMessages: () => [
    {
      role: "assistant" as const,
      content: {
        type: "text" as const,
        text: `## Skill: Registrer leverandørfaktura (Register Supplier Invoice)

### Norsk regnskapslov / Norwegian GAAP Context
- Incoming invoices from suppliers represent a cost and a liability (leverandørgjeld)
- Inngående MVA (input VAT) on business purchases can be deducted from utgående MVA (output VAT)
- The supplier invoice must be recorded as a voucher with correct account postings
- Tripletex's \`search_supplier_invoices\` endpoint lets you search existing registered invoices

### Key Accounts
- 2400 Leverandørgjeld (accounts payable) — credit side
- 2710 Inngående MVA (input VAT) — debit side (this is the VAT you can deduct)
- 4000-6xxx Cost accounts — debit side (the expense itself)
  - 4000 Varekjøp (goods purchased for resale)
  - 6300 Leie lokaler (rent)
  - 6800 Kontorkostnader (office expenses)
  - 6900 Telefon/internett
  - 7100 Bilkostnader (vehicle costs)

### Steps

**Step 1 — Find the supplier**
Call \`search_suppliers\` with the supplier name or org.nr.
- If found: use that supplier ID
- If not found: ask user "Leverandøren finnes ikke. Skal jeg opprette den?"

**Step 2 — Create supplier (only if needed)**
Call \`create_supplier\` with:
- name (required)
- organizationNumber (recommended)
- email, bankAccount (if available)

**Step 3 — Determine cost account and VAT**
Ask the user or infer from context:
- What type of expense is this? (goods, rent, office supplies, etc.)
- What VAT rate is on the invoice? (typically 25%, check the invoice)
Call \`search_accounts\` to find the correct cost account ID.
Call \`search_vat_types\` if unsure about VAT rates.

**Step 4 — Post the voucher**
Call \`create_voucher\` to register the invoice:

Example: Supplier invoice for office supplies, 10,000 NOK + 25% MVA = 12,500 NOK total:

| Account | Amount | Description |
|---------|--------|-------------|
| 6800 Kontorkostnader | +10,000 | (debit: the expense) |
| 2710 Inngående MVA | +2,500 | (debit: VAT to deduct) |
| 2400 Leverandørgjeld | -12,500 | (credit: what we owe) |

- date: invoice date (YYYY-MM-DD)
- description: "Leverandørfaktura fra [supplier name] - [what for]"
- postings must sum to 0

**Step 5 — Confirm**
Show the user: supplier name, total amount, VAT deducted, cost account used.

### When the Supplier Invoice is Paid
This is a separate step (not part of registration). Payment is recorded as:
| Account | Amount |
|---------|--------|
| 2400 Leverandørgjeld | +12,500 (debit: reduce liability) |
| 1920 Bank | -12,500 (credit: money left the bank) |

### Common Errors & Fixes
- Wrong VAT rate — Check the physical invoice. Not all purchases have 25% MVA.
- Missing inngående MVA posting — You lose your VAT deduction. Always include account 2710.
- Supplier not found — Search by org.nr as well as name (names can vary).

### Validation Checklist
- [ ] Supplier exists (searched first, not assumed)
- [ ] Cost account matches the type of expense
- [ ] Inngående MVA (2710) is posted as debit for VAT deduction
- [ ] Leverandørgjeld (2400) is posted as credit for the full invoice amount
- [ ] Postings sum to 0
- [ ] Date matches the invoice date`,
      },
    },
  ],
};
