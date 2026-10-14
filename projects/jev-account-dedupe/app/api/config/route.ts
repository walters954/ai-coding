import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const hasGatewayKey = Boolean(process.env.AI_GATEWAY_API_KEY);
  const hasTypeSafeKey = Boolean(process.env.TYPESAFE_API_KEY);

  return NextResponse.json({
    hasGatewayKey,
    hasTypeSafeKey,
    hasEnvKey: hasGatewayKey || hasTypeSafeKey,
    envKeyProvider: hasTypeSafeKey
      ? 'TypeSafe AI'
      : hasGatewayKey
        ? 'AI Gateway'
        : null,
  });
}
