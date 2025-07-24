import os from "node:os";
import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import defaultTemplates from "./default-templates.json";

// 定义模板对象的类型
export type Templates = {
	[key: string]: string;
};

// 用户配置目录
// 允许为了 E2E 测试覆盖 home 目录
const homeDir = process.env.G_CLI_TEST_HOME_DIR || os.homedir();
const configDir = path.join(homeDir, ".g-cli");
// 用户模板文件路径
export const userTemplatesPath = path.join(configDir, "user-templates.json");

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
		const message = err instanceof Error ? err.message : "发生未知错误。";
		console.error(chalk.red("创建用户模板文件失败:"), message);
		process.exit(1);
	}
}

/**
 * 获取所有模板（合并默认模板和用户模板）
 */
export async function getAllTemplates(): Promise<Templates> {
	await ensureUserTemplatesFile();
	try {
		const userTemplates = (await fs.readJson(userTemplatesPath)) as Templates;
		// 合并模板，用户模板的优先级更高
		return { ...defaultTemplates, ...userTemplates };
	} catch (err) {
		const message = err instanceof Error ? err.message : "发生未知错误。";
		console.error(chalk.red("读取模板文件失败:"), message);
		return defaultTemplates; // 出错时回退到默认模板
	}
}

/**
 * 校验模板名称是否合法
 * @param name The name to validate
 */
function isValidTemplateName(name: string): boolean {
	if (!name.trim()) {
		console.error(chalk.red("模板名称不能为空！"));
		return false;
	}
	if (!/^[a-z0-9-]+$/.test(name)) {
		console.error(chalk.red("模板名称只能包含小写字母、数字和连字符！"));
		return false;
	}
	return true;
}

/**
 * 校验 URL 是否是合法的 degit 地址
 * @param url The URL to validate
 */
function isValidDegitUrl(url: string): boolean {
	// 基于 degit 官方文档，我们支持多种格式。
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

	const isValid = patterns.some((pattern) => pattern.test(url));

	if (!isValid) {
		console.error(
			chalk.red(`无效的模板 URL: "${url}"。请使用有效的 degit 格式。`),
		);
		console.log(
			chalk.cyan(
				"例如: 'user/repo', 'github:user/repo', 'https://github.com/user/repo'",
			),
		);
		return false;
	}

	return true;
}

/**
 * 添加一个新模板到用户模板文件
 */
export async function addTemplate(
	name: string,
	url: string,
	onError: (message: string) => void = (message) => {
		console.error(chalk.red(message));
		process.exit(1);
	},
) {
	if (!isValidTemplateName(name) || !isValidDegitUrl(url)) {
		// 校验函数已经打印了具体的错误。
		onError("校验失败。");
		return;
	}

	await ensureUserTemplatesFile();
	try {
		const userTemplates = (await fs.readJson(userTemplatesPath)) as Templates;
		if (userTemplates[name]) {
			console.log(chalk.yellow(`模板 "${name}" 已存在。它将被覆盖。`));
		}
		userTemplates[name] = url;
		await fs.writeJson(userTemplatesPath, userTemplates, { spaces: 2 });
		console.log(chalk.green(`模板 "${name}" 添加成功！`));
	} catch (err) {
		const message = err instanceof Error ? err.message : "发生未知错误。";
		onError(`添加模板失败: ${message}`);
	}
}

/**
 * 从用户模板文件中删除一个模板
 */
export async function deleteTemplate(
	name: string,
	onError: (message: string) => void = (message) => {
		console.error(chalk.red(message));
		process.exit(1);
	},
) {
	if (!isValidTemplateName(name)) {
		onError("校验失败。");
		return;
	}

	await ensureUserTemplatesFile();
	try {
		// 检查是否为默认模板
		if (Object.hasOwn(defaultTemplates, name)) {
			console.log(chalk.red(`不能删除默认模板 "${name}"。`));
			return;
		}

		const userTemplates = (await fs.readJson(userTemplatesPath)) as Templates;
		if (!userTemplates[name]) {
			console.log(chalk.yellow(`在用户模板中未找到模板 "${name}"。`));
			return;
		}

		delete userTemplates[name];
		await fs.writeJson(userTemplatesPath, userTemplates, { spaces: 2 });
		console.log(chalk.green(`模板 "${name}" 删除成功！`));
	} catch (err) {
		const message = err instanceof Error ? err.message : "发生未知错误。";
		onError(`删除模板失败: ${message}`);
	}
}
