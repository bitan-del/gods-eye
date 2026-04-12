/**
 * @license
 * Copyright 2025 Gods Eye (gods-eye.org)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Gods Eye 基础组件库统一导出 / Gods Eye base components unified exports
 *
 * 提供所有基础组件和类型的统一导出入口
 * Provides unified export entry for all base components and types
 */

// ==================== 组件导出 / Component Exports ====================

export { default as GodsEyeModal } from './GodsEyeModal';
export { default as AionCollapse } from './AionCollapse';
export { default as GodsEyeSelect } from './GodsEyeSelect';
export { default as AionScrollArea } from './AionScrollArea';
export { default as AionSteps } from './AionSteps';

// ==================== 类型导出 / Type Exports ====================

// GodsEyeModal 类型 / GodsEyeModal types
export type {
  ModalSize,
  ModalHeaderConfig,
  ModalFooterConfig,
  ModalContentStyleConfig,
  GodsEyeModalProps,
} from './GodsEyeModal';
export { MODAL_SIZES } from './GodsEyeModal';

// AionCollapse 类型 / AionCollapse types
export type { AionCollapseProps, AionCollapseItemProps } from './AionCollapse';

// GodsEyeSelect 类型 / GodsEyeSelect types
export type { GodsEyeSelectProps } from './GodsEyeSelect';

// AionSteps 类型 / AionSteps types
export type { AionStepsProps } from './AionSteps';
