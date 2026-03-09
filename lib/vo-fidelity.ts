function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildBigrams(input: string): string[] {
  const text = normalize(input).replace(/\s/g, "");
  if (text.length < 2) return [];

  const grams: string[] = [];
  for (let index = 0; index < text.length - 1; index += 1) {
    grams.push(text.slice(index, index + 2));
  }
  return grams;
}

function diceCoefficient(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;

  const bCounts = new Map<string, number>();
  for (const gram of b) {
    bCounts.set(gram, (bCounts.get(gram) || 0) + 1);
  }

  let overlap = 0;
  for (const gram of a) {
    const count = bCounts.get(gram) || 0;
    if (count > 0) {
      overlap += 1;
      bCounts.set(gram, count - 1);
    }
  }

  return (2 * overlap) / (a.length + b.length);
}

export function voFidelityScore(source: string, preservedVo: string): number {
  return diceCoefficient(buildBigrams(source), buildBigrams(preservedVo));
}

export function passesVoFidelity(source: string, preservedVo: string, strictMode: boolean): boolean {
  const score = voFidelityScore(source, preservedVo);
  const threshold = strictMode ? 0.58 : 0.46;
  return score >= threshold;
}
