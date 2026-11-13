import Papa from 'papaparse';
import {
  RawWorkoutRow,
  WorkoutSession,
  WorkoutSet,
  TimePeriodFilter,
  UnitSystem,
  MuscleGroup,
  MovementType,
  ExerciseMechanic,
} from './types';
import { getExerciseMeta } from './taxonomy';

export function parseDurationToMinutes(durationStr?: string): number {
  if (!durationStr) return 0;
  // Format: "01 hours 09 minutes 10 seconds" or similar
  const hoursMatch = durationStr.match(/(\d+)\s*hour/i);
  const minutesMatch = durationStr.match(/(\d+)\s*minute/i);
  const secondsMatch = durationStr.match(/(\d+)\s*second/i);

  const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
  const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;
  const seconds = secondsMatch ? parseInt(secondsMatch[1], 10) : 0;

  return Math.round((hours * 60 + minutes + seconds / 60) * 10) / 10;
}

export function estimate1rm(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  // Epley formula: w * (1 + r / 30)
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function lbsToKg(lbs: number): number {
  return Math.round((lbs * 0.45359237) * 10) / 10;
}

export function kgToLbs(kg: number): number {
  return Math.round((kg / 0.45359237) * 10) / 10;
}

export function formatWeight(lbs: number, unit: UnitSystem): string {
  if (unit === 'kg') {
    return `${lbsToKg(lbs)} kg`;
  }
  return `${Math.round(lbs * 10) / 10} lbs`;
}

/**
 * Filter out test entries, placeholders, or aberrant data points
 * (e.g. 1 rep at 1 lb on a barbell/machine exercise, empty sets, or corrupt logs)
 */
export function isAberrantSet(
  rawWeight: number,
  reps: number,
  durationSec: number,
  distance: number,
  meta: ReturnType<typeof getExerciseMeta>
): boolean {
  // If duration / cardio exercise, valid if seconds or distance > 0
  if (meta.mechanic === 'duration' || meta.category === 'Cardio') {
    return durationSec <= 0 && distance <= 0 && reps <= 0;
  }

  // If empty set (0 reps, 0 seconds, 0 distance)
  if (reps <= 0 && durationSec <= 0 && distance <= 0) {
    return true;
  }

  // Bodyweight exercises (Dips, Pompes, Tractions, Crunch)
  if (meta.mechanic === 'bodyweight') {
    return reps <= 0;
  }

  // Standard or assisted exercises:
  // Placeholder/test sets like 1 rep at 1 lb, 2 reps at 1 lb, 1 rep at 2 lbs
  if (rawWeight <= 5 && reps <= 2) {
    return true;
  }

  // Standard weighted exercises with 0 weight and <= 2 reps
  if (meta.mechanic === 'standard' && rawWeight <= 0 && reps <= 2) {
    return true;
  }

  return false;
}

export function extractAllExerciseNotes(csvText: string): Map<string, string[]> {
  const result = Papa.parse<RawWorkoutRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const notesMap = new Map<string, Set<string>>();

  for (const r of result.data) {
    const exName = r["Nom de l'exercice"]?.trim();
    const note = r.Notes?.trim();
    if (!exName || !note) continue;

    if (!notesMap.has(exName)) {
      notesMap.set(exName, new Set());
    }
    notesMap.get(exName)!.add(note);
  }

  const finalMap = new Map<string, string[]>();
  for (const [ex, setOfNotes] of Array.from(notesMap.entries())) {
    finalMap.set(ex, Array.from(setOfNotes));
  }
  return finalMap;
}

export function cleanAndParseLiftoffCSV(
  csvText: string,
  userBodyweightLbs: number = 170
): WorkoutSession[] {
  const result = Papa.parse<RawWorkoutRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = result.data;
  
  // Group rows by Date (which uniquely identifies each session)
  const sessionMap = new Map<string, RawWorkoutRow[]>();

  for (const r of rows) {
    if (!r.Date) continue;
    const exerciseName = r["Nom de l'exercice"]?.trim();
    // Filter out corrupt / empty session rows with no exercise
    if (!exerciseName) continue;

    if (!sessionMap.has(r.Date)) {
      sessionMap.set(r.Date, []);
    }
    sessionMap.get(r.Date)!.push(r);
  }

  const sessions: WorkoutSession[] = [];

  for (const [dateStr, sessionRows] of Array.from(sessionMap.entries())) {
    // Determine session metadata
    const firstRow = sessionRows[0];
    const durationMinutes = parseDurationToMinutes(firstRow.Durée);
    const sessionTitle = firstRow["Nom de la séance"]?.trim() || undefined;
    const dateObj = new Date(dateStr.replace(' ', 'T'));
    const timestamp = isNaN(dateObj.getTime()) ? new Date(dateStr).getTime() : dateObj.getTime();

    // Group by exercise within the session
    const exerciseGroups = new Map<string, RawWorkoutRow[]>();
    for (const row of sessionRows) {
      const ex = row["Nom de l'exercice"]?.trim() || 'Inconnu';
      if (!exerciseGroups.has(ex)) {
        exerciseGroups.set(ex, []);
      }
      exerciseGroups.get(ex)!.push(row);
    }

    const sessionExercises: WorkoutSession['exercises'] = [];
    let isAllCardio = true;

    for (const [exName, exRows] of Array.from(exerciseGroups.entries())) {
      const meta = getExerciseMeta(exName);
      if (meta.category !== 'Cardio') {
        isAllCardio = false;
      }

      // First pass: find max weight to accurately tag warmups (<65% of top set)
      let maxSetWeight = 0;
      for (const r of exRows) {
        const w = parseFloat(String(r.Poids || 0));
        if (w > maxSetWeight) maxSetWeight = w;
      }

      const sets: WorkoutSet[] = [];
      let exTotalVolume = 0;
      let effectiveSetsCount = 0;
      let topSetWeight = 0;
      let topSetReps = 0;
      let topSet1rm = 0;
      let topSetScore = 0;
      let topSetDuration = 0;
      let totalDuration = 0;
      let hasTopSet = false;

      exRows.forEach((r, idx) => {
        const rawWeight = parseFloat(String(r.Poids || 0));
        const reps = parseInt(String(r.Réps || 0), 10);
        const durationSec = parseInt(String(r.Secondes || 0), 10);
        const distance = parseFloat(String(r.Distance || 0));
        const order = parseInt(String(r["Ordre des séries"] || idx), 10);
        const notes = r.Notes?.trim() || undefined;

        // Skip aberrant / placeholder test sets (e.g. 1 rep @ 1 lb on barbell, 0 reps/seconds, etc.)
        if (isAberrantSet(rawWeight, reps, durationSec, distance, meta)) {
          return;
        }

        // Warmup rule: only applies to standard exercises (<65% of max weight on first set)
        const isWarmup =
          meta.mechanic === 'standard' &&
          maxSetWeight > 0 &&
          order === 0 &&
          rawWeight < maxSetWeight * 0.65;

        // Effective load for assisted/bodyweight/duration exercises
        let effectiveLoad = rawWeight;
        if (meta.mechanic === 'assisted') {
          effectiveLoad = Math.max(5, userBodyweightLbs - rawWeight);
        } else if (meta.mechanic === 'bodyweight') {
          effectiveLoad = userBodyweightLbs + rawWeight;
        } else if (meta.mechanic === 'duration') {
          effectiveLoad = rawWeight;
        }

        const est1rm =
          meta.mechanic === 'duration'
            ? 0
            : meta.mechanic === 'assisted' || meta.mechanic === 'bodyweight'
            ? estimate1rm(effectiveLoad, reps)
            : estimate1rm(rawWeight, reps);

        const setObj: WorkoutSet = {
          id: `${dateStr}_${exName}_${idx}`,
          exerciseName: exName,
          setIndex: order,
          weightLbs: rawWeight,
          weightKg: lbsToKg(rawWeight),
          reps,
          durationSeconds: durationSec,
          distance,
          isWarmup,
          estimated1rmLbs: est1rm,
          estimated1rmKg: lbsToKg(est1rm),
          effectiveLoadLbs: effectiveLoad,
          notes,
        };

        sets.push(setObj);

        if (!isWarmup) {
          effectiveSetsCount++;

          if (meta.mechanic === 'duration') {
            totalDuration += durationSec;
            const setScore = durationSec > 0 ? durationSec : distance * 1000;
            if (
              !hasTopSet ||
              durationSec > topSetDuration ||
              (durationSec === topSetDuration && setScore > topSetScore)
            ) {
              topSetDuration = durationSec;
              topSetScore = setScore;
              topSetWeight = rawWeight;
              topSetReps = reps;
              topSet1rm = 0;
              hasTopSet = true;
            }
          } else if (meta.mechanic === 'bodyweight') {
            exTotalVolume += effectiveLoad * reps;
            const setScore = effectiveLoad * reps;
            if (
              !hasTopSet ||
              setScore > topSetScore ||
              (setScore === topSetScore && reps > topSetReps)
            ) {
              topSetScore = setScore;
              topSetWeight = rawWeight;
              topSetReps = reps;
              topSet1rm = est1rm;
              hasTopSet = true;
            }
          } else if (meta.mechanic === 'assisted') {
            exTotalVolume += effectiveLoad * reps;
            const setScore = effectiveLoad * reps;
            if (
              !hasTopSet ||
              setScore > topSetScore ||
              (setScore === topSetScore && rawWeight < topSetWeight)
            ) {
              topSetScore = setScore;
              topSetWeight = rawWeight;
              topSetReps = reps;
              topSet1rm = est1rm;
              hasTopSet = true;
            }
          } else {
            exTotalVolume += rawWeight * reps;
            const setScore = rawWeight * reps;
            if (
              !hasTopSet ||
              setScore > topSetScore ||
              (setScore === topSetScore && rawWeight > topSetWeight)
            ) {
              topSetScore = setScore;
              topSetWeight = rawWeight;
              topSetReps = reps;
              topSet1rm = est1rm;
              hasTopSet = true;
            }
          }
        }
      });

      // If all sets were aberrant/filtered out, do not register this exercise in the session
      if (sets.length === 0) {
        continue;
      }

      // If no working top set was selected (e.g. all warmup), fallback to best set
      if (!hasTopSet && sets.length > 0) {
        let bestSet = sets[0];
        let maxScore = -1;
        for (const st of sets) {
          const sScore =
            meta.mechanic === 'duration'
              ? st.durationSeconds
              : st.effectiveLoadLbs * st.reps;
          if (sScore >= maxScore) {
            maxScore = sScore;
            bestSet = st;
          }
        }
        topSetWeight = bestSet.weightLbs;
        topSetReps = bestSet.reps;
        topSet1rm = bestSet.estimated1rmLbs;
        topSetDuration = bestSet.durationSeconds;
        topSetScore = Math.max(0, maxScore);
      }

      sessionExercises.push({
        name: exName,
        sets,
        meta,
        totalVolumeLbs: exTotalVolume,
        effectiveSetsCount,
        topSetWeightLbs: topSetWeight,
        topSetReps: topSetReps,
        topSet1rmLbs: topSet1rm,
        topSetScoreLbs: topSetScore,
        topSetDurationSeconds: topSetDuration,
        totalDurationSeconds: totalDuration,
      });
    }

    // Skip sessions that have 0 valid exercises
    if (sessionExercises.length === 0) {
      continue;
    }

    // Auto classify session split (Push / Pull / Legs / Upper / Full Body / Cardio)
    let pushCount = 0;
    let pullCount = 0;
    let legsCount = 0;
    let cardioCount = 0;

    for (const ex of sessionExercises) {
      if (ex.meta.category === 'Push') pushCount += ex.effectiveSetsCount || 1;
      else if (ex.meta.category === 'Pull') pullCount += ex.effectiveSetsCount || 1;
      else if (ex.meta.category === 'Legs') legsCount += ex.effectiveSetsCount || 1;
      else if (ex.meta.category === 'Cardio') cardioCount += 1;
    }

    let detectedType: WorkoutSession['detectedType'] = 'Full Body';
    const totalWorkingSets = pushCount + pullCount + legsCount;

    if (isAllCardio || (cardioCount > 0 && totalWorkingSets === 0)) {
      detectedType = 'Cardio';
    } else if (pushCount >= totalWorkingSets * 0.65) {
      detectedType = 'Push';
    } else if (pullCount >= totalWorkingSets * 0.65) {
      detectedType = 'Pull';
    } else if (legsCount >= totalWorkingSets * 0.65) {
      detectedType = 'Legs';
    } else if (legsCount === 0 && pushCount > 0 && pullCount > 0) {
      detectedType = 'Upper';
    } else {
      detectedType = 'Full Body';
    }

    const totalSessionVolume = sessionExercises.reduce((acc, curr) => acc + curr.totalVolumeLbs, 0);
    const totalSessionSets = sessionExercises.reduce((acc, curr) => acc + curr.effectiveSetsCount, 0);

    sessions.push({
      id: dateStr,
      dateStr: dateStr.split(' ')[0],
      rawDate: dateStr,
      timestamp,
      durationMinutes,
      sessionTitle,
      detectedType,
      exercises: sessionExercises,
      totalEffectiveSets: totalSessionSets,
      totalVolumeLbs: totalSessionVolume,
      isCardioOnly: isAllCardio,
    });
  }

  // Sort chronologically ascending
  sessions.sort((a, b) => a.timestamp - b.timestamp);

  return sessions;
}

export function filterSessionsByPeriod(
  sessions: WorkoutSession[],
  period: TimePeriodFilter
): WorkoutSession[] {
  if (period === 'all') return sessions;

  // Find latest timestamp
  const latestTs = sessions.length > 0 ? sessions[sessions.length - 1].timestamp : Date.now();

  if (period === '30d') {
    const cutoff = latestTs - 30 * 24 * 3600 * 1000;
    return sessions.filter((s) => s.timestamp >= cutoff);
  }

  if (period === '90d') {
    const cutoff = latestTs - 90 * 24 * 3600 * 1000;
    return sessions.filter((s) => s.timestamp >= cutoff);
  }

  if (period === 'block_2026') {
    // Current block: from August 1st, 2026 onwards
    const cutoff = new Date('2026-08-01T00:00:00').getTime();
    return sessions.filter((s) => s.timestamp >= cutoff);
  }

  if (period === 'block_2024_2025') {
    // Initial block: from July 2024 up to May 2025
    const cutoffEnd = new Date('2025-06-01T00:00:00').getTime();
    return sessions.filter((s) => s.timestamp < cutoffEnd);
  }

  return sessions;
}

export interface ExerciseProgressionAnalysis {
  exerciseName: string;
  category: MovementType;
  mechanic: ExerciseMechanic;
  primaryMuscle: MuscleGroup;
  totalSessionsCount: number;
  lastSessionDate: string;
  lastTopSetWeight: number;
  lastTopSetReps: number;
  lastEstimated1rm: number;
  lastTopSetDurationSeconds: number;
  lastTotalDurationSeconds: number;
  lastEffectiveLoadLbs: number;
  historicalMaxWeight: number;
  historicalMax1rm: number;
  historicalMaxDurationSeconds: number;
  historicalMaxReps: number;
  status: 'progression' | 'plateau' | 'regression';
  statusReason: string;
  nextSessionGoal: {
    targetWeightLbs: number;
    targetReps: string;
    rationale: string;
  };
  recentSessions: {
    date: string;
    topWeight: number;
    topReps: number;
    estimated1rm: number;
    volume: number;
    workingSetsCount: number;
  }[];
}

export function analyzeExerciseProgression(
  exerciseName: string,
  sessions: WorkoutSession[],
  userBodyweightLbs: number = 170
): ExerciseProgressionAnalysis | null {
  // Extract all sessions containing this exercise
  const sessionsWithEx: {
    date: string;
    timestamp: number;
    topWeight: number;
    topReps: number;
    estimated1rm: number;
    topDuration: number;
    totalDuration: number;
    totalReps: number;
    volume: number;
    sets: WorkoutSet[];
  }[] = [];

  for (const s of sessions) {
    const exData = s.exercises.find((e) => e.name === exerciseName);
    if (!exData || exData.sets.length === 0) continue;

    const workingSets = exData.sets.filter((st) => !st.isWarmup);
    const setsToUse = workingSets.length > 0 ? workingSets : exData.sets;
    const totalReps = setsToUse.reduce((acc, st) => acc + st.reps, 0);

    sessionsWithEx.push({
      date: s.dateStr,
      timestamp: s.timestamp,
      topWeight: exData.topSetWeightLbs,
      topReps: exData.topSetReps,
      estimated1rm: exData.topSet1rmLbs,
      topDuration: exData.topSetDurationSeconds || 0,
      totalDuration: exData.totalDurationSeconds || 0,
      totalReps,
      volume: exData.totalVolumeLbs,
      sets: setsToUse,
    });
  }

  if (sessionsWithEx.length === 0) return null;

  const meta = getExerciseMeta(exerciseName);
  const totalCount = sessionsWithEx.length;
  const recent = sessionsWithEx.slice(-5); // last up to 5 sessions
  const last = recent[recent.length - 1];

  let histMaxWeight = 0;
  let histMax1rm = 0;
  let histMaxDuration = 0;
  let histMaxReps = 0;
  for (const item of sessionsWithEx) {
    if (item.topWeight > histMaxWeight) histMaxWeight = item.topWeight;
    if (item.estimated1rm > histMax1rm) histMax1rm = item.estimated1rm;
    if (item.topDuration > histMaxDuration) histMaxDuration = item.topDuration;
    for (const st of item.sets) {
      if (st.reps > histMaxReps) histMaxReps = st.reps;
      if (st.durationSeconds > histMaxDuration) histMaxDuration = st.durationSeconds;
    }
  }

  const lastEffectiveLoadLbs =
    meta.mechanic === 'assisted'
      ? Math.max(5, userBodyweightLbs - last.topWeight)
      : meta.mechanic === 'bodyweight'
      ? userBodyweightLbs + last.topWeight
      : last.topWeight;

  // Purely mathematical progression status
  let status: 'progression' | 'plateau' | 'regression' = 'plateau';
  let statusReason = "Performances stables sur les dernières séances";

  let targetWeight = last.topWeight;
  let targetReps = `${last.topReps + 1} réps`;
  let rationale = `Valider 1 rép supplémentaire à ${last.topWeight} lbs`;

  if (meta.mechanic === 'duration') {
    if (recent.length >= 2) {
      const prev = recent[recent.length - 2];
      const diffDuration = last.topDuration - prev.topDuration;
      if (diffDuration >= 2 || (diffDuration === 0 && last.totalDuration > prev.totalDuration)) {
        status = 'progression';
        statusReason =
          diffDuration > 0
            ? `+${diffDuration}s sur la meilleure série (${last.topDuration}s vs ${prev.topDuration}s)`
            : `Temps cumulé en hausse (${last.totalDuration}s sur la séance)`;
      } else if (diffDuration <= -5) {
        status = 'regression';
        statusReason = `Légère baisse de maintien (${last.topDuration}s vs ${prev.topDuration}s)`;
      } else {
        status = 'plateau';
        statusReason = `Maintien stable autour de ${last.topDuration}s (record : ${histMaxDuration}s)`;
      }
    } else {
      statusReason = `Meilleure série enregistrée : ${last.topDuration}s`;
    }

    const nextSec = last.topDuration + 5;
    targetWeight = 0;
    targetReps = `${nextSec} sec`;
    rationale = `Viser +5 secondes de maintien sur la 1ère série (${nextSec}s au lieu de ${last.topDuration}s).`;
  } else if (meta.mechanic === 'bodyweight') {
    if (recent.length >= 2) {
      const prev = recent[recent.length - 2];
      const diffWeight = last.topWeight - prev.topWeight;
      const diffReps = last.topReps - prev.topReps;
      if (
        diffWeight > 0 ||
        (diffWeight === 0 && diffReps >= 1) ||
        (diffWeight === 0 && diffReps === 0 && last.totalReps > prev.totalReps)
      ) {
        status = 'progression';
        statusReason =
          diffWeight > 0
            ? `+${diffWeight} lbs de lest (${last.topReps} réps)`
            : diffReps > 0
            ? `+${diffReps} rép${diffReps > 1 ? 's' : ''} au poids du corps (${last.topReps} réps vs ${prev.topReps})`
            : `Volume en hausse (${last.totalReps} réps cumulées sur la séance)`;
      } else if (diffWeight < 0 || (diffWeight === 0 && diffReps <= -2)) {
        status = 'regression';
        statusReason = `Moins de répétitions sur le top set (${last.topReps} réps vs ${prev.topReps} réps)`;
      } else {
        status = 'plateau';
        statusReason = `Stable à ${last.topReps} réps au poids du corps (record : ${histMaxReps} réps)`;
      }
    }

    targetWeight = last.topWeight;
    if (last.topReps >= 12) {
      targetReps = `${last.topReps + 1} réps (ou lest +10 lbs)`;
      rationale = `Palier de 12 réps atteint : viser ${last.topReps + 1} réps au PDC ou ajouter +10 lbs de lest (8 réps).`;
    } else {
      targetReps = `${last.topReps + 1} réps`;
      rationale = `Poids du corps : viser ${last.topReps + 1} réps sur la 1ère série (record actuel : ${histMaxReps} réps).`;
    }
  } else if (meta.mechanic === 'assisted') {
    if (recent.length >= 2) {
      const prev = recent[recent.length - 2];
      const assistReduction = prev.topWeight - last.topWeight;
      const lastEff = Math.max(5, userBodyweightLbs - last.topWeight);
      const prevEff = Math.max(5, userBodyweightLbs - prev.topWeight);
      const diffScore = lastEff * last.topReps - prevEff * prev.topReps;
      const diffReps = last.topReps - prev.topReps;

      if (
        (assistReduction > 0 && last.topReps >= prev.topReps - 3) ||
        (assistReduction === 0 && diffReps >= 1) ||
        diffScore > 10
      ) {
        status = 'progression';
        statusReason =
          assistReduction > 0
            ? `Assistance réduite de -${assistReduction} lbs (-${last.topWeight} lbs × ${last.topReps} réps)`
            : `+${diffReps} rép${diffReps > 1 ? 's' : ''} avec -${last.topWeight} lbs d'assistance (${last.topReps} réps)`;
      } else if (assistReduction < 0 || (assistReduction === 0 && diffReps <= -2)) {
        status = 'regression';
        statusReason = `Série à ${last.topReps} réps avec -${last.topWeight} lbs d'assistance (vs ${prev.topReps} réps)`;
      } else {
        status = 'plateau';
        statusReason = `Stable avec -${last.topWeight} lbs d'assistance (${last.topReps} réps)`;
      }
    }

    if (last.topReps >= 10 && last.topWeight > 0) {
      const nextWeight = Math.max(0, last.topWeight - 5);
      targetWeight = nextWeight;
      targetReps = "6 à 8 réps";
      rationale = `Palier validé (${last.topReps} réps). Réduire l'assistance à ${nextWeight} lbs.`;
    } else {
      targetWeight = last.topWeight;
      targetReps = `${last.topReps + 1} réps`;
      rationale = `Viser +1 rép avec la même assistance (-${last.topWeight} lbs).`;
    }
  } else {
    // Standard weighted exercise
    if (recent.length >= 2) {
      const prev = recent[recent.length - 2];
      const lastScore = last.topWeight * last.topReps;
      const prevScore = prev.topWeight * prev.topReps;
      const diffScore = lastScore - prevScore;
      const diff1rm = last.estimated1rm - prev.estimated1rm;
      const diffWeight = last.topWeight - prev.topWeight;
      const diffReps = last.topReps - prev.topReps;

      if (diffScore > 10 || diff1rm > 1.5 || (diffWeight === 0 && diffReps >= 1) || (diffWeight > 0 && diffReps >= 0)) {
        status = 'progression';
        statusReason = diffWeight > 0 && diffReps >= 0
          ? `+${diffWeight} lbs sur le top set (${last.topWeight} lbs × ${last.topReps})`
          : diffWeight === 0 && diffReps > 0
          ? `+${diffReps} rép à même charge (${last.topReps} réps à ${last.topWeight} lbs)`
          : `Volume du top set en hausse (+${Math.round(diffScore)} lbs en charge × réps)`;
      } else if (diffScore < -30 || diff1rm < -3 || (diffWeight === 0 && diffReps <= -2) || diffWeight < -5) {
        status = 'regression';
        statusReason = `Légère baisse de performance (-${Math.abs(Math.round(diffScore))} lbs en charge × réps)`;
      } else {
        status = 'plateau';
        statusReason = `Charge et réps identiques sur les ${Math.min(recent.length, 3)} dernières séances`;
      }
    }

    if (last.topReps >= 12) {
      targetWeight = last.topWeight + 5;
      targetReps = "8 à 10 réps";
      rationale = `Palier de 12 réps validé. Monter la charge de +5 lbs (${targetWeight} lbs).`;
    } else {
      targetWeight = last.topWeight;
      targetReps = `${Math.min(12, last.topReps + 1)} réps`;
      rationale = `Conserver ${last.topWeight} lbs et chercher à battre ${last.topReps} réps sur la 1ère série.`;
    }
  }

  return {
    exerciseName,
    category: meta.category,
    mechanic: meta.mechanic,
    primaryMuscle: meta.primaryMuscle,
    totalSessionsCount: totalCount,
    lastSessionDate: last.date,
    lastTopSetWeight: last.topWeight,
    lastTopSetReps: last.topReps,
    lastEstimated1rm: last.estimated1rm,
    lastTopSetDurationSeconds: last.topDuration,
    lastTotalDurationSeconds: last.totalDuration,
    lastEffectiveLoadLbs,
    historicalMaxWeight: histMaxWeight,
    historicalMax1rm: histMax1rm,
    historicalMaxDurationSeconds: histMaxDuration,
    historicalMaxReps: histMaxReps,
    status,
    statusReason,
    nextSessionGoal: {
      targetWeightLbs: targetWeight,
      targetReps,
      rationale,
    },
    recentSessions: recent.map((r) => ({
      date: r.date,
      topWeight: r.topWeight,
      topReps: r.topReps,
      estimated1rm: r.estimated1rm,
      volume: r.volume,
      workingSetsCount: r.sets.length,
    })),
  };
}

export interface IntraSessionFatigue {
  exerciseName: string;
  date: string;
  firstWorkingSetReps: number;
  lastWorkingSetReps: number;
  firstWorkingSetWeight: number;
  lastWorkingSetWeight: number;
  dropOffPercentage: number; // e.g. -25%
  workingSetsCount: number;
}

export function computeIntraSessionFatigue(sessions: WorkoutSession[]): IntraSessionFatigue[] {
  const result: IntraSessionFatigue[] = [];

  for (const s of sessions) {
    for (const ex of s.exercises) {
      const workingSets = ex.sets.filter((st) => !st.isWarmup && st.reps > 0);
      if (workingSets.length < 2) continue;

      const firstSet = workingSets[0];
      const lastSet = workingSets[workingSets.length - 1];

      // Drop off in reps if weight is similar
      const repDrop = ((lastSet.reps - firstSet.reps) / firstSet.reps) * 100;

      result.push({
        exerciseName: ex.name,
        date: s.dateStr,
        firstWorkingSetReps: firstSet.reps,
        lastWorkingSetReps: lastSet.reps,
        firstWorkingSetWeight: firstSet.weightLbs,
        lastWorkingSetWeight: lastSet.weightLbs,
        dropOffPercentage: Math.round(repDrop),
        workingSetsCount: workingSets.length,
      });
    }
  }

  return result;
}

export function computeMuscleVolumeDistribution(sessions: WorkoutSession[]) {
  // Muscle distribution with 1.0 for primary and 0.5 for secondary
  const distribution: Record<MuscleGroup, { effectiveSets: number; totalVolumeLbs: number }> = {
    'Pectoraux': { effectiveSets: 0, totalVolumeLbs: 0 },
    'Dos': { effectiveSets: 0, totalVolumeLbs: 0 },
    'Épaules Latérales': { effectiveSets: 0, totalVolumeLbs: 0 },
    'Épaules Antérieures': { effectiveSets: 0, totalVolumeLbs: 0 },
    'Épaules Postérieures': { effectiveSets: 0, totalVolumeLbs: 0 },
    'Triceps': { effectiveSets: 0, totalVolumeLbs: 0 },
    'Biceps': { effectiveSets: 0, totalVolumeLbs: 0 },
    'Avant-bras': { effectiveSets: 0, totalVolumeLbs: 0 },
    'Quadriceps': { effectiveSets: 0, totalVolumeLbs: 0 },
    'Ischios & Fessiers': { effectiveSets: 0, totalVolumeLbs: 0 },
    'Mollets': { effectiveSets: 0, totalVolumeLbs: 0 },
    'Abdominaux': { effectiveSets: 0, totalVolumeLbs: 0 },
  };

  for (const s of sessions) {
    for (const ex of s.exercises) {
      const workingSets = ex.sets.filter((st) => !st.isWarmup);
      const setCount = workingSets.length;
      if (setCount === 0) continue;

      // Primary muscle: 1.0 weight
      if (distribution[ex.meta.primaryMuscle]) {
        distribution[ex.meta.primaryMuscle].effectiveSets += setCount * 1.0;
        distribution[ex.meta.primaryMuscle].totalVolumeLbs += ex.totalVolumeLbs;
      }

      // Secondary muscles: 0.5 weight
      if (ex.meta.secondaryMuscles) {
        for (const sec of ex.meta.secondaryMuscles) {
          if (distribution[sec]) {
            distribution[sec].effectiveSets += setCount * 0.5;
            distribution[sec].totalVolumeLbs += ex.totalVolumeLbs * 0.5;
          }
        }
      }
    }
  }

  return distribution;
}
