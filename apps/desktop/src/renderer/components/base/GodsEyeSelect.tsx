/**
 * @license
 * Copyright 2025 Gods Eye (gods-eye.org)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Select } from '@arco-design/web-react';
import type { SelectProps } from '@arco-design/web-react';
import type { SelectHandle } from '@arco-design/web-react/es/Select/interface';
import classNames from 'classnames';
import React from 'react';

/**
 * 自定义下拉选择组件属性 / Custom select component props
 */
type NativeSelectProps = Omit<SelectProps, 'size'>;
type NativeSelectSize = NonNullable<SelectProps['size']>;
type GodsEyeSelectSize = NativeSelectSize | 'middle';

export interface GodsEyeSelectProps extends NativeSelectProps {
  /** 额外的类名 / Additional class name */
  className?: string;
  /** 统一尺寸，新增 middle（32px）/ Unified size with additional "middle" (32px) */
  size?: GodsEyeSelectSize;
}

/**
 * 基础样式类名
 * 注意：主题相关样式（背景色、边框色）在 arco-override.css 的 .godseye-select 类中定义
 * Note: Theme-related styles (background, border colors) are defined in .godseye-select class in arco-override.css
 */
const BASE_CLASS = classNames(
  'godseye-select',
  '[&_.arco-select-view]:rounded-[4px]',
  '[&_.arco-select-view]:border',
  '[&_.arco-select-view]:border-solid',
  '[&_.arco-select-view]:border-border-2',
  '[&_.arco-select-view]:shadow-none',
  '[&_.arco-select-view]:transition-colors',
  '[&_.arco-select-view:hover]:border-[var(--color-primary)]',
  '[&_.arco-select-view:focus-within]:border-[var(--color-primary)]',
  '[&_.arco-select-view-disabled]:bg-[var(--color-bg-2)]',
  '[&_.arco-select-view-disabled]:opacity-80'
);

/**
 * 默认的弹出层容器获取函数
 * 始终返回 document.body 以避免嵌套容器导致的 ResizeObserver 循环错误
 * Default popup container getter function
 * Always returns document.body to avoid ResizeObserver loop errors from nested containers
 */
const defaultGetPopupContainer = (): HTMLElement => {
  // 在浏览器环境下始终挂载到 body，避免嵌套容器导致 ResizeObserver 循环
  // Always mount popup to body in browsers to avoid nested-container ResizeObserver loops
  if (typeof document !== 'undefined' && document.body) {
    return document.body;
  }
  // SSR/测试环境降级返回占位，具体不会真正渲染
  // Fallback for SSR/tests – this code path shouldn't render popups
  return undefined as unknown as HTMLElement;
};

/**
 * 自定义下拉选择组件 / Custom select component
 *
 * 基于 Arco Design Select 的封装，提供统一的样式主题和弹出层处理
 * Wrapper around Arco Design Select with unified theme styling and popup handling
 *
 * @features
 * - 自动适配明暗主题 / Auto theme adaptation (light/dark)
 * - 弹出层挂载到 body，避免布局问题 / Popup mounted to body to avoid layout issues
 * - 统一的圆角和边框样式 / Unified border radius and border styles
 * - 完整的 Arco Select API 支持 / Full Arco Select API support
 *
 * @example
 * ```tsx
 * // 基本用法 / Basic usage
 * <GodsEyeSelect placeholder="请选择" style={{ width: 200 }}>
 *   <GodsEyeSelect.Option value="1">选项1</GodsEyeSelect.Option>
 *   <GodsEyeSelect.Option value="2">选项2</GodsEyeSelect.Option>
 * </GodsEyeSelect>
 *
 * // 多选 / Multiple selection
 * <GodsEyeSelect mode="multiple" placeholder="请选择多个">
 *   <GodsEyeSelect.Option value="1">选项1</GodsEyeSelect.Option>
 *   <GodsEyeSelect.Option value="2">选项2</GodsEyeSelect.Option>
 * </GodsEyeSelect>
 *
 * // 分组 / Grouped options
 * <GodsEyeSelect placeholder="请选择">
 *   <GodsEyeSelect.OptGroup label="分组1">
 *     <GodsEyeSelect.Option value="1">选项1</GodsEyeSelect.Option>
 *   </GodsEyeSelect.OptGroup>
 *   <GodsEyeSelect.OptGroup label="分组2">
 *     <GodsEyeSelect.Option value="2">选项2</GodsEyeSelect.Option>
 *   </GodsEyeSelect.OptGroup>
 * </GodsEyeSelect>
 * ```
 *
 * @see arco-override.css for theme-related styles (.godseye-select)
 */
const mapSizeToNative = (size?: GodsEyeSelectSize): NativeSelectSize | undefined => {
  if (!size) return undefined;
  if (size === 'middle') return 'default';
  return size;
};

type GodsEyeSelectComponent = React.ForwardRefExoticComponent<GodsEyeSelectProps & React.RefAttributes<SelectHandle>> & {
  Option: typeof Select.Option;
  OptGroup: typeof Select.OptGroup;
};

const InternalSelect = React.forwardRef<SelectHandle, GodsEyeSelectProps>(
  ({ className, getPopupContainer, size = 'middle', ...rest }, ref) => {
    const normalizedSize = mapSizeToNative(size);
    return (
      <Select
        ref={ref}
        size={normalizedSize}
        className={classNames(BASE_CLASS, className)}
        getPopupContainer={getPopupContainer || defaultGetPopupContainer}
        {...rest}
      />
    );
  }
);

const GodsEyeSelect = InternalSelect as GodsEyeSelectComponent;

GodsEyeSelect.displayName = 'GodsEyeSelect';

// 导出子组件 / Export sub-components
GodsEyeSelect.Option = Select.Option;
GodsEyeSelect.OptGroup = Select.OptGroup;

export default GodsEyeSelect;
