// Shared authorization guard for scheduled (cron-invoked) Edge Functions.
//
// These functions run with the service-role key and fan out push notifications
// to every household, so a stranger who discovered the function URL could spam
// all users. When a CRON_SECRET is configured, callers must present it in the
// `x-cron-secret` header — set that header on the Supabase scheduled job so only
// the cron can invoke the function.
//
// SAFE BY DEFAULT: while CRON_SECRET is unset the guard is a no-op, so existing
// schedules keep working unchanged. To "arm" it:
//   1. supabase secrets set CRON_SECRET=<a long random string>
//   2. add the header `x-cron-secret: <same string>` to each scheduled job
// Once both are done, anonymous callers get 401 and only the cron gets through.

export function assertCronAuthorized(req: Request): Response | null {
  const expected = Deno.env.get('CRON_SECRET');
  if (!expected) return null; // not armed yet — behave exactly as before

  const provided = req.headers.get('x-cron-secret');
  if (provided !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}
