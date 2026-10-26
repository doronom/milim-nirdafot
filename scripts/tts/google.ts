/**
 * Google Cloud Text-to-Speech over REST. The API key comes from .env (GOOGLE_TTS_API_KEY) and is sent only in a
 * request header: it is never printed, logged, written to a file or put in a URL. Audio is generated locally and the
 * MP3s are committed, so CI never needs the key.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const API = 'https://texttospeech.googleapis.com/v1';

function apiKey(): string {
  const env = resolve(import.meta.dirname, '../../.env');
  if (existsSync(env)) process.loadEnvFile(env);
  const key = process.env.GOOGLE_TTS_API_KEY?.trim();
  if (!key) throw new Error('GOOGLE_TTS_API_KEY is missing: add it to .env at the project root (never commit it).');
  return key;
}

/** Errors carry Google's status and message only (they never contain the key). */
async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey(), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      message = ((await res.json()) as { error?: { message?: string } }).error?.message ?? message;
    } catch {
      // Keep the status text.
    }
    throw new Error(`Google TTS ${res.status}: ${message}`);
  }
  return (await res.json()) as T;
}

export interface Voice {
  name: string;
  ssmlGender: string;
  naturalSampleRateHertz: number;
}

/** The voice family from its name: he-IL-Standard-A, he-IL-Wavenet-B, he-IL-Neural2-C, he-IL-Chirp3-HD-Aoede... */
export const voiceFamily = (name: string): string => name.replace(/^he-IL-/, '').replace(/-[A-Z][a-z]*$/, '');

export async function hebrewVoices(): Promise<Voice[]> {
  const { voices = [] } = await call<{ voices?: Voice[] }>('/voices?languageCode=he-IL');
  return voices.sort((a, b) => a.name.localeCompare(b.name));
}

export interface SynthOptions {
  voice: string;
  /** 1 is the voice's normal pace. Some voice families ignore or reject it, so it is sent only when not 1. */
  speakingRate?: number;
}

export async function synthesize(text: string, { voice, speakingRate = 1 }: SynthOptions): Promise<Buffer> {
  const audioConfig: Record<string, unknown> = { audioEncoding: 'MP3' };
  if (speakingRate !== 1) audioConfig.speakingRate = speakingRate;
  const { audioContent } = await call<{ audioContent: string }>('/text:synthesize', {
    method: 'POST',
    body: JSON.stringify({ input: { text }, voice: { languageCode: 'he-IL', name: voice }, audioConfig }),
  });
  return Buffer.from(audioContent, 'base64');
}

/** Runs `task` over items with a small concurrency limit (the API rate-limits bursts). */
export async function pool<T>(items: readonly T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await task(items[next++]!);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
