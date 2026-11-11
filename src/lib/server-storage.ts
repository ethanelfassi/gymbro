import { promises as fs } from 'fs';
import path from 'path';
import { UnitSystem, WorkoutGoal } from './types';
import { getDefaultGoals } from './goals';

export interface ServerSettings {
  unit: UnitSystem;
  bodyweightLbs: number;
  excludeWarmup: boolean;
}

export interface StoredCsvPayload {
  csvText: string;
  filename: string;
  isCustom: boolean;
  hasDefault: boolean;
  updatedAt?: string;
}

interface CsvMeta {
  filename: string;
  updatedAt: string;
}

const DATA_DIR = process.env.GYMBRO_DATA_DIR
  ? path.resolve(process.env.GYMBRO_DATA_DIR)
  : path.join(process.cwd(), 'data');

const WORKOUT_CSV_PATH = path.join(DATA_DIR, 'workout_data.csv');
const CSV_META_PATH = path.join(DATA_DIR, 'csv_meta.json');
const GOALS_PATH = path.join(DATA_DIR, 'goals.json');
const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json');
const DEFAULT_PUBLIC_CSV_PATH = path.join(process.cwd(), 'public', 'liftoff_workout_data.csv');

const DEFAULT_SETTINGS: ServerSettings = {
  unit: 'lbs',
  bodyweightLbs: 170,
  excludeWarmup: true,
};

// Simple per-file mutex to serialize concurrent read-modify-write operations in-process.
const locks = new Map<string, Promise<unknown>>();

function withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const next = previous.then(task, task);
  const tracked = next.then(
    () => undefined,
    () => undefined
  );
  locks.set(key, tracked);
  return next;
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function writeFileAtomic(targetPath: string, content: string): Promise<void> {
  await ensureDataDir();
  const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, content, 'utf-8');
  await fs.rename(tmpPath, targetPath);
}

async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    console.error(`Failed to read JSON file ${filePath}:`, err);
    return null;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads the active CSV from server disk (`data/workout_data.csv`),
 * falling back to the repository's default Liftoff CSV if no custom import exists.
 */
export async function getStoredCsv(): Promise<StoredCsvPayload> {
  const hasDefault = await fileExists(DEFAULT_PUBLIC_CSV_PATH);

  if (await fileExists(WORKOUT_CSV_PATH)) {
    const [csvText, meta] = await Promise.all([
      fs.readFile(WORKOUT_CSV_PATH, 'utf-8'),
      readJsonSafe<CsvMeta>(CSV_META_PATH),
    ]);
    return {
      csvText,
      filename: meta?.filename || 'Import serveur',
      isCustom: true,
      hasDefault,
      updatedAt: meta?.updatedAt,
    };
  }

  if (hasDefault) {
    const csvText = await fs.readFile(DEFAULT_PUBLIC_CSV_PATH, 'utf-8');
    return {
      csvText,
      filename: 'Export Liftoff du projet',
      isCustom: false,
      hasDefault: true,
    };
  }

  return {
    csvText: '',
    filename: 'Aucune donnée',
    isCustom: false,
    hasDefault: false,
  };
}

/**
 * Persists an uploaded CSV and its metadata into `data/`.
 */
export async function saveStoredCsv(
  csvText: string,
  filename: string
): Promise<StoredCsvPayload> {
  return withLock('csv', async () => {
    const safeName = path.basename(filename || 'liftoff_export.csv').slice(0, 120);
    const updatedAt = new Date().toISOString();
    const meta: CsvMeta = { filename: safeName, updatedAt };
    const hasDefault = await fileExists(DEFAULT_PUBLIC_CSV_PATH);

    await writeFileAtomic(WORKOUT_CSV_PATH, csvText);
    await writeFileAtomic(CSV_META_PATH, JSON.stringify(meta, null, 2));

    return {
      csvText,
      filename: safeName,
      isCustom: true,
      hasDefault,
      updatedAt,
    };
  });
}

/**
 * Deletes the server-stored custom CSV so the app falls back to default data.
 */
export async function resetStoredCsv(): Promise<StoredCsvPayload> {
  return withLock('csv', async () => {
    await Promise.all([
      fs.rm(WORKOUT_CSV_PATH, { force: true }),
      fs.rm(CSV_META_PATH, { force: true }),
    ]);
    return getStoredCsv();
  });
}

