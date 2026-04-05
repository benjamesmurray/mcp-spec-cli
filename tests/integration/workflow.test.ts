import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSpecTools } from '../../src/tools/specTools.js';

describe('Spec CLI Workflow Integration', () => {
  let tempDir: string;
  let tools: Record<string, any>;
  let originalCwd: () => string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `spec-cli-integration-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    
    // Mock process.cwd() to return our temp dir
    originalCwd = process.cwd;
    process.cwd = () => tempDir;

    const server = new McpServer({
      name: 'test-server',
      version: '1.0'
    });
    registerSpecTools(server);
    // @ts-ignore
    tools = server._registeredTools;
  });

  afterEach(() => {
    process.cwd = originalCwd;
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should execute a full spec workflow lifecycle', async () => {
    const featureName = 'payment-system';

    // 1. Initialize
    const initRes = await tools['spec_init'].callback({ name: featureName, description: 'Add payments' }, {});
    expect(initRes.content[0].text).toContain('**Requirements:** ⏳ Pending Edits');
    expect(initRes.content[0].text).toContain('Run `spec_plan` to finalize specifications/requirements.');
    
    // 2. spec_plan (with requirements not finished)
    const planRes1 = await tools['spec_plan'].callback({ instruction: 'Use Stripe' }, {});
    expect(planRes1.content[0].text).toContain('Please finish editing requirements.md');
    expect(planRes1.content[0].text).toContain('Reminder instruction: Use Stripe');
    
    // 3. Simulate AI finishing the requirements document (removing tags)
    const reqPath = join(tempDir, featureName, 'requirements.md');
    writeFileSync(reqPath, '# Requirements\nWe will use Stripe.', 'utf-8');
    
    // 4. spec_plan (advancing to Design)
    const planRes2 = await tools['spec_plan'].callback({}, {});
    expect(planRes2.content[0].text).toContain('Requirements complete. Scaffolding design.md.');
    expect(planRes2.content[0].text).toContain('**Design:** ⏳ Pending Edits');
    
    // 5. Simulate AI finishing the design document
    const desPath = join(tempDir, featureName, 'design.md');
    writeFileSync(desPath, '# Design\nStripe API design.', 'utf-8');
    
    // 6. spec_plan (advancing to Tasks)
    const planRes3 = await tools['spec_plan'].callback({}, {});
    expect(planRes3.content[0].text).toContain('Design complete. Scaffolding tasks.md.');
    expect(planRes3.content[0].text).toContain('**Tasks:** ⏳ Pending Edits');

    // 7. Simulate AI writing tasks
    const tasksPath = join(tempDir, featureName, 'tasks.md');
    writeFileSync(tasksPath, '# Tasks\n- [ ] 1.1 Setup Stripe webhook\n- [ ] 1.2 Implement checkout', 'utf-8');

    // 8. spec_status (everything ready)
    const statusRes = await tools['spec_status'].callback({}, {});
    expect(statusRes.content[0].text).toContain('**Tasks:** ✅ Active');
    expect(statusRes.content[0].text).toContain('Run `spec_todo list` or `spec_todo start <id>` to begin implementation.');

    // 9. spec_todo (Complete a task)
    const todoRes = await tools['spec_todo'].callback({ action: 'complete', id: '1.1' }, {});
    expect(todoRes.content[0].text).toContain('1.1');
    // Ensure file was modified
    const tasksContent = readFileSync(tasksPath, 'utf-8');
    expect(tasksContent).toContain('- [x] 1.1 Setup Stripe webhook');
    expect(tasksContent).toContain('- [ ] 1.2 Implement checkout');
  });
});
