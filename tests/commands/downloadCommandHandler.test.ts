import fs from 'fs';
import path from 'path';
import { DownloadCommandHandler } from '../../src/commands/downloadCommandHandler';
import { DL_FILE_PREFIX, DL_NAV_PREFIX } from '../../src/ui/downloadUi';

describe('DownloadCommandHandler', () => {
    let handler: DownloadCommandHandler;
    const testWorkspace = path.resolve(__dirname, '../__fixtures__/workspace_download');

    beforeAll(() => {
        // Setup a dummy workspace structure
        if (!fs.existsSync(testWorkspace)) {
            fs.mkdirSync(testWorkspace, { recursive: true });
        }
        fs.writeFileSync(path.join(testWorkspace, 'testfile.txt'), 'hello world');
        const subDir = path.join(testWorkspace, 'subdir');
        if (!fs.existsSync(subDir)) {
            fs.mkdirSync(subDir);
        }
        fs.writeFileSync(path.join(subDir, 'subfile.txt'), 'hello from subdir');
    });

    afterAll(() => {
        // Cleanup dummy workspace
        if (fs.existsSync(testWorkspace)) {
            fs.rmSync(testWorkspace, { recursive: true, force: true });
        }
    });

    beforeEach(() => {
        handler = new DownloadCommandHandler();
    });

    it('returns error if no active workspace', () => {
        const result = handler.handleCommand(['file.txt'], undefined);
        expect(result.success).toBe(false);
        expect(result.message).toMatch(/No active project/);
    });

    it('returns ui payload for browsing when no arguments provided', () => {
        const result = handler.handleCommand([], testWorkspace);
        expect(result.success).toBe(true);
        expect(result.uiPayload).toBeDefined();
        
        // Assert the keyboard contains testfile.txt and subdir
        const jsonString = JSON.stringify(result.uiPayload?.keyboard);
        expect(jsonString).toContain(`"${DL_FILE_PREFIX}:testfile.txt"`);
        expect(jsonString).toContain(`"${DL_NAV_PREFIX}:subdir"`);
    });

    it('returns documentPath for a valid file', () => {
        const result = handler.handleCommand(['testfile.txt'], testWorkspace);
        expect(result.success).toBe(true);
        expect(result.documentPath).toBe(path.join(testWorkspace, 'testfile.txt'));
        expect(result.message).toMatch(/Sending file/);
    });

    it('returns ui payload if path is a directory', () => {
        const result = handler.handleCommand(['subdir'], testWorkspace);
        expect(result.success).toBe(true);
        expect(result.documentPath).toBeUndefined();
        expect(result.uiPayload).toBeDefined();
        
        const jsonString = JSON.stringify(result.uiPayload?.keyboard);
        expect(jsonString).toContain(`"${DL_FILE_PREFIX}:subdir/subfile.txt"`);
    });

    it('prevents directory traversal attacks', () => {
        const result = handler.handleCommand(['../downloadCommandHandler.test.ts'], testWorkspace);
        expect(result.success).toBe(false);
        expect(result.message).toMatch(/Access denied: path is outside the active workspace/);
    });

    it('returns error for non-existent file', () => {
        const result = handler.handleCommand(['missing.txt'], testWorkspace);
        expect(result.success).toBe(false);
        expect(result.message).toMatch(/File not found/);
    });
});
