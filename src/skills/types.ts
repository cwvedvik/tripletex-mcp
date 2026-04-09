import { z } from "zod";

export interface SkillDefinition {
  id: string;
  title: string;
  description: string;
  triggers: string[];
  requiredTools: string[];
  args?: Record<string, { description: string; required?: boolean }>;
  buildMessages(args?: Record<string, string>): Array<{
    role: "user" | "assistant";
    content: { type: "text"; text: string };
  }>;
}
