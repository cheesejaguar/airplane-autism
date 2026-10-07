import { describe, expect, it } from "vitest";
import { DEFAULT_DECK, parseDeckConfig } from "@/lib/deck/config";
import { decodeDeck, encodeDeck } from "@/lib/deck/url";
import { matchesDeck, type FamilyLite } from "@/lib/catalog/lite";

const lite = (over: Partial<FamilyLite>): FamilyLite => ({
  id: "x", name: "X", label: "X", manufacturer: "Acme", sector: "military", category: "fixed-wing",
  roles: ["fighter"], branches: ["usaf"], difficulty: 2, angles: ["side"], thumb: null, quizzable: true, ...over,
});

describe("deck config", () => {
  it("round-trips through the URL encoding", () => {
    const deck = parseDeckConfig({ ...DEFAULT_DECK, categories: ["rotorcraft"], exposure: "1s", choices: 6 });
    expect(decodeDeck(encodeDeck(deck))).toEqual(deck);
  });
  it("encodes the default deck compactly", () => expect(encodeDeck(DEFAULT_DECK)).toBe("e30"));
  it("falls back to defaults on garbage", () => expect(decodeDeck("%%%")).toEqual(DEFAULT_DECK));
  it("rejects out-of-range values", () => expect(parseDeckConfig({ choices: 9 })).toEqual(DEFAULT_DECK));
});

describe("matchesDeck", () => {
  const d = (patch: Partial<typeof DEFAULT_DECK>) => ({ ...DEFAULT_DECK, ...patch });
  it("treats sector 'both' as matching civil and military", () => {
    const both = lite({ sector: "both" });
    expect(matchesDeck(both, d({ sectors: ["civil"] }))).toBe(true);
    expect(matchesDeck(both, d({ sectors: ["military"] }))).toBe(true);
    expect(matchesDeck(lite({ sector: "civil" }), d({ sectors: ["military"] }))).toBe(false);
  });
  it("filters by category, role, branch and difficulty", () => {
    const helo = lite({ category: "rotorcraft", roles: ["attack"], branches: ["army"], difficulty: 3 });
    expect(matchesDeck(helo, d({ categories: ["rotorcraft"] }))).toBe(true);
    expect(matchesDeck(helo, d({ categories: ["fixed-wing"] }))).toBe(false);
    expect(matchesDeck(helo, d({ roles: ["fighter"] }))).toBe(false);
    expect(matchesDeck(helo, d({ branches: ["army"] }))).toBe(true);
    expect(matchesDeck(helo, d({ difficulty: [4, 5] }))).toBe(false);
  });
  it("an explicit family list overrides other filters", () => {
    expect(matchesDeck(lite({ id: "a", category: "uas" }), d({ familyIds: ["a"], categories: ["rotorcraft"] }))).toBe(true);
  });
});
