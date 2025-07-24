import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import chalk from 'chalk';
import defaultTemplates from './default-templates.json';

// 定义模板对象的类型
export type Templates = {
  [key: string]: string;
};

// 用户配置目录
// Allow overriding the home directory for E2E testing purposes
const homeDir = process.env.G_CLI_TEST_HOME_DIR || os.homedir();
const configDir = path.join(homeDir, '.g-cli');
// 用户模板文件路径
export const userTemplatesPath = path.join(configDir, 'user-templates.json');

/**
 * 确保用户配置目录和模板文件存在
 */
async function ensureUserTemplatesFile() {
  try {
    // 确保目录存在
    await fs.ensureDir(configDir);
    // 确保文件存在，如果不存在则创建一个空 JSON 对象
    if (!fs.existsSync(userTemplatesPath)) {
      await fs.writeJson(userTemplatesPath, {});
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error(chalk.red('Failed to create user template file:'), message);
    process.exit(1);
  }
}

/**
 * 获取所有模板（合并默认模板和用户模板）
 */
export async function getAllTemplates(): Promise<Templates> {
  await ensureUserTemplatesFile();
  try {
    const userTemplates = await fs.readJson(userTemplatesPath) as Templates;
    // 合并模板，用户模板的优先级更高
    return { ...defaultTemplates, ...userTemplates };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error(chalk.red('Failed to read template files:'), message);
    return defaultTemplates; // 出错时回退到默认模板
  }
}

/**
 * 校验模板名称是否合法
 * @param name The name to validate
 */
function isValidTemplateName(name: string): boolean {
    if (!name.trim()) {
        console.error(chalk.red('Template name cannot be empty!'));
        return false;
    }
    if (!/^[a-z0-9-]+$/.test(name)) {
        console.error(chalk.red('Template name can only contain lowercase letters, numbers, and hyphens!'));
        return false;
    }
    return true;
}


/**
 * 校验 URL 是否是合法的 degit 地址
 * @param url The URL to validate
 */
function isValidDegitUrl(url: string): boolean {
  // Based on the official degit documentation, we support multiple formats.
  const patterns = [
    // user/repo
    // git.sr.ht/user/repo
    /^[\w-]+\/[\w-./]+(?:#.+)?$/,
    // github:user/repo, gitlab:user/repo, bitbucket:user/repo
    /^(github|gitlab|bitbucket):[\w-]+\/[\w-./]+(?:#.+)?$/,
    // git@provider.com:user/repo
    /^git@(github\.com|gitlab\.com|bitbucket\.org|git\.sr\.ht):[\w-]+\/[\w-./]+(?:#.+)?$/,
    // https://provider.com/user/repo
    /^https:\/\/(github\.com|gitlab\.com|bitbucket\.org|git\.sr\.ht)\/[\w-]+\/[\w-./]+(?:#.+)?$/,
  ];

  const isValid = patterns.some(pattern => pattern.test(url));

  if (!isValid) {
    console.error(chalk.red(`Invalid template URL: "${url}". Please use a valid degit format.`));
    console.log(chalk.cyan("Examples: 'user/repo', 'github:user/repo', 'https://github.com/user/repo'"));
    return false;
  }

  return true;
}

/**
 * 添加一个新模板到用户模板文件
 */
export async function addTemplate(name: string, url: string, onError: (message: string) => void = (message) => { console.error(chalk.red(message)); process.exit(1); }) {
  if (!isValidTemplateName(name) || !isValidDegitUrl(url)) {
    // The validation functions already log the specific error.
    onError('Validation failed.');
    return;
  }

  await ensureUserTemplatesFile();
  try {
    const userTemplates = await fs.readJson(userTemplatesPath) as Templates;
    if (userTemplates[name]) {
      console.log(chalk.yellow(`Template "${name}" already exists. It will be overwritten.`));
    }
    userTemplates[name] = url;
    await fs.writeJson(userTemplatesPath, userTemplates, { spaces: 2 });
    console.log(chalk.green(`Template "${name}" added successfully!`));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unknown error occurred.';
    onError(`Failed to add template: ${message}`);
  }
}

/**
 * 从用户模板文件中删除一个模板
 */
export async function deleteTemplate(name: string, onError: (message: string) => void = (message) => { console.error(chalk.red(message)); process.exit(1); }) {
  if (!isValidTemplateName(name)) {
    onError('Validation failed.');
    return;
  }

  await ensureUserTemplatesFile();
  try {
    // 检查是否为默认模板
    if (defaultTemplates.hasOwnProperty(name)) {
      console.log(chalk.red(`Cannot delete default template "${name}".`));
      return;
    }

    const userTemplates = await fs.readJson(userTemplatesPath) as Templates;
    if (!userTemplates[name]) {
      console.log(chalk.yellow(`Template "${name}" not found in user templates.`));
      return;
    }

    delete userTemplates[name];
    await fs.writeJson(userTemplatesPath, userTemplates, { spaces: 2 });
    console.log(chalk.green(`Template "${name}" deleted successfully!`));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unknown error occurred.';
    onError(`Failed to delete template: ${message}`);
  }
}