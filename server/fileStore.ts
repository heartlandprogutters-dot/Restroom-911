import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { emptySandbox, type SandboxState } from '../src/domain/types';
import type { SandboxStore } from './app';

export function createFileStore(filePath: string): SandboxStore {
  return {
    async load() {
      try {
        const text = await readFile(filePath, 'utf8');
        const parsed = JSON.parse(text) as SandboxState;
        if (parsed.version !== 1) return emptySandbox();
        return parsed;
      } catch {
        return emptySandbox();
      }
    },
    async save(state) {
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify(state, null, 2));
    },
  };
}
