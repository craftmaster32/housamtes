// delete-account Edge Function
// Called by an authenticated user who wants to permanently delete their account.
// Uses service role to call admin.deleteUser — cascade deletes all user data via FK.

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
      status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Record deletion request for GDPR audit trail before deleting
    await supabase.from('deletion_requests').insert({
      user_id: callerId,
      status: 'pending',
    });

    // Delete the auth user — FK cascades will remove:
    //   profiles, house_members, push_tokens, web_push_subscriptions,
    //   notification_preferences, user_consents, audit_log entries
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
      status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[delete-account] error:', err);
    return new Response(JSON.stringify({ error: 'Could not delete account. Please contact support@housemates.app.' }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
