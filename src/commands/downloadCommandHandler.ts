import * as fs from 'fs';
import * as path from 'path';
import { t } from '../utils/i18n';
import { CommandResult } from './slashCommandHandler';
import { buildDownloadBrowserUI } from '../ui/downloadUi';

export class DownloadCommandHandler {
    public handleCommand(args: string[], activeWorkspacePath?: string): CommandResult {
        if (!activeWorkspacePath) {
            return {
                success: false,
                message: t('⚠️ No active project. Please connect to a project first before downloading files.'),
            };
        }

        if (args.length > 0) {
            // Direct file download
            const filePathArg = args.join(' ');
            
            const absolutePath = path.resolve(activeWorkspacePath, filePathArg);

            // Double check it's still within workspace
            if (!absolutePath.startsWith(activeWorkspacePath)) {
                return {
                    success: false,
                    message: t('⚠️ Access denied: path is outside the active workspace.'),
                };
            }

            if (!fs.existsSync(absolutePath)) {
                return {
                    success: false,
                    message: t(`⚠️ File not found: ${filePathArg}`),
                };
            }

            const stat = fs.statSync(absolutePath);
            if (stat.isDirectory()) {
                // If it's a directory, return UI for it instead of trying to download
                const relPath = path.relative(activeWorkspacePath, absolutePath);
                const uiPayload = buildDownloadBrowserUI(activeWorkspacePath, relPath, 0);
                return {
                    success: true,
                    message: '',
                    uiPayload
                };
            }

            return {
                success: true,
                message: t(`📤 Sending file: ${path.basename(absolutePath)}`),
                documentPath: absolutePath
            };
        } else {
            // Browse files
            const uiPayload = buildDownloadBrowserUI(activeWorkspacePath, '', 0);
            return {
                success: true,
                message: '',
                uiPayload
            };
        }
    }
}
