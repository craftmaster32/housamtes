// Read-only production data health check.
// Verifies that every avatar/cover/house-photo reference stored in the
// database actually resolves to a real file in Supabase Storage.
// Never writes to the database or storage. Never logs the service role key.
//
// Run via the "Audit assets" GitHub Actions workflow (workflow_dispatch).
const { createClient } = require('@supabase/supabase-js');

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;

if (!ACCESS_TOKEN || !PROJECT_REF) {
  console.error('Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF');
  process.exit(1);
}

const summaryLines = [];
function log(line) {
  console.log(line);
  summaryLines.push(line);
}

async function fetchServiceRoleKey() {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`Could not fetch project API keys (status ${res.status})`);
  }
  const keys = await res.json();
  const serviceKey = keys.find((k) => k.name === 'service_role');
  if (!serviceKey) throw new Error('service_role key not found on project');
  return serviceKey.api_key;
}

async function checkUrl(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok) return null;
    // Some storage providers don't support HEAD — retry with GET on 4xx/405
    const getRes = await fetch(url, { method: 'GET' });
    if (getRes.ok) return null;
    return `status ${getRes.status}`;
  } catch (err) {
    return err instanceof Error ? err.message : 'fetch failed';
  }
}

async function main() {
  const serviceRoleKey = await fetchServiceRoleKey();
  const supabaseUrl = `https://${PROJECT_REF}.supabase.co`;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const failures = [];

  // 1. Avatars + covers — confirm the storage object actually exists for
  //    every profile that claims to have one.
  const { data: profiles, error: profilesErr } = await supabase
    .from('profiles')
    .select('id, name, avatar_url, cover_url');
  if (profilesErr) throw new Error(`profiles query failed: ${profilesErr.message}`);

  let avatarsChecked = 0;
  let coversChecked = 0;
  for (const p of profiles ?? []) {
    if (p.avatar_url) {
      avatarsChecked++;
      const { error } = await supabase.storage.from('profiles').createSignedUrl(`${p.id}/avatar`, 60);
      if (error) failures.push({ type: 'avatar', userId: p.id, reason: error.message });
    }
    if (p.cover_url) {
      coversChecked++;
      const { error } = await supabase.storage.from('profiles').createSignedUrl(`${p.id}/cover`, 60);
      if (error) failures.push({ type: 'cover', userId: p.id, reason: error.message });
    }
  }

  // 2. House photos — confirm every stored public URL still resolves.
  const { data: photos, error: photosErr } = await supabase
    .from('photos')
    .select('id, house_id, url');
  if (photosErr) throw new Error(`photos query failed: ${photosErr.message}`);

  for (const photo of photos ?? []) {
    const reason = await checkUrl(photo.url);
    if (reason) failures.push({ type: 'house_photo', photoId: photo.id, houseId: photo.house_id, reason });
  }

  // 3. Orphaned house_members — a member row with no matching profile row
  //    is silently dropped by housematesStore.ts, hiding a real person.
  const { data: members, error: membersErr } = await supabase
    .from('house_members')
    .select('id, user_id, house_id');
  if (membersErr) throw new Error(`house_members query failed: ${membersErr.message}`);

  const profileIds = new Set((profiles ?? []).map((p) => p.id));
  const orphans = (members ?? []).filter((m) => !profileIds.has(m.user_id));
  for (const o of orphans) {
    failures.push({ type: 'orphaned_member', memberId: o.id, houseId: o.house_id, reason: 'no matching profile row' });
  }

  // ── Report ──────────────────────────────────────────────────
  log('## Production asset audit');
  log('');
  log(`Checked ${avatarsChecked} avatars, ${coversChecked} covers, ${(photos ?? []).length} house photos, ${(members ?? []).length} memberships.`);
  log('');
  if (failures.length === 0) {
    log('✅ No broken references found.');
  } else {
    log(`❌ Found ${failures.length} broken reference(s):`);
    log('');
    for (const f of failures) {
      log(`- **${f.type}** — ${JSON.stringify({ ...f, type: undefined })} — ${f.reason}`);
    }
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    require('fs').appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryLines.join('\n') + '\n');
  }

  if (failures.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Audit failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
