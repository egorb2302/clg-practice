export type ModelEntry = { name: string; kit?: boolean };

export const MODELS: Record<string, ModelEntry[]> = {
  JAC: [{ name: "T9", kit: true }, { name: "T8" }, { name: "JS4" }],
  Haval: [{ name: "H3", kit: true }, { name: "Dargo" }, { name: "Jolion" }, { name: "H5" }],
  Tank: [{ name: "300" }, { name: "400" }, { name: "500" }],
  Chery: [{ name: "Tiggo 7 Pro" }, { name: "Tiggo 8 Pro" }, { name: "Tiggo 9" }],
  Geely: [{ name: "Monjaro" }, { name: "Atlas" }, { name: "Okavango" }],
  "Great Wall": [{ name: "Poer" }, { name: "Wingle 7" }],
  Changan: [{ name: "UNI-K" }, { name: "CS75 Plus" }],
  Exeed: [{ name: "VX" }, { name: "TXL" }],
};

export const BRANDS = Object.keys(MODELS);

export function hasKit(brand: string, model: string): boolean {
  return !!MODELS[brand]?.some((m) => m.name === model && m.kit);
}
