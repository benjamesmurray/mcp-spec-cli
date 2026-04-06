import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { isDocumentEdited } from './documentAnalyzer.js';
import { WorkflowStateRepository } from './workflowStateRepository.js';

export type FeatureState = 'Requirements Pending' | 'Requirements Confirmed' | 'Design Confirmed' | 'Tasks Pending' | 'Tasks Completed';

export interface WorkflowState {
  requirements: { exists: boolean; edited: boolean };
  design: { exists: boolean; edited: boolean };
  tasks: { exists: boolean; edited: boolean };
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

      const reqStatus = state.requirements.exists ? (state.requirements.edited ? 'Approved' : 'Pending Edits') : 'Missing';
      const desStatus = state.design.exists ? (state.design.edited ? 'Approved' : 'Pending Edits') : 'Missing';
      const tskStatus = state.tasks.exists ? (state.tasks.edited ? 'Active' : 'Pending Edits') : 'Missing';

      let nextSteps = '';
      let phase = 'Specify';
      if (!state.requirements.exists || !state.requirements.edited) {
         phase = WorkflowStateRepository.getStageDisplayName('requirements');
         nextSteps = 'Run `sc_exec plan` to finalize specifications/requirements.';
      } else if (!state.design.exists || !state.design.edited) {
         phase = WorkflowStateRepository.getStageDisplayName('design');
         nextSteps = 'Run `sc_exec plan` to create an implementation plan (design).';
      } else if (!state.tasks.exists || !state.tasks.edited) {
         phase = WorkflowStateRepository.getStageDisplayName('tasks');
         nextSteps = 'Run `sc_exec plan` to scaffold tasks.';
      } else {
         phase = 'Implementation';
         nextSteps = 'Run `sc_exec todo list` or `sc_exec todo start <id>` to begin implementation.';
      }

      return `Project: spec-cli | Phase: ${phase}
Feature: ${featurePath.replace(baseDir, '').replace(/^[\/\\]/, '')}
Requirements: ${reqStatus}
Design: ${desStatus}
Tasks: ${tskStatus}
Next Step: ${nextSteps}`;
    } catch (e: any) {
      return `Project: spec-cli | Phase: Error
Error: ${e.message}
Next Step: Run \`sc_exec init --name "your-feature"\` to start a new feature.`;
    }
  }
}
