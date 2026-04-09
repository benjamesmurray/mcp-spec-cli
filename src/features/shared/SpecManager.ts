import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, isAbsolute } from 'path';
import { isDocumentEdited } from './documentAnalyzer.js';
import { WorkflowStateRepository } from './workflowStateRepository.js';
import { TaskParser } from './taskParser.js';

export type FeatureState = 'Requirements Pending' | 'Requirements Confirmed' | 'Design Confirmed' | 'Tasks Pending' | 'Tasks Completed' | 'Testing Pending' | 'Testing Confirmed';

export interface WorkflowState {
  requirements: { exists: boolean; edited: boolean };
  design: { exists: boolean; edited: boolean };
  tasks: { exists: boolean; edited: boolean };
  testing: { exists: boolean; edited: boolean };
  featurePath: string;
}

/**
 * SpecManager manages the feature path resolution and overall workflow state.
 */
export class SpecManager {
  private static LAST_USED_FILE = '.spec_last_used';

  /**
   * Resolves the feature path using fuzzy logic and implicit context.
   */
  static resolveFeaturePath(baseDir: string, featureName?: string): string {
    if (featureName) {
      if (isAbsolute(featureName)) {
        if (existsSync(featureName)) {
          this.setLastUsed(baseDir, featureName);
          return featureName;
        }
      }

      if (existsSync(join(baseDir, featureName))) {
        this.setLastUsed(baseDir, featureName);
        return join(baseDir, featureName);
      }
      const commonDirs = [join('projects', 'active'), join('projects', 'completed'), 'active', 'completed', 'specs', 'docs'];
      for (const dir of commonDirs) {
        if (existsSync(join(baseDir, dir, featureName))) {
          this.setLastUsed(baseDir, join(dir, featureName));
          return join(baseDir, dir, featureName);
        }
      }
      const defaultPath = join('projects', 'active', featureName);
      this.setLastUsed(baseDir, defaultPath);
      return join(baseDir, defaultPath);
    }

    const lastUsedPath = join(baseDir, this.LAST_USED_FILE);
    if (existsSync(lastUsedPath)) {
      const lastUsed = readFileSync(lastUsedPath, 'utf-8').trim();
      const fullPath = join(baseDir, lastUsed);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }

    throw new Error('Could not determine project context. Please provide a feature name (e.g. {"feature": "auth"}).');
  }

  private static setLastUsed(baseDir: string, featurePathRelative: string): void {
    writeFileSync(join(baseDir, this.LAST_USED_FILE), featurePathRelative, 'utf-8');
  }

  /**
   * Gets the current workflow mode for the feature.
   */
  static getMode(featurePath: string): 'step-through' | 'one-shot' {
    const modeFile = join(featurePath, '.spec-mode');
    if (existsSync(modeFile)) {
      const mode = readFileSync(modeFile, 'utf-8').trim();
      if (mode === 'one-shot') return 'one-shot';
    }
    return 'step-through';
  }

  /**
   * Sets the workflow mode for the feature.
   */
  static setMode(featurePath: string, mode: 'step-through' | 'one-shot'): void {
    writeFileSync(join(featurePath, '.spec-mode'), mode, 'utf-8');
  }

  /**
   * Infers the workflow state dynamically.
   */
  static getWorkflowState(featurePath: string): WorkflowState {
    const checkDoc = (stage: string) => {
      const fileName = WorkflowStateRepository.getStageFileName(stage);
      const filePath = join(featurePath, fileName);
      return {
        exists: existsSync(filePath),
        edited: isDocumentEdited(filePath)
      };
    };

    return {
      requirements: checkDoc('requirements'),
      design: checkDoc('design'),
      tasks: checkDoc('tasks'),
      testing: checkDoc('testing'),
      featurePath
    };
  }

