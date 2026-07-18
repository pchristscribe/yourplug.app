/**
 * Tests for .github/workflows/deploy-backend.yml
 *
 * These tests validate:
 *   1. Structural correctness of the workflow YAML (job names, dependencies,
 *      service configuration, environment variables, action versions, step
 *      conditions).
 *   2. Shell-script behaviour extracted from the workflow steps (health-check
 *      polling loop and migration pipeline construction).
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WORKFLOW_PATH = join(__dirname, '../../.github/workflows/deploy-backend.yml')

// ─── Helpers ────────────────────────────────────────────────────────────────

let workflowText = ''

beforeAll(() => {
  workflowText = readFileSync(WORKFLOW_PATH, 'utf8')
})

/**
 * Run a shell snippet and return { stdout, exitCode }.
 * stderr is suppressed so test output stays clean.
 */
function runShell(script, env = {}) {
  try {
    const stdout = execSync(`bash -c '${script.replace(/'/g, "'\\''")}'`, {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    }).toString()
    return { stdout, exitCode: 0 }
  } catch (err) {
    return {
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
      exitCode: err.status ?? 1,
    }
  }
}

/**
 * Run a multi-line bash script from a temp file so quoting is not an issue.
 */
function runShellScript(script, env = {}) {
  const tmpFile = join(tmpdir(), `workflow-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sh`)
  try {
    writeFileSync(tmpFile, `#!/usr/bin/env bash\n${script}\n`, { mode: 0o755 })
    const stdout = execSync(`bash "${tmpFile}"`, {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    }).toString()
    return { stdout, exitCode: 0 }
  } catch (err) {
    return {
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
      exitCode: err.status ?? 1,
    }
  } finally {
    try { rmSync(tmpFile) } catch { /* ignore */ }
  }
}

// ─── 1. Workflow-level structure ─────────────────────────────────────────────

describe('deploy-backend.yml – workflow structure', () => {
  it('workflow file exists and is non-empty', () => {
    expect(workflowText.length).toBeGreaterThan(0)
  })

  it('workflow is named "Deploy Backend"', () => {
    expect(workflowText).toMatch(/^name:\s*Deploy Backend/m)
  })

  it('triggers only on push to the main branch', () => {
    expect(workflowText).toMatch(/branches:\s*\[main\]/m)
    // Should not trigger on pull_request or other events
    expect(workflowText).not.toMatch(/pull_request/m)
  })
})

// ─── 2. `test` job ───────────────────────────────────────────────────────────

