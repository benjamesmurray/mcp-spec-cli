#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { parseArgs } from 'util';
import { SpecManager } from './features/shared/SpecManager.js';
import { TemplateRepository } from './features/shared/templateRepository.js';
import { WorkflowStateRepository } from './features/shared/workflowStateRepository.js';
import { openApiLoader } from './features/shared/openApiLoader.js';
import { completeTask } from './features/task/completeTask.js';
import { TaskParser } from './features/shared/taskParser.js';
import { Logger } from './logger.js';

const { positionals, values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    feature: { type: 'string' },
    instruction: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    id: { type: 'string' },
    focus: { type: 'string' },
    intentions: { type: 'string' },
    hypotheses: { type: 'string' },
    openQuestions: { type: 'string' },
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
  exec epoch               Update the epoch context
  verify                   Verify current state

Options:
  --feature <name>         Feature name
  --instruction <text>     Instructions or updates
  --name <name>            Feature or project name (for init)
  --description <text>     Optional description (for init)
  --id <id>                Task ID (for todo)
  --focus <text>           Active focus (for epoch)
  --intentions <text>      Pending intentions (for epoch)
  --hypotheses <text>      Active hypotheses (for epoch)
  --openQuestions <text>   Open questions (for epoch)
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
        
        const reqPath = join(featurePath, WorkflowStateRepository.getStageFileName('requirements'));
        if (!existsSync(reqPath)) {
          const content = TemplateRepository.getInterpolatedTemplate('requirements', { 
            featureName, 
            introduction: values.description || 'Initial requirements' 
          });
          writeFileSync(reqPath, content, 'utf-8');
          writeFileSync(join(featurePath, '.epoch-context.md'), `# Epoch Context\n\n**Current Phase:** Requirements\n\n`, 'utf-8');
        }

        output = SpecManager.getStatusSummary(baseDir, featureName);
        console.log(output);
      } 
      else if (subcommand === 'plan') {
        const featurePath = SpecManager.resolveFeaturePath(baseDir, values.feature);
        const state = SpecManager.getWorkflowState(featurePath);
        
        let message = '';
        if (!state.requirements.exists) {
            const content = TemplateRepository.getInterpolatedTemplate('requirements', { 
              featureName: featurePath.split('/').pop() || 'feature', 
              introduction: values.instruction || '' 
            });
            writeFileSync(join(featurePath, WorkflowStateRepository.getStageFileName('requirements')), content, 'utf-8');
            message = `Initialized ${WorkflowStateRepository.getStageFileName('requirements')}.`;
            const guide = openApiLoader.getSharedResourceText('requirements-guide');
            if (guide) message += `\n\n--- Guide ---\n${guide}`;
        } else if (!state.requirements.edited) {
            message = `Please finish editing ${WorkflowStateRepository.getStageFileName('requirements')} (remove all <template> tags) before advancing.`;
            if (values.instruction) message += `\n> Reminder instruction: ${values.instruction}`;
        } else if (!state.design.exists) {
            let content = TemplateRepository.getInterpolatedTemplate('design', { 
              featureName: featurePath.split('/').pop() || 'feature' 
            });
            if (values.instruction) content += `\n\n> **Guidance:** ${values.instruction}`;
            writeFileSync(join(featurePath, WorkflowStateRepository.getStageFileName('design')), content, 'utf-8');
            writeFileSync(join(featurePath, '.epoch-context.md'), `# Epoch Context\n\n**Current Phase:** Design\n\n`, 'utf-8');
            message = `Requirements complete. Scaffolding ${WorkflowStateRepository.getStageFileName('design')}. Epoch context reset.`;
            const guide = openApiLoader.getSharedResourceText('design-guide');
            if (guide) message += `\n\n--- Guide ---\n${guide}`;
        } else if (!state.design.edited) {
            message = `Please finish editing ${WorkflowStateRepository.getStageFileName('design')} (remove all <template> tags) before advancing.`;
            if (values.instruction) message += `\n> Reminder instruction: ${values.instruction}`;
        } else if (!state.tasks.exists) {
            let content = TemplateRepository.getInterpolatedTemplate('tasks', { 
              featureName: featurePath.split('/').pop() || 'feature' 
            });
            if (values.instruction) content += `\n\n> **Guidance:** ${values.instruction}`;
            writeFileSync(join(featurePath, WorkflowStateRepository.getStageFileName('tasks')), content, 'utf-8');
            writeFileSync(join(featurePath, '.epoch-context.md'), `# Epoch Context\n\n**Current Phase:** Implementation Planning\n\n`, 'utf-8');
            message = `Design complete. Scaffolding ${WorkflowStateRepository.getStageFileName('tasks')}. Epoch context reset.`;
            const guide = openApiLoader.getSharedResourceText('tasks-guide');
            if (guide) message += `\n\n--- Guide ---\n${guide}`;
        } else if (!state.tasks.edited) {
            message = `Please finish editing ${WorkflowStateRepository.getStageFileName('tasks')} (remove all <template> tags) before advancing.`;
            if (values.instruction) message += `\n> Reminder instruction: ${values.instruction}`;
        } else {
            // Check if all tasks are complete
            let allTasksComplete = false;
            const tasksPath = join(featurePath, WorkflowStateRepository.getStageFileName('tasks'));
            if (existsSync(tasksPath)) {
                const tasksContent = readFileSync(tasksPath, 'utf-8');
                const tasks = TaskParser.parse(tasksContent);
                const areTasksDone = (ts: any[]): boolean => ts.every(t => t.completed && (t.children.length === 0 || areTasksDone(t.children)));
                allTasksComplete = tasks.length > 0 && areTasksDone(tasks);
            }

            if (!allTasksComplete) {
                message = 'Not all implementation tasks are complete. Proceed with `exec todo` or finish tasks manually.';
                if (values.instruction) message += `\n> Received instruction: ${values.instruction}`;
            } else if (!state.testing.exists) {
                let content = TemplateRepository.getInterpolatedTemplate('testing', { 
                  featureName: featurePath.split('/').pop() || 'feature' 
                });
                if (values.instruction) content += `\n\n> **Guidance:** ${values.instruction}`;
                writeFileSync(join(featurePath, WorkflowStateRepository.getStageFileName('testing')), content, 'utf-8');
                writeFileSync(join(featurePath, '.epoch-context.md'), `# Epoch Context\n\n**Current Phase:** User Testing\n\n`, 'utf-8');
                message = `Implementation complete. Scaffolding ${WorkflowStateRepository.getStageFileName('testing')}. Epoch context reset.`;
                const guide = openApiLoader.getSharedResourceText('testing-guide');
                if (guide) message += `\n\n--- Guide ---\n${guide}`;
            } else if (!state.testing.edited) {
                message = `Please finish editing ${WorkflowStateRepository.getStageFileName('testing')} (remove all <template> tags) and wait for user feedback before advancing.`;
                if (values.instruction) message += `\n> Reminder instruction: ${values.instruction}`;
            } else {
                message = 'Workflow is completely finished.';
            }
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
      }
      else if (subcommand === 'epoch') {
        const featurePath = SpecManager.resolveFeaturePath(baseDir, values.feature);
        const epochPath = join(featurePath, '.epoch-context.md');
        let epochContent = existsSync(epochPath) ? readFileSync(epochPath, 'utf-8') : `# Epoch Context\n\n`;

        if (values.focus) {
            epochContent = epochContent.replace(/## Active Focus[\s\S]*?(?=##|$)/, `## Active Focus\n*   ${values.focus}\n\n`);
            if (!epochContent.includes('## Active Focus')) epochContent += `## Active Focus\n*   ${values.focus}\n\n`;
        }
        if (values.intentions) {
            epochContent = epochContent.replace(/## Pending Intentions[\s\S]*?(?=##|$)/, `## Pending Intentions\n*   ${values.intentions}\n\n`);
            if (!epochContent.includes('## Pending Intentions')) epochContent += `## Pending Intentions\n*   ${values.intentions}\n\n`;
        }
        if (values.hypotheses) {
            epochContent = epochContent.replace(/## Active Hypotheses[\s\S]*?(?=##|$)/, `## Active Hypotheses\n*   ${values.hypotheses}\n\n`);
            if (!epochContent.includes('## Active Hypotheses')) epochContent += `## Active Hypotheses\n*   ${values.hypotheses}\n\n`;
        }
        if (values.openQuestions) {
            epochContent = epochContent.replace(/## Open Questions \/ Uncertainties[\s\S]*?(?=##|$)/, `## Open Questions / Uncertainties\n*   ${values.openQuestions}\n\n`);
            if (!epochContent.includes('## Open Questions / Uncertainties')) epochContent += `## Open Questions / Uncertainties\n*   ${values.openQuestions}\n\n`;
        }
        
        writeFileSync(epochPath, epochContent, 'utf-8');
        output = `Epoch context updated successfully.\n\n${SpecManager.getStatusSummary(baseDir, values.feature)}`;
        console.log(output);
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
