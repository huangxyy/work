# 小程序老师端UI与功能修复 Spec

## Why
小程序老师端存在多个UI和功能问题：班级选择按钮太小、快捷操作按钮点击无响应、学生提交页面无法正常使用、班级学生数据显示不正确。这些问题严重影响用户体验和功能可用性。

## What Changes
- 增大班级选择按钮尺寸，优化布局
- 修复班级管理页面快捷操作按钮的点击响应问题
- 修复学生提交页面的数据显示和交互问题
- 修复班级学生数据统计显示问题
- 检查并修复其他页面的数据展示问题

## Impact
- Affected specs: 小程序老师端所有页面
- Affected code:
  - `wechat-miniapp/pages/teacher/classes/index.wxml` - 班级管理页面布局
  - `wechat-miniapp/pages/teacher/classes/index.wxss` - 班级管理页面样式
  - `wechat-miniapp/pages/teacher/classes/index.js` - 班级管理页面逻辑
  - `wechat-miniapp/pages/teacher/student-submissions/index.js` - 学生提交页面逻辑
  - `wechat-miniapp/styles/teacher.wxss` - 老师端通用样式
  - `wechat-miniapp/styles/components.wxss` - 组件样式

## ADDED Requirements

### Requirement: 班级选择按钮尺寸优化
班级管理页面的班级选择按钮 SHALL 具有足够大的点击区域，确保用户可以轻松点击。

#### Scenario: 按钮尺寸规范
- **WHEN** 用户查看班级管理页面
- **THEN** 班级选择按钮的最小高度应为 80rpx
- **AND** 按钮内边距应为 20rpx 40rpx
- **AND** 按钮之间应有适当的间距

#### Scenario: 按钮布局优化
- **WHEN** 班级数量较多时
- **THEN** 班级选择区域应支持横向滚动
- **AND** 滚动应流畅无卡顿
- **AND** 选中的班级应有明显的视觉反馈

### Requirement: 快捷操作按钮响应
班级管理页面的快捷操作按钮（班级作业、学习报告） SHALL 正确响应点击事件并跳转到对应页面。

#### Scenario: 按钮点击区域
- **WHEN** 用户点击快捷操作按钮
- **THEN** 按钮的最小高度应为 120rpx
- **AND** 按钮应有足够的内边距
- **AND** 点击区域应覆盖整个按钮区域

#### Scenario: 点击反馈
- **WHEN** 用户点击快捷操作按钮
- **THEN** 按钮应有明显的视觉反馈（缩放或变色）
- **AND** 跳转应正确执行

### Requirement: 学生提交页面功能完善
学生提交页面 SHALL 正确显示学生的提交记录和统计数据。

#### Scenario: 数据加载
- **WHEN** 用户进入学生提交页面
- **THEN** 页面应正确加载学生的提交记录
- **AND** 统计数据应准确显示
- **AND** 加载失败时应显示错误提示

#### Scenario: 提交记录展示
- **WHEN** 学生有提交记录
- **THEN** 每条记录应显示作业名称、得分、状态、提交时间
- **AND** 点击记录应能查看详情

### Requirement: 班级学生数据正确显示
班级管理页面 SHALL 正确显示班级学生数量和学生列表。

#### Scenario: 学生数量统计
- **WHEN** 用户查看班级详情
- **THEN** 学生人数应与实际学生数量一致
- **AND** 学生列表应完整显示

#### Scenario: 学生列表展示
- **WHEN** 班级有学生
- **THEN** 学生列表应显示学生姓名和账号
- **AND** 点击学生应能跳转到学生提交页面

## MODIFIED Requirements

### Requirement: 统计卡片样式优化
统计卡片（班级作业、学习报告）应具有更大的点击区域和更明显的可点击提示。

**原有样式**:
- padding: 28rpx 20rpx
- 最小高度: 无明确要求

**优化后样式**:
- padding: 32rpx 24rpx
- 最小高度: 120rpx
- 添加更明显的箭头提示

### Requirement: 筛选胶囊样式优化
班级选择筛选胶囊应具有更大的点击区域。

**原有样式**:
- padding: 16rpx 32rpx
- font-size: 26rpx

**优化后样式**:
- padding: 20rpx 40rpx
- font-size: 28rpx
- min-height: 80rpx

## REMOVED Requirements
无
