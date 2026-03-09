import type { FilmPack } from "@/types/film-pack";

export function toFilmPackMarkdown(pack: FilmPack): string {
  const beatSheetBlock = pack.beatSheet?.length
    ? `## Beat Sheet\n${pack.beatSheet
        .map(
          (beat) =>
            `- Beat ${beat.beatNumber}: [${beat.phase}] role=${beat.role}, importance=${beat.importance}, VO=${beat.voLine}, purpose=${beat.purpose}`
        )
        .join("\n")}\n\n`
    : "";

  const header = `# ${pack.title}\n\n- Style: ${pack.style}\n- World Note: ${pack.settingNote}\n\n## Preserved Voice Over\n${pack.preservedVoiceOverScript}\n\n## Character Reference Guidance\n${pack.characterReferenceGuidance}\n\n${beatSheetBlock}## Scenes\n`;

  const sceneBlocks = pack.scenes
    .map((scene) => {
      const companionBlock = scene.companionShots?.length
        ? `\n- Companion shots:\n${scene.companionShots
            .map(
              (shot) =>
                `  - ${shot.label}: kind=${shot.kind}, shot type=${shot.shotType}, purpose=${shot.scenePurpose}, image prompt=${shot.imagePrompt}, video prompt=${shot.videoPrompt}`
            )
            .join("\n")}`
        : "";

      return `### Scene ${scene.sceneNumber}\n- Phase: ${scene.phase}\n- VO line: ${scene.voLine}\n- Shot type: ${scene.shotType}\n- Scene purpose: ${scene.scenePurpose}\n- Importance: ${scene.importance}\n- Reference image: ${scene.useReferenceImage ? "yes" : "no"}\n- Image prompt: ${scene.imagePrompt}\n- Video prompt: ${scene.videoPrompt}\n- Camera: ${scene.camera}\n- Lighting / Color: ${scene.lightingColor}${companionBlock}`;
    })
    .join("\n\n");

  return `${header}\n${sceneBlocks}\n`;
}

export function toFilmPackText(pack: FilmPack): string {
  return toFilmPackMarkdown(pack)
    .replace(/^#\s/gm, "")
    .replace(/^##\s/gm, "")
    .replace(/^###\s/gm, "")
    .replace(/-\s/gm, "• ");
}

export function fullOutputCopy(pack: FilmPack): string {
  return toFilmPackMarkdown(pack);
}
