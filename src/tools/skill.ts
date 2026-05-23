import { DynamicStructuredTool } from '@langchain/core/tools';
import { dirname, resolve } from 'path';
import { z } from 'zod';
import { getSkill, discoverSkills } from '../skills/index.js';

/**
 * Rich description for the skill tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const SKILL_TOOL_DESCRIPTION = `
Execute a skill to get specialized instructions for a task. Skills provide authoritative workflows and data-source guidance.

## When to Use

- IMMEDIATELY when the user's query matches an available skill's description. Check the Available Skills list before using any other tool.
- For any financial data query that falls within a skill's domain — skills know which data sources to use and how to query them correctly
- For structured workflows (e.g., DCF valuation, financial research)
- When a skill offers a data source or capability that general tools don't cover (e.g., Wind financial data, X/Twitter research)

## When NOT to Use

- If you've already invoked the skill for this query (don't invoke twice)
- When absolutely no available skill matches the task

## Usage Notes

- Invoke the skill IMMEDIATELY when relevant, as your first action, before using any general-purpose tools
- The skill returns instructions that tell you exactly which tools to use and how
- Use the skill name exactly as listed in Available Skills
- Pass any relevant arguments (like ticker symbols) via the args parameter
`.trim();

/**
 * Skill invocation tool.
 * Loads and returns skill instructions for the agent to follow.
 */
export const skillTool = new DynamicStructuredTool({
  name: 'skill',
  description: 'Execute a skill to get specialized instructions for a task. Returns instructions to follow.',
  schema: z.object({
    skill: z.string().describe('Name of the skill to invoke (e.g., "dcf")'),
    args: z.string().optional().describe('Optional arguments for the skill (e.g., ticker symbol)'),
  }),
  func: async ({ skill, args }) => {
    const skillDef = getSkill(skill);

    if (!skillDef) {
      const available = discoverSkills().map((s) => s.name).join(', ');
      return `Error: Skill "${skill}" not found. Available skills: ${available || 'none'}`;
    }

    // Return instructions with optional args context
    let result = `## Skill: ${skillDef.name}\n\n`;
    
    if (args) {
      result += `**Arguments provided:** ${args}\n\n`;
    }
    
    // Resolve relative markdown links to absolute paths so the agent's
    // read_file tool can find referenced files (e.g., sector-wacc.md).
    const skillDir = dirname(skillDef.path);
    const resolved = skillDef.instructions.replace(
      /\[([^\]]+)\]\(([^)]+\.md)\)/g,
      (_match, label, relPath) => {
        if (relPath.startsWith('/') || relPath.startsWith('http')) return _match;
        return `[${label}](${resolve(skillDir, relPath)})`;
      },
    );

    result += resolved;

    return result;
  },
});
