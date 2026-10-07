"use server";

import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { deckPreset, userPrefs } from "@/db/schema";
import { parseDeckConfig, type DeckConfig } from "@/lib/deck/config";
import { getViewer } from "@/lib/session";

export type PresetDTO = { id: string; name: string; config: DeckConfig };

export async function listPresets(): Promise<PresetDTO[]> {
  const viewer = await getViewer();
  if (!viewer) return [];
  const rows = await db.select().from(deckPreset).where(eq(deckPreset.userId, viewer.id)).orderBy(desc(deckPreset.createdAt));
  return rows.map((r) => ({ id: r.id, name: r.name, config: parseDeckConfig(r.config) }));
}

export async function savePreset(name: string, config: unknown): Promise<PresetDTO | null> {
  const viewer = await getViewer();
  const clean = name.trim().slice(0, 60);
  if (!viewer || !clean) return null;
  const row = { id: crypto.randomUUID(), userId: viewer.id, name: clean, config: parseDeckConfig(config) };
  await db.insert(deckPreset).values(row);
  return { id: row.id, name: row.name, config: row.config };
}

export async function deletePreset(id: string): Promise<void> {
  const viewer = await getViewer();
  if (!viewer) return;
  await db.delete(deckPreset).where(and(eq(deckPreset.id, id), eq(deckPreset.userId, viewer.id)));
}

export async function getDefaultDeck(): Promise<DeckConfig | null> {
  const viewer = await getViewer();
  if (!viewer) return null;
  const [row] = await db.select().from(userPrefs).where(eq(userPrefs.userId, viewer.id));
  return row?.data.deck ? parseDeckConfig(row.data.deck) : null;
}

export async function saveDefaultDeck(config: unknown): Promise<void> {
  const viewer = await getViewer();
  if (!viewer) return;
  const deck = parseDeckConfig(config);
  const [row] = await db.select().from(userPrefs).where(eq(userPrefs.userId, viewer.id));
  const data = { ...(row?.data ?? {}), deck };
  await db
    .insert(userPrefs)
    .values({ userId: viewer.id, data })
    .onConflictDoUpdate({ target: userPrefs.userId, set: { data } });
}
