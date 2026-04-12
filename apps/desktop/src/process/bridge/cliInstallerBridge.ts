/**
 * @license
 * Copyright 2025 Gods Eye (gods-eye.org)
 * SPDX-License-Identifier: Apache-2.0
 *
 * IPC bridge for CLI installer — connects renderer setup wizard
 * to the main process CLI installer service.
 */

import { ipcBridge } from '@/common';
import {
  checkCliInstalled,
  installCli,
  runSetup,
  sendSetupAnswer,
  writeSetupKeypress,
  openSetupInTerminal,
  dismissSetup,
  restartGateway,
} from '@process/services/cliInstaller';

export function initCliInstallerBridge(): void {
  // Check if CLI is installed
  ipcBridge.cliInstaller.checkInstalled.provider(async () => {
    try {
      const status = await checkCliInstalled();
      return {
        code: 200,
        msg: 'ok',
        data: status,
      };
    } catch (error) {
      return {
        code: 500,
        msg: (error as Error).message,
        data: { installed: false },
      };
    }
  });

  // Install CLI
  ipcBridge.cliInstaller.install.provider(async (_params) => {
    try {
      const result = await installCli();
      return {
        code: result.success ? 200 : 500,
        msg: result.error || 'ok',
        data: { success: result.success },
      };
    } catch (error) {
      return {
        code: 500,
        msg: (error as Error).message,
        data: { success: false },
      };
    }
  });

  // Run setup wizard
  ipcBridge.cliInstaller.runSetup.provider(async () => {
    try {
      const result = await runSetup();
      return {
        code: result.success ? 200 : 500,
        msg: result.error || 'ok',
        data: { success: result.success },
      };
    } catch (error) {
      return {
        code: 500,
        msg: (error as Error).message,
        data: { success: false },
      };
    }
  });

  // Answer a setup prompt
  ipcBridge.cliInstaller.setupAnswer.provider(async (params) => {
    sendSetupAnswer(params.promptId, params.answer);
  });

  // Forward raw keypress to setup process
  ipcBridge.cliInstaller.setupKeypress.provider(async (params) => {
    writeSetupKeypress(params.data);
  });

  // Open setup in native terminal
  ipcBridge.cliInstaller.openSetupInTerminal.provider(async () => {
    openSetupInTerminal();
  });

  // Dismiss the wizard
  ipcBridge.cliInstaller.dismiss.provider(async () => {
    await dismissSetup();
  });

  // Restart gateway with fresh config
  ipcBridge.cliInstaller.restartGateway.provider(async () => {
    try {
      const result = await restartGateway();
      return {
        code: result.success ? 200 : 500,
        msg: result.message || 'ok',
        data: { success: result.success, message: result.message },
      };
    } catch (error) {
      return {
        code: 500,
        msg: (error as Error).message,
        data: { success: false, message: (error as Error).message },
      };
    }
  });
}
