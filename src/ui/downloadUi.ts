import { InlineKeyboard } from 'grammy';
import * as fs from 'fs';
import * as path from 'path';
import { t } from '../utils/i18n';
import { escapeHtml } from '../utils/telegramFormatter';
import { logger } from '../utils/logger';

export const DL_NAV_PREFIX = 'dl_nav';
export const DL_FILE_PREFIX = 'dl_file';
export const DL_PAGE_PREFIX = 'dl_pg';
export const ITEMS_PER_PAGE = 10;

export function buildDownloadBrowserUI(
    basePath: string,
    currentRelPath: string = '',
    page: number = 0,
): { text: string; keyboard: InlineKeyboard } {
    const safeCurrentRelPath = currentRelPath ? path.normalize(currentRelPath).replace(/^(\.\.(\/|\\|$))+/, '').replace(/\\/g, '/') : '';
    const absolutePath = path.join(basePath, safeCurrentRelPath);

    let text = `<b>📥 Download File</b>\n\n`;
    const pathHeader = safeCurrentRelPath ? `📁 <b>/${escapeHtml(safeCurrentRelPath)}</b>` : `📁 <b>Root</b>`;
    text += `Current path: ${pathHeader}\nSelect a file to download, or navigate into a folder.\n\n`;

    logger.info(`[DownloadUi] buildDownloadBrowserUI: basePath=${basePath}, safeCurrentRelPath=${safeCurrentRelPath}, absolutePath=${absolutePath}`);

    const keyboard = new InlineKeyboard();

    try {
        if (!fs.existsSync(absolutePath)) {
            return {
                text: text + `<i>Error: Directory does not exist.</i>`,
                keyboard
            };
        }

        const entries = fs.readdirSync(absolutePath, { withFileTypes: true });
        
        // Sort: directories first, then files, both alphabetically
        const dirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => e.name).sort();
        const files = entries.filter(e => e.isFile() && !e.name.startsWith('.')).map(e => e.name).sort();
        const allItems = [...dirs.map(d => ({ name: d, isDir: true })), ...files.map(f => ({ name: f, isDir: false }))];

        if (allItems.length === 0) {
            text += `<i>(Empty directory)</i>`;
        } else {
            const totalPages = Math.max(1, Math.ceil(allItems.length / ITEMS_PER_PAGE));
            const safePage = Math.max(0, Math.min(page, totalPages - 1));
            const start = safePage * ITEMS_PER_PAGE;
            const end = Math.min(start + ITEMS_PER_PAGE, allItems.length);
            const pageItems = allItems.slice(start, end);

            const lines = pageItems.map((item, i) => {
                const icon = item.isDir ? '📁' : '📄';
                return `${start + i + 1}. ${icon} ${escapeHtml(item.name)}`;
            });
            text += lines.join('\n');

            if (totalPages > 1) {
                text += `\n\n<i>Page ${safePage + 1} / ${totalPages} (${allItems.length} items)</i>`;
            }

            // Add buttons for items
            for (const item of pageItems) {
                const itemRelPath = safeCurrentRelPath ? `${safeCurrentRelPath}/${item.name}` : item.name;
                const icon = item.isDir ? '📁' : '📄';
                const callbackPrefix = item.isDir ? DL_NAV_PREFIX : DL_FILE_PREFIX;
                const callbackData = `${callbackPrefix}:${itemRelPath}`;
                
                if (callbackData.length <= 64) {
                    const label = `${icon} ${item.name.length > 35 ? item.name.substring(0, 32) + '...' : item.name}`;
                    keyboard.text(label, callbackData).row();
                } else {
                    const label = `${icon} [Path too long] ${item.name.substring(0, 15)}`;
                    keyboard.text(label, `dl_err`).row();
                }
            }

            // Pagination & Back buttons
            const navRow: { text: string; data: string }[] = [];

            if (safeCurrentRelPath) {
                const parts = safeCurrentRelPath.split('/');
                parts.pop();
                const parentPath = parts.join('/');
                navRow.push({ text: '⬆️ Up', data: `${DL_NAV_PREFIX}:${parentPath}` });
            }

            if (totalPages > 1) {
                if (safePage > 0) {
                    navRow.push({ text: '◀ Prev', data: `${DL_PAGE_PREFIX}:${safePage - 1}:${safeCurrentRelPath}` });
                }
                if (safePage < totalPages - 1) {
                    navRow.push({ text: 'Next ▶', data: `${DL_PAGE_PREFIX}:${safePage + 1}:${safeCurrentRelPath}` });
                }
            }

            if (navRow.length > 0) {
                for (const btn of navRow) {
                    keyboard.text(btn.text, btn.data);
                }
                keyboard.row();
            }
        }
    } catch (err: any) {
        logger.error('[DownloadUi] Failed to read directory:', err);
        text += `<i>Error reading directory: ${escapeHtml(err.message)}</i>`;
    }

    return { text, keyboard };
}
