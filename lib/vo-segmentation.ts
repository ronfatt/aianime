function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function splitSentences(input: string): string[] {
  const raw = input
    .replace(/\r\n/g, "\n")
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  return raw.length > 0 ? raw : [normalizeWhitespace(input)];
}

export function splitVoiceOverIntoSceneBeats(voiceOver: string, sceneCount: number): string[] {
  const sentences = splitSentences(voiceOver);
  if (sentences.length === 0) return Array.from({ length: sceneCount }, () => "");

  const beats: string[] = [];
  for (let i = 0; i < sceneCount; i += 1) {
    const start = Math.floor((i * sentences.length) / sceneCount);
    const end = Math.floor(((i + 1) * sentences.length) / sceneCount);

    if (end > start) {
      beats.push(sentences.slice(start, end).join(" "));
    } else {
      beats.push(sentences[Math.min(start, sentences.length - 1)]);
    }
  }

  return beats.map((beat) => normalizeWhitespace(beat));
}
