import { SkillDefinition } from "./types.js";

export const createProjectSkill: SkillDefinition = {
  id: "create-project",
  title: "Opprett prosjekt",
  description: "Guide for creating projects for time tracking and project-based invoicing",
  triggers: ["prosjekt", "project", "nytt prosjekt", "opprett prosjekt"],
  requiredTools: ["search_projects", "search_customers"],
  buildMessages: () => [
    {
      role: "assistant" as const,
      content: {
        type: "text" as const,
        text: `## Skill: Opprett prosjekt (Create Project)

### Context
Projects in Tripletex are used for:
- Time tracking — employees log hours against projects
- Cost tracking — expenses can be allocated to projects
- Invoicing — time and costs can be invoiced per project
- Reporting — profitability analysis per project/customer

### Pre-flight: Search First
Call \`search_projects\` to check if a similar project already exists.

### Steps

**Step 1 — Search for existing project**
Call \`search_projects\` with the project name.
Verify no duplicate exists.

**Step 2 — Identify the customer**
If this is a customer project:
Call \`search_customers\` to find the customer ID.
Projects can also be internal (no customer).

**Step 3 — Gather project info**
Required:
- name — descriptive project name (e.g., "Nordvik Bygg - Rådgivning 2026")
- number — project number (company convention, e.g., "P-2026-001")
- projectManagerId — employee ID of the project manager

Recommended:
- customer: { id: customerId } — link to customer for invoicing
- startDate: YYYY-MM-DD
- endDate: YYYY-MM-DD (if fixed-term)
- isClosed: false (default)

**Step 4 — Create the project**
POST to /project with the gathered data.

**Step 5 — Set up activities (if needed)**
Projects use activities for categorizing time entries (e.g., "Utvikling", "Møter", "Prosjektledelse").
Check existing activities with \`search_activities\`.
Activities in Tripletex require \`activityType: "PROJECT_GENERAL_ACTIVITY"\` when creating.

**Step 6 — Confirm**
Return: project ID, number, name, customer (if any), and available activities.

### Project Naming Conventions (suggestions)
- "[Customer] - [Description] [Year]" — e.g., "Nordvik Bygg - IT-rådgivning 2026"
- "[Internal] - [Description]" — e.g., "Intern - Kompetanseutvikling"

### Tips
- Link projects to customers for easier invoicing workflows
- Use consistent project numbering across the company
- Set a project manager for accountability and reporting

### Validation Checklist
- [ ] Searched for existing projects first
- [ ] Project name is descriptive and follows company convention
- [ ] Customer is linked (if external project)
- [ ] Project manager is assigned
- [ ] Start date is set`,
      },
    },
  ],
};
