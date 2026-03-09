import type {
  StudioCharacter,
  StudioEpisode,
  StudioProject,
  StudioSeries,
  StudioWorld,
} from "@/types/studio";

export function toSeriesMarkdown(input: {
  series: StudioSeries;
  project: StudioProject;
  world: StudioWorld;
  character: StudioCharacter;
  episodes: StudioEpisode[];
}): string {
  const { series, project, world, character, episodes } = input;

  const episodeBlocks = episodes
    .map((episode) => {
      const sceneBlock = episode.scenes.length
        ? `\n#### Scenes\n${episode.scenes
            .map(
              (scene, index) =>
                `- Scene ${index + 1}: ${scene.title}\n  - Purpose: ${scene.purpose}\n  - Beat: ${scene.beat}\n  - Shot: ${scene.shot.shotType}\n  - Camera: ${scene.shot.camera}\n  - Emotion: ${scene.shot.emotion}\n  - Lighting: ${scene.shot.lighting}\n  - Duration: ${scene.shot.durationSeconds}s`
            )
            .join("\n")}`
        : "";

      return `### EP${episode.episodeNumber} ${episode.title}\n- Status: ${episode.status}\n- Summary: ${episode.summary}\n- Hook: ${episode.hook}\n- Conflict: ${episode.conflict}\n- Action: ${episode.action}\n- Climax: ${episode.climax}\n- Ending: ${episode.ending}\n- Cliffhanger: ${episode.cliffhanger}\n- Duration: ${episode.durationSeconds}s${sceneBlock}`;
    })
    .join("\n\n");

  return `# ${series.seriesTitle}\n
- Season: ${series.seasonLabel}
- Premise: ${series.premise}
- Season Arc: ${series.seasonArc}
- Hook Formula: ${series.hookFormula}
- Target Episodes: ${series.targetEpisodes}

## Project
- Title: ${project.title}
- Format: ${project.format}
- Genre: ${project.genre}
- Tone: ${project.tone}
- Animation Style: ${project.animationStyle}

## World
- Setting: ${world.setting}
- Environment: ${world.environment}
- Weather: ${world.weather}
- Architecture: ${world.architecture}
- Palette: ${world.palette}

## Character
- Name: ${character.name}
- Role: ${character.role}
- Age: ${character.age}
- Appearance: ${character.appearance}
- Outfit: ${character.outfit}
- Pose Language: ${character.poseLanguage}
- Power: ${character.power}

## Episodes
${episodeBlocks}
`;
}

export function toSeriesText(input: {
  series: StudioSeries;
  project: StudioProject;
  world: StudioWorld;
  character: StudioCharacter;
  episodes: StudioEpisode[];
}): string {
  return toSeriesMarkdown(input)
    .replace(/^#\s/gm, "")
    .replace(/^##\s/gm, "")
    .replace(/^###\s/gm, "")
    .replace(/^####\s/gm, "")
    .replace(/-\s/gm, "• ");
}
