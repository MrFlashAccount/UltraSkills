/** Restart-stable opaque locators carrying no filesystem path or content authority. */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  type BinaryLike,
} from "node:crypto";
import { realpathSync, statSync } from "node:fs";

type CursorPayload = {
  identity: string;
  offset: number;
  resource: "workflow" | "traversal" | "activity" | "logs" | "artifacts";
  runId: string;
  scope?: string;
};

type RefPayload = { [key: string]: unknown; runId: string };
type LocatorEnvelope =
  | { identity: RefPayload; kind: "artifact"; v: 2 }
  | { kind: "cursor"; payload: CursorPayload; v: 2 };

const MAX_LOCATOR_LENGTH = 512;
const NONCE_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const LOCATOR_PATTERN = /^[A-Za-z0-9_-]+$/u;

function stable(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * Derive the process-independent sealing key from the configured canonical
 * runs-root authority. Replacing or moving that authority intentionally makes
 * old locators stale, while a normal dashboard restart does not.
 */
export function locatorSecretForRunsRoot(runsRoot: string): Buffer {
  const canonical = realpathSync.native(runsRoot);
  const stat = statSync(canonical);
  if (!stat.isDirectory()) {
    throw new Error("dashboard runs root is unavailable");
  }
  return createHash("sha256")
    .update("orbita-dashboard-v2-locator\0")
    .update(canonical)
    .update("\0")
    .update(String(stat.dev))
    .update("\0")
    .update(String(stat.ino))
    .digest();
}

export class OpaqueLocatorCodec {
  private readonly key: Buffer;

  constructor(secret: BinaryLike) {
    this.key = createHash("sha256").update(secret).digest();
  }

  private seal(envelope: LocatorEnvelope): string {
    const plaintext = Buffer.from(stable(envelope), "utf8");
    const nonce = createHmac("sha256", this.key)
      .update("orbita-dashboard-v2-nonce\0")
      .update(plaintext)
      .digest()
      .subarray(0, NONCE_BYTES);
    const cipher = createCipheriv("aes-256-gcm", this.key, nonce);
    cipher.setAAD(Buffer.from("orbita-dashboard-v2-locator", "utf8"));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const locator = Buffer.concat([nonce, ciphertext, cipher.getAuthTag()]).toString("base64url");
    if (locator.length > MAX_LOCATOR_LENGTH) {
      throw new Error("stale_locator");
    }
    return locator;
  }

  private open(locator: string): LocatorEnvelope {
    if (
      typeof locator !== "string" ||
      locator.length < 16 ||
      locator.length > MAX_LOCATOR_LENGTH ||
      !LOCATOR_PATTERN.test(locator)
    ) {
      throw new Error("stale_locator");
    }
    try {
      const bytes = Buffer.from(locator, "base64url");
      if (bytes.length <= NONCE_BYTES + AUTH_TAG_BYTES) {
        throw new Error("invalid locator");
      }
      const nonce = bytes.subarray(0, NONCE_BYTES);
      const authTag = bytes.subarray(bytes.length - AUTH_TAG_BYTES);
      const ciphertext = bytes.subarray(NONCE_BYTES, bytes.length - AUTH_TAG_BYTES);
      const decipher = createDecipheriv("aes-256-gcm", this.key, nonce);
      decipher.setAAD(Buffer.from("orbita-dashboard-v2-locator", "utf8"));
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      const envelope = JSON.parse(plaintext.toString("utf8"));
      if (
        !envelope ||
        typeof envelope !== "object" ||
        Array.isArray(envelope) ||
        envelope.v !== 2
      ) {
        throw new Error("invalid locator");
      }
      return envelope as LocatorEnvelope;
    } catch {
      throw new Error("stale_locator");
    }
  }

  ref(kind: "artifact", canonicalIdentity: unknown): string {
    if (
      !canonicalIdentity ||
      typeof canonicalIdentity !== "object" ||
      Array.isArray(canonicalIdentity)
    ) {
      throw new Error("stale_locator");
    }
    return this.seal({
      identity: structuredClone(canonicalIdentity) as RefPayload,
      kind,
      v: 2,
    });
  }

  resolveRef(locator: string, expected: { kind: "artifact"; runId: string }): RefPayload {
    const resolved = this.open(locator);
    if (
      resolved.kind !== expected.kind ||
      !resolved.identity ||
      typeof resolved.identity !== "object" ||
      resolved.identity.runId !== expected.runId
    ) {
      throw new Error("stale_locator");
    }
    return structuredClone(resolved.identity);
  }

  cursor(payload: CursorPayload): string {
    return this.seal({ kind: "cursor", payload: structuredClone(payload), v: 2 });
  }

  parseCursor(
    locator: string,
    expected: Pick<CursorPayload, "resource" | "runId"> & { scope?: string },
  ): CursorPayload {
    const envelope = this.open(locator);
    const decoded = envelope.kind === "cursor" ? envelope.payload : undefined;
    if (
      !decoded ||
      decoded.runId !== expected.runId ||
      decoded.resource !== expected.resource ||
      decoded.scope !== expected.scope ||
      typeof decoded.identity !== "string" ||
      !Number.isSafeInteger(decoded.offset) ||
      decoded.offset < 0
    ) {
      throw new Error("stale_locator");
    }
    return structuredClone(decoded);
  }
}
