/**
 * @license
 * Copyright 2025 Gods Eye (gods-eye.org)
 * SPDX-License-Identifier: Apache-2.0
 *
 * WhatsApp channel configuration form.
 * Supports WhatsApp Web QR code login, agent selection, model selection,
 * and user pairing/authorization management.
 */

import type { IChannelPairingRequest, IChannelPluginStatus, IChannelUser } from '@process/channels/types';
import { acpConversation, channel } from '@/common/adapter/ipcBridge';
import { ConfigStorage } from '@/common/config/storage';
import GeminiModelSelector from '@/renderer/pages/conversation/platforms/gemini/GeminiModelSelector';
import type { GeminiModelSelection } from '@/renderer/pages/conversation/platforms/gemini/useGeminiModelSelection';
import type { AcpBackendAll } from '@/common/types/acpTypes';
import { Button, Dropdown, Empty, Input, Menu, Message, Spin, Tooltip } from '@arco-design/web-react';
import { CheckOne, CloseOne, Copy, Delete, Down, Refresh } from '@icon-park/react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const PreferenceRow: React.FC<{
  label: string;
  description?: React.ReactNode;
  extra?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, description, extra, children }) => (
  <div className='flex items-center justify-between gap-24px py-12px'>
    <div className='flex-1'>
      <div className='flex items-center gap-8px'>
        <span className='text-14px text-t-primary'>{label}</span>
        {extra}
      </div>
      {description && <div className='text-12px text-t-tertiary mt-2px'>{description}</div>}
    </div>
    <div className='flex items-center'>{children}</div>
  </div>
);

const SectionHeader: React.FC<{ title: string; action?: React.ReactNode }> = ({ title, action }) => (
  <div className='flex items-center justify-between mb-12px'>
    <h3 className='text-14px font-500 text-t-primary m-0'>{title}</h3>
    {action}
  </div>
);

interface WhatsAppConfigFormProps {
  pluginStatus: IChannelPluginStatus | null;
  modelSelection: GeminiModelSelection;
  onStatusChange: (status: IChannelPluginStatus | null) => void;
}

const formatTime = (timestamp: number) => new Date(timestamp).toLocaleString();

const getRemainingTime = (expiresAt: number) => {
  const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000 / 60));
  return `${remaining} min`;
};

