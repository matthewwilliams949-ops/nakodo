// e2e-panel.ts — local browser panel for hands-on end-to-end testing.
//
//   pnpm e2e:panel     → http://localhost:4747
//
// One page of buttons over the existing test tooling so a human can drive a
// full intro lifecycle without the CLI: seed personas, send yourself a match,
// approve held proposals, accept/decline/reply AS a persona, clean up, and
// reset the fresh-user identity used for onboarding runs.
//
// Principles:
// - LOCAL ONLY: binds 127.0.0.1, never deployed, never linked from the app.
// - The panel drives the COUNTERPARTY side (personas) and the admin actions.
//   Your own side you experience as a real user — email, agent, intro page.
// - All mutations go through the same paths as production traffic or the
//   established tools: e2e-harness (API), intro:send / intro:review (app lib).
//   The only direct DB access is read-only state for display.
// - HYGIENE: personas are source='e2e-harness' rows; `cleanup` is surgical.
//   Onboarding test users are deleted via their own token (guarantee 5 path).
import { execFile } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { homedir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'

const ROOT = join(import.meta.dirname, '..')
const APP_URL = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const PORT = 4747
// Fresh-user sandbox identity for onboarding runs (the "Nakodo testing"
// workspace points NAKODO_CONFIG_DIR here — never the real ~/.config/nakodo).
const ONBOARD_DIR = join(homedir(), '.config', 'nakodo-e2e-user')

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set — run via `pnpm e2e:panel` (loads .env).')
  process.exit(1)
}
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
const dbHost = process.env.DATABASE_URL.replace(/.*@/, '').replace(/\/.*/, '')

function sh(cmd: string, args: string[], cwd = ROOT): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd, env: process.env, timeout: 60_000 }, (err, stdout, stderr) => {
      resolve([stdout, stderr, err && !stdout && !stderr ? String(err) : ''].filter(Boolean).join('\n').trim())
    })
  })
}
const tsx = join(ROOT, 'node_modules', '.bin', 'tsx')
const harness = (args: string[]) => sh(tsx, ['scripts/e2e-harness.ts', ...args])
const webScript = (script: string, args: string[]) =>
  sh(tsx, [join('scripts', script), ...args], join(ROOT, 'apps', 'web'))

async function state(): Promise<unknown> {
  const users = (
    await db.query(`
      select u.id, u.handle, u.display_name, u.email is not null as has_email, u.source, u.created_at,
             (select count(*)::int from snippets s where s.user_id = u.id) as snippets,
             (select count(*)::int from asks a where a.user_id = u.id and a.status = 'open') as open_asks,
             coalesce(p.body, '') as profile
      from users u left join profiles p on p.user_id = u.id
      order by u.created_at`)
  ).rows
  const intros = (
    await db.query(`
      select i.id, i.status, i.created_at, i.a_response, i.b_response,
             i.token_a, i.token_b,
             ua.display_name as name_a, ua.source as source_a,
             ub.display_name as name_b, ub.source as source_b
      from intros i
      left join users ua on ua.id = i.user_a
      left join users ub on ub.id = i.user_b
      order by i.created_at desc`)
  ).rows
  const onboardCfg = join(ONBOARD_DIR, 'config.json')
  let onboard: unknown = { exists: false }
  if (existsSync(onboardCfg)) {
    try {
      const c = JSON.parse(readFileSync(onboardCfg, 'utf8'))
      onboard = { exists: true, registered: Boolean(c.token), email: c.email ?? null }
    } catch {
      onboard = { exists: true, registered: false, email: null }
    }
  }
  return { appUrl: APP_URL, dbHost, users, intros, onboard, onboardDir: ONBOARD_DIR }
}

