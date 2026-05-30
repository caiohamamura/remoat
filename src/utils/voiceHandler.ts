import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { logger } from './logger';

const TEMP_VOICE_DIR = path.join(os.tmpdir(), 'remoat-voice');

const WHISPER_URL = process.env.WHISPER_URL || 'http://127.0.0.1:8765';

/**
 * Check whether Whisper transcription is available.
 * Returns null if ready, or a user-facing setup message if not.
 */
export async function checkWhisperAvailability(): Promise<string | null> {
    try {
        const response = await fetch(`${WHISPER_URL}/health`);
        if (!response.ok) {
            return `🔇 Local Whisper server health check failed (status ${response.status}).`;
        }
        return null;
    } catch (error: any) {
        return `🔇 Local Whisper server is offline (unreachable at ${WHISPER_URL}/health).\nError: ${error?.message || error}`;
    }
}

export interface TelegramVoiceInfo {
    file_id: string;
    file_unique_id: string;
    duration: number;
    mime_type?: string;
    file_size?: number;
}

/**
 * Download a voice message OGG file from the Telegram Bot API to a local temp directory.
 */
export async function downloadTelegramVoice(
    botApi: { getFile: (fileId: string) => Promise<any> },
    botToken: string,
    voice: TelegramVoiceInfo,
): Promise<string> {
    await fs.mkdir(TEMP_VOICE_DIR, { recursive: true });

    const file = await botApi.getFile(voice.file_id);
    const filePath = file.file_path;
    if (!filePath) {
        throw new Error('Telegram returned no file_path for voice message');
    }

    const url = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Voice download failed (status=${response.status})`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0) {
        throw new Error('Voice download returned empty file');
    }

    const ext = path.extname(filePath) || '.ogg';
    const localPath = path.join(TEMP_VOICE_DIR, `${Date.now()}-${voice.file_unique_id}${ext}`);
    await fs.writeFile(localPath, bytes);

    logger.info(`[VoiceHandler] Downloaded voice message to ${localPath} (${bytes.length} bytes)`);
    return localPath;
}

/**
 * Transcribe a voice file using the local Whisper server HTTP API.
 * Returns the trimmed transcript string, or null if transcription fails.
 */
export async function transcribeVoice(voicePath: string): Promise<string | null> {
    try {
        const fileData = await fs.readFile(voicePath);
        const formData = new (globalThis as any).FormData();
        const fileBlob = new (globalThis as any).Blob([fileData], { type: 'audio/ogg' });
        formData.append('file', fileBlob, path.basename(voicePath));

        const response = await fetch(`${WHISPER_URL}/transcribe`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Whisper server returned status ${response.status}: ${errText}`);
        }

        const data = await response.json() as { text: string };
        const transcript = (data.text || '').trim();

        if (!transcript) {
            logger.warn('[VoiceHandler] Whisper server returned empty transcript');
            return null;
        }

        logger.info(`[VoiceHandler] Transcribed: "${transcript.slice(0, 100)}${transcript.length > 100 ? '...' : ''}"`);
        return transcript;
    } catch (error: any) {
        logger.error('[VoiceHandler] Transcription failed:', error?.message || error);
        return null;
    } finally {
        // Clean up the original voice file
        await fs.unlink(voicePath).catch(() => {});
    }
}
