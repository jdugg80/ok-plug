import { app, safeStorage } from "electron";
import { promises as fs } from "fs";
import path from "path";

/**
 * safeStorage encrypts/decrypts using the OS credential store (DPAPI on
 * Windows, Keychain on macOS, libsecret on Linux) but does not persist
 * anything itself — we own writing the encrypted bytes to disk. This is
 * app-level (one key for the whole app), not per-project, so it lives
 * under userData, not inside any project folder.
 */
const SECRETS_DIR_NAME = "secrets";
const ANTHROPIC_KEY_FILE = "anthropic-api-key.enc";

function secretsDir(): string {
  return path.join(app.getPath("userData"), SECRETS_DIR_NAME);
}

function anthropicKeyPath(): string {
  return path.join(secretsDir(), ANTHROPIC_KEY_FILE);
}

export interface AiKeyStatus {
  isSet: boolean;
  encryptionAvailable: boolean;
}

export async function getAnthropicKeyStatus(): Promise<AiKeyStatus> {
  const encryptionAvailable = safeStorage.isEncryptionAvailable();
  try {
    await fs.access(anthropicKeyPath());
    return { isSet: true, encryptionAvailable };
  } catch {
    return { isSet: false, encryptionAvailable };
  }
}

export async function setAnthropicKey(rawKey: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "OS-level encryption isn't available on this machine, so the key can't be stored securely."
    );
  }
  const trimmed = rawKey.trim();
  if (!trimmed) {
    throw new Error("API key cannot be empty.");
  }
  const encrypted = safeStorage.encryptString(trimmed);
  await fs.mkdir(secretsDir(), { recursive: true });
  const filePath = anthropicKeyPath();
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, encrypted);
  await fs.rename(tmpPath, filePath);
}

export async function clearAnthropicKey(): Promise<void> {
  try {
    await fs.unlink(anthropicKeyPath());
  } catch (err) {
    // Already absent is fine; anything else is a real failure.
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

/**
 * Main-process-only. Never exposed over IPC — the renderer only ever
 * sees AiKeyStatus, never the decrypted key itself. Used internally by
 * the AI Creative Assistant service (Step 5) when making API calls.
 */
export async function getAnthropicKeyForInternalUse(): Promise<string | null> {
  try {
    const encrypted = await fs.readFile(anthropicKeyPath());
    if (!safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.decryptString(encrypted);
  } catch {
    return null;
  }
}
