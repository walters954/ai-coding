import { NextRequest } from 'next/server';
import { EXISTING_ACCOUNTS } from '@/data/existing-accounts';
import { INBOUND_ACCOUNTS } from '@/data/inbound-accounts';
import { processInboundAccount } from '@/lib/dedupe-engine';
import { DedupeStrategy } from '@/types/crm';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      inboundIds,
      strategy = 'hybrid_jev',
      apiKey,
    }: {
      inboundIds: string[];
      strategy: DedupeStrategy;
      apiKey?: string;
    } = body;

    if (!Array.isArray(inboundIds) || inboundIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No inbound IDs provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Filter inbound accounts in requested order
    const inbounds = inboundIds
      .map((id) => INBOUND_ACCOUNTS.find((a) => a.id === id))
      .filter((a): a is NonNullable<typeof a> => Boolean(a));

    const encoder = new TextEncoder();

    // Stream results back as NDJSON
    const stream = new ReadableStream({
      async start(controller) {
        for (const inbound of inbounds) {
          try {
            const result = await processInboundAccount(
              inbound,
              EXISTING_ACCOUNTS,
              strategy,
              apiKey
            );
            const line = JSON.stringify(result) + '\n';
            controller.enqueue(encoder.encode(line));
          } catch (err: unknown) {
            const errorMsg =
              err instanceof Error ? err.message : 'Processing error';
            const errorResult = {
              error: true,
              inboundId: inbound.id,
              message: errorMsg,
            };
            controller.enqueue(
              encoder.encode(JSON.stringify(errorResult) + '\n')
            );
          }
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (error: unknown) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