async function runAction(action: string, p: Record<string, string>): Promise<string> {
  switch (action) {
    case 'seed':
      return harness(['seed'])
    case 'cleanup':
      return harness(['cleanup'])
    case 'status':
      return harness(['status'])
    case 'accept':
    case 'decline':
      if (!p.token) return 'missing token'
      return harness([action, p.token])
    case 'say':
      if (!p.token || !p.message) return 'missing token/message'
      return harness(['say', p.token, p.message])
    case 'approve':
      if (!p.id) return 'missing id'
      return webScript('review-intros.ts', ['approve', p.id])
    case 'review_list':
      return webScript('review-intros.ts', ['list'])
    case 'send_match': {
      // Stage an inbound intro: persona (side A) → the real user (side B).
      // Goes through createIntro via intro:send, so card emails really fire.
      if (!p.persona || !p.to) return 'missing persona/to'
      const { rows } = await db.query(
        `select u.handle, coalesce(p.body,'') as profile from users u
         left join profiles p on p.user_id = u.id where u.handle = $1 and u.source = 'e2e-harness'`,
        [p.persona],
      )
      if (!rows[0]) return `persona ${p.persona} not found — seed first`
      const { rows: target } = await db.query(
        `select u.id, coalesce(p.body,'') as profile from users u
         left join profiles p on p.user_id = u.id where u.id = $1`,
        [p.to],
      )
      if (!target[0]) return 'target user not found'
      const spec = {
        userA: rows[0].handle,
        userB: target[0].id,
        cardA: target[0].profile || 'An early Nakodo user building something real.',
        cardB: rows[0].profile,
      }
      const file = join(ROOT, 'scripts', `.panel-intro-${Date.now()}.json`)
      const { writeFileSync, unlinkSync } = await import('node:fs')
      writeFileSync(file, JSON.stringify(spec))
      try {
        return await webScript('send-intro.ts', [file])
      } finally {
        unlinkSync(file)
      }
    }
    case 'onboard_reset':
      rmSync(ONBOARD_DIR, { recursive: true, force: true })
      return `Fresh-user identity cleared (${ONBOARD_DIR}).\nOpen a NEW session in the "Nakodo testing" folder and onboard from scratch.`
    case 'onboard_delete': {
      // Deletes the onboarding test user via its OWN token — the guarantee-5
      // path, precise by construction. Then clears the local identity.
      const cfg = join(ONBOARD_DIR, 'config.json')
      if (!existsSync(cfg)) return 'No onboarding identity on disk — nothing to delete.'
      const token = JSON.parse(readFileSync(cfg, 'utf8')).token
      let apiResult = 'no token in config (never registered) — nothing on the server.'
      if (token) {
        const res = await fetch(`${APP_URL}/api/me`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        apiResult = `DELETE /api/me → ${res.status}`
      }
      rmSync(ONBOARD_DIR, { recursive: true, force: true })
      return `${apiResult}\nLocal identity cleared. Ready for the next onboarding run.`
    }
    default:
      return `unknown action: ${action}`
  }
}

const PAGE = `<!doctype html><meta charset="utf-8"><title>Nakodo e2e panel</title>
<style>
  :root{color-scheme:dark}
  body{font:14px/1.45 -apple-system,system-ui,sans-serif;background:#111418;color:#e6e6e6;margin:0;padding:24px;max-width:1100px}
  h1{font-size:18px;margin:0 0 4px} h2{font-size:14px;margin:20px 0 8px;color:#9ecbff}
  .warn{color:#ffb454;font-size:12px;margin-bottom:16px}
  button{background:#1d2733;color:#e6e6e6;border:1px solid #33465c;border-radius:6px;padding:5px 12px;margin:2px 4px 2px 0;cursor:pointer;font-size:13px}
  button:hover{background:#28394d} button.danger{border-color:#7a3333}
  table{border-collapse:collapse;width:100%;font-size:13px}
  td,th{border-bottom:1px solid #2a2f36;padding:5px 8px;text-align:left;vertical-align:top}
  th{color:#8a919c;font-weight:500}
  .tag{display:inline-block;padding:1px 7px;border-radius:9px;font-size:11px;background:#26303b}
  .tag.held{background:#4a3b16}.tag.proposed{background:#173a5e}.tag.revealed{background:#1d4428}.tag.declined,.tag.vetoed{background:#442222}
  #log{background:#0b0e11;border:1px solid #2a2f36;border-radius:6px;padding:10px;white-space:pre-wrap;font:12px ui-monospace,monospace;min-height:70px;max-height:260px;overflow:auto;margin-top:8px}
  input[type=text]{background:#0b0e11;border:1px solid #33465c;border-radius:6px;color:#e6e6e6;padding:5px 8px;width:340px}
  .muted{color:#8a919c;font-size:12px} a{color:#9ecbff}
  .persona{color:#c7a5ff}
</style>
<h1>Nakodo e2e panel</h1>
<div class="warn">TARGET: <b id="dbhost"></b> · <span id="appurl"></span> — this drives REAL infrastructure. Personas are e2e-tagged; Cleanup is surgical.</div>

<h2>Pool</h2>
<div>
  <button onclick="run('seed')">Seed 4 personas</button>
  <button class="danger" onclick="if(confirm('Delete ALL e2e-tagged rows (personas, their intros, messages)?'))run('cleanup')">Cleanup e2e rows</button>
  <span class="muted">Personas: Mira (agent-memory), Dio (design), Sol (vertical SaaS), Nao (community growth)</span>
</div>
<table id="users"></table>

<h2>Send yourself a match <span class="muted">(inbound card: persona → you, real email if you have one on record)</span></h2>
<div id="sendmatch"></div>

<h2>Intros <span class="muted">(panel buttons act AS the persona / admin — your own side you do by email, agent, or intro page)</span></h2>
<table id="intros"></table>

<h2>Onboarding runs <span class="muted">(sandbox identity — never your real account)</span></h2>
<div id="onboard"></div>
<div class="muted" style="margin-top:6px">
  Loop: <b>Reset</b> → new session in <code>~/Personal/Nakodo testing</code> → say "find me someone…" and onboard →
  watch the user appear above → <b>Delete test user</b> → repeat.
</div>

<h2>Log</h2>
<div id="log">ready.</div>

<script>
let S=null
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))
async function refresh(){
  S=await (await fetch('/api/state')).json()
  document.getElementById('dbhost').textContent=S.dbHost
  document.getElementById('appurl').textContent=S.appUrl
  const users=document.getElementById('users')
  users.innerHTML='<tr><th>user</th><th>kind</th><th>profile</th><th>snippets</th><th>open asks</th><th>email</th></tr>'+S.users.map(u=>{
    const kind=u.source==='e2e-harness'?'<span class="persona">persona</span>':(esc(u.source||'real').slice(0,40))
    return '<tr><td>'+esc(u.display_name||u.handle||u.id.slice(0,8))+'</td><td>'+kind+'</td><td class="muted">'+esc(u.profile.slice(0,90))+'</td><td>'+u.snippets+'</td><td>'+u.open_asks+'</td><td>'+(u.has_email?'✓':'—')+'</td></tr>'}).join('')
  const real=S.users.filter(u=>u.source!=='e2e-harness')
  const personas=S.users.filter(u=>u.source==='e2e-harness')
  document.getElementById('sendmatch').innerHTML = personas.length===0
    ? '<span class="muted">Seed personas first.</span>'
    : real.map(r=>personas.map(p=>'<button onclick="run(\\'send_match\\',{persona:\\''+p.handle+'\\',to:\\''+r.id+'\\'})">'+esc((p.display_name||p.handle).replace(' (test)',''))+' → '+esc(r.display_name||'you')+'</button>').join('')).join('<br>')
  const intros=document.getElementById('intros')
  intros.innerHTML='<tr><th>created</th><th>a-side</th><th>b-side</th><th>status</th><th>act as persona / admin</th></tr>'+(S.intros.length?S.intros.map(i=>{
    const side=(name,src,tok,resp)=>{
      if(src!=='e2e-harness')return '<span class="muted">('+esc(name||'?')+' — real user: use email/agent/page)</span>'
      let b=''
      if(i.status==='proposed'&&resp==null)b+='<button onclick="run(\\'accept\\',{token:\\''+tok+'\\'})">Accept as '+esc(name)+'</button><button class="danger" onclick="run(\\'decline\\',{token:\\''+tok+'\\'})">Decline</button>'
      if(i.status==='revealed')b+='<button onclick="const m=prompt(\\'Message from '+esc(name)+':\\');if(m)run(\\'say\\',{token:\\''+tok+'\\',message:m})">Reply as '+esc(name)+'</button>'
      return b||'<span class="muted">—</span>'
    }
    let admin=i.status==='held'?'<button onclick="run(\\'approve\\',{id:\\''+i.id+'\\'})">Approve (release to target)</button>':''
    return '<tr><td class="muted">'+esc(i.created_at.slice(5,16).replace('T',' '))+'</td><td>'+esc(i.name_a||'?')+' <span class="muted">'+(i.a_response||'pending')+'</span></td><td>'+esc(i.name_b||'?')+' <span class="muted">'+(i.b_response||'pending')+'</span></td><td><span class="tag '+i.status+'">'+i.status+'</span></td><td>'+admin+side(i.name_a,i.source_a,i.token_a,i.a_response)+' '+side(i.name_b,i.source_b,i.token_b,i.b_response)+'</td></tr>'
  }).join(''):'<tr><td colspan="5" class="muted">no intros</td></tr>')
  const ob=S.onboard
  document.getElementById('onboard').innerHTML=
    '<button onclick="run(\\'onboard_reset\\')">Reset fresh-user identity</button>'+
    '<button class="danger" onclick="run(\\'onboard_delete\\')">Delete test user (server + local)</button> '+
    (ob.exists?('<span class="tag">identity on disk'+(ob.registered?' · registered':' · unregistered')+(ob.email?' · '+esc(ob.email):'')+'</span>'):'<span class="muted">no sandbox identity — ready for a fresh run</span>')
}
async function run(action,params){
  const log=document.getElementById('log')
  log.textContent='… '+action
  const r=await fetch('/api/run',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,params:params||{}})})
  log.textContent='$ '+action+(params?' '+JSON.stringify(params):'')+'\\n\\n'+await r.text()
  refresh()
}
refresh();setInterval(refresh,20000)
</script>`

createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(PAGE)
    } else if (req.method === 'GET' && req.url === '/api/state') {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(await state()))
    } else if (req.method === 'POST' && req.url === '/api/run') {
      let body = ''
      for await (const chunk of req) body += chunk
      const { action, params } = JSON.parse(body || '{}')
      const out = await runAction(String(action), params ?? {})
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end(out)
    } else {
      res.writeHead(404).end('not found')
    }
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' }).end(String(e))
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Nakodo e2e panel → http://localhost:${PORT}`)
  console.log(`   target app: ${APP_URL}`)
  console.log(`   target db:  ${dbHost}${dbHost.includes('localhost') ? '' : '   ⚠ NON-LOCAL'}`)
})
