import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import { getAllTemplates, addTemplate, deleteTemplate, userTemplatesPath } from '../src/templates';
import defaultTemplates from '../src/default-templates.json';

// Mock fs-extra using Vitest
vi.mock('fs-extra');

describe('Template Management with Vitest', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    // Spy on console methods and restore them after each test
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAllTemplates', () => {
    it('should return merged templates when user templates exist', async () => {
      const userTemplates = { 'my-template': 'user/repo' };
      vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readJson).mockResolvedValue(userTemplates);

      const templates = await getAllTemplates();
      expect(templates).toEqual({ ...defaultTemplates, ...userTemplates });
    });

    it('should create user templates file if it does not exist', async () => {
      vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeJson).mockResolvedValue(undefined);
      vi.mocked(fs.readJson).mockResolvedValue({});

      await getAllTemplates();

      expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('.g-cli'));
      expect(fs.writeJson).toHaveBeenCalledWith(userTemplatesPath, {});
    });
  });

  describe('addTemplate', () => {
    it('should add a new template to user templates', async () => {
      vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
      vi.mocked(fs.readJson).mockResolvedValue({});
      vi.mocked(fs.writeJson).mockResolvedValue(undefined);

      await addTemplate('new-template', 'user/new-repo');
      
      expect(fs.writeJson).toHaveBeenCalledWith(userTemplatesPath, { 'new-template': 'user/new-repo' }, { spaces: 2 });
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('added successfully!'));
    });

    it('should not add template with invalid name', async () => {
      const onError = vi.fn(); // 定义错误处理函数
      vi.mocked(fs.existsSync).mockReturnValue(false); // 让它返回false，模拟不能删除默认模板的情况
      await addTemplate('InvalidName', 'user/repo', onError);
      expect(fs.writeJson).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith('Validation failed.');
    });

    it('should not add template with invalid URL', async () => {
      const onError = vi.fn();
      await addTemplate('valid-name', 'invalid-url', onError);
      expect(fs.writeJson).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith('Validation failed.');
    });

    it('should overwrite an existing template and log a warning', async () => {
      const existingTemplates = { 'my-template': 'user/repo' };
      vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
      vi.mocked(fs.readJson).mockResolvedValue(existingTemplates);
      vi.mocked(fs.writeJson).mockResolvedValue(undefined);

      await addTemplate('my-template', 'user/new-repo');

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('already exists. It will be overwritten.'));
      expect(fs.writeJson).toHaveBeenCalledWith(userTemplatesPath, { 'my-template': 'user/new-repo' }, { spaces: 2 });
    });
  });

  describe('deleteTemplate', () => {
    it('should delete an existing user template', async () => {
      const userTemplates = { 'my-template': 'user/repo' };
      vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
      vi.mocked(fs.readJson).mockResolvedValue(userTemplates);
      vi.mocked(fs.writeJson).mockResolvedValue(undefined);

      await deleteTemplate('my-template');

      expect(fs.writeJson).toHaveBeenCalledWith(userTemplatesPath, {}, { spaces: 2 });
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('deleted successfully!'));
    });

    it('should not delete a default template', async () => {
      const onError = vi.fn(); // 定义错误处理函数
      vi.mocked(fs.existsSync).mockReturnValue(true); // 让它返回true，模拟用户模板文件已经存在的情况

      await deleteTemplate('react', onError);

      expect(fs.writeJson).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled(); // 确保该方法被调用
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Cannot delete default template "react".'));
      expect(onError).not.toHaveBeenCalled();
    });

    it('should not delete a non-existent user template', async () => {
      const userTemplates = { 'another-template': 'user/repo' };
      vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
      vi.mocked(fs.readJson).mockResolvedValue(userTemplates);
      vi.mocked(fs.existsSync).mockReturnValue(true);

      await deleteTemplate('my-template');

      expect(fs.writeJson).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('not found in user templates.'));
    });

    it('should not delete a template with an invalid name', async () => {
      const onError = vi.fn();
      await deleteTemplate('InvalidName', onError);
      expect(fs.writeJson).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith('Validation failed.');
    });
  });
});