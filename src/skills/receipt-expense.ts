import { SkillDefinition } from "./types.js";

export const receiptExpenseSkill: SkillDefinition = {
  id: "receipt-expense",
  title: "Utlegg / kvittering",
  description: "Guide for registering out-of-pocket expenses and receipts as vouchers",
  triggers: ["utlegg", "kvittering", "receipt", "expense", "utlegg ansatt", "refusjon", "reimbursement"],
  requiredTools: ["search_employees", "search_accounts", "search_vat_types", "create_voucher"],
  buildMessages: () => [
    {
      role: "assistant" as const,
      content: {
        type: "text" as const,
        text: `## Skill: Utlegg / Kvittering (Receipt Expense)

### Context
When an employee pays for business expenses out of pocket, the company must:
1. Post the expense to the correct cost account
2. Record the inngående MVA (input VAT) for deduction
3. Create a liability to the employee (or reimburse immediately)

### Key Accounts
- 6800 Kontorkostnader (office supplies)
- 6840 Datautstyr (IT equipment)
- 6900 Telefon/internett
- 7100 Bilkostnader
- 7320 Representasjon (client entertainment — limited deductibility!)
- 7350 Serveringskostnader (food/drinks for meetings)
- 2710 Inngående MVA (input VAT to deduct)
- 2930 Skyldige utlegg / ansattutlegg (payable to employee)
- 1920 Bank (if reimbursing immediately)

### Steps

**Step 1 — Gather receipt details**
Ask the user:
- Who paid? (employee name)
- What was purchased? (description)
- Total amount (incl. MVA)
- Date of purchase
- Receipt available? (required for VAT deduction)

**Step 2 — Determine cost account and VAT**
Based on what was purchased:
- Office supplies → 6800 + 25% MVA
- IT equipment → 6840 + 25% MVA
- Food for meetings → 7350 + 15% MVA (note: limited deductibility for representasjon)
- Phone/internet → 6900 + 25% MVA

Call \`search_accounts\` to get account IDs.
Call \`search_vat_types\` if unsure about the VAT rate.

**Step 3 — Calculate amounts**
From total amount (incl. MVA):
- Amount excl. MVA = total / (1 + MVA rate)
- MVA amount = total - amount excl. MVA

Example: 1,250 NOK total with 25% MVA:
- Excl. MVA: 1,250 / 1.25 = 1,000
- MVA: 250

**Step 4 — Post the voucher**
Call \`create_voucher\` with:
- date: purchase date (from receipt)
- description: "Utlegg [employee name] - [description]"

If reimbursing later:
| Account | Amount | Description |
|---------|--------|-------------|
| 6800 Kontorkostnader | +1,000 | Office supplies |
| 2710 Inngående MVA | +250 | 25% MVA |
| 2930 Skyldige utlegg | -1,250 | Payable to employee |

If reimbursing immediately:
| Account | Amount | Description |
|---------|--------|-------------|
| 6800 Kontorkostnader | +1,000 | Office supplies |
| 2710 Inngående MVA | +250 | 25% MVA |
| 1920 Bank | -1,250 | Reimbursement |

**Step 5 — Confirm**
Show: expense type, amount excl. MVA, MVA deducted, total, and whether reimbursement is pending or complete.

### Special Rules for Representasjon (Client Entertainment)
- Representasjon has LIMITED MVA deduction in Norway
- Food/drink with business contacts: only deductible if documented (who, what, where, purpose)
- Internal events for employees: generally fully deductible
- Gifts to business contacts: max NOK 290 per person per year for tax deduction

### Important Notes
- Keep receipts! VAT deduction requires valid documentation
- Receipts must show: seller's org.nr, MVA amount, date, description of goods/services
- Kvitteringer under NOK 1,000 have simplified documentation requirements
- Post expenses promptly — don't accumulate receipts

### Validation Checklist
- [ ] Receipt details captured (amount, date, description, seller)
- [ ] Correct cost account identified
- [ ] MVA rate matches receipt and product type
- [ ] Back-calculation from total: excl. MVA + MVA = total
- [ ] Voucher postings balance to 0
- [ ] Employee identified for reimbursement tracking`,
      },
    },
  ],
};
