import { execFile } from 'child_process'
import { access, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

function exec(cmd: string, args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd, timeout: 60_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`git ${args[0]} failed: ${stderr || error.message}`))
      } else {
        resolve(stdout.trim())
      }
    })
  })
}

// Cache the repo URL per directory so we can detect config changes
const repoDirUrls = new Map<string, string>()
// Per-connection lock to prevent concurrent clone/fetch races
const syncLocks = new Map<string, Promise<{ commitHash: string }>>()

export function getRepoDir(connectionId: string): string {
  return join(tmpdir(), 'pgconsole-schema', connectionId)
}

export async function syncRepo(connectionId: string, repo: string, branch?: string): Promise<{ commitHash: string }> {
  // Serialize concurrent sync requests for the same connection
  const existing = syncLocks.get(connectionId)
  if (existing) {
    return existing
  }

  const promise = doSyncRepo(connectionId, repo, branch).finally(() => {
    syncLocks.delete(connectionId)
  })
  syncLocks.set(connectionId, promise)
  return promise
}

async function doSyncRepo(connectionId: string, repo: string, branch?: string): Promise<{ commitHash: string }> {
  const repoDir = getRepoDir(connectionId)

  const exists = await access(join(repoDir, '.git')).then(() => true).catch(() => false)

  // If the repo URL changed, wipe the old checkout
  if (exists) {
    const cachedUrl = repoDirUrls.get(repoDir)
    if (cachedUrl && cachedUrl !== repo) {
      await rm(repoDir, { recursive: true, force: true })
    }
  }

  const stillExists = await access(join(repoDir, '.git')).then(() => true).catch(() => false)

  if (stillExists) {
    await exec('git', ['fetch', 'origin', ...(branch ? [branch] : [])], repoDir)
    await exec('git', ['reset', '--hard', branch ? `origin/${branch}` : 'FETCH_HEAD'], repoDir)
  } else {
    const cloneArgs = ['clone', '--depth', '1']
    if (branch) cloneArgs.push('--branch', branch)
    cloneArgs.push(repo, repoDir)
    await exec('git', cloneArgs)
  }

  repoDirUrls.set(repoDir, repo)

  const commitHash = await exec('git', ['rev-parse', 'HEAD'], repoDir)
  return { commitHash }
}
