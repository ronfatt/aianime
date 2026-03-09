import { z } from "zod";

const sceneCountSchema = z.union([
  z.literal("auto"),
  z.literal(20),
  z.literal(22),
  z.literal(25),
  z.literal(28),
  z.literal(30),
]);

const styleSchema = z.union([
  z.literal("cinematic anime"),
  z.literal("shonen action"),
  z.literal("slice of life"),
  z.literal("fantasy drama"),
]);

const colorGradePresetSchema = z.union([
  z.literal("vibrant cel-shaded"),
  z.literal("neon twilight"),
  z.literal("pastel dreamlight"),
  z.literal("inked dramatic contrast"),
]);

const phaseSchema = z.union([
  z.literal("Opening - Awareness"),
  z.literal("Understanding - Reframing"),
  z.literal("Turning Point - Action"),
  z.literal("Impact - Closing"),
]);

const beatRoleSchema = z.union([z.literal("hero"), z.literal("broll"), z.literal("transition")]);

export const beatItemSchema = z.object({
  beatNumber: z.number().int().positive(),
  phase: phaseSchema,
  role: beatRoleSchema,
  importance: z.union([z.literal("A"), z.literal("B"), z.literal("C")]),
  voLine: z.string().min(1),
  purpose: z.string().min(1),
});

export const generateRequestSchema = z.object({
  settings: z.object({
    title: z.string().trim().max(120).optional(),
    originalScript: z.string().trim().min(20, "Script is too short.").max(10000),
    lockedVoiceOver: z.string().trim().min(20).max(10000).optional().or(z.literal("")),
    referenceTag: z
      .string()
      .trim()
      .max(50)
      .regex(/^\[[A-Z0-9_]+\]$/i, "Reference tag must look like [AKI_REF].")
      .optional()
      .or(z.literal("")),
    sceneCount: sceneCountSchema,
    style: styleSchema,
    colorGradePreset: colorGradePresetSchema.optional(),
    strictMode: z.boolean().optional(),
  }),
  beatSheet: z.array(beatItemSchema).min(20).max(30).optional(),
  strict_mode: z.boolean().optional(),
});

export const sceneItemSchema = z.object({
  sceneNumber: z.number().int().positive(),
  phase: z.string().optional().or(z.literal("")),
  voLine: z.string().min(1),
  shotType: z.string().min(1),
  scenePurpose: z.string().min(1),
  importance: z.union([z.literal("A"), z.literal("B"), z.literal("C")]),
  useReferenceImage: z.boolean(),
  imagePrompt: z.string().min(1),
  videoPrompt: z.string().min(1),
  camera: z.string().min(1),
  lightingColor: z.string().min(1),
});

export const filmPackSchema = z.object({
  title: z.string().min(1),
  style: styleSchema,
  settingNote: z.string().min(1),
  preservedVoiceOverScript: z.string().min(1),
  characterReferenceGuidance: z.string().min(1),
  scenes: z.array(sceneItemSchema).min(20).max(30),
});
