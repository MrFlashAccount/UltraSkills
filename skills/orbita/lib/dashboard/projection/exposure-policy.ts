/** Source-specific public text policy. Unknown source classes are omitted by construction. */
import {
  EXPOSURE_POLICY_VERSION,
  PUBLIC_TEXT_LIMITS,
  PublicDisplayTextSchema,
  type PublicDisplayText,
  type PublicTextSource,
} from "../contracts/browser";

export { EXPOSURE_POLICY_VERSION } from "../contracts/browser";
export type { PublicTextSource } from "../contracts/browser";

const FORBIDDEN = [
  /(?:^|[\s"'=(])(?:\/[\w.@+-]+){2,}(?:[\s"'),]|$)/u,
  /(?:^|\s)[A-Za-z]:\\(?:[^\\\s]+\\)+[^\s]+/u,
  /(?:--lease-token|workflow[_-]?run[_-]?token|tokenhash|authorization\s*:|bearer\s+\S+)/iu,
  /(?:\b[A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API[_-]?KEY|PRIVATE[_-]?KEY|ACCESS[_-]?KEY)[A-Z0-9_]*\s*[:=])/iu,
  /(?:\b(?:token|secret|password|passwd|api[_-]?key|private[_-]?key)\s*[:=]\s*\S+)/iu,
  /(?:workflow-runner\.mjs\s+instructions|\bbind-agent\b|\bpreferred agent\b)/iu,
  /(?:private prompt|hidden prompt|system prompt|developer prompt|hidden transcript|session transcript)/iu,
  /(?:^|\s)(?:rm|curl|wget|ssh|sudo|bash|sh|fish|zsh|bun|deno|node|npm|npx|pnpm|yarn|git|arc|docker|make|just|go|python\d*|pip\d*|ruby|perl|php|powershell|pwsh|cmd)(?:\.exe)?\s+(?:-[^\s]+\s*)?[^\n]*/iu,
  /(?:\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,})/u,
  /(?:\b[a-f0-9]{40,}\b)/iu,
];

function normalize(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replaceAll(/[\u0000-\u001F\u007F-\u009F]/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim();
}

function truncate(value: string, codePointLimit: number, utf8ByteLimit: number): string {
  const encoder = new TextEncoder();
  const accepted: Array<string> = [];
  let bytes = 0;
  for (const codePoint of value) {
    if (accepted.length >= codePointLimit) {
      break;
    }
    const nextBytes = encoder.encode(codePoint).byteLength;
    if (bytes + nextBytes > utf8ByteLimit) {
      break;
    }
    accepted.push(codePoint);
    bytes += nextBytes;
  }
  return accepted.join("").trim();
}

export function exposePublicText(
  source: PublicTextSource,
  value: unknown,
): PublicDisplayText | undefined {
  const normalized = normalize(value);
  if (!normalized || FORBIDDEN.some((pattern) => pattern.test(normalized))) {
    return undefined;
  }
  const limits = PUBLIC_TEXT_LIMITS[source];
  const exposed = truncate(normalized, limits.codePoints, limits.utf8Bytes);
  if (!exposed) {
    return undefined;
  }
  return PublicDisplayTextSchema.parse({
    policyVersion: EXPOSURE_POLICY_VERSION,
    sourceClass: source,
    value: exposed,
  });
}

export function fixedPublicText(
  source: "run_title" | "public_diagnostic",
  value: string,
): PublicDisplayText {
  const exposed = exposePublicText(source, value);
  if (!exposed) {
    throw new Error("fixed public dashboard text violates the exposure policy");
  }
  return exposed;
}

export function exposeIdentifier(
  source: "workflow_identity" | "step_id" | "artifact_id" | "result_ref",
  value: unknown,
): string | undefined {
  const normalized = normalize(value);
  const max = source === "workflow_identity" ? 120 : 160;
  if (
    !normalized ||
    Array.from(normalized).length > max ||
    new TextEncoder().encode(normalized).byteLength > max * 2
  ) {
    return undefined;
  }
  const pattern =
    source === "artifact_id" || source === "result_ref"
      ? /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u
      : /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
  return pattern.test(normalized) ? normalized : undefined;
}
