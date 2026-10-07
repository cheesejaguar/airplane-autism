import { DEFAULT_DECK, parseDeckConfig, type DeckConfig } from "./config";

/** Only non-default fields are encoded to keep URLs short. */
export function encodeDeck(config: DeckConfig): string {
  const diff: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (JSON.stringify(v) !== JSON.stringify(DEFAULT_DECK[k as keyof DeckConfig])) diff[k] = v;
  }
  const json = JSON.stringify(diff);
  return typeof window === "undefined"
    ? Buffer.from(json).toString("base64url")
    : btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeDeck(value: string | null | undefined): DeckConfig {
  if (!value) return DEFAULT_DECK;
  try {
    const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const json = typeof window === "undefined" ? Buffer.from(value, "base64url").toString("utf8") : decodeURIComponent(escape(atob(b64)));
    return parseDeckConfig({ ...DEFAULT_DECK, ...JSON.parse(json) });
  } catch {
    return DEFAULT_DECK;
  }
}

export function trainHref(config: Partial<DeckConfig>): string {
  return `/train/session?deck=${encodeDeck(parseDeckConfig({ ...DEFAULT_DECK, ...config }))}`;
}
