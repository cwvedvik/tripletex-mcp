import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SkillDefinition } from "./types.js";
import { createInvoiceSkill } from "./create-invoice.js";
import { postVoucherSkill } from "./post-voucher.js";
import { registerSupplierInvoiceSkill } from "./register-supplier-invoice.js";
import { customerManagementSkill } from "./customer-management.js";
import { timeToInvoiceSkill } from "./time-to-invoice.js";
import { creditNoteSkill } from "./credit-note.js";
import { balanceCheckSkill } from "./balance-check.js";
import { createProductSkill } from "./create-product.js";
import { registerPaymentSkill } from "./register-payment.js";
import { createEmployeeSkill } from "./create-employee.js";
import { runPayrollSkill } from "./run-payroll.js";
import { createProjectSkill } from "./create-project.js";
import { createDepartmentsSkill } from "./create-departments.js";
import { yearEndClosingSkill } from "./year-end-closing.js";
import { monthEndClosingSkill } from "./month-end-closing.js";
import { bankReconciliationSkill } from "./bank-reconciliation.js";
import { travelExpenseSkill } from "./travel-expense.js";
import { receiptExpenseSkill } from "./receipt-expense.js";

const ALL_SKILLS: SkillDefinition[] = [
  // Tier 1 — Core workflows
  createInvoiceSkill,
  postVoucherSkill,
  registerSupplierInvoiceSkill,
  customerManagementSkill,
  // Tier 2 — Common workflows
  timeToInvoiceSkill,
  creditNoteSkill,
  balanceCheckSkill,
  createProductSkill,
  registerPaymentSkill,
  createEmployeeSkill,
  createProjectSkill,
  createDepartmentsSkill,
  // Tier 3 — Advanced workflows
  runPayrollSkill,
  yearEndClosingSkill,
  monthEndClosingSkill,
  bankReconciliationSkill,
  travelExpenseSkill,
  receiptExpenseSkill,
];

export function registerSkills(server: McpServer): void {
  for (const skill of ALL_SKILLS) {
    server.prompt(skill.id, skill.description, () => ({
      messages: skill.buildMessages(),
    }));
  }

  server.resource(
    "skill-index",
    "tripletex://skills",
    { description: "Index of all available Tripletex accounting skills with trigger keywords" },
    () => ({
      contents: [
        {
          uri: "tripletex://skills",
          mimeType: "text/plain",
          text: ALL_SKILLS.map(
            (s) => `${s.id}: ${s.description} [triggers: ${s.triggers.join(", ")}]`
          ).join("\n"),
        },
      ],
    })
  );
}
