import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isTs = __filename.endsWith('.ts');
const cliCmd = isTs ? 'npx' : 'node';
const cliPath = join(__dirname, '..', isTs ? 'cli.ts' : 'cli.js');

async function runCli(args: string[]): Promise<string> {
  try {
    const execArgs = isTs ? ['tsx', cliPath, ...args] : [cliPath, ...args];
    const { stdout, stderr } = await execFileAsync(cliCmd, execArgs, {
        cwd: process.cwd(),
        env: process.env
    });
    if (stderr && stderr.trim().length > 0 && !stdout) {
       throw new Error(stderr);
    }
    return stdout.trim();
  } catch (error: any) {
    if (error.stdout) return error.stdout.trim();
    throw new Error(error.message || String(error));
  }
}

export function registerSpecTools(server: McpServer): void {
  server.registerTool(
    'sc_status',
    {
      description: 'Get a health check of the active project and discover next steps.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (optional)')
      }
    },
    async (args) => {
      try {
        const cliArgs = ['status'];
        if (args.feature) cliArgs.push('--feature', args.feature);
        const result = await runCli(cliArgs);
        return { content: [{ type: 'text', text: result }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
      }
    }
  );

  server.registerTool(
    'sc_help',
    {
      description: 'Learn how to use the CLI tools and get deep documentation.',
      inputSchema: {
        topic: z.string().optional().describe('Topic to get help for')
      }
    },
    async (args) => {
      try {
        const cliArgs = ['help'];
        if (args.topic) cliArgs.push(args.topic);
        const result = await runCli(cliArgs);
        return { content: [{ type: 'text', text: result }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
      }
    }
  );

  server.registerTool(
    'sc_exec',
    {
      description: 'The primary workhorse tool. Run `sc_help` for usage details.',
      inputSchema: {
        action: z.enum(['init', 'plan', 'todo']).describe('The action to perform'),
        resource: z.string().optional().describe('The resource to act upon (e.g. "list", "start") for todo'),
        flags: z.record(z.string()).optional().describe('Key-value pairs for flags (e.g. {"feature": "auth", "id": "1"})')
      }
    },
    async (args) => {
      try {
        const cliArgs = ['exec', args.action];
        if (args.resource) cliArgs.push(args.resource);
        
        if (args.flags) {
            for (const [k, v] of Object.entries(args.flags)) {
                cliArgs.push(`--${k}`, String(v));
            }
        }
        
        const result = await runCli(cliArgs);
        return { content: [{ type: 'text', text: result }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
      }
    }
  );

  server.registerTool(
    'sc_verify',
    {
      description: 'A dedicated tool to validate that the last action worked.',
      inputSchema: {
         feature: z.string().optional().describe('Feature name (optional)')
      }
    },
    async (args) => {
      try {
        const cliArgs = ['verify'];
        if (args.feature) cliArgs.push('--feature', args.feature);
        const result = await runCli(cliArgs);
        return { content: [{ type: 'text', text: result }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
      }
    }
  );
}