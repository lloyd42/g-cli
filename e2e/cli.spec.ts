import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';

const cliCommand = `node ${path.resolve(__dirname, '../dist/index.js')}`;
let tempHomeDir: string;

// We need to mock os.homedir() to isolate user config files for tests.
// However, Playwright runs tests in a separate process, so we need to
// set an environment variable that our test runner setup can use.
// For simplicity in this context, we will directly manipulate files in a temp dir,
// and our CLI will need to be adapted to respect a custom home dir via an env var.

// Let's first create a helper and adapt the CLI to accept a custom home dir.
// This is a more robust approach for E2E testing a CLI.

test.beforeAll(() => {
  // Create a temporary directory to act as a fake home directory
  tempHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'g-cli-e2e-'));
});

test.afterAll(() => {
  // Clean up the temporary directory
  fs.removeSync(tempHomeDir);
});

// Helper function to run CLI commands in our isolated environment
const runCli = (args: string) => {
  return execSync(`${cliCommand} ${args}`, {
    env: {
      ...process.env,
      // We will modify the CLI to use this env var for the home directory
      G_CLI_TEST_HOME_DIR: tempHomeDir,
      // Force chalk to disable colors in the test environment
      FORCE_COLOR: '0',
    },
    encoding: 'utf-8',
  });
};

test.describe('g-cli E2E Tests', () => {
  test('should list default templates correctly', () => {
    const output = runCli('list');
    expect(output).toContain('Available templates:');
    const cleanOutput = output.replace(/\s+/g, ' ');
    expect(cleanOutput).toContain('react:');
    expect(cleanOutput).toContain('vue:');
  });

  test('should add a new template, list it, and then delete it', () => {
    // 1. Add a new template
    const addOutput = runCli('add my-e2e-template user/e2e-repo');
    expect(addOutput).toContain('Template "my-e2e-template" added successfully!');

    // 2. List templates to verify addition
    const listOutput = runCli('list');
    const cleanListOutput = listOutput.replace(/\s+/g, ' ');
    expect(cleanListOutput).toContain('my-e2e-template:');
    expect(cleanListOutput).toContain('user/e2e-repo');

    // 3. Delete the template
    const deleteOutput = runCli('delete my-e2e-template');
    expect(deleteOutput).toContain('Template "my-e2e-template" deleted successfully!');

    // 4. List again to verify deletion
    const finalListOutput = runCli('list');
    expect(finalListOutput).not.toContain('my-e2e-template:');
  });

  test('should prevent deleting a default template', () => {
    const output = runCli('delete react');
    expect(output).toContain('Cannot delete default template "react"');
  });

  test('should show config path correctly', () => {
    const output = runCli('config');
    const expectedPath = path.join(tempHomeDir, '.g-cli', 'user-templates.json');
    expect(output).toContain('User templates file path:');
    expect(output).toContain(expectedPath);
  });
});