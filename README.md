# Anime Pack Studio

Anime Pack Studio is a production-ready Next.js web app for rapid AI pre-production of vertical 9:16 animated shorts. Paste a source script and generate one structured anime pack with preserved VO, scene-by-scene breakdown, and image/video prompts tuned for anime keyframe workflows.

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS (v4)
- OpenAI Responses API (server-side route)
- Zod validation

## Features

- Script input with optional title and reference tag (e.g. `[AKI_REF]`)
- Optional locked VO input (if provided, system keeps VO text exactly and does not rewrite)
- Beat-first generation flow:
  - Generate beat sheet first
  - Then generate scenes from beats
  - Better VO coverage and more stable transition coverage
- Scene count selection: `Auto / 20 / 22 / 25 / 28 / 30`
- Tone/style selection:
  - `cinematic anime`
  - `shonen action`
  - `slice of life`
  - `fantasy drama`
- Structured output:
  - Preserved 80-90 second VO
  - 20-30 scene cards
  - Includes a small B-roll / transition layer for pacing coverage
  - Per-scene fields:
    - Scene number
    - VO line
    - Shot type
    - Scene purpose
    - Importance (A/B/C)
    - Reference image yes/no
    - Anime image prompt
    - Image-to-video prompt
    - Camera movement
    - Lighting/color notes
- Copy controls:
  - Full anime pack
  - Scene image prompt
  - Scene video prompt
- Optional one-click scene image generation via Gemini API
- Character master reference workflow (upload master refs / paste master ref URLs for stronger identity consistency)
- Official master reference selection (choose one canonical character image and bind future scene image generation to it)
- Per-scene companion shot generation (`Generate B-roll` / `Generate Transition`) without replacing the main shot
- Exports:
  - Download `.txt`
  - Download `.md`
- API error handling and output validation
- Dark cinematic responsive UI

## Project Structure

- `app/`
- `components/`
- `lib/`
- `lib/prompts/`
  - `systemPrompt.ts`
  - `stylePrompt.ts`
  - `sceneRules.ts`
  - `outputSchema.ts`
  - `promptBuilder.ts`
- `types/`
- `app/api/generate/route.ts`
- `app/api/generate-beats/route.ts`

## Environment Variables

Copy `.env.example` to `.env.local` and set:

```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5.1
IMAGE_PROVIDER=gemini
IMAGE_FALLBACK_PROVIDER=
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_IMAGE_MODEL=gemini-3-pro-image-preview
GEMINI_IMAGE_FALLBACK_MODEL=gemini-2.5-flash-image-preview
KLING_API_KEY=your_kling_api_key_here
KLING_IMAGE_ENDPOINT=https://api-singapore.klingai.com/v1/images/omni-image
KLING_IMAGE_MODEL=kling-image-o1
KLING_AUTH_HEADER=Authorization
KLING_AUTH_PREFIX=Bearer
KLING_BASE_URL=https://api-singapore.klingai.com
KLING_QUERY_ENDPOINT_TEMPLATE=https://api-singapore.klingai.com/v1/images/omni-image/{task_id}
KLING_POLL_MAX_ATTEMPTS=12
KLING_POLL_INTERVAL_MS=1500
```

`OPENAI_MODEL` is optional. If omitted, the app defaults to `gpt-5.1`.
`GEMINI_IMAGE_MODEL` is optional. If omitted, the app defaults to `gemini-3-pro-image-preview`.
`GEMINI_IMAGE_FALLBACK_MODEL` is optional. If omitted, the app falls back to `gemini-2.5-flash-image-preview` when primary model fails.
`IMAGE_PROVIDER` controls image backend (`gemini` or `kling`).
If `IMAGE_PROVIDER=kling`, configure `KLING_API_KEY` and `KLING_IMAGE_ENDPOINT`.
Optional: set `IMAGE_FALLBACK_PROVIDER=gemini` to auto-fallback when Kling fails.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Run development server:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Push this repository to GitHub/GitLab/Bitbucket.
2. Import the project in [Vercel](https://vercel.com/new).
3. Set environment variables in Vercel Project Settings:
   - `OPENAI_API_KEY`
   - Optional: `OPENAI_MODEL`
   - For one-click image generation:
     - `IMAGE_PROVIDER=gemini` with `GEMINI_API_KEY` (and optional Gemini model vars), or
     - `IMAGE_PROVIDER=kling` with `KLING_API_KEY` + `KLING_IMAGE_ENDPOINT`
4. Deploy.

## API Endpoint

- `POST /api/generate`
- `POST /api/generate-beats`
- Validates incoming settings with Zod
- Calls OpenAI Responses API with strict JSON schema
- Validates returned JSON before responding
- `generate-beats` creates a beat sheet with `phase + role + importance + purpose`
- `generate` consumes that beat sheet to produce the final scene pack
- Supports strict mode toggle:
  - `settings.strictMode` (camelCase) or `strict_mode` (snake_case)
  - Default: `true` (stability-first)

## Notes

- The generation prompt enforces vertical 9:16 anime composition and consistency guardrails.
- The server route rejects malformed responses and mismatched scene counts.
- This app is designed for practical short-form production usage, not toy output formatting.