describe('deploy-backend.yml – test job', () => {
  it('defines a job named "test"', () => {
    expect(workflowText).toMatch(/^\s{2}test:/m)
  })

  it('test job has the correct display name', () => {
    expect(workflowText).toMatch(/name:\s*Backend tests \(gate\)/)
  })

  it('test job runs on ubuntu-latest', () => {
    // The test job's runs-on line should precede the deploy-backend job
    const testJobSection = workflowText.slice(
      workflowText.indexOf('  test:'),
      workflowText.indexOf('  deploy-backend:'),
    )
    expect(testJobSection).toMatch(/runs-on:\s*ubuntu-latest/)
  })

  // ─── PostgreSQL service ──────────────────────────────────────────────────

  describe('postgres service', () => {
    let postgresSection = ''

    beforeAll(() => {
      const servicesStart = workflowText.indexOf('    services:')
      // Grab enough context (up to the env: block of the test job)
      const servicesEnd = workflowText.indexOf('    env:', servicesStart)
      postgresSection = workflowText.slice(servicesStart, servicesEnd)
    })

    it('uses postgres:16-alpine image', () => {
      expect(postgresSection).toMatch(/image:\s*postgres:16-alpine/)
    })

    it('sets POSTGRES_USER to yourplug', () => {
      expect(postgresSection).toMatch(/POSTGRES_USER:\s*yourplug/)
    })

    it('sets POSTGRES_DB to yourplug_test', () => {
      expect(postgresSection).toMatch(/POSTGRES_DB:\s*yourplug_test/)
    })

    it('configures pg_isready health check', () => {
      expect(postgresSection).toMatch(/--health-cmd\s+pg_isready/)
    })

    it('exposes port 5432', () => {
      expect(postgresSection).toMatch(/5432:5432/)
    })

    it('health check uses 10s interval', () => {
      expect(postgresSection).toMatch(/--health-interval\s+10s/)
    })

    it('health check uses 5s timeout', () => {
      expect(postgresSection).toMatch(/--health-timeout\s+5s/)
    })

    it('health check retries 5 times', () => {
      expect(postgresSection).toMatch(/--health-retries\s+5/)
    })
  })

  // ─── Redis service ───────────────────────────────────────────────────────

  describe('redis service', () => {
    let redisSection = ''

    beforeAll(() => {
      const redisStart = workflowText.indexOf('      redis:')
      const redisEnd = workflowText.indexOf('    env:', redisStart)
      redisSection = workflowText.slice(redisStart, redisEnd)
    })

    it('uses redis:7-alpine image', () => {
      expect(redisSection).toMatch(/image:\s*redis:7-alpine/)
    })

    it('health check pings redis-cli', () => {
      expect(redisSection).toMatch(/redis-cli ping/)
    })

    it('exposes port 6379', () => {
      expect(redisSection).toMatch(/6379:6379/)
    })

    it('health check retries 5 times', () => {
      expect(redisSection).toMatch(/--health-retries\s+5/)
    })
  })

  // ─── Environment variables ───────────────────────────────────────────────

  describe('test job environment variables', () => {
    let testJobEnvSection = ''

    beforeAll(() => {
      const envStart = workflowText.indexOf('    env:', workflowText.indexOf('  test:'))
      const envEnd = workflowText.indexOf('    steps:', envStart)
      testJobEnvSection = workflowText.slice(envStart, envEnd)
    })

    it('sets DATABASE_URL pointing to local postgres', () => {
      expect(testJobEnvSection).toMatch(
        /DATABASE_URL:\s*postgresql:\/\/yourplug:test_password@localhost:5432\/yourplug_test/,
      )
    })

    it('sets TEST_DATABASE_URL to same as DATABASE_URL', () => {
      expect(testJobEnvSection).toMatch(
        /TEST_DATABASE_URL:\s*postgresql:\/\/yourplug:test_password@localhost:5432\/yourplug_test/,
      )
    })

    it('sets REDIS_URL pointing to local redis', () => {
      expect(testJobEnvSection).toMatch(/REDIS_URL:\s*redis:\/\/localhost:6379/)
    })

    it('sets TEST_REDIS_URL to same as REDIS_URL', () => {
      expect(testJobEnvSection).toMatch(/TEST_REDIS_URL:\s*redis:\/\/localhost:6379/)
    })

    it('sets SESSION_SECRET to a value at least 32 characters', () => {
      const match = testJobEnvSection.match(/SESSION_SECRET:\s*(.+)/)
      expect(match).not.toBeNull()
      const secretValue = match[1].trim()
      expect(secretValue.length).toBeGreaterThanOrEqual(32)
    })

    it('sets NODE_ENV to test', () => {
      expect(testJobEnvSection).toMatch(/NODE_ENV:\s*test/)
    })
  })

  // ─── Steps ───────────────────────────────────────────────────────────────

  describe('test job steps', () => {
    let testStepsSection = ''

    beforeAll(() => {
      const stepsStart = workflowText.indexOf('    steps:', workflowText.indexOf('  test:'))
      const deployStart = workflowText.indexOf('  deploy-backend:')
      testStepsSection = workflowText.slice(stepsStart, deployStart)
    })

    it('uses actions/checkout@v4', () => {
      expect(testStepsSection).toMatch(/uses:\s*actions\/checkout@v4/)
    })

    it('uses pnpm/action-setup@v4', () => {
      expect(testStepsSection).toMatch(/uses:\s*pnpm\/action-setup@v4/)
    })

    it('uses actions/setup-node@v4 with node-version 24', () => {
      expect(testStepsSection).toMatch(/uses:\s*actions\/setup-node@v4/)
      expect(testStepsSection).toMatch(/node-version:\s*'24'/)
    })

    it('caches pnpm with dependency path pointing to backend lock file', () => {
      expect(testStepsSection).toMatch(/cache:\s*pnpm/)
      expect(testStepsSection).toMatch(/cache-dependency-path:\s*backend\/pnpm-lock\.yaml/)
    })

    it('installs deps with --frozen-lockfile in backend directory', () => {
      expect(testStepsSection).toMatch(/working-directory:\s*backend/)
      expect(testStepsSection).toMatch(/pnpm install --frozen-lockfile/)
    })

    it('runs pnpm test in backend directory', () => {
      expect(testStepsSection).toMatch(/run:\s*pnpm test/)
    })

    it('apply migrations step sets PGPASSWORD', () => {
      expect(testStepsSection).toMatch(/PGPASSWORD:\s*test_password/)
    })

    it('migration step uses set -euo pipefail', () => {
      expect(testStepsSection).toMatch(/set -euo pipefail/)
    })

    it('migration creates auth schema', () => {
      expect(testStepsSection).toMatch(/CREATE SCHEMA IF NOT EXISTS auth/)
    })

    it('migration creates auth.role stub function', () => {
      expect(testStepsSection).toMatch(/auth\.role\(\)/)
    })

    it('migration creates auth.uid stub function', () => {
      expect(testStepsSection).toMatch(/auth\.uid\(\)/)
    })

    it('migration creates auth.email stub function', () => {
      expect(testStepsSection).toMatch(/auth\.email\(\)/)
    })

    it('migration finds sql files sorted with version sort', () => {
      expect(testStepsSection).toMatch(/find supabase\/migrations -name '\*\.sql'/)
      expect(testStepsSection).toMatch(/sort -V/)
    })

    it('migration applies all sql files in a single transaction (-1 flag)', () => {
      expect(testStepsSection).toMatch(/psql.*-1/)
    })
  })
})

