// Module-level singleton — persists across requests in the Node.js process.
// Safe for single-instance Docker deployments; not suitable for multi-replica environments.
let migrationRunning = false

type OnFinishReason = 'completed' | 'paused' | 'error'

export function startBackgroundMigration(
  processBatch: () => Promise<{ concluido: boolean; error?: string }>,
  shouldContinue: () => Promise<boolean>,
  onFinish: (reason: OnFinishReason) => Promise<void>,
): boolean {
  if (migrationRunning) return false
  migrationRunning = true

  void (async () => {
    let finishReason: OnFinishReason = 'error'
    try {
      while (true) {
        const continuar = await shouldContinue()
        if (!continuar) {
          finishReason = 'paused'
          break
        }

        const result = await processBatch()
        if (result.error) {
          finishReason = 'error'
          break
        }
        if (result.concluido) {
          finishReason = 'completed'
          break
        }

        await new Promise<void>((r) => setTimeout(r, 300))
      }
    } catch {
      finishReason = 'error'
    } finally {
      migrationRunning = false
      await onFinish(finishReason)
    }
  })()

  return true
}

export function isMigrationRunning(): boolean {
  return migrationRunning
}
