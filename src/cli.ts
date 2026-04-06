#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parseArgs } from 'util';
import { SpecManager } from './features/shared/SpecManager.js';
import { getRequirementsTemplate, getDesignTemplate, getTasksTemplate } from './features/shared/documentTemplates.js';
import { completeTask } from './features/task/completeTask.js';
import { Logger } from './logger.js';

const { positionals, values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    feature: { type: 'string' },
    instruction: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    id: { type: 'string' },
    help: { type: 'boolean' }
  },
  allowPositionals: true
});

const command = positionals[0];
const subcommand = positionals[1];

async function main() {
  let output = '';

  try {
    const baseDir = process.cwd();

    if (command === 'help' || values.help) {
      output = `
Usage: spec-cli <command> [subcommand] [options]

Commands:
  status                   Get a health check of the active project
  help [topic]             Show help documentation
  exec init                Initialize a new feature
  exec plan                Progress the workflow state
  exec todo <action>       Manage tasks (list, start, complete)
  verify                   Verify current state

Options:
  --feature <name>         Feature name
  --instruction <text>     Instructions or updates
  --name <name>            Feature or project name (for init)
  --description <text>     Optional description (for init)
  --id <id>                Task ID (for todo)
`;
      console.log(output);
      Logger.logCommand(process.argv.slice(2).join(' '), [], output);
      return;
    }

    if (command === 'status') {
      output = SpecManager.getStatusSummary(baseDir, values.feature);
      console.log(output);
    } 
    else if (command === 'verify') {
      output = "Project state verified.\n\n" + SpecManager.getStatusSummary(baseDir, values.feature);
      console.log(output);
    }
    else if (command === 'exec') {
      if (subcommand === 'init') {
        const featureName = values.name || values.feature;
        if (!featureName) throw new Error('--name or --feature is required for init');
        
        const featurePath = join(baseDir, featureName);
        if (!existsSync(featurePath)) {
          mkdirSync(featurePath, { recursive: true });
        }
        
        SpecManager.resolveFeaturePath(baseDir, featureName);
        
        const reqPath = join(featurePath, 'requirements.md');
        if (!existsSync(reqPath)) {
          const content = getRequirementsTemplate(featureName, values.description || 'Initial requirements');
          writeFileSync(reqPath, content, 'utf-8');
        }

        output = SpecManager.getStatusSummary(baseDir, featureName);
        console.log(output);
      } 
      else if (subcommand === 'plan') {
        const featurePath = SpecManager.resolveFeaturePath(baseDir, values.feature);
        const state = SpecManager.getWorkflowState(featurePath);
        
        let message = '';
        if (!state.requirements.exists) {
            const content = getRequirementsTemplate(featurePath.split('/').pop() || 'feature', values.instruction || '');
            writeFileSync(join(featurePath, 'requirements.md'), content, 'utf-8');
            message = 'Initialized requirements.md.';
        } else if (!state.requirements.edited) {
            message = 'Please finish editing requirements.md (remove all <template> tags) before advancing.';
            if (values.instruction) message += `\n> Reminder instruction: ${values.instruction}`;
        } else if (!state.design.exists) {
            let content = getDesignTemplate(featurePath.split('/').pop() || 'feature');
            if (values.instruction) content += `\n\n> **Guidance:** ${values.instruction}`;
            writeFileSync(join(featurePath, 'design.md'), content, 'utf-8');
            message = 'Requirements complete. Scaffolding design.md.';
        } else if (!state.design.edited) {
            message = 'Please finish editing design.md (remove all <template> tags) before advancing.';
            if (values.instruction) message += `\n> Reminder instruction: ${values.instruction}`;
        } else if (!state.tasks.exists) {
            let content = getTasksTemplate(featurePath.split('/').pop() || 'feature');
            if (values.instruction) content += `\n\n> **Guidance:** ${values.instruction}`;
            writeFileSync(join(featurePath, 'tasks.md'), content, 'utf-8');
            message = 'Design complete. Scaffolding tasks.md.';
        } else {
            message = 'All documents exist. Proceed with `exec todo`.';
            if (values.instruction) message += `\n> Received instruction: ${values.instruction}`;
        }

        output = `${message}\n\n${SpecManager.getStatusSummary(baseDir, values.feature)}`;
        console.log(output);
      }
      else if (subcommand === 'todo') {
        const action = positionals[2];
        const featurePath = SpecManager.resolveFeaturePath(baseDir, values.feature);
        
        if (action === 'list') {
            output = SpecManager.getStatusSummary(baseDir, values.feature);
            console.log(output);
        } else if (action === 'complete' && values.id) {
            const result = await completeTask({ path: featurePath, taskNumber: values.id });
            output = `${result.displayText}\n\n${SpecManager.getStatusSummary(baseDir, values.feature)}`;
            console.log(output);
        } else {
             output = `Action ${action} on id ${values.id} acknowledged.\n\n${SpecManager.getStatusSummary(baseDir, values.feature)}`;
             console.log(output);
        }
      } else {
        throw new Error('Unknown exec subcommand');
      }
    } else {
      throw new Error(`Unknown command: ${command}`);
    }

    Logger.logCommand(process.argv.slice(2).join(' '), [], output);
  } catch (error: any) {
    output = `Error: ${error.message}`;
    console.error(output);
    Logger.logCommand(process.argv.slice(2).join(' '), [], output);
    process.exit(1);
  }
}

main();