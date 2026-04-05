import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { SpecManager } from '../features/shared/SpecManager.js';
import { getRequirementsTemplate, getDesignTemplate, getTasksTemplate } from '../features/shared/documentTemplates.js';
import { completeTask } from '../features/task/completeTask.js';

export function registerSpecTools(server: McpServer): void {
  // 1. spec_init
  server.registerTool(
    'spec_init',
    {
      description: 'Initialize a new feature/project workflow. Run this to start a new feature.',
      inputSchema: {
        name: z.string().describe('The name of the feature or project (e.g., auth-system)'),
        description: z.string().optional().describe('Optional initial description or prompt')
      }
    },
    async (args) => {
      const baseDir = process.cwd();
      const featurePath = join(baseDir, args.name);
      
      if (!existsSync(featurePath)) {
        mkdirSync(featurePath, { recursive: true });
      }
      
      // We resolve it to set .spec_last_used
      SpecManager.resolveFeaturePath(baseDir, args.name);
      
      const reqPath = join(featurePath, 'requirements.md');
      if (!existsSync(reqPath)) {
        const content = getRequirementsTemplate(args.name, args.description || 'Initial requirements');
        writeFileSync(reqPath, content, 'utf-8');
      }

      return {
        content: [{
          type: 'text',
          text: SpecManager.getStatusSummary(baseDir, args.name)
        }]
      };
    }
  );

  // 2. spec_plan
  server.registerTool(
    'spec_plan',
    {
      description: 'Progress the workflow state (Requirements -> Design -> Tasks) and inject instructions.',
      inputSchema: {
        instruction: z.string().optional().describe('Instructions or updates for the current document'),
        feature: z.string().optional().describe('Feature name (optional if context is already set)')
      }
    },
    async (args) => {
      const baseDir = process.cwd();
      try {
        const featurePath = SpecManager.resolveFeaturePath(baseDir, args.feature);
        const state = SpecManager.getWorkflowState(featurePath);
        
        let message = '';

        if (!state.requirements.exists) {
            // Scaffold requirements
            const content = getRequirementsTemplate(featurePath.split('/').pop() || 'feature', args.instruction || '');
            writeFileSync(join(featurePath, 'requirements.md'), content, 'utf-8');
            message = 'Initialized requirements.md.';
        } else if (!state.requirements.edited) {
            message = 'Please finish editing requirements.md (remove all <template> tags) before advancing.';
            if (args.instruction) message += `\n> Reminder instruction: ${args.instruction}`;
        } else if (!state.design.exists) {
            // Scaffold design
            let content = getDesignTemplate(featurePath.split('/').pop() || 'feature');
            if (args.instruction) {
                content += `\n\n> **Guidance:** ${args.instruction}`;
            }
            writeFileSync(join(featurePath, 'design.md'), content, 'utf-8');
            message = 'Requirements complete. Scaffolding design.md.';
        } else if (!state.design.edited) {
            message = 'Please finish editing design.md (remove all <template> tags) before advancing.';
            if (args.instruction) message += `\n> Reminder instruction: ${args.instruction}`;
        } else if (!state.tasks.exists) {
            // Scaffold tasks
            let content = getTasksTemplate(featurePath.split('/').pop() || 'feature');
            if (args.instruction) {
                content += `\n\n> **Guidance:** ${args.instruction}`;
            }
            writeFileSync(join(featurePath, 'tasks.md'), content, 'utf-8');
            message = 'Design complete. Scaffolding tasks.md.';
        } else {
            message = 'All documents exist. Proceed with `spec_todo`.';
            if (args.instruction) message += `\n> Received instruction: ${args.instruction}`;
        }

        return {
          content: [{
            type: 'text',
            text: `${message}\n\n${SpecManager.getStatusSummary(baseDir, args.feature)}`
          }]
        };
      } catch (error: any) {
         return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  // 3. spec_todo
  server.registerTool(
    'spec_todo',
    {
      description: 'Manage tasks. Use action=list to view, start to mark in progress, complete to finish.',
      inputSchema: {
        action: z.enum(['list', 'complete', 'start']).describe('Action to perform'),
        id: z.string().optional().describe('Task ID (required for complete/start)'),
        feature: z.string().optional().describe('Feature name (optional if context is already set)')
      }
    },
    async (args) => {
      const baseDir = process.cwd();
      try {
        const featurePath = SpecManager.resolveFeaturePath(baseDir, args.feature);
        
        if (args.action === 'list') {
            // just return status summary
            return {
              content: [{
                type: 'text',
                text: SpecManager.getStatusSummary(baseDir, args.feature)
              }]
            };
        } else if (args.action === 'complete' && args.id) {
            const result = await completeTask({ path: featurePath, taskNumber: args.id });
            return {
               content: [{
                 type: 'text',
                 text: `${result.displayText}\n\n${SpecManager.getStatusSummary(baseDir, args.feature)}`
               }]
            };
        } else {
             return {
              content: [{ type: 'text', text: `Action ${args.action} on id ${args.id} acknowledged.\n\n${SpecManager.getStatusSummary(baseDir, args.feature)}` }]
            };
        }
      } catch (error: any) {
         return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  // 4. spec_status
  server.registerTool(
    'spec_status',
    {
      description: 'Get a health check of the active project and clear Next Steps.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (optional if context is already set)')
      }
    },
    async (args) => {
      const baseDir = process.cwd();
      try {
        return {
          content: [{
            type: 'text',
            text: SpecManager.getStatusSummary(baseDir, args.feature)
          }]
        };
      } catch (error: any) {
         return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );
}