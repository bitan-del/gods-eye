/**
 * @license
 * Copyright 2025 Gods Eye (gods-eye.org)
 * SPDX-License-Identifier: Apache-2.0
 *
 * CLI Installer Service — detects, installs, and runs the Gods Eye CLI
 * setup wizard from the Electron main process.
 */

import { exec, spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { promisify } from 'util';
import { ipcBridge } from '@/common';
import { ProcessConfig } from '@process/utils/initStorage';

const execAsync = promisify(exec);

let installProcess: ChildProcess | null = null;
let setupProcess: ChildProcess | null = null;
let promptIdCounter = 0;
const pendingPrompts = new Map<string, (answer: string) => void>();

/**
 * Check if `godseye` CLI is available in PATH.
 */
export async function checkCliInstalled(): Promise<{
  installed: boolean;
  version?: string;
  path?: string;
}> {
  const whichCmd = process.platform === 'win32' ? 'where godseye' : 'which godseye';

  try {
    const { stdout: pathOut } = await execAsync(whichCmd);
    const cliPath = pathOut.trim().split('\n')[0].trim();

    try {
      const { stdout: versionOut } = await execAsync('godseye --version');
      return { installed: true, version: versionOut.trim(), path: cliPath };
    } catch {
      return { installed: true, path: cliPath };
    }
  } catch {
    return { installed: false };
  }
}

/**
 * Install Gods Eye CLI using the official install script:
 *   curl -fsSL https://gods-eye.org/install.sh | bash
 *
 * Streams stdout/stderr to the renderer in real time.
 */
export function installCli(): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (installProcess) {
      resolve({ success: false, error: 'Installation already in progress' });
      return;
    }

    console.log('[CLI Installer] Running install script with git buffer config');

    ipcBridge.cliInstaller.installOutput.emit({
      stream: 'stdout',
      data: '$ Installing Gods Eye CLI...\n\n',
    });

    const envNoColor = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', TERM: 'dumb' };

    // Run as a single shell command: configure git for large repos, then run the install script
    const script = [
      // Increase git HTTP buffer for large repo clones
      'git config --global http.postBuffer 524288000',
      // Use HTTP/1.1 to avoid HTTP/2 stream errors
      'git config --global http.version HTTP/1.1',
      // Run the official install script
      'curl -fsSL https://gods-eye.org/install.sh | bash',
    ].join(' && ');

    const child = spawn('bash', ['-c', script], {
      shell: false,
      env: envNoColor,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    installProcess = child;

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      ipcBridge.cliInstaller.installOutput.emit({ stream: 'stdout', data: text });
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      ipcBridge.cliInstaller.installOutput.emit({ stream: 'stderr', data: text });
    });

    child.on('close', (code) => {
      installProcess = null;
      if (code === 0) {
        ipcBridge.cliInstaller.installOutput.emit({
          stream: 'stdout',
          data: '\n✓ Gods Eye CLI installed successfully!\n',
        });
        resolve({ success: true });
      } else {
        const errMsg = `Installation exited with code ${code}`;
        ipcBridge.cliInstaller.installOutput.emit({ stream: 'stderr', data: `\n✗ ${errMsg}\n` });
        resolve({ success: false, error: errMsg });
      }
    });

    child.on('error', (err) => {
      installProcess = null;
      const errMsg = `Failed to start installation: ${err.message}`;
      ipcBridge.cliInstaller.installOutput.emit({ stream: 'stderr', data: `\n✗ ${errMsg}\n` });
      resolve({ success: false, error: errMsg });
    });
  });
}

/**
 * Run `godseye onboard` interactively, streaming output and
 * forwarding prompts to the renderer for user input.
 */
