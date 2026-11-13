import { NextRequest, NextResponse } from 'next/server';
import { WorkoutGoal } from '@/lib/types';
import { getStoredGoals, upsertStoredGoal, deleteStoredGoal } from '@/lib/server-storage';

export const dynamic = 'force-dynamic';

function isValidGoal(value: unknown): value is WorkoutGoal {
  if (!value || typeof value !== 'object') return false;
  const g = value as Partial<WorkoutGoal>;
  return (
    typeof g.id === 'string' &&
    g.id.trim().length > 0 &&
    typeof g.exerciseName === 'string' &&
    g.exerciseName.trim().length > 0 &&
    (g.targetMetric === '1rm' ||
      g.targetMetric === 'top_weight' ||
      g.targetMetric === 'reps' ||
      g.targetMetric === 'duration') &&
    typeof g.targetWeightLbs === 'number' &&
    Number.isFinite(g.targetWeightLbs) &&
    g.targetWeightLbs > 0 &&
    typeof g.targetDate === 'string' &&
    g.targetDate.trim().length > 0
  );
}

export async function GET() {
  try {
    const goals = await getStoredGoals();
    return NextResponse.json({ goals });
  } catch (err) {
    console.error('GET /api/goals error:', err);
    return NextResponse.json(
      { error: 'Impossible de charger les objectifs.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const candidate = body?.goal ?? body;

    if (!isValidGoal(candidate)) {
      return NextResponse.json(
        { error: 'Données d\'objectif invalides.' },
        { status: 400 }
      );
    }

    const goals = await upsertStoredGoal(candidate);
    return NextResponse.json({ goals });
  } catch (err) {
    console.error('POST /api/goals error:', err);
    return NextResponse.json(
      { error: 'Impossible d\'enregistrer l\'objectif.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Paramètre id manquant.' }, { status: 400 });
    }

    const goals = await deleteStoredGoal(id);
    return NextResponse.json({ goals });
  } catch (err) {
    console.error('DELETE /api/goals error:', err);
    return NextResponse.json(
      { error: 'Impossible de supprimer l\'objectif.' },
      { status: 500 }
    );
  }
}
