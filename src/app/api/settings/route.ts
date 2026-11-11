import { NextRequest, NextResponse } from 'next/server';
import { getStoredSettings, updateStoredSettings } from '@/lib/server-storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getStoredSettings();
    return NextResponse.json(settings);
  } catch (err) {
    console.error('GET /api/settings error:', err);
    return NextResponse.json(
      { error: 'Impossible de charger les réglages.' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = await updateStoredSettings({
      unit: body?.unit,
      bodyweightLbs: body?.bodyweightLbs,
      excludeWarmup: body?.excludeWarmup,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('PUT /api/settings error:', err);
    return NextResponse.json(
      { error: 'Impossible de sauvegarder les réglages.' },
      { status: 500 }
    );
  }
}