export function runSetup(): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (setupProcess) {
      resolve({ success: false, error: 'Setup is already running' });
      return;
    }

    console.log('[CLI Installer] Starting godseye onboard...');

    ipcBridge.cliInstaller.installOutput.emit({
      stream: 'stdout',
      data: '$ godseye onboard\n\n',
    });

    setupProcess = spawn('godseye', ['onboard'], {
      shell: true,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    });

    let outputBuffer = '';

    setupProcess.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      outputBuffer += text;
      ipcBridge.cliInstaller.installOutput.emit({ stream: 'stdout', data: text });
      detectAndEmitPrompts(outputBuffer);
    });

    setupProcess.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      ipcBridge.cliInstaller.installOutput.emit({ stream: 'stderr', data: text });
    });

    setupProcess.on('close', (code) => {
      setupProcess = null;
      pendingPrompts.clear();
      const success = code === 0;
      ipcBridge.cliInstaller.setupComplete.emit({
        success,
        error: success ? undefined : `Setup exited with code ${code}`,
      });
      resolve({ success });
    });

    setupProcess.on('error', (err) => {
      setupProcess = null;
      pendingPrompts.clear();
      const errMsg = `Failed to start setup: ${err.message}`;
      ipcBridge.cliInstaller.setupComplete.emit({ success: false, error: errMsg });
      resolve({ success: false, error: errMsg });
    });
  });
}

function detectAndEmitPrompts(buffer: string): void {
  const promptPatterns = [
    /([^\n]*\?)\s*$/m,
    /([^\n]*:)\s*$/m,
    /([^\n]*>\s*)$/m,
    /\(([^)]+)\)\s*$/m,
  ];

  const lines = buffer.split('\n');
  const lastLine = lines[lines.length - 1]?.trim();
  if (!lastLine) return;

  for (const pattern of promptPatterns) {
    const match = lastLine.match(pattern);
    if (match) {
      const promptId = `prompt-${++promptIdCounter}`;
      const question = lastLine;

      let type: 'text' | 'password' | 'select' | 'confirm' = 'text';
      const options: Array<{ label: string; value: string }> = [];

      if (/password|secret|token|key/i.test(question)) {
        type = 'password';
      } else if (/\(y\/n\)|\(yes\/no\)/i.test(question)) {
        type = 'confirm';
      } else if (/select|choose|pick/i.test(question)) {
        type = 'select';
        for (let i = Math.max(0, lines.length - 10); i < lines.length - 1; i++) {
          const optMatch = lines[i].match(/^\s*(\d+)[.)]\s+(.+)/);
          if (optMatch) {
            options.push({ label: optMatch[2].trim(), value: optMatch[1] });
          }
        }
      }

      ipcBridge.cliInstaller.setupPrompt.emit({
        promptId,
        question,
        type,
        options: options.length > 0 ? options : undefined,
      });

      pendingPrompts.set(promptId, (answer: string) => {
        if (setupProcess?.stdin?.writable) {
          setupProcess.stdin.write(answer + '\n');
        }
      });

      break;
    }
  }
}

/**
 * Forward raw keypress data to the setup process stdin.
 * Used for arrow keys, Enter, Space in interactive prompts.
 */
export function writeSetupKeypress(data: string): void {
  if (setupProcess?.stdin?.writable) {
    setupProcess.stdin.write(data);
  }
}

export function sendSetupAnswer(promptId: string, answer: string): void {
  const resolver = pendingPrompts.get(promptId);
  if (resolver) {
    resolver(answer);
    pendingPrompts.delete(promptId);
  } else if (setupProcess?.stdin?.writable) {
    setupProcess.stdin.write(answer + '\n');
  }
}

/**
 * Open `godseye onboard` in the native system terminal (Terminal.app on macOS).
 */
export function openSetupInTerminal(): void {
  const platform = process.platform;
  if (platform === 'darwin') {
    spawn('osascript', [
      '-e',
      'tell application "Terminal" to do script "godseye onboard"',
      '-e',
      'tell application "Terminal" to activate',
    ], { detached: true, stdio: 'ignore' }).unref();
  } else if (platform === 'win32') {
    spawn('cmd.exe', ['/c', 'start', 'cmd', '/k', 'godseye onboard'], {
      detached: true,
      stdio: 'ignore',
    }).unref();
  } else {
    // Linux: try common terminal emulators
    const terminals = ['gnome-terminal', 'konsole', 'xterm'];
    for (const term of terminals) {
      try {
        spawn(term, ['--', 'godseye', 'onboard'], { detached: true, stdio: 'ignore' }).unref();
        break;
      } catch {
        continue;
      }
    }
  }
}

export async function dismissSetup(): Promise<void> {
  await ProcessConfig.set('cli.setupDismissed', true);
  if (installProcess) {
    installProcess.kill();
    installProcess = null;
  }
  if (setupProcess) {
    setupProcess.kill();
    setupProcess = null;
    pendingPrompts.clear();
  }
}
