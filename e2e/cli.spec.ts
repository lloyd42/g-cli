import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';

const cliCommand = `node ${path.resolve(__dirname, '../dist/index.js')}`;
let tempHomeDir: string;

// 我们需要模拟 os.homedir() 来为测试隔离用户配置文件。
// 然而，Playwright 在一个单独的进程中运行测试，所以我们需要
// 设置一个环境变量，我们的测试运行器设置可以使用它。
// 在这种情况下，为简单起见，我们将直接在临时目录中操作文件，
// 我们的 CLI 将需要被调整以通过环境变量来支持自定义主目录。

// 让我们首先创建一个辅助函数并调整 CLI 以接受自定义主目录。
// 这是对 CLI 进行 E2E 测试的一种更健壮的方法。

test.beforeAll(() => {
  // 创建一个临时目录作为假的 home 目录
  tempHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'g-cli-e2e-'));
});

test.afterAll(() => {
  // 清理临时目录
  fs.removeSync(tempHomeDir);
});

// 在我们隔离的环境中运行 CLI 命令的辅助函数
const runCli = (args: string) => {
  return execSync(`${cliCommand} ${args}`, {
    env: {
      ...process.env,
      // 我们将修改 CLI 以使用此环境变量作为 home 目录
      G_CLI_TEST_HOME_DIR: tempHomeDir,
      // 在测试环境中强制 chalk 禁用颜色
      FORCE_COLOR: '0',
    },
    encoding: 'utf-8',
  });
};

test.describe('g-cli E2E 测试', () => {
  test('应该正确列出默认模板', () => {
    const output = runCli('list');
    expect(output).toContain('可用模板:');
    const cleanOutput = output.replace(/\s+/g, ' ');
    expect(cleanOutput).toContain('react:');
    expect(cleanOutput).toContain('vue:');
  });

  test('应该可以添加一个新模板，列出它，然后删除它', () => {
    // 1. 添加一个新模板
    const addOutput = runCli('add my-e2e-template user/e2e-repo');
    expect(addOutput).toContain('模板 "my-e2e-template" 添加成功！');

    // 2. 列出模板以验证添加
    const listOutput = runCli('list');
    const cleanListOutput = listOutput.replace(/\s+/g, ' ');
    expect(cleanListOutput).toContain('my-e2e-template:');
    expect(cleanListOutput).toContain('user/e2e-repo');

    // 3. 删除模板
    const deleteOutput = runCli('delete my-e2e-template');
    expect(deleteOutput).toContain('模板 "my-e2e-template" 删除成功！');

    // 4. 再次列出以验证删除
    const finalListOutput = runCli('list');
    expect(finalListOutput).not.toContain('my-e2e-template:');
  });

  test('应该阻止删除默认模板', () => {
    const output = runCli('delete react');
    expect(output).toContain('不能删除默认模板 "react"');
  });

  test('应该正确显示配置文件路径', () => {
    const output = runCli('config');
    const expectedPath = path.join(tempHomeDir, '.g-cli', 'user-templates.json');
    expect(output).toContain('用户模板文件路径:');
    expect(output).toContain(expectedPath);
  });
});