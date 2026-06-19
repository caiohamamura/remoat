import { InlineKeyboard } from 'grammy';
import { escapeHtml } from '../utils/telegramFormatter';

export const CLAUDE_WD_SELECT_ID = 'claude_wd_sel';
export const CLAUDE_WD_NAV_PREFIX = 'cwd_nav';
export const CLAUDE_WD_PAGE_PREFIX = 'cwd_pg';
export const CLAUDE_WD_ERR = 'cwd_err';

const ITEMS_PER_PAGE = 10;

export function buildClaudeWdUI(
    workspaces: string[],
    page: number = 0,
    currentPath: string = '',
): { text: string; keyboard: InlineKeyboard } {
    const totalPages = Math.max(1, Math.ceil(workspaces.length / ITEMS_PER_PAGE));
    const safePage = Math.max(0, Math.min(page, totalPages - 1));

    const pathHeader = currentPath ? `📁 <b>/${escapeHtml(currentPath)}</b>` : `📁 <b>Root</b>`;
    let text = `<b>🔧 Claude-Remote Working Directory</b>\n\n` +
        `Current path: ${pathHeader}\n` +
        `Select a subdirectory to navigate into it, or click <b>Select Current</b> to set this as the claude-remote working directory.\n\n`;

    if (workspaces.length === 0) {
        text += `<i>(No subdirectories found here)</i>`;
    } else {
        const start = safePage * ITEMS_PER_PAGE;
        const end = Math.min(start + ITEMS_PER_PAGE, workspaces.length);
        const pageItems = workspaces.slice(start, end);

        const lines = pageItems.map((ws, i) =>
            `${start + i + 1}. 📁 ${escapeHtml(ws)}`,
        );
        text += lines.join('\n');

        if (totalPages > 1) {
            text += `\n\n<i>Page ${safePage + 1} / ${totalPages} (${workspaces.length} folders total)</i>`;
        }
    }

    const keyboard = new InlineKeyboard();

    // 1. Select Current Directory button (if currentPath is not empty)
    if (currentPath) {
        keyboard.text(
            `✅ Select Current: /${currentPath.length > 20 ? '...' + currentPath.slice(-17) : currentPath}`,
            `${CLAUDE_WD_SELECT_ID}:${currentPath}`,
        ).row();
    }

    // 2. Navigation List
    if (workspaces.length > 0) {
        const start = safePage * ITEMS_PER_PAGE;
        const end = Math.min(start + ITEMS_PER_PAGE, workspaces.length);
        const pageItems = workspaces.slice(start, end);

        for (const ws of pageItems) {
            const nextPath = currentPath ? `${currentPath}/${ws}` : ws;
            const callbackData = `${CLAUDE_WD_NAV_PREFIX}:${nextPath}`;
            if (callbackData.length <= 64) {
                const label = `📁 ${ws.length > 35 ? ws.substring(0, 32) + '...' : ws}`;
                keyboard.text(label, callbackData).row();
            } else {
                const label = `📁 [Too deep] ${ws.substring(0, 15)}`;
                keyboard.text(label, CLAUDE_WD_ERR).row();
            }
        }
    }

    // 3. Pagination & Back buttons
    const navRow: { text: string; data: string }[] = [];

    // Parent folder button
    if (currentPath) {
        const parts = currentPath.split('/');
        parts.pop();
        const parentPath = parts.join('/');
        navRow.push({ text: '⬆️ Up', data: `${CLAUDE_WD_NAV_PREFIX}:${parentPath}` });
    }

    if (totalPages > 1) {
        if (safePage > 0) {
            navRow.push({ text: '◀ Prev', data: `${CLAUDE_WD_PAGE_PREFIX}:${safePage - 1}:${currentPath}` });
        }
        if (safePage < totalPages - 1) {
            navRow.push({ text: 'Next ▶', data: `${CLAUDE_WD_PAGE_PREFIX}:${safePage + 1}:${currentPath}` });
        }
    }

    if (navRow.length > 0) {
        for (const btn of navRow) {
            keyboard.text(btn.text, btn.data);
        }
        keyboard.row();
    }

    return { text, keyboard };
}
