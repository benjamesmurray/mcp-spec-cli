import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SpecManager } from '../../src/features/shared/SpecManager.js';
import { WorkflowStateRepository } from '../../src/features/shared/workflowStateRepository.js';

describe('SpecManager', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a unique temporary directory for each test
    tempDir = join(tmpdir(), `spec-cli-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('resolveFeaturePath', () => {
    it('should resolve an exact match in the base directory', () => {
      const featureName = 'auth';
      const expectedPath = join(tempDir, featureName);
      mkdirSync(expectedPath); // Create the exact match

      const resolvedPath = SpecManager.resolveFeaturePath(tempDir, featureName);
      expect(resolvedPath).toBe(expectedPath);
      
      // Verify .spec_last_used was updated
      const lastUsed = readFileSync(join(tempDir, '.spec_last_used'), 'utf-8');
      expect(lastUsed).toBe(featureName);
    });

    it('should search common subdirectories (docs, specs) if exact match not found', () => {
      const featureName = 'billing';
      const expectedPath = join(tempDir, 'specs', featureName);
      mkdirSync(expectedPath, { recursive: true });

      const resolvedPath = SpecManager.resolveFeaturePath(tempDir, featureName);
      expect(resolvedPath).toBe(expectedPath);

      // Verify .spec_last_used
      const lastUsed = readFileSync(join(tempDir, '.spec_last_used'), 'utf-8');
      expect(lastUsed).toBe(join('specs', featureName));
    });

    it('should fallback to creating in baseDir if not found anywhere', () => {
      const featureName = 'new-feature';
      const expectedPath = join(tempDir, featureName);

      const resolvedPath = SpecManager.resolveFeaturePath(tempDir, featureName);
      expect(resolvedPath).toBe(expectedPath);

      const lastUsed = readFileSync(join(tempDir, '.spec_last_used'), 'utf-8');
      expect(lastUsed).toBe(featureName);
    });

    it('should resolve implicitly via .spec_last_used if featureName is omitted', () => {
      const featureName = 'implicit-feature';
      const featurePath = join(tempDir, featureName);
      mkdirSync(featurePath);
      writeFileSync(join(tempDir, '.spec_last_used'), featureName, 'utf-8');

      const resolvedPath = SpecManager.resolveFeaturePath(tempDir);
      expect(resolvedPath).toBe(featurePath);
    });

    it('should throw an error if no featureName provided and .spec_last_used is missing or invalid', () => {
      expect(() => SpecManager.resolveFeaturePath(tempDir)).toThrowError(/Could not determine project context/);
    });
  });

  describe('getWorkflowState & getStatusSummary', () => {
    it('should return missing state when no documents exist', () => {
      const featureName = 'test-feature';
      const summary = SpecManager.getStatusSummary(tempDir, featureName);
      
      expect(summary).toContain('Requirements: Missing');
      expect(summary).toContain('Design: Missing');
      expect(summary).toContain('Tasks: Missing');
      expect(summary).toContain('Run `sc_exec plan` to finalize specifications/requirements.');
    });

    it('should return pending edits if document contains <template-*> tags', () => {
      const featureName = 'test-feature';
      const featurePath = join(tempDir, featureName);
      mkdirSync(featurePath);
      
      const reqFile = WorkflowStateRepository.getStageFileName('requirements');
      writeFileSync(join(featurePath, reqFile), 'Content\n<template-requirements>\nPlaceholder\n</template-requirements>', 'utf-8');
      
      const summary = SpecManager.getStatusSummary(tempDir, featureName);
      expect(summary).toContain('Requirements: Pending Edits');
      expect(summary).toContain('Run `sc_exec plan` to finalize specifications/requirements.');
    });

    it('should return approved if document exists and has no <template-*> tags', () => {
      const featureName = 'test-feature';
      const featurePath = join(tempDir, featureName);
      mkdirSync(featurePath);
      
      const reqFile = WorkflowStateRepository.getStageFileName('requirements');
      writeFileSync(join(featurePath, reqFile), 'Completed requirements without tags', 'utf-8');
      
      const summary = SpecManager.getStatusSummary(tempDir, featureName);
      expect(summary).toContain('Requirements: Approved');
      expect(summary).toContain('Design: Missing');
      expect(summary).toContain('Next Step: Run `sc_exec plan` to create an implementation plan (design).');
    });
    
    it('should handle full workflow completion state', () => {
      const featureName = 'test-feature';
      const featurePath = join(tempDir, featureName);
      mkdirSync(featurePath);
      
      writeFileSync(join(featurePath, WorkflowStateRepository.getStageFileName('requirements')), 'Req', 'utf-8');
      writeFileSync(join(featurePath, WorkflowStateRepository.getStageFileName('design')), 'Des', 'utf-8');
      writeFileSync(join(featurePath, WorkflowStateRepository.getStageFileName('tasks')), 'Tsk', 'utf-8');
      
      const summary = SpecManager.getStatusSummary(tempDir, featureName);
      expect(summary).toContain('Requirements: Approved');
      expect(summary).toContain('Design: Approved');
      expect(summary).toContain('Tasks: Active');
      expect(summary).toContain('Next Step: Run `sc_exec todo list` or `sc_exec todo start <id>` to begin implementation.');
    });

    it('should include epoch context in status summary if file exists', () => {
      const featureName = 'test-feature';
      const featurePath = join(tempDir, featureName);
      mkdirSync(featurePath);
      
      const epochContent = '# Epoch Context\n\n## Active Focus\n* Working on tests';
      writeFileSync(join(featurePath, '.epoch-context.md'), epochContent, 'utf-8');
      
      const summary = SpecManager.getStatusSummary(tempDir, featureName);
      expect(summary).toContain('--- Epoch Context ---');
      expect(summary).toContain('Active Focus');
      expect(summary).toContain('Working on tests');
    });
  });
});
