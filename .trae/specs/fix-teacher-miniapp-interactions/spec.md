# 修复老师端小程序交互问题 Spec

## Why
班级管理页面的快捷操作按钮点击无反应，以及选择器弹窗被Tab Bar遮挡，影响用户体验和功能可用性。

## What Changes
- 修复班级管理页面快捷操作按钮（班级作业、学习报告）的点击事件问题
- 修复所有老师端页面底部弹窗被Tab Bar遮挡的问题
- 调整弹窗样式，确保内容不被Tab Bar遮挡

## Impact
- Affected specs: 老师端小程序交互体验
- Affected code: 
  - `wechat-miniapp/pages/teacher/classes/index.js` - 班级管理页面逻辑
  - `wechat-miniapp/styles/teacher.wxss` - 弹窗样式

## ADDED Requirements

### Requirement: 快捷操作按钮响应
班级管理页面的快捷操作按钮（班级作业、学习报告） SHALL 正确响应点击事件并跳转到对应页面。

#### Scenario: 点击班级作业按钮
- **WHEN** 用户在班级管理页面点击"班级作业"按钮
- **AND** 已选择班级
- **THEN** 系统应跳转到该班级的作业列表页面

#### Scenario: 点击学习报告按钮
- **WHEN** 用户在班级管理页面点击"学习报告"按钮
- **AND** 已选择班级
- **THEN** 系统应跳转到该班级的学习报告页面

#### Scenario: 未选择班级时点击按钮
- **WHEN** 用户在班级管理页面点击快捷操作按钮
- **AND** 未选择班级（selectedClassId为空）
- **THEN** 系统应显示提示"请先选择班级"

### Requirement: 弹窗不被Tab Bar遮挡
所有老师端页面的底部弹出选择器 SHALL 不被Tab Bar遮挡，确保用户可以完整查看和操作弹窗内容。

#### Scenario: 弹窗显示完整
- **WHEN** 用户触发底部弹窗（班级选择、作业选择、模式选择等）
- **THEN** 弹窗内容应完全可见，不被Tab Bar遮挡
- **AND** 弹窗底部应有足够的内边距（至少120rpx + safe-area-inset-bottom）

#### Scenario: 弹窗滚动区域可用
- **WHEN** 弹窗内容超过最大高度
- **THEN** 用户应能够滚动查看所有选项
- **AND** 滚动区域不被Tab Bar遮挡

## MODIFIED Requirements

### Requirement: 弹窗样式优化
`.teacher-selector-content` 的 `padding-bottom` 应从 `calc(24rpx + env(safe-area-inset-bottom))` 修改为 `calc(140rpx + env(safe-area-inset-bottom))`，以避免被Tab Bar（高度100rpx）遮挡。

## REMOVED Requirements
无
