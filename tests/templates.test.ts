import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import { getAllTemplates, addTemplate, deleteTemplate, userTemplatesPath } from '../src/templates';
import defaultTemplates from '../src/default-templates.json';

// 使用 Vitest 模拟 fs-extra
vi.mock('fs-extra');

describe('使用 Vitest 进行模板管理', () => {
  beforeEach(() => {
    // 在每个测试前重置模拟
    vi.clearAllMocks();
    // 监视 console 方法并在每个测试后恢复它们
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAllTemplates', () => {
    it('当用户模板存在时，应返回合并后的模板', async () => {
      // 模拟用户模板，使其包含一个自定义模板
      const userTemplates = { 'my-template': 'user/repo' };
      vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readJson).mockResolvedValue(userTemplates);

      // 调用函数并断言结果是默认模板和用户模板的合并
      const templates = await getAllTemplates();
      expect(templates).toEqual({ ...defaultTemplates, ...userTemplates });
    });

    it('如果用户模板文件不存在，则应创建它', async () => {
      // 模拟文件系统，表明用户模板文件尚不存在
      vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeJson).mockResolvedValue(undefined);
      vi.mocked(fs.readJson).mockResolvedValue({});

      // 调用函数以触发文件创建逻辑
      await getAllTemplates();

      // 验证是否已尝试创建目录和空的 JSON 文件
      expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('.g-cli'));
      expect(fs.writeJson).toHaveBeenCalledWith(userTemplatesPath, {});
    });
  });

  describe('addTemplate', () => {
    it('应该向用户模板添加一个新模板', async () => {
      // 模拟一个空的用户模板文件
      vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
      vi.mocked(fs.readJson).mockResolvedValue({});
      vi.mocked(fs.writeJson).mockResolvedValue(undefined);

      // 添加一个新模板
      await addTemplate('new-template', 'user/new-repo');
      
      // 验证模板是否已正确写入文件
      expect(fs.writeJson).toHaveBeenCalledWith(userTemplatesPath, { 'new-template': 'user/new-repo' }, { spaces: 2 });
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('添加成功！'));
    });

    it('不应添加名称无效的模板', async () => {
      const onError = vi.fn(); // 定义错误处理函数
      vi.mocked(fs.existsSync).mockReturnValue(false); // 模拟文件不存在
      // 尝试使用无效名称添加模板
      await addTemplate('InvalidName', 'user/repo', onError);
      // 验证写操作未被调用，并且错误处理函数被触发
      expect(fs.writeJson).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith('校验失败。');
    });

    it('不应添加 URL 无效的模板', async () => {
      const onError = vi.fn();
      // 尝试使用无效 URL 添加模板
      await addTemplate('valid-name', 'invalid-url', onError);
      // 验证写操作未被调用，并且错误处理函数被触发
      expect(fs.writeJson).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith('校验失败。');
    });

    it('应该覆盖现有模板并记录警告', async () => {
      // 模拟一个已包含同名模板的用户模板文件
      const existingTemplates = { 'my-template': 'user/repo' };
      vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
      vi.mocked(fs.readJson).mockResolvedValue(existingTemplates);
      vi.mocked(fs.writeJson).mockResolvedValue(undefined);

      // 尝试使用新 URL 再次添加相同的模板
      await addTemplate('my-template', 'user/new-repo');

      // 验证是否记录了覆盖警告，并且文件已使用新 URL 更新
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('已存在。它将被覆盖。'));
      expect(fs.writeJson).toHaveBeenCalledWith(userTemplatesPath, { 'my-template': 'user/new-repo' }, { spaces: 2 });
    });
  });

  describe('deleteTemplate', () => {
    it('应该删除一个现有的用户模板', async () => {
      // 模拟一个包含待删除模板的用户模板文件
      const userTemplates = { 'my-template': 'user/repo' };
      vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
      vi.mocked(fs.readJson).mockResolvedValue(userTemplates);
      vi.mocked(fs.writeJson).mockResolvedValue(undefined);

      // 删除模板
      await deleteTemplate('my-template');

      // 验证文件是否已在移除模板后被写入
      expect(fs.writeJson).toHaveBeenCalledWith(userTemplatesPath, {}, { spaces: 2 });
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('删除成功！'));
    });

    it('不应删除默认模板', async () => {
      const onError = vi.fn(); // 定义错误处理函数
      vi.mocked(fs.existsSync).mockReturnValue(true); // 模拟文件存在

      // 尝试删除一个默认模板
      await deleteTemplate('react', onError);

      // 验证写操作未被调用，并且记录了正确的日志消息
      expect(fs.writeJson).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled(); // 确保该方法被调用
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('不能删除默认模板 "react"。'));
      expect(onError).not.toHaveBeenCalled();
    });

    it('不应删除不存在的用户模板', async () => {
      // 模拟一个不包含目标模板的用户模板文件
      const userTemplates = { 'another-template': 'user/repo' };
      vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
      vi.mocked(fs.readJson).mockResolvedValue(userTemplates);
      vi.mocked(fs.existsSync).mockReturnValue(true);

      // 尝试删除一个不存在的模板
      await deleteTemplate('my-template');

      // 验证写操作未被调用，并且记录了相应的警告
      expect(fs.writeJson).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('在用户模板中未找到模板'));
    });

    it('不应删除名称无效的模板', async () => {
      const onError = vi.fn();
      // 尝试使用无效名称删除模板
      await deleteTemplate('InvalidName', onError);
      // 验证写操作未被调用，并且错误处理函数被触发
      expect(fs.writeJson).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith('校验失败。');
    });
  });
});