/**
 * Loads persisted workout goals from `data/goals.json`, seeding defaults on first access.
 */
export async function getStoredGoals(): Promise<WorkoutGoal[]> {
  return withLock('goals', async () => {
    const existing = await readJsonSafe<WorkoutGoal[]>(GOALS_PATH);
    if (Array.isArray(existing)) {
      return existing;
    }
    const defaults = getDefaultGoals();
    await writeFileAtomic(GOALS_PATH, JSON.stringify(defaults, null, 2));
    return defaults;
  });
}

/**
 * Creates or updates a single goal by `id` in `data/goals.json`.
 */
export async function upsertStoredGoal(goal: WorkoutGoal): Promise<WorkoutGoal[]> {
  return withLock('goals', async () => {
    const existing = await readJsonSafe<WorkoutGoal[]>(GOALS_PATH);
    const list = Array.isArray(existing) ? existing : getDefaultGoals();
    const idx = list.findIndex((g) => g.id === goal.id);
    const updated =
      idx >= 0 ? list.map((g) => (g.id === goal.id ? goal : g)) : [...list, goal];
    await writeFileAtomic(GOALS_PATH, JSON.stringify(updated, null, 2));
    return updated;
  });
}

/**
 * Removes a goal by `id` from `data/goals.json`.
 */
export async function deleteStoredGoal(id: string): Promise<WorkoutGoal[]> {
  return withLock('goals', async () => {
    const existing = await readJsonSafe<WorkoutGoal[]>(GOALS_PATH);
    const list = Array.isArray(existing) ? existing : getDefaultGoals();
    const updated = list.filter((g) => g.id !== id);
    await writeFileAtomic(GOALS_PATH, JSON.stringify(updated, null, 2));
    return updated;
  });
}

/**
 * Loads user display/calculation settings from `data/settings.json`.
 */
export async function getStoredSettings(): Promise<ServerSettings> {
  return withLock('settings', async () => {
    const existing = await readJsonSafe<Partial<ServerSettings>>(SETTINGS_PATH);
    if (!existing) {
      await writeFileAtomic(SETTINGS_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2));
      return { ...DEFAULT_SETTINGS };
    }
    return {
      unit: existing.unit === 'kg' ? 'kg' : 'lbs',
      bodyweightLbs:
        typeof existing.bodyweightLbs === 'number' && existing.bodyweightLbs > 0
          ? existing.bodyweightLbs
          : DEFAULT_SETTINGS.bodyweightLbs,
      excludeWarmup:
        typeof existing.excludeWarmup === 'boolean'
          ? existing.excludeWarmup
          : DEFAULT_SETTINGS.excludeWarmup,
    };
  });
}

/**
 * Merges and persists user settings into `data/settings.json`.
 */
export async function updateStoredSettings(
  partial: Partial<ServerSettings>
): Promise<ServerSettings> {
  return withLock('settings', async () => {
    const current = (await readJsonSafe<Partial<ServerSettings>>(SETTINGS_PATH)) || {};
    const next: ServerSettings = {
      unit:
        partial.unit === 'kg' || partial.unit === 'lbs'
          ? partial.unit
          : current.unit === 'kg'
          ? 'kg'
          : DEFAULT_SETTINGS.unit,
      bodyweightLbs:
        typeof partial.bodyweightLbs === 'number' &&
        Number.isFinite(partial.bodyweightLbs) &&
        partial.bodyweightLbs > 0
          ? Math.round(partial.bodyweightLbs * 10) / 10
          : typeof current.bodyweightLbs === 'number' && current.bodyweightLbs > 0
          ? current.bodyweightLbs
          : DEFAULT_SETTINGS.bodyweightLbs,
      excludeWarmup:
        typeof partial.excludeWarmup === 'boolean'
          ? partial.excludeWarmup
          : typeof current.excludeWarmup === 'boolean'
          ? current.excludeWarmup
          : DEFAULT_SETTINGS.excludeWarmup,
    };
    await writeFileAtomic(SETTINGS_PATH, JSON.stringify(next, null, 2));
    return next;
  });
}
