import { useEffect, useState, type FormEvent } from "react";
import styles from "./SettingsPage.module.css";
import type { AiProviderName } from "@/types/domain";

export function SettingsPage() {
  const [version, setVersion] = useState<string>("…");
  const [providerChoice, setProviderChoice] = useState<AiProviderName>("anthropic");

  // Anthropic key state
  const [anthropicKeyStatus, setAnthropicKeyStatus] = useState<{ isSet: boolean; encryptionAvailable: boolean } | null>(null);
  const [anthropicKeyInput, setAnthropicKeyInput] = useState("");
  const [anthropicSaveState, setAnthropicSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [anthropicSaveError, setAnthropicSaveError] = useState<string | null>(null);

  // OpenAI key state
  const [openaiKeyStatus, setOpenaiKeyStatus] = useState<{ isSet: boolean; encryptionAvailable: boolean } | null>(null);
  const [openaiKeyInput, setOpenaiKeyInput] = useState("");
  const [openaiSaveState, setOpenaiSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [openaiSaveError, setOpenaiSaveError] = useState<string | null>(null);

  useEffect(() => {
    window.vibeforge.getAppVersion().then(setVersion);
    refreshAllStatus();
  }, []);

  async function refreshAllStatus() {
    const [provider, anthropicStatus, openaiStatus] = await Promise.all([
      window.vibeforge.getProviderChoice(),
      window.vibeforge.getAiKeyStatus(),
      window.vibeforge.getOpenAIKeyStatus(),
    ]);
    setProviderChoice(provider);
    setAnthropicKeyStatus(anthropicStatus);
    setOpenaiKeyStatus(openaiStatus);
  }

  async function handleProviderChange(provider: AiProviderName) {
    await window.vibeforge.setProviderChoice(provider);
    setProviderChoice(provider);
  }

  async function handleSaveAnthropicKey(e: FormEvent) {
    e.preventDefault();
    if (!anthropicKeyInput.trim()) return;
    setAnthropicSaveState("saving");
    setAnthropicSaveError(null);
    try {
      await window.vibeforge.setAiApiKey(anthropicKeyInput.trim());
      setAnthropicKeyInput("");
      setAnthropicSaveState("idle");
      await refreshAllStatus();
    } catch (err) {
      setAnthropicSaveState("error");
      setAnthropicSaveError((err as Error).message);
    }
  }

  async function handleClearAnthropicKey() {
    await window.vibeforge.clearAiApiKey();
    await refreshAllStatus();
  }

  async function handleSaveOpenAIKey(e: FormEvent) {
    e.preventDefault();
    if (!openaiKeyInput.trim()) return;
    setOpenaiSaveState("saving");
    setOpenaiSaveError(null);
    try {
      await window.vibeforge.setOpenAIKey(openaiKeyInput.trim());
      setOpenaiKeyInput("");
      setOpenaiSaveState("idle");
      await refreshAllStatus();
    } catch (err) {
      setOpenaiSaveState("error");
      setOpenaiSaveError((err as Error).message);
    }
  }

  async function handleClearOpenAIKey() {
    await window.vibeforge.clearOpenAIKey();
    await refreshAllStatus();
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Settings</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>AI Provider</h2>

        {anthropicKeyStatus && !anthropicKeyStatus.encryptionAvailable && (
          <div className={styles.warning}>
            OS-level encryption isn't available on this machine, so API keys
            can't be stored securely here. This usually means no system
            keyring is set up.
          </div>
        )}

        <div className={styles.providerToggle}>
          <button
            className={`${styles.providerBtn} ${providerChoice === "anthropic" ? styles.providerBtnActive : ""}`}
            onClick={() => handleProviderChange("anthropic")}
          >
            Anthropic (Claude)
          </button>
          <button
            className={`${styles.providerBtn} ${providerChoice === "openai" ? styles.providerBtnActive : ""}`}
            onClick={() => handleProviderChange("openai")}
          >
            OpenAI (GPT-4o)
          </button>
        </div>

        <p className={styles.hint}>
          Active provider: <strong>{providerChoice === "anthropic" ? "Anthropic Claude" : "OpenAI GPT-4o"}</strong>.
          You need at least one key set for the active provider.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Anthropic API Key</h2>

        <div className={styles.row}>
          <span className={styles.label}>Status</span>
          <span className={styles.value}>
            {anthropicKeyStatus === null
              ? "Checking…"
              : anthropicKeyStatus.isSet
                ? "Set (encrypted)"
                : "Not set"}
          </span>
        </div>

        <form onSubmit={handleSaveAnthropicKey} className={styles.keyForm}>
          <input
            type="password"
            placeholder={anthropicKeyStatus?.isSet ? "Enter a new key to replace it" : "sk-ant-…"}
            value={anthropicKeyInput}
            onChange={(e) => setAnthropicKeyInput(e.target.value)}
            disabled={anthropicSaveState === "saving" || anthropicKeyStatus?.encryptionAvailable === false}
            className={styles.keyInput}
          />
          <button
            type="submit"
            className="vf-btn vf-btn--primary"
            disabled={
              anthropicSaveState === "saving" ||
              !anthropicKeyInput.trim() ||
              anthropicKeyStatus?.encryptionAvailable === false
            }
          >
            {anthropicSaveState === "saving" ? "Saving…" : "Save Key"}
          </button>
          {anthropicKeyStatus?.isSet && (
            <button type="button" className="vf-btn" onClick={handleClearAnthropicKey}>
              Clear Key
            </button>
          )}
        </form>
        {anthropicSaveError && <p className={styles.error}>{anthropicSaveError}</p>}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>OpenAI API Key</h2>

        <div className={styles.row}>
          <span className={styles.label}>Status</span>
          <span className={styles.value}>
            {openaiKeyStatus === null
              ? "Checking…"
              : openaiKeyStatus.isSet
                ? "Set (encrypted)"
                : "Not set"}
          </span>
        </div>

        <form onSubmit={handleSaveOpenAIKey} className={styles.keyForm}>
          <input
            type="password"
            placeholder={openaiKeyStatus?.isSet ? "Enter a new key to replace it" : "sk-…"}
            value={openaiKeyInput}
            onChange={(e) => setOpenaiKeyInput(e.target.value)}
            disabled={openaiSaveState === "saving" || openaiKeyStatus?.encryptionAvailable === false}
            className={styles.keyInput}
          />
          <button
            type="submit"
            className="vf-btn vf-btn--primary"
            disabled={
              openaiSaveState === "saving" ||
              !openaiKeyInput.trim() ||
              openaiKeyStatus?.encryptionAvailable === false
            }
          >
            {openaiSaveState === "saving" ? "Saving…" : "Save Key"}
          </button>
          {openaiKeyStatus?.isSet && (
            <button type="button" className="vf-btn" onClick={handleClearOpenAIKey}>
              Clear Key
            </button>
          )}
        </form>
        {openaiSaveError && <p className={styles.error}>{openaiSaveError}</p>}
      </section>

      <p className={styles.hint} style={{ marginTop: "-16px" }}>
        Keys are stored encrypted via your OS's credential store. They are never
        shown again once saved, and never leave this device.
      </p>

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
