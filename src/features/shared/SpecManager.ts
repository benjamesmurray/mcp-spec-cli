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
      const commonDirs = ['specs', 'docs'];
      for (const dir of commonDirs) {
        if (existsSync(join(baseDir, dir, featureName))) {
          this.setLastUsed(baseDir, join(dir, featureName));
          return join(baseDir, dir, featureName);
        }
      }
      this.setLastUsed(baseDir, featureName);
      return join(baseDir, featureName);
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
         nextSteps = 'Run `sc_exec plan` to initialize requirements.';
      } else if (!state.requirements.edited) {
         phase = WorkflowStateRepository.getStageDisplayName('requirements');
         nextSteps = 'Edit requirements document. Remove all `<template-requirements>` tags. Once edited, you MUST ask the user "Do the requirements look good?" before proceeding.';
      } else if (!state.design.exists) {
         phase = WorkflowStateRepository.getStageDisplayName('requirements');
         nextSteps = 'Requirements drafted. You MUST ask the user for explicit approval. Once explicitly approved, run `sc_exec plan` to scaffold the design phase.';
      } else if (!state.design.edited) {
         phase = WorkflowStateRepository.getStageDisplayName('design');
         nextSteps = 'Edit design document. Conduct necessary research. Remove all `<template-design>` tags. Once edited, you MUST ask the user "Does the design look good?" before proceeding.';
      } else if (!state.tasks.exists) {
         phase = WorkflowStateRepository.getStageDisplayName('design');
         nextSteps = 'Design drafted. You MUST ask the user for explicit approval. Once explicitly approved, run `sc_exec plan` to scaffold the tasks phase.';
      } else if (!state.tasks.edited) {
         phase = WorkflowStateRepository.getStageDisplayName('tasks');
         nextSteps = 'Edit tasks document. Important: Remember to perform a refresh of the tasks.md document by adding dependencies and organizing the execution order. Remove all `<template-tasks>` tags. Once edited, you MUST ask the user "Do the tasks look good?" before proceeding.';
      } else if (!allTasksComplete) {
         phase = 'Implementation';
         nextSteps = 'Tasks drafted and approved. Run `sc_exec todo list` or `sc_exec todo start <id>` to begin implementation.';
      } else if (!state.testing.exists) {
         phase = WorkflowStateRepository.getStageDisplayName('testing');
         nextSteps = 'Implementation complete. Run `sc_exec plan` to scaffold the user testing plan.';
      } else if (!state.testing.edited) {
         phase = WorkflowStateRepository.getStageDisplayName('testing');
         nextSteps = 'Edit testing document. Provide manual testing steps. Remove all `<template-testing>` tags. Ask the user to execute tests and provide feedback.';
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
Next Step: Run \`sc_exec init --name "your-feature"\` to start a new feature.`;
    }
  }
}