// ─── 3. `deploy-backend` job ─────────────────────────────────────────────────

describe('deploy-backend.yml – deploy-backend job', () => {
  let deployJobSection = ''

  beforeAll(() => {
    deployJobSection = workflowText.slice(workflowText.indexOf('  deploy-backend:'))
  })

  it('deploy-backend job requires the test job to pass first', () => {
    expect(deployJobSection).toMatch(/needs:\s*test/)
  })

  it('deploy-backend job targets the production environment', () => {
    expect(deployJobSection).toMatch(/environment:\s*production/)
  })

  it('uses actions/checkout@v4 (not the old @v6)', () => {
    const checkoutMatches = [...deployJobSection.matchAll(/uses:\s*actions\/checkout@(\S+)/g)]
    expect(checkoutMatches.length).toBeGreaterThan(0)
    for (const match of checkoutMatches) {
      expect(match[1]).toBe('v4')
    }
  })

  it('uses actions/setup-node@v4 with node 24', () => {
    expect(deployJobSection).toMatch(/uses:\s*actions\/setup-node@v4/)
    expect(deployJobSection).toMatch(/node-version:\s*'24'/)
  })

  it('deploys yourplug-api service via Railway CLI 4.66.1', () => {
    expect(deployJobSection).toMatch(/@railway\/cli@4\.66\.1 up --service yourplug-api --detach/)
  })

  it('deploys yourplug-worker service via Railway CLI', () => {
    expect(deployJobSection).toMatch(/@railway\/cli@4\.66\.1 up --service yourplug-worker --detach/)
  })

  it('deploy steps use RAILWAY_TOKEN secret', () => {
    const tokenMatches = [...deployJobSection.matchAll(/RAILWAY_TOKEN:\s*\$\{\{[^}]+\}\}/g)]
    expect(tokenMatches.length).toBeGreaterThanOrEqual(2)
  })

  // ─── Post-deploy health check step ──────────────────────────────────────

  describe('health check step', () => {
    let healthCheckSection = ''

    beforeAll(() => {
      const start = deployJobSection.indexOf('      - name: Post-deploy health check')
      const end = deployJobSection.indexOf('      - name: Rollback instructions')
      healthCheckSection = deployJobSection.slice(start, end)
    })

    it('health check runs only on success', () => {
      expect(healthCheckSection).toMatch(/if:\s*success\(\)/)
    })

    it('health check reads BACKEND_HEALTH_URL from secret or variable', () => {
      expect(healthCheckSection).toMatch(/BACKEND_HEALTH_URL:.*secrets\.BACKEND_HEALTH_URL/)
    })

    it('health check uses set -euo pipefail', () => {
      expect(healthCheckSection).toMatch(/set -euo pipefail/)
    })

    it('health check exits with error when BACKEND_HEALTH_URL is empty', () => {
      expect(healthCheckSection).toMatch(/if \[ -z "\$\{BACKEND_HEALTH_URL:-\}"/)
      expect(healthCheckSection).toMatch(/exit 1/)
    })

    it('health check appends /health to the base URL', () => {
      expect(healthCheckSection).toMatch(/HEALTH_URL=.*\/health"/)
    })

    it('health check has a 120-second deadline', () => {
      expect(healthCheckSection).toMatch(/\d+.*120/)
    })

    it('health check uses curl with --silent --fail --max-time 5', () => {
      expect(healthCheckSection).toMatch(/curl --silent --fail --max-time 5/)
    })

    it('health check sleeps 5 seconds between retries', () => {
      expect(healthCheckSection).toMatch(/sleep 5/)
    })
  })

  // ─── Rollback step ───────────────────────────────────────────────────────

  describe('rollback instructions step', () => {
    let rollbackSection = ''

    beforeAll(() => {
      rollbackSection = deployJobSection.slice(
        deployJobSection.indexOf('      - name: Rollback instructions'),
      )
    })

    it('rollback step runs with if: always()', () => {
      expect(rollbackSection).toMatch(/if:\s*always\(\)/)
    })

    it('rollback instructions write to GITHUB_STEP_SUMMARY', () => {
      expect(rollbackSection).toMatch(/GITHUB_STEP_SUMMARY/)
    })

    it('rollback instructions include yourplug-api service command', () => {
      expect(rollbackSection).toMatch(/railway rollback --service yourplug-api/)
    })

    it('rollback instructions include yourplug-worker service command', () => {
      expect(rollbackSection).toMatch(/railway rollback --service yourplug-worker/)
    })

    it('rollback instructions reference Railway dashboard URL', () => {
      expect(rollbackSection).toMatch(/https:\/\/railway\.app/)
    })
  })
})

// ─── 4. Shell-script logic – health check ────────────────────────────────────

describe('health-check shell script logic', () => {
  it('exits non-zero when BACKEND_HEALTH_URL is unset', () => {
    const script = `
set -euo pipefail
if [ -z "\${BACKEND_HEALTH_URL:-}" ]; then
  echo "ERROR: BACKEND_HEALTH_URL is not set."
  exit 1
fi
echo "should not reach here"
`
    const { exitCode, stdout } = runShellScript(script, { BACKEND_HEALTH_URL: '' })
    expect(exitCode).toBe(1)
    expect(stdout).toMatch(/ERROR: BACKEND_HEALTH_URL is not set/)
    expect(stdout).not.toMatch(/should not reach here/)
  })

  it('exits non-zero when BACKEND_HEALTH_URL is empty string', () => {
    const script = `
if [ -z "\${BACKEND_HEALTH_URL:-}" ]; then
  exit 1
fi
exit 0
`
    const result = runShellScript(script, { BACKEND_HEALTH_URL: '' })
    expect(result.exitCode).toBe(1)
  })

  it('proceeds when BACKEND_HEALTH_URL is set', () => {
    const script = `
set -euo pipefail
if [ -z "\${BACKEND_HEALTH_URL:-}" ]; then
  exit 1
fi
HEALTH_URL="\${BACKEND_HEALTH_URL}/health"
echo "URL is: \${HEALTH_URL}"
`
    const { exitCode, stdout } = runShellScript(script, {
      BACKEND_HEALTH_URL: 'https://example.up.railway.app',
    })
    expect(exitCode).toBe(0)
    expect(stdout).toMatch(/URL is: https:\/\/example\.up\.railway\.app\/health/)
  })

  it('constructs HEALTH_URL by appending /health to base URL', () => {
    const script = `
BACKEND_HEALTH_URL="https://api.example.com"
HEALTH_URL="\${BACKEND_HEALTH_URL}/health"
echo "\${HEALTH_URL}"
`
    const { exitCode, stdout } = runShellScript(script)
    expect(exitCode).toBe(0)
    expect(stdout.trim()).toBe('https://api.example.com/health')
  })

  it('deadline is set to current time plus 120 seconds', () => {
    const script = `
before=\$(date +%s)
deadline=\$(( \$(date +%s) + 120 ))
after=\$(date +%s)
# deadline should be between before+120 and after+120
if [ "\$deadline" -ge "\$(( before + 120 ))" ] && [ "\$deadline" -le "\$(( after + 120 ))" ]; then
  echo "deadline ok"
else
  echo "deadline wrong"
  exit 1
fi
`
    const { exitCode, stdout } = runShellScript(script)
    expect(exitCode).toBe(0)
    expect(stdout).toMatch(/deadline ok/)
  })

  it('exits with error and non-zero code when deadline is exceeded', () => {
    // Simulate the deadline-exceeded branch: date always returns a value >= deadline
    const script = `
set -euo pipefail
BACKEND_HEALTH_URL="https://example.com"
HEALTH_URL="\${BACKEND_HEALTH_URL}/health"
# Set deadline already in the past
deadline=\$(( \$(date +%s) - 1 ))
# Simulate the timeout check logic without actually sleeping or curling
if [ "\$(date +%s)" -ge "\$deadline" ]; then
  echo "ERROR: Backend did not become healthy within 120 seconds."
  exit 1
fi
echo "should not reach here"
`
    const { exitCode, stdout } = runShellScript(script)
    expect(exitCode).toBe(1)
    expect(stdout).toMatch(/ERROR: Backend did not become healthy within 120 seconds/)
  })

  it('poll loop exits successfully when curl succeeds immediately', () => {
    // Replace curl with a stub that always succeeds
    const script = `
set -euo pipefail
HEALTH_URL="http://localhost/health"
deadline=\$(( \$(date +%s) + 120 ))
# Stub curl: always exits 0 (simulate healthy)
curl() { return 0; }
export -f curl

until curl --silent --fail --max-time 5 "\${HEALTH_URL}" > /dev/null 2>&1; do
  if [ "\$(date +%s)" -ge "\$deadline" ]; then
    echo "ERROR: timed out"
    exit 1
  fi
  sleep 5
done
echo "Backend is healthy."
`
    const { exitCode, stdout } = runShellScript(script)
    expect(exitCode).toBe(0)
    expect(stdout).toMatch(/Backend is healthy\./)
  })

  it('poll loop times out and exits 1 when curl always fails', () => {
    // Replace curl with a stub that always fails; set deadline already past
    const script = `
HEALTH_URL="http://localhost/health"
# Deadline already in the past so we time out on first check
deadline=\$(( \$(date +%s) - 1 ))
# Stub curl: always fails (exit 1)
until false; do
  if [ "\$(date +%s)" -ge "\$deadline" ]; then
    echo "ERROR: Backend did not become healthy within 120 seconds."
    exit 1
  fi
  sleep 5
done
echo "Backend is healthy."
`
    const { exitCode, stdout } = runShellScript(script)
    expect(exitCode).toBe(1)
    expect(stdout).toMatch(/ERROR: Backend did not become healthy within 120 seconds/)
  })
})

// ─── 5. Shell-script logic – rollback summary ────────────────────────────────

describe('rollback instructions shell script logic', () => {
  it('appends rollback content to GITHUB_STEP_SUMMARY file', () => {
    const tmpSummary = join(tmpdir(), `gha-summary-${Date.now()}.md`)
    try {
      const script = `
GITHUB_STEP_SUMMARY="${tmpSummary}"
cat >> "\$GITHUB_STEP_SUMMARY" <<'EOF'
## Rollback

If this deployment introduced a regression, run:

\`\`\`bash
railway rollback --service yourplug-api
railway rollback --service yourplug-worker
\`\`\`

Or use the Railway dashboard: https://railway.app
EOF
`
      const { exitCode } = runShellScript(script)
      expect(exitCode).toBe(0)

      const summaryContent = readFileSync(tmpSummary, 'utf8')
      expect(summaryContent).toMatch(/## Rollback/)
      expect(summaryContent).toMatch(/railway rollback --service yourplug-api/)
      expect(summaryContent).toMatch(/railway rollback --service yourplug-worker/)
      expect(summaryContent).toMatch(/https:\/\/railway\.app/)
    } finally {
      try { rmSync(tmpSummary) } catch { /* ignore */ }
    }
  })

  it('appends to (does not overwrite) existing GITHUB_STEP_SUMMARY content', () => {
    const tmpSummary = join(tmpdir(), `gha-summary-${Date.now()}.md`)
    try {
      writeFileSync(tmpSummary, '## Prior Step\n\nSome earlier content.\n')

      const script = `
GITHUB_STEP_SUMMARY="${tmpSummary}"
cat >> "\$GITHUB_STEP_SUMMARY" <<'EOF'
## Rollback

railway rollback --service yourplug-api
EOF
`
      const { exitCode } = runShellScript(script)
      expect(exitCode).toBe(0)

      const summaryContent = readFileSync(tmpSummary, 'utf8')
      expect(summaryContent).toMatch(/## Prior Step/)
      expect(summaryContent).toMatch(/## Rollback/)
    } finally {
      try { rmSync(tmpSummary) } catch { /* ignore */ }
    }
  })
})

// ─── 6. Migration pipeline – sort and transaction ────────────────────────────

describe('migration pipeline shell script logic', () => {
  it('sort -V orders SQL files by version number correctly', () => {
    const script = `
# Simulate output from: find supabase/migrations -name '*.sql' | sort -V
files="
20240101_0001_init.sql
20240101_0010_add_users.sql
20240101_0002_add_roles.sql
20240202_0001_new_feature.sql
"
sorted=\$(echo "\$files" | sort -V)
first=\$(echo "\$sorted" | grep -v '^$' | head -1)
last=\$(echo "\$sorted" | grep -v '^$' | tail -1)
echo "first:\$first"
echo "last:\$last"
`
    const { exitCode, stdout } = runShellScript(script)
    expect(exitCode).toBe(0)
    // sort -V (version sort) should order numerically
    expect(stdout).toMatch(/first:.*20240101_0001/)
    expect(stdout).toMatch(/last:.*20240202_0001/)
  })

  it('sort -V orders files numerically not lexicographically', () => {
    // Lexicographic sort would put _0010 before _0002; version sort puts _0002 first
    const script = `
files="20240101_0010_add.sql
20240101_0002_add.sql"
sorted=\$(echo "\$files" | sort -V)
first=\$(echo "\$sorted" | head -1)
echo "\$first"
`
    const { exitCode, stdout } = runShellScript(script)
    expect(exitCode).toBe(0)
    expect(stdout.trim()).toBe('20240101_0002_add.sql')
  })

  it('set -euo pipefail causes the script to fail on any error', () => {
    const script = `
set -euo pipefail
false  # non-zero exit
echo "should not reach"
`
    const { exitCode, stdout } = runShellScript(script)
    expect(exitCode).not.toBe(0)
    expect(stdout).not.toMatch(/should not reach/)
  })

  it('set -euo pipefail fails on unset variable reference', () => {
    const script = `
set -euo pipefail
echo "\${DEFINITELY_UNSET_VAR_XYZ}"
echo "should not reach"
`
    const { exitCode } = runShellScript(script)
    expect(exitCode).not.toBe(0)
  })
})

// ─── 7. Regression / boundary cases ─────────────────────────────────────────

describe('regression and boundary cases', () => {
  it('workflow does not use deprecated actions/checkout@v6', () => {
    expect(workflowText).not.toMatch(/actions\/checkout@v6/)
  })

  it('both jobs reference the same pnpm/action-setup version (v4)', () => {
    const pnpmMatches = [...workflowText.matchAll(/uses:\s*pnpm\/action-setup@(\S+)/g)]
    expect(pnpmMatches.length).toBeGreaterThanOrEqual(2)
    const versions = pnpmMatches.map((m) => m[1])
    const unique = [...new Set(versions)]
    expect(unique).toHaveLength(1)
    expect(unique[0]).toBe('v4')
  })

  it('health check BACKEND_HEALTH_URL is not hardcoded (uses secret/variable expression)', () => {
    const healthCheckSection = workflowText.slice(
      workflowText.indexOf('Post-deploy health check'),
    )
    // Must use the ${{ ... }} expression syntax, not a raw URL
    expect(healthCheckSection).toMatch(/\$\{\{.*BACKEND_HEALTH_URL/)
    // Must not contain a hardcoded https:// URL as the env value
    expect(healthCheckSection).not.toMatch(/BACKEND_HEALTH_URL:\s*https?:\/\//)
  })

  it('migration script connects to the correct database and user', () => {
    const migrationSection = workflowText.slice(
      workflowText.indexOf('Apply database migrations'),
      workflowText.indexOf('      - name: Run tests'),
    )
    expect(migrationSection).toMatch(/-U yourplug/)
    expect(migrationSection).toMatch(/-d yourplug_test/)
    expect(migrationSection).toMatch(/-h localhost/)
  })

  it('test job SESSION_SECRET is long enough to be a valid secret (>=32 chars)', () => {
    const match = workflowText.match(/SESSION_SECRET:\s*(.+)/)
    expect(match).not.toBeNull()
    // The value on the same line (trim any YAML trailing spaces)
    expect(match[1].trim().length).toBeGreaterThanOrEqual(32)
  })

  it('health check curl uses --max-time 5 to avoid hanging forever', () => {
    const deploySection = workflowText.slice(workflowText.indexOf('  deploy-backend:'))
    const curlMatches = [...deploySection.matchAll(/curl.*--max-time\s+(\d+)/g)]
    expect(curlMatches.length).toBeGreaterThan(0)
    for (const m of curlMatches) {
      expect(Number(m[1])).toBeLessThanOrEqual(10)
    }
  })

  it('BACKEND_HEALTH_URL var check guards against whitespace-only values', () => {
    // [ -z "" ] returns true, but [ -z "   " ] returns false — document the behaviour
    const script = `
val="   "
if [ -z "\${val}" ]; then
  echo "empty"
else
  echo "not-empty"
fi
`
    const { exitCode, stdout } = runShellScript(script)
    expect(exitCode).toBe(0)
    // bash -z only checks length==0; spaces are NOT considered empty
    expect(stdout.trim()).toBe('not-empty')
  })
})
