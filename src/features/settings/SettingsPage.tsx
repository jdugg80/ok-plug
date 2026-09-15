import { useEffect, useState, type FormEvent } from "react";
import styles from "./SettingsPage.module.css";

export function SettingsPage() {
  const [version, setVersion] = useState<string>("…");
  const [keyStatus, setKeyStatus] = useState<{ isSet: boolean; encryptionAvailable: boolean } | null>(
    null
  );
  const [keyInput, setKeyInput] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    window.vibeforge.getAppVersion().then(setVersion);
    refreshKeyStatus();
  }, []);

  async function refreshKeyStatus() {
    const status = await window.vibeforge.getAiKeyStatus();
    setKeyStatus(status);
  }

  async function handleSaveKey(e: FormEvent) {
    e.preventDefault();
    if (!keyInput.trim()) return;
    setSaveState("saving");
    setSaveError(null);
    try {
      await window.vibeforge.setAiApiKey(keyInput.trim());
      setKeyInput("");
      setSaveState("idle");
      await refreshKeyStatus();
    } catch (err) {
      setSaveState("error");
      setSaveError((err as Error).message);
    }
  }

  async function handleClearKey() {
    await window.vibeforge.clearAiApiKey();
    await refreshKeyStatus();
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Settings</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>AI Provider</h2>

        {keyStatus && !keyStatus.encryptionAvailable && (
          <div className={styles.warning}>
            OS-level encryption isn't available on this machine, so an API key
            can't be stored securely here. This usually means no system
            keyring is set up.
          </div>
        )}

        <div className={styles.row}>
          <span className={styles.label}>Anthropic API Key</span>
          <span className={styles.value}>
            {keyStatus === null
              ? "Checking…"
              : keyStatus.isSet
                ? "Set (encrypted)"
                : "Not set"}
          </span>
        </div>

        <form onSubmit={handleSaveKey} className={styles.keyForm}>
          <input
            type="password"
            placeholder={keyStatus?.isSet ? "Enter a new key to replace it" : "sk-ant-…"}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            disabled={saveState === "saving" || keyStatus?.encryptionAvailable === false}
            className={styles.keyInput}
          />
          <button
            type="submit"
            className="vf-btn vf-btn--primary"
            disabled={
              saveState === "saving" ||
              !keyInput.trim() ||
              keyStatus?.encryptionAvailable === false
            }
          >
            {saveState === "saving" ? "Saving…" : "Save Key"}
          </button>
          {keyStatus?.isSet && (
            <button type="button" className="vf-btn" onClick={handleClearKey}>
              Clear Key
            </button>
          )}
        </form>
        {saveError && <p className={styles.error}>{saveError}</p>}
        <p className={styles.hint}>
          Stored encrypted via your OS's credential store. The key is never
          shown again once saved, and never leaves this device.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>About</h2>
        <div className={styles.row}>
          <span className={styles.label}>Version</span>
          <span className={styles.value}>{version}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Publisher</span>
          <span className={styles.value}>O-Kay-Est Media LLC</span>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Rendering</h2>
        <div className={styles.row}>
          <span className={styles.label}>FFmpeg</span>
          <span className={styles.value}>Not yet integrated — needed for MP4/WEBM/GIF export</span>
        </div>
      </section>
    </div>
  );
}
