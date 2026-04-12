/**
 * @license
 * Copyright 2025 Gods Eye (gods-eye.org)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hook to manage CLI setup wizard visibility.
 * Checks CLI status on launch and supports opening from settings.
 */

import { useCallback, useEffect, useState } from 'react';
import { ipcBridge } from '@/common';

type WizardInitialStep = 'installing' | 'setup';

export function useCliSetupWizard() {
  const [wizardVisible, setWizardVisible] = useState(false);
  const [initialStep, setInitialStep] = useState<WizardInitialStep>('installing');
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await ipcBridge.cliInstaller.checkInstalled.invoke();
          if (result?.data?.installed) {
            setChecked(true);
            return;
          }
          // CLI not installed — show wizard from install step
          setInitialStep('installing');
          setWizardVisible(true);
        } catch (err) {
          console.warn('[SetupWizard] CLI check failed, showing wizard:', err);
          setInitialStep('installing');
          setWizardVisible(true);
        } finally {
          setChecked(true);
        }
      })();
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const closeWizard = useCallback(() => {
    setWizardVisible(false);
  }, []);

  /** Open wizard from settings — skip to configure step if CLI is already installed */
  const openWizard = useCallback(async () => {
    try {
      const result = await ipcBridge.cliInstaller.checkInstalled.invoke();
      if (result?.data?.installed) {
        setInitialStep('setup');
      } else {
        setInitialStep('installing');
      }
    } catch {
      setInitialStep('installing');
    }
    setWizardVisible(true);
  }, []);

  return {
    wizardVisible,
    closeWizard,
    openWizard,
    initialStep,
    checked,
  };
}
