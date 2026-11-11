import { NextRequest, NextResponse } from 'next/server';
import { getStoredCsv, saveStoredCsv, resetStoredCsv } from '@/lib/server-storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const payload = await getStoredCsv();
    return NextResponse.json(payload);
  } catch (err) {
    console.error('GET /api/csv error:', err);
    return NextResponse.json(
      { error: 'Impossible de charger les données CSV depuis le serveur.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const csvText = typeof body?.csvText === 'string' ? body.csvText : '';
    const filename = typeof body?.filename === 'string' ? body.filename : 'liftoff_export.csv';

    if (!csvText.trim()) {
      return NextResponse.json(
        { error: 'Le contenu CSV fourni est vide.' },
        { status: 400 }
      );
    }

    const saved = await saveStoredCsv(csvText, filename);
    return NextResponse.json({
      filename: saved.filename,
      isCustom: saved.isCustom,
      hasDefault: saved.hasDefault,
      updatedAt: saved.updatedAt,
    });
  } catch (err) {
    console.error('POST /api/csv error:', err);
    return NextResponse.json(
      { error: 'Impossible de sauvegarder le fichier CSV sur le serveur.' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const fallback = await resetStoredCsv();
    return NextResponse.json(fallback);
  } catch (err) {
    console.error('DELETE /api/csv error:', err);
    return NextResponse.json(
      { error: 'Impossible de réinitialiser le CSV sur le serveur.' },
      { status: 500 }
    );
  }
}
