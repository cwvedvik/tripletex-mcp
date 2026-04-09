import { SkillDefinition } from "./types.js";

export const postVoucherSkill: SkillDefinition = {
  id: "post-voucher",
  title: "Bilagsføring (Post Voucher)",
  description: "Step-by-step guide for posting an accounting voucher with debit/credit entries",
  triggers: ["bilag", "voucher", "føre bilag", "postering", "bokføring", "journal entry"],
  requiredTools: ["search_accounts", "create_voucher"],
  buildMessages: () => [
    {
      role: "assistant" as const,
      content: {
        type: "text" as const,
        text: `## Skill: Bilagsføring (Post Accounting Voucher)

### Norsk regnskapslov / Norwegian GAAP Context
- Every financial transaction must be documented with a voucher (bilag)
- Double-entry bookkeeping: every voucher must have balanced debit and credit entries (sum = 0)
- Vouchers must have a date, description, and at least two posting lines
- The Norwegian standard chart of accounts (NS 4102) organizes accounts by class:
  - 1xxx — Eiendeler (Assets): 1500 kundefordringer, 1920 bank, 1200 maskiner
  - 2xxx — Gjeld og egenkapital (Liabilities & Equity): 2000 egenkapital, 2400 leverandørgjeld, 2700 utgående MVA, 2710 inngående MVA
  - 3xxx — Salgsinntekter (Revenue): 3000 salgsinntekt, 3100 salg av tjenester
  - 4xxx — Varekostnad (Cost of goods): 4000 varekjøp
  - 5xxx — Lønnskostnader (Payroll): 5000 lønn, 5400 arbeidsgiveravgift
  - 6xxx — Driftskostnader (Operating expenses): 6300 leie, 6800 kontorkostnader
  - 7xxx — Andre driftskostnader: 7000 avskrivninger, 7700 tap på fordringer
  - 8xxx — Finansposter (Financial items): 8000 renteinntekter, 8100 rentekostnader

### Core Rules
- **Debit = positive amount**, **Credit = negative amount**
- All postings in a voucher MUST sum to exactly 0
- Voucher row numbering starts from 1 (row 0 is reserved by the system)
- Date format: YYYY-MM-DD

### Steps

**Step 1 — Understand the transaction**
Ask the user (or infer from context):
- What happened? (purchase, sale, payment, salary, etc.)
- What date?
- What amount(s)?
- Which accounts are involved?

**Step 2 — Look up account IDs**
Call \`search_accounts\` to find the correct account IDs.
- Search by name (e.g., "bank") or by number range (e.g., numberFrom: "1920", numberTo: "1920")
- You need the account \`id\` field (not the account number) for posting

**Step 3 — Create the voucher**
Call \`create_voucher\` with:
- date: transaction date (YYYY-MM-DD)
- description: clear description of the transaction
- postings: array of debit/credit entries, each with:
  - accountId: the account ID from step 2
  - amount: positive for debit, negative for credit
  - description: optional line-level description

**Step 4 — Verify to user**
Confirm the voucher was created. Show the postings with account names and amounts.

### Common Voucher Examples

**Sale on credit (fakturasalg):**
| Account | Debit | Credit |
|---------|-------|--------|
| 1500 Kundefordringer | 12,500 | |
| 3000 Salgsinntekt | | -10,000 |
| 2700 Utgående MVA 25% | | -2,500 |

**Purchase paid by bank:**
| Account | Debit | Credit |
|---------|-------|--------|
| 6800 Kontorkostnader | 8,000 | |
| 2710 Inngående MVA 25% | 2,000 | |
| 1920 Bank | | -10,000 |

**Salary payment:**
| Account | Debit | Credit |
|---------|-------|--------|
| 5000 Lønn | 50,000 | |
| 1920 Bank | | -38,500 |
| 2600 Skattetrekk | | -8,500 |
| 2770 Arb.giveravgift skyldig | | -3,000 |

### Common Errors & Fixes
- "Postings do not balance" — The sum of all amounts must be exactly 0. Check your math.
- "Account not found" — Use search_accounts to verify the account ID exists.
- "Invalid row" — Ensure row numbering starts from 1, not 0.

### Validation Checklist
- [ ] All posting amounts sum to exactly 0
- [ ] Account IDs are valid (from search_accounts, not assumed)
- [ ] Date is in YYYY-MM-DD format
- [ ] Description is meaningful for audit trail
- [ ] MVA (VAT) is properly accounted for where applicable`,
      },
    },
  ],
};
