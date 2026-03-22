import { createClient } from '@insforge/sdk';

const baseUrl = import.meta.env.VITE_INSFORGE_URL as string | undefined;
const anonKey = import.meta.env.VITE_INSFORGE_ANON_KEY as string | undefined;

if (!baseUrl || !anonKey) {
  console.warn(
    '[InsForge] Set VITE_INSFORGE_URL and VITE_INSFORGE_ANON_KEY in .env (see .env.example). Get values from `insforge metadata` or the InsForge dashboard.'
  );
}

export const insforge = createClient({
  baseUrl: baseUrl ?? '',
  anonKey: anonKey ?? '',
});

export function isInsForgeConfigured(): boolean {
  return Boolean(baseUrl && anonKey);
}
