// delete-account Edge Function
// Called by an authenticated user who wants to permanently delete their account.
// Uses the service role to call admin.deleteUser. Foreign keys are set up so
// this fully erases the person's personal data (profile, push tokens, consents,
// house membership cascade away) while their shared footprint is anonymised, not
// destroyed: bills, messages, grocery items etc. have their author reference
// blanked via ON DELETE SET NULL, so the household's history stays intact but no
// longer identifies the deleted user. This is the GDPR / App Store "delete my
// account" erasure — it cannot be undone.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jwtVerify, createRemoteJWKSet } from 'npm:jose';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS, status: 200 });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Verify the caller's JWT — they must be an authenticated user
  const token = authHeader.slice(7);
  const jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  let callerId: string;
  try {
    const { payload } = await jwtVerify(token, jwks);
    if (!payload.sub || payload['role'] !== 'authenticated') throw new Error('not authenticated');
    callerId = payload.sub;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Record deletion request for GDPR audit trail before deleting
    await supabase.from('deletion_requests').insert({
      user_id: callerId,
      status: 'pending',
    });

    // Delete the auth user. FK cascades remove personal data (profiles,
    // house_members, push_tokens, web_push_subscriptions,
    // notification_preferences, user_consents); shared records (bills,
    // messages, grocery items, …) have their author reference set to NULL and
    // survive as "Former member".
    const { error } = await supabase.auth.admin.deleteUser(callerId);
    if (error) {
      await supabase
        .from('deletion_requests')
        .update({ status: 'failed' })
        .eq('user_id', callerId)
        .eq('status', 'pending');
      throw error;
    }

    // Mark completed
    await supabase
      .from('deletion_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('user_id', callerId)
      .eq('status', 'pending');

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[delete-account] error:', err);
    return new Response(
      JSON.stringify({ error: 'Could not delete account. Please contact support@housemates.app.' }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }
});
