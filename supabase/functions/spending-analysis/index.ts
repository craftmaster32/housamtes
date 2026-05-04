import Anthropic from 'npm:@anthropic-ai/sdk';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CategorySpend {
  name: string;
  amount: number;
}

interface MonthSpend {
  label: string;
  total: number;
  houseTotal: number;
  houseCategories: CategorySpend[];
}

interface RequestBody {
  months: MonthSpend[];
  userName: string;
  currency: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

  try {
    const body = (await req.json()) as RequestBody;
    const { months, userName, currency } = body;

    if (!Array.isArray(months) || months.length === 0) {
      return new Response(
        JSON.stringify({ error: 'months must be a non-empty array' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const current = months[0];
    const previous = months[1];

    if (
      typeof current.houseTotal !== 'number' ||
      !Array.isArray(current.houseCategories) ||
      typeof current.total !== 'number'
    ) {
      return new Response(
        JSON.stringify({ error: 'Invalid month data structure' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const sym = currency || '£';

    if (current.houseTotal === 0) {
      return new Response(
        JSON.stringify({ insight: 'No spending recorded yet — add some bills to see your analysis.' }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const topCategories = current.houseCategories
      .slice(0, 3)
      .map((c) => `${c.name}: ${sym}${c.amount.toFixed(0)}`)
      .join(', ');

    const prevLine = previous
      ? `Last month (${previous.label}): house ${sym}${previous.houseTotal.toFixed(0)}, ${userName}'s share ${sym}${previous.total.toFixed(0)}.`
      : '';

    const prompt = [
      `You are a friendly household spending assistant. Write a 2–3 sentence insight based on this data.`,
      ``,
      `This month (${current.label}):`,
      `  House total: ${sym}${current.houseTotal.toFixed(0)}`,
      `  ${userName}'s share: ${sym}${current.total.toFixed(0)}`,
      `  Top categories: ${topCategories || 'none'}`,
      prevLine,
      ``,
      `Rules:`,
      `- Sentence 1: what's happening at house level vs last month (use specific numbers).`,
      `- Sentence 2: ${userName}'s personal context — their share as a fraction of the house total.`,
      `- Sentence 3 (optional): one concrete observation about a category or a short tip.`,
      `- Be direct, specific, and friendly. No corporate language. No bullet points.`,
    ].filter(Boolean).join('\n');

    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 160,
      messages: [{ role: 'user', content: prompt }],
    });

    const insight = message.content[0].type === 'text' ? message.content[0].text.trim() : '';

    return new Response(
      JSON.stringify({ insight }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[spending-analysis]', err);
    return new Response(
      JSON.stringify({ error: 'Failed to generate insight' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
});