const WhatsAppConfigForm: React.FC<WhatsAppConfigFormProps> = ({ pluginStatus, modelSelection, onStatusChange }) => {
  const { t } = useTranslation();

  // Phone number for WhatsApp Web session
  const [phoneNumber, setPhoneNumber] = useState('');
  const [saving, setSaving] = useState(false);

  // Pairing state
  const [pairingLoading, setPairingLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [pendingPairings, setPendingPairings] = useState<IChannelPairingRequest[]>([]);
  const [authorizedUsers, setAuthorizedUsers] = useState<IChannelUser[]>([]);

  // Agent selection
  const [availableAgents, setAvailableAgents] = useState<
    Array<{ backend: AcpBackendAll; name: string; customAgentId?: string }>
  >([]);
  const [selectedAgent, setSelectedAgent] = useState<{
    backend: AcpBackendAll;
    name?: string;
    customAgentId?: string;
  }>({ backend: 'gemini' });

  const isConnected = pluginStatus?.connected || false;
  const hasToken = pluginStatus?.hasToken || false;

  // Load pairing requests
  const loadPendingPairings = useCallback(async () => {
    setPairingLoading(true);
    try {
      const result = await channel.getPendingPairings.invoke();
      if (result.success && result.data) {
        setPendingPairings(result.data.filter((p) => p.platformType === 'whatsapp'));
      }
    } catch (error) {
      console.error('[WhatsAppConfig] Failed to load pending pairings:', error);
    } finally {
      setPairingLoading(false);
    }
  }, []);

  // Load authorized users
  const loadAuthorizedUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const result = await channel.getAuthorizedUsers.invoke();
      if (result.success && result.data) {
        setAuthorizedUsers(result.data.filter((u) => u.platformType === 'whatsapp'));
      }
    } catch (error) {
      console.error('[WhatsAppConfig] Failed to load authorized users:', error);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPendingPairings();
    void loadAuthorizedUsers();
  }, [loadPendingPairings, loadAuthorizedUsers]);

  // Listen for incoming whatsapp pairing requests
  useEffect(() => {
    const unsubscribe = channel.pairingRequested.on((request) => {
      if (request.platformType !== 'whatsapp') return;
      setPendingPairings((prev) => {
        const exists = prev.some((p) => p.code === request.code);
        if (exists) return prev;
        return [request, ...prev];
      });
    });
    return () => unsubscribe();
  }, []);

  // Listen for user authorization
  useEffect(() => {
    const unsubscribe = channel.userAuthorized.on((user) => {
      if (user.platformType !== 'whatsapp') return;
      setAuthorizedUsers((prev) => {
        const exists = prev.some((u) => u.id === user.id);
        if (exists) return prev;
        return [user, ...prev];
      });
      setPendingPairings((prev) => prev.filter((p) => p.platformUserId !== user.platformUserId));
    });
    return () => unsubscribe();
  }, []);

  // Load agents + saved selection
  useEffect(() => {
    const load = async () => {
      try {
        const [agentsResp, saved] = await Promise.all([
          acpConversation.getAvailableAgents.invoke(),
          ConfigStorage.get('assistant.whatsapp.agent'),
        ]);
        if (agentsResp.success && agentsResp.data) {
          setAvailableAgents(
            agentsResp.data
              .filter((a) => !a.isPreset)
              .map((a) => ({
                backend: a.backend,
                name: a.name,
                customAgentId: a.customAgentId,
              }))
          );
        }
        if (
          saved &&
          typeof saved === 'object' &&
          'backend' in saved &&
          typeof (saved as Record<string, unknown>).backend === 'string'
        ) {
          const s = saved as { backend: AcpBackendAll; customAgentId?: string; name?: string };
          setSelectedAgent({
            backend: s.backend,
            customAgentId: s.customAgentId,
            name: s.name,
          });
        }
      } catch (error) {
        console.error('[WhatsAppConfig] Failed to load agents:', error);
      }
    };
    void load();
  }, []);

  const persistSelectedAgent = async (agent: { backend: AcpBackendAll; customAgentId?: string; name?: string }) => {
    try {
      await ConfigStorage.set('assistant.whatsapp.agent', agent);
      await channel.syncChannelSettings
        .invoke({ platform: 'whatsapp', agent })
        .catch((err) => console.warn('[WhatsAppConfig] syncChannelSettings failed:', err));
      Message.success(t('settings.assistant.agentSwitched', 'Agent switched successfully'));
    } catch (error) {
      console.error('[WhatsAppConfig] Failed to save agent:', error);
      Message.error(t('common.saveFailed', 'Failed to save'));
    }
  };

  const handleSaveAndEnable = async () => {
    const trimmed = phoneNumber.trim();
    if (!trimmed) {
      Message.warning(t('settings.whatsapp.phoneRequired', 'Please enter your WhatsApp phone number'));
      return;
    }
    setSaving(true);
    try {
      const result = await channel.enablePlugin.invoke({
        pluginId: 'whatsapp_default',
        config: { phoneNumber: trimmed },
      });
      if (result.success) {
        Message.success(t('settings.whatsapp.pluginEnabled', 'WhatsApp channel enabled'));
        const statusResult = await channel.getPluginStatus.invoke();
        if (statusResult.success && statusResult.data) {
          const whatsappPlugin = statusResult.data.find((p) => p.type === 'whatsapp');
          onStatusChange(whatsappPlugin || null);
        }
      } else {
        Message.error(result.msg || t('settings.whatsapp.enableFailed', 'Failed to enable WhatsApp'));
      }
    } catch (error: any) {
      Message.error(error.message || t('settings.whatsapp.enableFailed', 'Failed to enable WhatsApp'));
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const result = await channel.disablePlugin.invoke({ pluginId: 'whatsapp_default' });
      if (result.success) {
        Message.success(t('settings.whatsapp.pluginDisabled', 'WhatsApp channel disabled'));
        onStatusChange(null);
        setPhoneNumber('');
      } else {
        Message.error(result.msg || t('settings.whatsapp.disableFailed', 'Failed to disconnect'));
      }
    } catch (error: any) {
      Message.error(error.message);
    }
  };

  const handleApprovePairing = async (code: string) => {
    try {
      const result = await channel.approvePairing.invoke({ code });
      if (result.success) {
        Message.success(t('settings.assistant.pairingApproved', 'Pairing approved'));
        await loadPendingPairings();
        await loadAuthorizedUsers();
      } else {
        Message.error(result.msg || t('settings.assistant.approveFailed', 'Failed to approve pairing'));
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    }
  };

  const handleRejectPairing = async (code: string) => {
    try {
      const result = await channel.rejectPairing.invoke({ code });
      if (result.success) {
        Message.info(t('settings.assistant.pairingRejected', 'Pairing rejected'));
        await loadPendingPairings();
      } else {
        Message.error(result.msg || t('settings.assistant.rejectFailed', 'Failed to reject pairing'));
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    }
  };

  const handleRevokeUser = async (userId: string) => {
    try {
      const result = await channel.revokeUser.invoke({ userId });
      if (result.success) {
        Message.success(t('settings.assistant.userRevoked', 'User access revoked'));
        await loadAuthorizedUsers();
      } else {
        Message.error(result.msg || t('settings.assistant.revokeFailed', 'Failed to revoke user'));
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    }
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    Message.success(t('common.copySuccess', 'Copied'));
  };

  const isGeminiAgent = selectedAgent.backend === 'gemini';
  const agentOptions: Array<{
    backend: AcpBackendAll;
    name: string;
    customAgentId?: string;
  }> = availableAgents.length > 0 ? availableAgents : [{ backend: 'gemini', name: 'Gemini CLI' }];

  return (
    <div className='flex flex-col gap-24px'>
      {/* Connection / Phone Number */}
      <PreferenceRow
        label={t('settings.whatsapp.phoneNumber', 'Phone Number')}
        description={t(
          'settings.whatsapp.phoneDesc',
          'Enter your WhatsApp phone number with country code (e.g. +1234567890)'
        )}
      >
        {isConnected && hasToken ? (
          <div className='flex items-center gap-8px'>
            <CheckOne theme='filled' size={16} className='text-green-500' />
            <span className='text-14px text-t-primary'>{t('settings.whatsapp.connected', 'Connected')}</span>
            {pluginStatus?.botUsername && (
              <span className='text-12px text-t-tertiary'>({pluginStatus.botUsername})</span>
            )}
            <Button
              type='secondary'
              size='small'
              status='danger'
              onClick={() => {
                void handleDisconnect();
              }}
            >
              {t('settings.whatsapp.disconnect', 'Disconnect')}
            </Button>
          </div>
        ) : (
          <div className='flex items-center gap-8px'>
            <Input
              value={phoneNumber}
              onChange={setPhoneNumber}
              placeholder='+1234567890'
              className='w-200px'
              disabled={saving}
            />
            <Button type='primary' loading={saving} onClick={() => void handleSaveAndEnable()}>
              {t('settings.whatsapp.connect', 'Connect')}
            </Button>
          </div>
        )}
      </PreferenceRow>

      {/* Agent Selection */}
      <PreferenceRow
        label={t('settings.whatsapp.agent', 'Agent')}
        description={t('settings.whatsapp.agentDesc', 'AI agent used for WhatsApp conversations')}
      >
        <Dropdown
          trigger='click'
          position='br'
          droplist={
            <Menu
              selectedKeys={[
                selectedAgent.customAgentId
                  ? `${selectedAgent.backend}|${selectedAgent.customAgentId}`
                  : selectedAgent.backend,
              ]}
            >
              {agentOptions.map((a) => {
                const key = a.customAgentId ? `${a.backend}|${a.customAgentId}` : a.backend;
                return (
                  <Menu.Item
                    key={key}
                    onClick={() => {
                      const currentKey = selectedAgent.customAgentId
                        ? `${selectedAgent.backend}|${selectedAgent.customAgentId}`
                        : selectedAgent.backend;
                      if (key === currentKey) return;
                      const next = {
                        backend: a.backend,
                        customAgentId: a.customAgentId,
                        name: a.name,
                      };
                      setSelectedAgent(next);
                      void persistSelectedAgent(next);
                    }}
                  >
                    {a.name}
                  </Menu.Item>
                );
              })}
            </Menu>
          }
        >
          <Button type='secondary' className='min-w-160px flex items-center justify-between gap-8px'>
            <span className='truncate'>
              {selectedAgent.name ||
                availableAgents.find(
                  (a) =>
                    (a.customAgentId ? `${a.backend}|${a.customAgentId}` : a.backend) ===
                    (selectedAgent.customAgentId
                      ? `${selectedAgent.backend}|${selectedAgent.customAgentId}`
                      : selectedAgent.backend)
                )?.name ||
                selectedAgent.backend}
            </span>
            <Down theme='outline' size={14} />
          </Button>
        </Dropdown>
      </PreferenceRow>

      {/* Default Model Selection */}
      <PreferenceRow
        label={t('settings.assistant.defaultModel', 'Default Model')}
        description={t('settings.whatsapp.defaultModelDesc', 'Model used for WhatsApp conversations')}
      >
        <GeminiModelSelector
          selection={isGeminiAgent ? modelSelection : undefined}
          disabled={!isGeminiAgent}
          label={
            !isGeminiAgent
              ? t('settings.assistant.autoFollowCliModel', 'Automatically follow the model when CLI is running')
              : undefined
          }
          variant='settings'
        />
      </PreferenceRow>

      {/* Next Steps Guide — shown when connected but no authorized users yet */}
      {isConnected && authorizedUsers.length === 0 && (
        <div className='bg-blue-50 dark:bg-blue-900/20 rd-12px p-16px border border-blue-200 dark:border-blue-800'>
          <SectionHeader title={t('settings.assistant.nextSteps', 'Next Steps')} />
          <div className='text-14px text-t-secondary space-y-8px'>
            <p className='m-0'>
              <strong>1.</strong>{' '}
              {t('settings.whatsapp.step1', 'Send a message to your Gods Eye WhatsApp number from any phone')}
            </p>
            <p className='m-0'>
              <strong>2.</strong>{' '}
              {t(
                'settings.whatsapp.step2',
                'A pairing request will appear below. Click "Approve" to authorize the user.'
              )}
            </p>
            <p className='m-0'>
              <strong>3.</strong>{' '}
              {t(
                'settings.whatsapp.step3',
                'Once approved, you can start chatting with the AI assistant through WhatsApp!'
              )}
            </p>
          </div>
        </div>
      )}

      {/* Pending Pairing Requests */}
      {isConnected && (
        <div className='bg-fill-1 rd-12px pt-16px pr-16px pb-16px pl-0'>
          <SectionHeader
            title={t('settings.assistant.pendingPairings', 'Pending Pairing Requests')}
            action={
              <Button
                size='mini'
                type='text'
                icon={<Refresh size={14} />}
                loading={pairingLoading}
                onClick={loadPendingPairings}
              >
                {t('common.refresh', 'Refresh')}
              </Button>
            }
          />
          {pairingLoading ? (
            <div className='flex justify-center py-24px'>
              <Spin />
            </div>
          ) : pendingPairings.length === 0 ? (
            <Empty description={t('settings.assistant.noPendingPairings', 'No pending pairing requests')} />
          ) : (
            <div className='flex flex-col gap-12px'>
              {pendingPairings.map((pairing) => (
                <div key={pairing.code} className='flex items-center justify-between bg-fill-2 rd-8px p-12px'>
                  <div className='flex-1'>
                    <div className='flex items-center gap-8px'>
                      <span className='text-14px font-500 text-t-primary'>
                        {pairing.displayName || 'Unknown User'}
                      </span>
                      <Tooltip content={t('settings.assistant.copyCode', 'Copy pairing code')}>
                        <Button
                          type='text'
                          size='mini'
                          icon={<Copy size={14} />}
                          onClick={() => copyToClipboard(pairing.code)}
                        />
                      </Tooltip>
                    </div>
                    <div className='text-12px text-t-tertiary mt-4px'>
                      {t('settings.assistant.pairingCode', 'Code')}:{' '}
                      <code className='bg-fill-3 px-4px rd-2px'>{pairing.code}</code>
                      <span className='mx-8px'>|</span>
                      {t('settings.assistant.expiresIn', 'Expires in')}: {getRemainingTime(pairing.expiresAt)}
                    </div>
                  </div>
                  <div className='flex items-center gap-8px'>
                    <Button
                      type='primary'
                      size='small'
                      icon={<CheckOne size={14} />}
                      onClick={() => handleApprovePairing(pairing.code)}
                    >
                      {t('settings.assistant.approve', 'Approve')}
                    </Button>
                    <Button
                      type='secondary'
                      size='small'
                      status='danger'
                      icon={<CloseOne size={14} />}
                      onClick={() => handleRejectPairing(pairing.code)}
                    >
                      {t('settings.assistant.reject', 'Reject')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Authorized Users */}
      {authorizedUsers.length > 0 && (
        <div className='bg-fill-1 rd-12px pt-16px pr-16px pb-16px pl-0'>
          <SectionHeader
            title={t('settings.assistant.authorizedUsers', 'Authorized Users')}
            action={
              <Button
                size='mini'
                type='text'
                icon={<Refresh size={14} />}
                loading={usersLoading}
                onClick={loadAuthorizedUsers}
              >
                {t('common.refresh', 'Refresh')}
              </Button>
            }
          />
          {usersLoading ? (
            <div className='flex justify-center py-24px'>
              <Spin />
            </div>
          ) : (
            <div className='flex flex-col gap-12px'>
              {authorizedUsers.map((user) => (
                <div key={user.id} className='flex items-center justify-between bg-fill-2 rd-8px p-12px'>
                  <div className='flex-1'>
                    <div className='text-14px font-500 text-t-primary'>{user.displayName || 'Unknown User'}</div>
                    <div className='text-12px text-t-tertiary mt-4px'>
                      {t('settings.assistant.authorizedAt', 'Authorized')}: {formatTime(user.authorizedAt)}
                    </div>
                  </div>
                  <Tooltip content={t('settings.assistant.revokeAccess', 'Revoke access')}>
                    <Button
                      type='text'
                      status='danger'
                      size='small'
                      icon={<Delete size={16} />}
                      onClick={() => handleRevokeUser(user.id)}
                    />
                  </Tooltip>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WhatsAppConfigForm;
