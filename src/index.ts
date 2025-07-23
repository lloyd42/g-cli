#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import degit from 'degit';
import ora from 'ora';
import chalk from 'chalk';
import path from 'path';
import fsPromises from 'fs/promises';
import { existsSync, rmSync } from 'fs';
import { exec } from 'child_process';
import { getAllTemplates, addTemplate, deleteTemplate, userTemplatesPath } from './templates';

/**
 * 替换模板中的项目名称（如 package.json 的 name 字段）
 */
async function updateProjectName(projectPath: string, projectName: string) {
  const packageJsonPath = path.join(projectPath, 'package.json');

  try {
    // 读取 package.json
    const data = await fsPromises.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(data);

    // 更新字段
    packageJson.name = projectName;

    // 写回文件
    await fsPromises.writeFile(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.log(chalk.yellow('Warning: Failed to update package.json name.'));
  }
}

const program = new Command();

program
  .name('my-cli')
  .description('A simple CLI for creating front-end projects from templates.')
  .version('1.0.0');

// 定义模板仓库信息

program
  .command('create')
  .description('Create a new project from a template')
  .action(async () => {
    const templates = await getAllTemplates();
    const templateChoices = Object.keys(templates);

    // 1. 提问环节
    const { projectName, framework } = await inquirer.prompt<{
      projectName: string;
      framework: keyof typeof templates;
    }>([
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        default: 'my-app', // 默认值
        validate: (input: string) => {
          if (!input.trim()) return 'Project name cannot be empty!';
          if (!/^[a-z0-9-]+$/.test(input)) {
            return 'Only lowercase letters, numbers, and hyphens are allowed!';
          }
          return true;
        },
      },
      {
        type: 'list',
        name: 'framework',
        message: 'Please choose which project template to use',
        choices: templateChoices,
      },
    ]);


    const targetPath = path.resolve(process.cwd(), projectName);

    // 2. 检查目录是否已存在
    if (existsSync(targetPath)) {
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: `Directory "${projectName}" already exists. Overwrite?`,
          default: false,
        },
      ]);
      if (!overwrite) {
        console.log(chalk.yellow('Operation cancelled.'));
        process.exit(1);
      }
      // 删除旧目录
      rmSync(targetPath, { recursive: true, force: true });
    }

    // 3. 3. 下载模板（使用 degit）
    const spinner = ora('Downloading template...').start();
    const emitter = degit(templates[framework], {
      force: true, // 覆盖目标目录
      verbose: true, // 打印更多日志
    });

    emitter.on('info', (info) => {
      console.log(chalk.blue(info.message));
    });

    try {
      await emitter.clone(targetPath);
      spinner.succeed(chalk.green('Template downloaded successfully!'));

      // 4. 动态替换项目名称（如 package.json）
      await updateProjectName(targetPath, projectName);

      // 5. 完成提示
      console.log(chalk.green(`\nSuccess! Created ${projectName} at ${targetPath}`));
      console.log(chalk.green(`\nSuccess! Created ${projectName} at ${targetPath}`));

      // 6. 询问是否安装依赖
      const { install } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'install',
          message: 'Do you want to install dependencies now?',
          default: true,
        },
      ]);

      if (install) {
        const installSpinner = ora('Installing dependencies...').start();
        try {
          await new Promise((resolve, reject) => {
            exec('npm install', { cwd: targetPath }, (error, stdout, stderr) => {
              if (error) {
                reject(error);
                return;
              }
              resolve(stdout);
            });
          });
          installSpinner.succeed(chalk.green('Dependencies installed successfully!'));
          console.log(chalk.cyan('\nNext steps:'));
          console.log(chalk.cyan(`  cd ${projectName}`));
          console.log(chalk.cyan('  npm run dev\n'));

          // 7. 询问是否初始化 Git 仓库
          const { initGit } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'initGit',
              message: 'Do you want to initialize a Git repository?',
              default: true,
            },
          ]);

          if (initGit) {
            const gitSpinner = ora('Initializing Git repository...').start();
            try {
              await new Promise((resolve, reject) => {
                exec('git init && git add . && git commit -m "Initial commit"', { cwd: targetPath }, (error, stdout, stderr) => {
                  if (error) {
                    reject(error);
                    return;
                  }
                  resolve(stdout);
                });
              });
              gitSpinner.succeed(chalk.green('Git repository initialized successfully!'));
            } catch (gitErr) {
              gitSpinner.fail(chalk.red('Failed to initialize Git repository.'));
              console.error(chalk.red(gitErr));
            }
          }
        } catch (installErr) {
          installSpinner.fail(chalk.red('Failed to install dependencies.'));
          console.error(chalk.red(installErr));
          console.log(chalk.cyan('\nPlease install dependencies manually.'));
        }
      } else {
        console.log(chalk.cyan('\nNext steps:'));
        console.log(chalk.cyan(`  cd ${projectName}`));
        console.log(chalk.cyan('  npm install'));
        console.log(chalk.cyan('  npm run dev\n'));
      }
    } catch (err) {
      spinner.fail(chalk.red('Failed to download template.'));
      if (err instanceof Error) {
        console.error(chalk.red(err.message));
      } else {
        console.error(chalk.red('An unknown error occurred.'));
      }
      process.exit(1);
    }
  });

program
  .command('list')
  .alias('ls')
  .description('List all available templates')
  .action(async () => {
    const templates = await getAllTemplates();
    console.log(chalk.bold.cyan('Available templates:'));
    Object.entries(templates).forEach(([name, url]) => {
      console.log(`  ${chalk.green(name)}: ${chalk.gray(url)}`);
    });
  });

program
  .command('add <name> <url>')
  .description('Add a new template')
  .action((name, url) => {
    addTemplate(name, url);
  });

program
  .command('delete <name>')
  .alias('rm')
  .description('Delete a template')
  .action((name) => {
    deleteTemplate(name);
  });

program
    .command('config')
    .description('Show the path to the user templates configuration file')
    .action(() => {
        console.log(chalk.bold.cyan('User templates file path:'));
        console.log(userTemplatesPath);
    });

program.parse(process.argv);
