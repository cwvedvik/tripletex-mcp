import { SkillDefinition } from "./types.js";

export const createEmployeeSkill: SkillDefinition = {
  id: "create-employee",
  title: "Opprett ansatt",
  description: "Guide for onboarding an employee in Tripletex with Norwegian employment requirements",
  triggers: ["ansatt", "employee", "ny ansatt", "opprett ansatt", "onboarding", "ansette"],
  requiredTools: ["search_employees"],
  buildMessages: () => [
    {
      role: "assistant" as const,
      content: {
        type: "text" as const,
        text: `## Skill: Opprett ansatt (Create Employee)

### Norwegian Employment Context
- All employees must be registered in the employer's payroll system (A-melding)
- Key Norwegian requirements: fødselsnummer (11 digits), tax card (skattekort), employment contract
- Tripletex employee creation requires: userType and department
- The employment record (start date, position, percentage) goes on a separate endpoint: /employee/employment

### Important Tripletex API Quirks
- \`userType\` is required — common values: "STANDARD" for regular employees
- \`department\` is required — must reference an existing department (create one first if needed)
- \`startDate\` goes on the employment record (/employee/employment), NOT on the employee object itself
- Search for the employee first to avoid duplicates

### Steps

**Step 1 — Search for existing employee**
Call \`search_employees\` with the person's name.
- If found: verify it's the same person (could be a name collision)
- If not found: proceed to creation

**Step 2 — Ensure department exists**
The employee needs a department. Ask the user which department, or check existing departments.
If no department exists, one must be created first (see create-departments skill).

**Step 3 — Gather employee info**
Required:
- firstName, lastName
- department: { id: departmentId }
- userType: "STANDARD" (or as specified)

Recommended:
- email
- phoneNumberMobile
- dateOfBirth (YYYY-MM-DD)
- nationalIdentityNumber (fødselsnummer, 11 digits — sensitive data)

**Step 4 — Create the employee**
POST to /employee with the gathered data.
Note: This is a direct API call — the create_employee tool would need to be added, or use the raw API if available.

**Step 5 — Create employment record**
POST to /employee/employment with:
- employeeId: from step 4
- startDate: employment start date (YYYY-MM-DD)
- employmentType: "ORDINARY" for standard employment
- percentageOfFullTimeEquivalent: 100 for full-time

**Step 6 — Confirm**
Return employee ID, name, department, and start date.

### Norwegian Employment Types
- Fast ansatt (permanent) — most common
- Midlertidig ansatt (temporary) — fixed-term contract
- Vikar (substitute) — temporary replacement
- Deltid (part-time) — percentageOfFullTimeEquivalent < 100

### Validation Checklist
- [ ] Searched for existing employee first
- [ ] Department exists and is correct
- [ ] userType is set (required by Tripletex)
- [ ] Start date is on the employment record, not the employee object
- [ ] Fødselsnummer is 11 digits if provided (handle as sensitive data)`,
      },
    },
  ],
};
