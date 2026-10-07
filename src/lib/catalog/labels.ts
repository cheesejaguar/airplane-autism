// Client-safe label helpers (no catalog data import).
import type { Category, Role } from "./schema";

export const CATEGORY_LABELS_CLIENT: Record<Category, string> = {
  "fixed-wing": "Fixed-wing",
  rotorcraft: "Rotorcraft",
  tiltrotor: "Tiltrotor",
  uas: "Drone (UAS)",
};

export function roleLabel(r: Role): string {
  return r.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()).replace("Isr", "ISR").replace("Aew", "AEW").replace("Vip", "VIP").replace("Ems", "EMS");
}
