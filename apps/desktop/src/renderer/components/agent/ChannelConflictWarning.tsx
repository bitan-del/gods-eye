/**
 * @license
 * Copyright 2025 Gods Eye (gods-eye.org)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Alert, Button, Link, Space, Typography } from '@arco-design/web-react';
import { IconExclamationCircle } from '@arco-design/web-react/icon';
import React from 'react';

const { Paragraph, Text } = Typography;

interface ChannelConflictWarningProps {
  platform: 'lark' | 'telegram';
  openclawConfigPath: string;
  onDisableOpenClaw?: () => void;
  onIgnore?: () => void;
}

/**
 * Warning component when OpenClaw channel conflicts with Gods Eye Channels
 */
export const ChannelConflictWarning: React.FC<ChannelConflictWarningProps> = ({
  platform,
  openclawConfigPath,
  onDisableOpenClaw,
  onIgnore,
}) => {
  const platformName = platform === 'lark' ? 'Lark/Feishu' : 'Telegram';
  const channelKey = platform === 'lark' ? 'feishu' : 'telegram';

  return (
    <Alert
      type='warning'
      icon={<IconExclamationCircle />}
      title={`${platformName} Channel Conflict Detected`}
      content={
        <Space direction='vertical' size='medium' style={{ width: '100%' }}>
          <Paragraph>
            <Text bold>Gods Eye CLI is handling {platformName} messages, not Gods Eye.</Text>
          </Paragraph>

          <Paragraph>
            Your {platformName} bot credentials are also configured in Gods Eye CLI. This means:
            <ul>
              <li>
                <Text type='error'>✗ Switching agents in Gods Eye will have no effect</Text>
              </li>
              <li>
                <Text type='error'>✗ Messages are processed by Gods Eye CLI agent</Text>
              </li>
              <li>
                <Text type='success'>✓ Messages still work (via Gods Eye CLI)</Text>
              </li>
            </ul>
          </Paragraph>

          <Paragraph>
            <Text bold>To use Gods Eye Channels and switch agents:</Text>
          </Paragraph>

          <Paragraph>
            <Text type='secondary'>Option 1: Disable Gods Eye CLI {platformName} (Recommended)</Text>
            <br />
            Edit: <Text code>{openclawConfigPath}</Text>
            <br />
            Set: <Text code>{`channels.${channelKey}.enabled = false`}</Text>
            <br />
            Then restart Gods Eye.
          </Paragraph>

          <Paragraph>
            <Text type='secondary'>Option 2: Use a different bot</Text>
            <br />
            Create a new {platformName} bot with different credentials for Gods Eye.
          </Paragraph>

          <Paragraph>
            <Text type='secondary'>Option 3: Keep using Gods Eye CLI</Text>
            <br />
            Disable {platformName} in Gods Eye Channels and continue using Gods Eye CLI integration.
          </Paragraph>

          <Space>
            {onDisableOpenClaw && (
              <Button type='primary' onClick={onDisableOpenClaw}>
                Help me disable Gods Eye CLI {platformName}
              </Button>
            )}
            {onIgnore && (
              <Button type='text' onClick={onIgnore}>
                Ignore (I know what I'm doing)
              </Button>
            )}
          </Space>
        </Space>
      }
      closable={false}
      style={{ marginBottom: 16 }}
    />
  );
};

/**
 * Compact warning banner (for settings page)
 */
export const ChannelConflictBanner: React.FC<{ platform: 'lark' | 'telegram'; onLearnMore: () => void }> = ({
  platform,
  onLearnMore,
}) => {
  const platformName = platform === 'lark' ? 'Lark/Feishu' : 'Telegram';

  return (
    <Alert
      type='warning'
      content={
        <Space>
          <Text>⚠️ Gods Eye CLI {platformName} conflict detected - Agent switching won't work.</Text>
          <Link onClick={onLearnMore}>Learn more</Link>
        </Space>
      }
      closable
      style={{ marginBottom: 12 }}
    />
  );
};
