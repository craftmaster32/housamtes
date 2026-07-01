// Read-only production data health check.
// Verifies that every avatar/cover/house-photo reference stored in the
// database actually resolves to a real file in Supabase Storage.
// Never writes to the database or storage. Never logs the service role key.
//
// Run via the "Audit assets" GitHub Actions workflow (workflow_dispatch).
const { createClient } = require('@supabase/supabase-js');

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!PROJECT_REF || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_PROJECT_REF or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const summaryLines = [];
function log(line) {
  console.log(line);
  summaryLines.push(line);
}


async function checkUrl(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10_000) });
    if (res.ok) return null;
    // Some storage providers don't support HEAD — retry with GET on 4xx/405
    const getRes = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(10_000) });
    if (getRes.ok) return null;
    return `status ${getRes.status}`;
  } catch (err) {
    return err instanceof Error ? err.message : 'fetch failed';
  }
}

// PostgREST caps .select() at 1000 rows — page through with .range() so large
// houses/photo libraries don't get silently truncated.
async function fetchAll(supabase, table, columns) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table} query failed: ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

async function main() {
  const supabaseUrl = `https://${PROJECT_REF}.supabase.co`;
  const supabase = createClient(supabaseUrl, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const failures = [];

  // 1. Avatars + covers — confirm the storage object actually exists for
  //    every profile that claims to have one.
  const profiles = await fetchAll(supabase, 'profiles', 'id, name, avatar_url, cover_url');

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
  const photos = await fetchAll(supabase, 'photos', 'id, house_id, url');

  // Bounded concurrency — sequential checks with a 10s-per-URL timeout could
  // exceed the workflow's job timeout before the report ever gets written.
  const concurrency = 20;
  const photoList = photos ?? [];
  for (let i = 0; i < photoList.length; i += concurrency) {
    const batch = photoList.slice(i, i + concurrency);
    const reasons = await Promise.all(batch.map((photo) => checkUrl(photo.url)));
    batch.forEach((photo, idx) => {
      const reason = reasons[idx];
      if (reason) failures.push({ type: 'house_photo', photoId: photo.id, houseId: photo.house_id, reason });
    });
  }

  // 3. Orphaned house_members — a member row with no matching profile row
  //    is silently dropped by housematesStore.ts, hiding a real person.
  const members = await fetchAll(supabase, 'house_members', 'id, user_id, house_id');

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
