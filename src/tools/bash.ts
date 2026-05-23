import { exec } from 'node:child_process';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from './types.js';

export const BASH_TOOL_DESCRIPTION = `
Execute a shell command and return stdout, stderr, and exit code.

## When to Use

- Running CLI tools and scripts (e.g., node, python, curl)
- Reading or transforming files with shell utilities
- Any task that requires external command execution

## When NOT to Use

- Reading local files (use \`read_file\`)
- Writing or editing files (use \`write_file\` / \`edit_file\`)
- Web requests (use \`web_fetch\` or \`web_search\`)
- Financial data queries (use \`get_financials\` or Wind skill)

## Usage Notes

- Commands run in the specified \`workdir\` (defaults to project root)
- Maximum output is capped at 1MB; long output is truncated
- Timeout defaults to 30 seconds
- This tool requires user approval before each execution
`.trim();

const bashSchema = z.object({
  command: z.string().describe('The shell command to execute.'),
  workdir: z.string().optional().describe('Working directory for the command. Defaults to the project root.'),
  timeout: z.number().optional().describe('Timeout in milliseconds (default 30000, max 120000).'),
});

const MAX_OUTPUT_BYTES = 1_024 * 1_024; // 1MB
const MAX_TIMEOUT = 120_000;

function truncateOutput(text: string): string {
  const buf = Buffer.from(text, 'utf-8');
  if (buf.length <= MAX_OUTPUT_BYTES) return text;
  const truncated = buf.subarray(0, MAX_OUTPUT_BYTES).toString('utf-8');
  return truncated + `\n\n[Output truncated at ${MAX_OUTPUT_BYTES} bytes]`;
}

export const bashTool = new DynamicStructuredTool({
  name: 'bash',
  description: 'Execute a shell command and return stdout, stderr, and exit code. Requires user approval.',
  schema: bashSchema,
  func: async (input) => {
    const timeout = Math.min(input.timeout ?? 30_000, MAX_TIMEOUT);

    return new Promise<string>((resolve) => {
      exec(input.command, {
        cwd: input.workdir ?? process.cwd(),
        timeout,
        maxBuffer: MAX_OUTPUT_BYTES,
        windowsHide: true,
      }, (error, stdout, stderr) => {
        resolve(formatToolResult({
          exitCode: error?.code ?? 0,
          stdout: truncateOutput(stdout),
          stderr: truncateOutput(stderr),
          killed: error?.killed ?? false,
          timedOut: error?.killed ?? false,
        }));
      });
    });
  },
});
