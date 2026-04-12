/**
 * @license
 * Copyright 2025 Gods Eye (gods-eye.org)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Setup Wizard Modal — auto-installs Gods Eye CLI via the official
 * install script, then opens native Terminal for interactive onboarding.
 */

import { Button } from '@arco-design/web-react';
import { CheckOne, CloseOne, Terminal } from '@icon-park/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import GodsEyeModal from '@/renderer/components/base/GodsEyeModal';
import AionSteps from '@/renderer/components/base/AionSteps';
import { ipcBridge } from '@/common';
import type { ICliInstallOutput } from '@/common/adapter/ipcBridge';

type WizardStep = 'installing' | 'setup' | 'setting-up' | 'complete' | 'error';

const SetupWizardModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  /** Start at a specific step (e.g. 'setup' to skip install) */
  initialStep?: WizardStep;
}> = ({ visible, onClose, initialStep }) => {
  const [step, setStep] = useState<WizardStep>(initialStep || 'installing');
  const [terminalLines, setTerminalLines] = useState<Array<{ text: string; type: 'cmd' | 'out' | 'err' | 'ok' }>>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const terminalRef = useRef<HTMLDivElement>(null);
  const installStarted = useRef(false);

  const scrollToBottom = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [terminalLines, scrollToBottom]);

  // Elapsed time counter (only during install)
  useEffect(() => {
    if (step !== 'installing') {
      setElapsed(0);
      return;
    }
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [step]);

  // Reset state when initialStep changes (e.g. opened from settings)
  useEffect(() => {
    if (visible && initialStep) {
      setStep(initialStep);
      installStarted.current = initialStep !== 'installing';
    }
  }, [visible, initialStep]);

  // Auto-start install when wizard becomes visible (only for install step)
  useEffect(() => {
    if (!visible || installStarted.current || initialStep === 'setup') return;
    installStarted.current = true;

    setStep('installing');
    setTerminalLines([]);
    setProgress(0);

    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) {
          clearInterval(progressTimer);
          return prev;
        }
        return prev + Math.random() * 3;
      });
    }, 800);

    void (async () => {
      try {
        const result = await ipcBridge.cliInstaller.install.invoke({});
        clearInterval(progressTimer);
        if (result.data?.success) {
          setProgress(100);
          setTimeout(() => setStep('setup'), 600);
        } else {
          setErrorMessage(result.msg || 'Installation failed');
          setStep('error');
        }
      } catch (err) {
        clearInterval(progressTimer);
        setErrorMessage((err as Error).message);
        setStep('error');
      }
    })();

    return () => clearInterval(progressTimer);
  }, [visible, initialStep]);

  // Subscribe to install output
  useEffect(() => {
    if (!visible) return;

    const unsubOutput = ipcBridge.cliInstaller.installOutput.on((data: ICliInstallOutput) => {
      const text = data.data;
      // Strip ANSI escape codes
      const esc = String.fromCharCode(0x1b);
      const clean = text
        .replaceAll(new RegExp(`${esc}\\[[0-9;?]*[a-zA-Z]`, 'g'), '')
        .replaceAll(new RegExp('\\[[\\d;?]*[a-zA-Z]', 'g'), '')
        .replaceAll(new RegExp(`${esc}\\]`, 'g'), '');
      const lines = clean.split('\n').filter((l) => l.trim().length > 0);
      const newLines = lines.map((line) => {
        if (line.startsWith('$')) return { text: line, type: 'cmd' as const };
        if (line.includes('✓') || line.includes('✔') || line.includes('successfully') || line.includes('ready') || line.includes('installed') || line.includes('found')) return { text: line, type: 'ok' as const };
        if (data.stream === 'stderr' || line.startsWith('✗') || line.includes('error') || line.includes('Error')) return { text: line, type: 'err' as const };
        return { text: line, type: 'out' as const };
      });
      if (newLines.length > 0) {
        setTerminalLines((prev) => [...prev, ...newLines]);
      }
    });

    return () => {
      unsubOutput();
    };
  }, [visible]);

  // Open godseye onboard in real Terminal.app
  const handleOpenTerminal = useCallback(async () => {
    setStep('setting-up');
    await ipcBridge.cliInstaller.openSetupInTerminal.invoke();
  }, []);

  const handleDismiss = useCallback(async () => {
    await ipcBridge.cliInstaller.dismiss.invoke();
    onClose();
  }, [onClose]);

  const handleRetry = useCallback(() => {
    installStarted.current = false;
    setTerminalLines([]);
    setErrorMessage('');
    setProgress(0);
    setStep('installing');
    setTimeout(() => {
      installStarted.current = false;
      setStep('installing');
    }, 100);
  }, []);

  const stepIndex = step === 'installing' ? 0 : step === 'setup' || step === 'setting-up' ? 1 : 2;

  // Terminal colors matching app's dark theme
  const terminalStyle: React.CSSProperties = {
    background: '#0d1117',
    borderRadius: '8px',
    padding: '16px',
    fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", Menlo, Monaco, monospace',
    fontSize: '12.5px',
    lineHeight: '20px',
    overflowY: 'auto',
    maxHeight: '280px',
    minHeight: '160px',
    border: '1px solid #21262d',
    position: 'relative',
  };

  const lineColors = {
    cmd: '#58a6ff',
    out: '#c9d1d9',
    err: '#f85149',
    ok: '#3fb950',
  };

  const renderTerminal = () => (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          background: '#161b22',
          borderRadius: '8px 8px 0 0',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid #21262d',
          borderBottom: 'none',
        }}
      >
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f85149' }} />
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#e3b341' }} />
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#3fb950' }} />
        <span style={{ marginLeft: '12px', color: '#8b949e', fontSize: '12px', fontFamily: 'inherit' }}>
          Gods Eye Installer
        </span>
      </div>
      <div ref={terminalRef} style={{ ...terminalStyle, borderRadius: '0 0 8px 8px' }}>
        {terminalLines.map((line, i) => (
          <div key={i} style={{ color: lineColors[line.type], whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {line.type === 'cmd' && <span style={{ color: '#3fb950', marginRight: '8px' }}>{'>'}</span>}
            {line.text}
          </div>
        ))}
        {step === 'installing' && terminalLines.length > 0 && (
          <div style={{ color: '#3fb950' }}>
            <span className="inline-block" style={{ animation: 'blink 1s step-end infinite' }}>_</span>
          </div>
        )}
      </div>
      {step === 'installing' && (
        <div style={{ height: '3px', background: '#21262d', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.min(progress, 100)}%`,
              background: 'linear-gradient(90deg, #58a6ff, #3fb950)',
              transition: 'width 0.4s ease',
              borderRadius: '0 0 8px 8px',
            }}
          />
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    switch (step) {
      case 'installing': {
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        const timeStr = mins > 0 ? `${mins}m ${secs.toString().padStart(2, '0')}s` : `${secs}s`;
        return (
          <div className="flex flex-col gap-12px">
            <div className="flex items-center justify-between" style={{ color: 'var(--text-secondary)' }}>
              <div className="flex items-center gap-8px">
                <div
                  style={{
                    width: 8, height: 8, borderRadius: '50%', background: '#3fb950',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                />
                <span className="text-13px">Installing Gods Eye CLI...</span>
              </div>
              <span className="text-12px" style={{ color: '#8b949e', fontVariantNumeric: 'tabular-nums' }}>
                {timeStr}
              </span>
            </div>
            {renderTerminal()}
            {elapsed > 30 && (
              <div className="text-12px text-center" style={{ color: '#8b949e' }}>
                Installing dependencies — this usually takes 2-5 minutes on first setup
              </div>
            )}
          </div>
        );
      }

      case 'setup':
        return (
          <div className="flex flex-col gap-16px items-center py-16px">
            <CheckOne theme="filled" size="44" fill="#3fb950" />
            <h3 className="text-16px font-500 m-0" style={{ color: 'var(--text-primary)' }}>CLI Installed</h3>
            <p className="text-13px m-0 text-center" style={{ color: 'var(--text-secondary)', maxWidth: '380px' }}>
              Configure your API keys and preferences in Terminal.
            </p>
            <div className="flex gap-12px">
              <Button type="secondary" onClick={handleDismiss}>Skip for Now</Button>
              <Button type="primary" onClick={handleOpenTerminal}>
                <span className="flex items-center gap-6px">
                  <Terminal theme="outline" size="16" />
                  Open Terminal to Configure
                </span>
              </Button>
            </div>
          </div>
        );

      case 'setting-up':
        return (
          <div className="flex flex-col gap-16px items-center py-24px">
            <Terminal theme="outline" size="48" fill="var(--text-secondary)" />
            <h3 className="text-16px font-500 m-0" style={{ color: 'var(--text-primary)' }}>
              Complete Setup in Terminal
            </h3>
            <p className="text-13px m-0 text-center" style={{ color: 'var(--text-secondary)', maxWidth: '400px' }}>
              A Terminal window has opened with the setup wizard. Follow the prompts there to configure Gods Eye.
            </p>
            <div
              style={{
                background: '#0d1117',
                borderRadius: '8px',
                padding: '12px 16px',
                border: '1px solid #21262d',
                maxWidth: '380px',
                width: '100%',
              }}
            >
              <code style={{ color: '#3fb950', fontSize: '13px' }}>$ godseye onboard</code>
            </div>
            <div className="flex gap-12px" style={{ marginTop: '4px' }}>
              <Button type="secondary" onClick={handleDismiss}>Close</Button>
              <Button type="primary" onClick={handleOpenTerminal}>
                <span className="flex items-center gap-6px">
                  <Terminal theme="outline" size="16" />
                  Reopen Terminal
                </span>
              </Button>
              <Button onClick={() => setStep('complete')}>I'm Done</Button>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="flex flex-col items-center gap-16px py-24px">
            <CheckOne theme="filled" size="52" fill="#3fb950" />
            <h3 className="text-18px font-500 m-0" style={{ color: 'var(--text-primary)' }}>You're All Set!</h3>
            <p className="text-13px m-0" style={{ color: 'var(--text-secondary)' }}>
              Gods Eye CLI is installed and configured.
            </p>
            <Button type="primary" onClick={onClose} style={{ marginTop: '4px' }}>Get Started</Button>
          </div>
        );

      case 'error':
        return (
          <div className="flex flex-col gap-16px">
            <div className="flex flex-col items-center gap-8px py-8px">
              <CloseOne theme="filled" size="44" fill="#f85149" />
              <h3 className="text-16px font-500 m-0" style={{ color: 'var(--text-primary)' }}>Installation Failed</h3>
              <p className="text-13px m-0" style={{ color: '#f85149' }}>{errorMessage}</p>
            </div>
            {terminalLines.length > 0 && renderTerminal()}
            <div className="flex justify-center gap-12px">
              <Button type="secondary" onClick={handleDismiss}>Skip for Now</Button>
              <Button type="primary" onClick={handleRetry}>Try Again</Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <GodsEyeModal
      visible={visible}
      onCancel={handleDismiss}
      size="large"
      header={{ title: 'Gods Eye Setup', showClose: true }}
      footer={null}
      maskClosable={false}
    >
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
      <div className="flex flex-col gap-20px px-16px py-8px">
        <AionSteps current={stepIndex} size="small" style={{ padding: '0 32px' }}>
          <AionSteps.Step title="Install" />
          <AionSteps.Step title="Configure" />
          <AionSteps.Step title="Done" />
        </AionSteps>
        {renderContent()}
      </div>
    </GodsEyeModal>
  );
};

export default SetupWizardModal;