  /**
   * Returns a dense Markdown output representing the current status.
   */
  static getStatusSummary(baseDir: string, featureName?: string): string {
    try {
      const featurePath = this.resolveFeaturePath(baseDir, featureName);
      const state = this.getWorkflowState(featurePath);
      const mode = this.getMode(featurePath);

      const reqStatus = state.requirements.exists ? (state.requirements.edited ? 'Drafted' : 'Pending Edits') : 'Missing';
      const desStatus = state.design.exists ? (state.design.edited ? 'Drafted' : 'Pending Edits') : 'Missing';
      const tskStatus = state.tasks.exists ? (state.tasks.edited ? 'Active' : 'Pending Edits') : 'Missing';
      
      let allTasksComplete = false;
      if (state.tasks.exists && state.tasks.edited) {
        const tasksPath = join(featurePath, WorkflowStateRepository.getStageFileName('tasks'));
        const content = readFileSync(tasksPath, 'utf-8');
        const tasks = TaskParser.parse(content);
        const checkAllComplete = (ts: any[]): boolean => ts.length > 0 && ts.every(t => t.completed && checkAllComplete(t.children !== undefined ? t.children : []));
        // We only require roots and their children to be complete. If no tasks, it's not complete.
        // Wait, checkAllComplete needs to handle empty children properly.
        const areTasksDone = (ts: any[]): boolean => ts.every(t => t.completed && (t.children.length === 0 || areTasksDone(t.children)));
        allTasksComplete = tasks.length > 0 && areTasksDone(tasks);
      }

      const tstStatus = state.testing.exists ? (state.testing.edited ? 'Drafted' : 'Pending Edits') : 'Missing';

      let nextSteps = '';
      let phase = 'Specify';
      if (!state.requirements.exists) {
         phase = WorkflowStateRepository.getStageDisplayName('requirements');
         nextSteps = 'Run `sc_init` to initialize requirements.';
      } else if (!state.requirements.edited) {
         phase = WorkflowStateRepository.getStageDisplayName('requirements');
         nextSteps = 'Edit requirements document. Remove all `<template-requirements>` tags to indicate the draft is complete.';
      } else if (!state.design.exists) {
         phase = WorkflowStateRepository.getStageDisplayName('requirements');
         if (mode === 'one-shot') {
             nextSteps = '🚨 ONE-SHOT MODE ACTIVE: You are in the **Autonomous Ambiguity Resolution Loop**: 1. Self-review the requirements for ambiguities or edge cases. 2. Use `sc_epoch --openQuestions "..."` to record findings. 3. Resolve all identified issues autonomously using your best judgment. 4. Ensure all open questions are answered and closed. Once all ambiguities are resolved autonomously, IMMEDIATELY run `sc_plan` to scaffold the design phase.';
         } else {
             nextSteps = 'Requirements drafted. You are in the **Ambiguity Resolution Loop**: 1. Self-review for ambiguities/edge cases. 2. Use `sc_epoch --openQuestions "..."` to record findings. 3. Resolve what you can confidently. 4. Ask the user targeted questions for the rest. If using a prompter tool, always include an "Other" or open-ended option; never restrict to strict Yes/No. 5. DO NOT ask for final approval until all questions are answered. Repeat this loop if answers raise new questions. Once all ambiguities are resolved, ask the user for explicit approval (e.g., "Do the requirements look good?"). Once explicitly approved, run `sc_plan` to scaffold the design phase.';
         }
      } else if (!state.design.edited) {
         phase = WorkflowStateRepository.getStageDisplayName('design');
         nextSteps = 'Edit design document. Conduct necessary research. Remove all `<template-design>` tags to indicate the draft is complete.';
      } else if (!state.tasks.exists) {
         phase = WorkflowStateRepository.getStageDisplayName('design');
         if (mode === 'one-shot') {
             nextSteps = '🚨 ONE-SHOT MODE ACTIVE: You are in the **Autonomous Ambiguity Resolution Loop**: 1. Self-review the design for technical ambiguities or missing details. 2. Use `sc_epoch --openQuestions "..."` to record findings. 3. Resolve all identified issues autonomously using your best judgment. 4. Ensure all open questions are answered and closed. Once all ambiguities are resolved autonomously, IMMEDIATELY run `sc_plan` to scaffold the tasks phase.';
         } else {
             nextSteps = 'Design drafted. You are in the **Ambiguity Resolution Loop**: 1. Self-review for technical ambiguities/missing details. 2. Use `sc_epoch --openQuestions "..."` to record findings. 3. Resolve what you can confidently. 4. Ask the user targeted questions for the rest (always include an "Other" or open-ended option). 5. DO NOT ask for final approval until all questions are answered. Repeat this loop if answers raise new questions. Once all ambiguities are resolved, ask the user for explicit approval (e.g., "Does the design look good?"). Once explicitly approved, run `sc_plan` to scaffold the tasks phase.';
         }
      } else if (!state.tasks.edited) {
         phase = WorkflowStateRepository.getStageDisplayName('tasks');
         nextSteps = 'Edit tasks document. Add dependencies and organize execution order. Remove all `<template-tasks>` tags to indicate the draft is complete.';
      } else if (!allTasksComplete) {
         phase = 'Implementation';
         if (mode === 'one-shot') {
             nextSteps = '🚨 ONE-SHOT MODE ACTIVE: You are in the **Autonomous Ambiguity Resolution Loop**: 1. Self-review the task list for missing dependencies or unclear steps. 2. Use `sc_epoch --openQuestions "..."` to record findings. 3. Resolve all identified issues autonomously using your best judgment. 4. Ensure the task plan is comprehensive and dependencies are correct. Once verified, IMMEDIATELY run `sc_todo_start --id <first_task_id>` to begin implementation.';
         } else {
             nextSteps = 'Tasks drafted. If you have not yet received explicit approval from the user for the task list, you are in the **Ambiguity Resolution Loop**: 1. Self-review for missing dependencies. 2. Use `sc_epoch --openQuestions "..."` to record findings. 3. Resolve what you can. 4. Ask the user targeted questions (always include an "Other" or open-ended option). 5. DO NOT ask for final approval until all questions are answered. Once all questions are answered, ask for explicit approval (e.g., "Do the tasks look good?"). Once approved, run `sc_todo_start --id <id>` to begin implementation. If already approved, proceed with implementation.';
         }
      } else if (!state.testing.exists) {
         phase = WorkflowStateRepository.getStageDisplayName('testing');
         nextSteps = 'Implementation complete. Run `sc_plan` to scaffold the testing and verification plan.';
      } else if (!state.testing.edited) {
         phase = WorkflowStateRepository.getStageDisplayName('testing');
         if (mode === 'one-shot') {
             nextSteps = '🚨 ONE-SHOT MODE ACTIVE: 1. Draft the testing document (remove all `<template-testing>` tags). 2. Implement and execute automated tests (unit, integration, or E2E) as per the plan. 3. Autonomously fix any failures. 4. Once all tests pass, IMMEDIATELY run `sc_plan` to finalize the project.';
         } else {
             nextSteps = 'Edit testing document. Provide manual testing steps. Remove all `<template-testing>` tags. Ask the user to execute tests and provide feedback.';
         }
      } else {
         phase = 'Completed';
         nextSteps = 'Feature workflow is complete.';
      }

      let epochInfo = '';
      const epochPath = join(featurePath, '.epoch-context.md');
      if (existsSync(epochPath)) {
          const epochContent = readFileSync(epochPath, 'utf-8');
          epochInfo = `\n\n--- Epoch Context ---\n${epochContent.trim()}`;
      }

      return `Project: spec-cli | Phase: ${phase}
Feature: ${featurePath.replace(baseDir, '').replace(/^[\/\\]/, '')}
Requirements: ${reqStatus}
Design: ${desStatus}
Tasks: ${allTasksComplete ? 'Completed' : tskStatus}
Testing: ${tstStatus}
Next Step: ${nextSteps}${epochInfo}`;
    } catch (e: any) {
      return `Project: spec-cli | Phase: Error
Error: ${e.message}
Next Step: Run \`sc_init --name "your-feature"\` to start a new feature.`;
    }
  }
}
