import { execFile } from 'child_process'
import { access } from 'fs/promises'
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

export function getRepoDir(connectionId: string): string {
  return join(tmpdir(), 'pgconsole-schema', connectionId)
}

export async function syncRepo(connectionId: string, repo: string, branch?: string): Promise<{ commitHash: string }> {
  const repoDir = getRepoDir(connectionId)

  const exists = await access(join(repoDir, '.git')).then(() => true).catch(() => false)

  if (exists) {
    await exec('git', ['fetch', 'origin', ...(branch ? [branch] : [])], repoDir)
    await exec('git', ['reset', '--hard', branch ? `origin/${branch}` : 'FETCH_HEAD'], repoDir)
  } else {
    const cloneArgs = ['clone', '--depth', '1']
    if (branch) cloneArgs.push('--branch', branch)
    cloneArgs.push(repo, repoDir)
    await exec('git', cloneArgs)
  }

  const commitHash = await exec('git', ['rev-parse', 'HEAD'], repoDir)
  return { commitHash }
}
