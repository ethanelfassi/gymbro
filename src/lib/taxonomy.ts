import { ExerciseMeta, MovementType, MuscleGroup } from './types';

export const EXERCISE_TAXONOMY: Record<string, ExerciseMeta> = {
  // PUSH
  "Développé couché": {
    category: "Push",
    mechanic: "standard",
    primaryMuscle: "Pectoraux",
    secondaryMuscles: ["Triceps", "Épaules Antérieures"],
  },
  "Développé couché avec haltères": {
    category: "Push",
    mechanic: "standard",
    primaryMuscle: "Pectoraux",
    secondaryMuscles: ["Triceps", "Épaules Antérieures"],
  },
  "Développé couché incliné": {
    category: "Push",
    mechanic: "standard",
    primaryMuscle: "Pectoraux",
    secondaryMuscles: ["Triceps", "Épaules Antérieures"],
  },
  "Développé couché incliné avec haltères": {
    category: "Push",
    mechanic: "standard",
    primaryMuscle: "Pectoraux",
    secondaryMuscles: ["Triceps", "Épaules Antérieures"],
  },
  "Développé incliné à la Smith Machine": {
    category: "Push",
    mechanic: "standard",
    primaryMuscle: "Pectoraux",
    secondaryMuscles: ["Triceps", "Épaules Antérieures"],
  },
  "Développé incliné à la machine": {
    category: "Push",
    mechanic: "standard",
    primaryMuscle: "Pectoraux",
    secondaryMuscles: ["Triceps", "Épaules Antérieures"],
  },
  "Presse pectorale": {
    category: "Push",
    mechanic: "standard",
    primaryMuscle: "Pectoraux",
    secondaryMuscles: ["Triceps", "Épaules Antérieures"],
  },
  "Machine pec fly": {
    category: "Push",
    mechanic: "standard",
    primaryMuscle: "Pectoraux",
  },
  "Pompes": {
    category: "Push",
    mechanic: "bodyweight",
    primaryMuscle: "Pectoraux",
    secondaryMuscles: ["Triceps", "Épaules Antérieures"],
  },
  "Dips": {
    category: "Push",
    mechanic: "bodyweight",
    primaryMuscle: "Pectoraux",
    secondaryMuscles: ["Triceps", "Épaules Antérieures"],
  },
  "Dips assistés": {
    category: "Push",
    mechanic: "assisted",
    primaryMuscle: "Pectoraux",
    secondaryMuscles: ["Triceps", "Épaules Antérieures"],
    linkedExercise: "Dips",
  },
  "Développé épaules assis avec haltères": {
    category: "Push",
    mechanic: "standard",
    primaryMuscle: "Épaules Antérieures",
    secondaryMuscles: ["Triceps", "Épaules Latérales"],
  },
  "Développé épaules assis à la Smith machine": {
    category: "Push",
    mechanic: "standard",
    primaryMuscle: "Épaules Antérieures",
    secondaryMuscles: ["Triceps", "Épaules Latérales"],
  },
  "Développé épaules à la machine": {
    category: "Push",
    mechanic: "standard",
    primaryMuscle: "Épaules Antérieures",
    secondaryMuscles: ["Triceps", "Épaules Latérales"],
  },
  "Élévations latérales haltères": {
    category: "Push",
    mechanic: "standard",
    primaryMuscle: "Épaules Latérales",
  },
  "Élévations latérales poulie": {
    category: "Push",
    mechanic: "standard",
    primaryMuscle: "Épaules Latérales",
  },
  "Extension triceps": {
    category: "Push",
    mechanic: "standard",
    primaryMuscle: "Triceps",
  },
  "Extension triceps avec haltères": {
    category: "Push",
    mechanic: "standard",
    primaryMuscle: "Triceps",
  },
  "Extension triceps à la corde": {
    category: "Push",
    mechanic: "standard",
    primaryMuscle: "Triceps",
  },
  "Extension triceps à la poulie haute": {
    category: "Push",
    mechanic: "standard",
    primaryMuscle: "Triceps",
  },
  "Pushdown triceps": {
    category: "Push",
    mechanic: "standard",
    primaryMuscle: "Triceps",
  },

  // PULL
  "Tirage vertical": {
    category: "Pull",
    mechanic: "standard",
    primaryMuscle: "Dos",
    secondaryMuscles: ["Biceps", "Épaules Postérieures"],
  },
  "Tirage à la machine": {
    category: "Pull",
    mechanic: "standard",
    primaryMuscle: "Dos",
    secondaryMuscles: ["Biceps"],
  },
  "Tirage assis à la poulie": {
    category: "Pull",
    mechanic: "standard",
    primaryMuscle: "Dos",
    secondaryMuscles: ["Biceps", "Épaules Postérieures"],
  },
  "Tirage buste penché": {
    category: "Pull",
    mechanic: "standard",
    primaryMuscle: "Dos",
    secondaryMuscles: ["Biceps", "Ischios & Fessiers"],
  },
  "Tirage T-bar avec support poitrine": {
    category: "Pull",
    mechanic: "standard",
    primaryMuscle: "Dos",
    secondaryMuscles: ["Biceps", "Épaules Postérieures"],
  },
  "Tirage bûcheron": {
    category: "Pull",
    mechanic: "standard",
    primaryMuscle: "Dos",
    secondaryMuscles: ["Biceps"],
  },
  "Tirage iso-latéral": {
    category: "Pull",
    mechanic: "standard",
    primaryMuscle: "Dos",
    secondaryMuscles: ["Biceps"],
  },
  "Tractions": {
    category: "Pull",
    mechanic: "bodyweight",
    primaryMuscle: "Dos",
    secondaryMuscles: ["Biceps"],
  },
  "Tractions assistées": {
    category: "Pull",
    mechanic: "assisted",
    primaryMuscle: "Dos",
    secondaryMuscles: ["Biceps"],
    linkedExercise: "Tractions",
  },
  "Soulevé de terre": {
    category: "Pull",
    mechanic: "standard",
    primaryMuscle: "Dos",
    secondaryMuscles: ["Ischios & Fessiers", "Avant-bras"],
  },
  "Écartés inversés à la machine": {
    category: "Pull",
    mechanic: "standard",
    primaryMuscle: "Épaules Postérieures",
    secondaryMuscles: ["Dos"],
  },
  "Curl avec haltères": {
    category: "Pull",
    mechanic: "standard",
    primaryMuscle: "Biceps",
    secondaryMuscles: ["Avant-bras"],
  },
  "Curl biceps à la machine": {
    category: "Pull",
    mechanic: "standard",
    primaryMuscle: "Biceps",
  },
  "Curl biceps à la poulie": {
    category: "Pull",
    mechanic: "standard",
    primaryMuscle: "Biceps",
  },
  "Curl marteau": {
    category: "Pull",
    mechanic: "standard",
    primaryMuscle: "Biceps",
    secondaryMuscles: ["Avant-bras"],
  },
  "Curl poignets haltères": {
    category: "Pull",
    mechanic: "standard",
    primaryMuscle: "Avant-bras",
  },
  "Cable Reverse Curl": {
    category: "Pull",
    mechanic: "standard",
    primaryMuscle: "Avant-bras",
    secondaryMuscles: ["Biceps"],
  },
  "Curl à la barre": {
    category: "Pull",
    mechanic: "standard",
    primaryMuscle: "Biceps",
  },
  "Curl à la barre EZ": {
    category: "Pull",
    mechanic: "standard",
    primaryMuscle: "Biceps",
  },
  "Dead Hang": {
    category: "Pull",
    mechanic: "duration",
    primaryMuscle: "Avant-bras",
    secondaryMuscles: ["Dos", "Abdominaux"],
  },

  // LEGS
  "Squat": {
    category: "Legs",
    mechanic: "standard",
    primaryMuscle: "Quadriceps",
    secondaryMuscles: ["Ischios & Fessiers"],
  },
  "Squat à la Smith Machine": {
    category: "Legs",
    mechanic: "standard",
    primaryMuscle: "Quadriceps",
    secondaryMuscles: ["Ischios & Fessiers"],
  },
  "Hack squat": {
    category: "Legs",
    mechanic: "standard",
    primaryMuscle: "Quadriceps",
    secondaryMuscles: ["Ischios & Fessiers"],
  },
  "Leg Press": {
    category: "Legs",
    mechanic: "standard",
    primaryMuscle: "Quadriceps",
    secondaryMuscles: ["Ischios & Fessiers"],
  },
  "Presse à cuisses": {
    category: "Legs",
    mechanic: "standard",
    primaryMuscle: "Quadriceps",
    secondaryMuscles: ["Ischios & Fessiers"],
  },
  "Presse à cuisses horizontale": {
    category: "Legs",
    mechanic: "standard",
    primaryMuscle: "Quadriceps",
    secondaryMuscles: ["Ischios & Fessiers"],
  },
  "Extension des jambes": {
    category: "Legs",
    mechanic: "standard",
    primaryMuscle: "Quadriceps",
  },
  "Leg curl assis": {
    category: "Legs",
    mechanic: "standard",
    primaryMuscle: "Ischios & Fessiers",
  },
  "Leg curl allongé": {
    category: "Legs",
    mechanic: "standard",
    primaryMuscle: "Ischios & Fessiers",
  },
  "Abduction des hanches": {
    category: "Legs",
    mechanic: "standard",
    primaryMuscle: "Ischios & Fessiers",
  },
  "Adduction des hanches": {
    category: "Legs",
    mechanic: "standard",
    primaryMuscle: "Quadriceps",
  },
  "Mollets à la machine": {
    category: "Legs",
    mechanic: "standard",
    primaryMuscle: "Mollets",
  },
  "Mollets à la presse": {
    category: "Legs",
    mechanic: "standard",
    primaryMuscle: "Mollets",
  },
  "Élévation des mollets assis": {
    category: "Legs",
    mechanic: "standard",
    primaryMuscle: "Mollets",
  },

  // CORE
  "Crunch assis à la machine": {
    category: "Core",
    mechanic: "standard",
    primaryMuscle: "Abdominaux",
  },
  "Crunch décliné": {
    category: "Core",
    mechanic: "bodyweight",
    primaryMuscle: "Abdominaux",
  },

  // CARDIO / OUTDOOR
  "Randonnée": {
    category: "Cardio",
    mechanic: "duration",
    primaryMuscle: "Quadriceps",
  },
  "Marche": {
    category: "Cardio",
    mechanic: "duration",
    primaryMuscle: "Quadriceps",
  },
};

export function getExerciseMeta(name: string): ExerciseMeta {
  const meta = EXERCISE_TAXONOMY[name.trim()];
  if (meta) return meta;

  // Fallback heuristic if unknown exercise is added later
  const lower = name.toLowerCase();
  if (lower.includes('curl') || lower.includes('tirage') || lower.includes('traction') || lower.includes('row')) {
    return {
      category: "Pull",
      mechanic: "standard",
      primaryMuscle: lower.includes('curl') ? "Biceps" : "Dos",
    };
  }
  if (lower.includes('squat') || lower.includes('leg') || lower.includes('mollet') || lower.includes('presse à cuisse')) {
    return {
      category: "Legs",
      mechanic: "standard",
      primaryMuscle: lower.includes('mollet') ? "Mollets" : (lower.includes('curl') ? "Ischios & Fessiers" : "Quadriceps"),
    };
  }
  return {
    category: "Push",
    mechanic: "standard",
    primaryMuscle: "Pectoraux",
  };
}
