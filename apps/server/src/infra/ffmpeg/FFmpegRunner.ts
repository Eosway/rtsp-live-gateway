import { spawn, type ChildProcess } from 'node:child_process'
import type { FFmpegCommand } from './FFmpegCommandBuilder.js'

type StdoutListener = (chunk: Buffer) => void
type StderrLineListener = (line: string) => void
type ExitListener = (code: number | null, signal: NodeJS.Signals | null) => void
type ErrorListener = (error: Error) => void

export class FFmpegRunner {
  private processRef?: ChildProcess
  private readonly stdoutListeners: StdoutListener[] = []
  private readonly stderrLineListeners: StderrLineListener[] = []
  private readonly exitListeners: ExitListener[] = []
  private readonly errorListeners: ErrorListener[] = []
  private stderrBuffer = ''

  start(command: FFmpegCommand): void {
    const child = spawn(command.cmd, command.args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    this.processRef = child

    child.stdout.on('data', (chunk: Buffer) => {
      for (const listener of this.stdoutListeners) {
        listener(chunk)
      }
    })

    child.stderr.on('data', (chunk: Buffer) => {
      this.stderrBuffer += chunk.toString('utf8')
      this.flushStderrLines(false)
    })

    child.on('error', (error) => {
      for (const listener of this.errorListeners) {
        listener(error)
      }
    })

    child.on('exit', (code, signal) => {
      this.flushStderrLines(true)
      for (const listener of this.exitListeners) {
        listener(code, signal)
      }
    })
  }

  onStdout(listener: StdoutListener): void {
    this.stdoutListeners.push(listener)
  }

  onStderrLine(listener: StderrLineListener): void {
    this.stderrLineListeners.push(listener)
  }

  onExit(listener: ExitListener): void {
    this.exitListeners.push(listener)
  }

  onError(listener: ErrorListener): void {
    this.errorListeners.push(listener)
  }

  async stop(graceMs: number): Promise<void> {
    const proc = this.processRef
    if (!proc || proc.killed) {
      return
    }
    await new Promise<void>((resolve) => {
      let settled = false
      const timer = setTimeout(() => {
        if (settled) {
          return
        }
        settled = true
        proc.kill('SIGKILL')
        resolve()
      }, graceMs)

      proc.once('exit', () => {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(timer)
        resolve()
      })

      proc.kill('SIGTERM')
    })
  }

  kill(): void {
    this.processRef?.kill('SIGKILL')
  }

  pid(): number | undefined {
    return this.processRef?.pid
  }

  private flushStderrLines(includePartial: boolean): void {
    const lines = this.stderrBuffer.split(/\r?\n/)
    this.stderrBuffer = includePartial ? '' : (lines.pop() ?? '')
    if (includePartial && lines.length === 1 && !lines[0]) {
      return
    }
    for (const line of lines) {
      if (!line) {
        continue
      }
      for (const listener of this.stderrLineListeners) {
        listener(line)
      }
    }
  }
}
