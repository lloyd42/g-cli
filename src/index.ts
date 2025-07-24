#!/usr/bin/env node

import { exec } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import degit from "degit";
import inquirer from "inquirer";
import ora from "ora";
import {
	addTemplate,
	deleteTemplate,
	getAllTemplates,
	userTemplatesPath,
} from "./templates";

/**
 * 替换模板中的项目名称（如 package.json 的 name 字段）
 */
async function updateProjectName(projectPath: string, projectName: string) {
	const packageJsonPath = path.join(projectPath, "package.json");

	try {
		// 读取 package.json
		const data = await fsPromises.readFile(packageJsonPath, "utf-8");
		const packageJson = JSON.parse(data);

		// 更新字段
		packageJson.name = projectName;

		// 写回文件
		await fsPromises.writeFile(
			packageJsonPath,
			JSON.stringify(packageJson, null, 2),
			"utf-8",
		);
	} catch (_err) {
		console.log(chalk.yellow("警告：更新 package.json 名称失败。"));
	}
}

const program = new Command();

program
	.name("my-cli")
	.description("一个用于从模板创建前端项目的简单CLI。")
	.version("1.0.0");

// 定义模板仓库信息

program
	.command("create")
	.description("从模板创建一个新项目")
	.action(async () => {
		const templates = await getAllTemplates();
		const templateChoices = Object.keys(templates);

		// 1. 提问环节
		const { projectName, framework } = await inquirer.prompt<{
			projectName: string;
			framework: keyof typeof templates;
		}>([
			{
				type: "input",
				name: "projectName",
				message: "项目名称:",
				default: "my-app", // 默认值
				validate: (input: string) => {
					if (!input.trim()) return "项目名称不能为空！";
					if (!/^[a-z0-9-]+$/.test(input)) {
						return "只允许使用小写字母、数字和连字符！";
					}
					return true;
				},
			},
			{
				type: "list",
				name: "framework",
				message: "请选择要使用的项目模板",
				choices: templateChoices,
			},
		]);

		const targetPath = path.resolve(process.cwd(), projectName);

		// 2. 检查目录是否已存在
		if (existsSync(targetPath)) {
			const { overwrite } = await inquirer.prompt([
				{
					type: "confirm",
					name: "overwrite",
					message: `目录 "${projectName}" 已存在。是否覆盖？`,
					default: false,
				},
			]);
			if (!overwrite) {
				console.log(chalk.yellow("操作已取消。"));
				process.exit(1);
			}
			// 删除旧目录
			rmSync(targetPath, { recursive: true, force: true });
		}

		// 3. 下载模板（使用 degit）
		const spinner = ora("正在下载模板...").start();
		const emitter = degit(templates[framework], {
			force: true, // 覆盖目标目录
			verbose: true, // 打印更多日志
		});

		emitter.on("info", (info) => {
			console.log(chalk.blue(info.message));
		});

		try {
			await emitter.clone(targetPath);
			spinner.succeed(chalk.green("模板下载成功！"));

			// 4. 动态替换项目名称（如 package.json）
			await updateProjectName(targetPath, projectName);

			// 5. 完成提示
			console.log(
				chalk.green(`\n成功！项目 ${projectName} 已创建在 ${targetPath}`),
			);

			// 6. 询问是否安装依赖
			const { install } = await inquirer.prompt([
				{
					type: "confirm",
					name: "install",
					message: "是否立即安装依赖？",
					default: true,
				},
			]);

			if (install) {
				const installSpinner = ora("正在安装依赖...").start();
				try {
					// 使用 Promise 包装 exec，以便在异步流程中正确处理其回调
					await new Promise((resolve, reject) => {
						exec(
							"npm install",
							{ cwd: targetPath },
							(error, stdout, _stderr) => {
								if (error) {
									reject(error);
									return;
								}
								resolve(stdout);
							},
						);
					});
					installSpinner.succeed(chalk.green("依赖安装成功！"));
					console.log(chalk.cyan("\n后续步骤:"));
					console.log(chalk.cyan(`  cd ${projectName}`));
					console.log(chalk.cyan("  npm run dev\n"));

					// 7. 询问是否初始化 Git 仓库
					const { initGit } = await inquirer.prompt([
						{
							type: "confirm",
							name: "initGit",
							message: "是否初始化Git仓库？",
							default: true,
						},
					]);

					if (initGit) {
						const gitSpinner = ora("正在初始化Git仓库...").start();
						try {
							// 链式执行 git 命令
							await new Promise((resolve, reject) => {
								exec(
									'git init && git add . && git commit -m "Initial commit"',
									{ cwd: targetPath },
									(error, stdout, _stderr) => {
										if (error) {
											reject(error);
											return;
										}
										resolve(stdout);
									},
								);
							});
							gitSpinner.succeed(chalk.green("Git仓库初始化成功！"));
						} catch (gitErr) {
							gitSpinner.fail(chalk.red("初始化Git仓库失败。"));
							console.error(chalk.red(gitErr));
						}
					}
				} catch (installErr) {
					installSpinner.fail(chalk.red("依赖安装失败。"));
					console.error(chalk.red(installErr));
					console.log(chalk.cyan("\n请手动安装依赖。"));
				}
			} else {
				console.log(chalk.cyan("\n后续步骤:"));
				console.log(chalk.cyan(`  cd ${projectName}`));
				console.log(chalk.cyan("  npm install"));
				console.log(chalk.cyan("  npm run dev\n"));
			}
		} catch (err) {
			spinner.fail(chalk.red("模板下载失败。"));
			if (err instanceof Error) {
				console.error(chalk.red(err.message));
			} else {
				console.error(chalk.red("发生未知错误。"));
			}
			process.exit(1);
		}
	});

program
	.command("list")
	.alias("ls")
	.description("列出所有可用的模板")
	.action(async () => {
		const templates = await getAllTemplates();
		console.log(chalk.bold.cyan("可用模板:"));
		Object.entries(templates).forEach(([name, url]) => {
			// 手动构造字符串以确保输出一致，尤其是在非终端环境中
			const namePart = chalk.green(name);
			const urlPart = chalk.gray(url);
			console.log(`  ${namePart}: ${urlPart}`);
		});
	});

program
	.command("add <name> <url>")
	.description("添加一个新模板")
	.action((name, url) => {
		addTemplate(name, url);
	});

program
	.command("delete <name>")
	.alias("rm")
	.description("删除一个模板")
	.action((name) => {
		deleteTemplate(name);
	});

program
	.command("config")
	.description("显示用户模板配置文件的路径")
	.action(() => {
		console.log(chalk.bold.cyan("用户模板文件路径:"));
		console.log(userTemplatesPath);
	});

program.parse(process.argv);
