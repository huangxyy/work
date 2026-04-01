# 用户体验简化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 简化老师端评分设置页面和管理端菜单结构，提升用户体验

**Architecture:** 
- 老师端：将评分设置简化为单一的模式选择，技术参数由管理端统一配置
- 管理端：重新组织菜单结构，将高级工具分组折叠

**Tech Stack:** NestJS, Prisma, React, Ant Design Pro, TypeScript

---

## 文件结构

### 新增文件
- `apps/backend/prisma/migrations/YYYYMMDDHHMMSS_add_user_grading_preference/migration.sql` - 数据库迁移
- `apps/backend/src/teacher-settings/dto/grading-preference.dto.ts` - DTO 定义
- `apps/backend/src/teacher-settings/teacher-preference.service.ts` - 评分偏好服务
- `apps/frontend/src/pages/teacher/GradingPreference.tsx` - 简化版评分设置页面

### 修改文件
- `apps/backend/prisma/schema.prisma` - 添加 gradingPreference 字段
- `apps/backend/src/teacher-settings/teacher-settings.controller.ts` - 添加新端点
- `apps/backend/src/teacher-settings/teacher-settings.module.ts` - 注册新服务
- `apps/backend/src/grading/grading.service.ts` - 读取老师评分偏好
- `apps/frontend/src/layouts/AdminLayout.tsx` - 重构菜单结构
- `apps/frontend/src/layouts/TeacherLayout.tsx` - 更新导航菜单
- `apps/frontend/src/routes/modules/teacher.tsx` - 更新路由
- `apps/frontend/src/api/teacher.ts` - 添加新 API 函数
- `apps/frontend/src/i18n.ts` - 更新文案

---

## Task 1: 数据库迁移 - 添加 gradingPreference 字段

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/migrations/YYYYMMDDHHMMSS_add_user_grading_preference/migration.sql`

- [ ] **Step 1: 修改 Prisma schema，添加 gradingPreference 字段**

在 `apps/backend/prisma/schema.prisma` 的 `User` 模型中添加字段：

```prisma
model User {
  id           String   @id @default(cuid())
  role         Role
  name         String
  account      String   @unique
  passwordHash String
  email        String?
  phone        String?
  avatarUrl    String?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  gradingPreference Json?  // 添加此字段，存储格式：{ "mode": "cheap" | "quality" }

  teacherClasses  Class[]            @relation("TeacherClasses")
  studentEnrolls  Enrollment[]
  submissions     Submission[]
  batchUploads    BatchUpload[]
  notifications   Notification[]
  announcements   Announcement[]     @relation("AuthoredAnnouncements")
  hwTemplates     HomeworkTemplate[] @relation("TeacherTemplates")
}
```

- [ ] **Step 2: 生成 Prisma 迁移文件**

Run: `cd apps/backend && pnpm prisma migrate dev --name add_user_grading_preference`
Expected: 迁移文件创建成功，数据库更新

- [ ] **Step 3: 生成 Prisma Client**

Run: `cd apps/backend && pnpm prisma generate`
Expected: Prisma Client 更新成功

- [ ] **Step 4: 提交数据库迁移**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations/
git commit -m "feat(db): add gradingPreference field to User model"
```

---

## Task 2: 后端 - 创建评分偏好 DTO 和服务

**Files:**
- Create: `apps/backend/src/teacher-settings/dto/grading-preference.dto.ts`
- Create: `apps/backend/src/teacher-settings/teacher-preference.service.ts`
- Modify: `apps/backend/src/teacher-settings/teacher-settings.module.ts`

- [ ] **Step 1: 创建 DTO 定义**

创建文件 `apps/backend/src/teacher-settings/dto/grading-preference.dto.ts`：

```typescript
import { IsEnum, IsOptional } from 'class-validator';

export enum GradingMode {
  CHEAP = 'cheap',
  QUALITY = 'quality',
}

export class GradingPreferenceDto {
  @IsEnum(GradingMode)
  @IsOptional()
  mode?: GradingMode;
}

export class GradingPreferenceResponseDto {
  mode: GradingMode | null;
}
```

- [ ] **Step 2: 创建评分偏好服务**

创建文件 `apps/backend/src/teacher-settings/teacher-preference.service.ts`：

```typescript
import { Injectable, Logger } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { GradingMode, GradingPreferenceDto, GradingPreferenceResponseDto } from './dto/grading-preference.dto';

@Injectable()
export class TeacherPreferenceService {
  private readonly logger = new Logger(TeacherPreferenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getGradingPreference(user: AuthUser): Promise<GradingPreferenceResponseDto> {
    const startedAt = Date.now();
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { gradingPreference: true },
    });

    const preference = userRecord?.gradingPreference as { mode?: GradingMode } | null;
    const result: GradingPreferenceResponseDto = {
      mode: preference?.mode || null,
    };

    this.logger.debug(
      `Teacher grading preference fetched userId=${user.id} mode=${result.mode} durationMs=${Date.now() - startedAt}`,
    );

    return result;
  }

  async updateGradingPreference(user: AuthUser, dto: GradingPreferenceDto): Promise<GradingPreferenceResponseDto> {
    const startedAt = Date.now();
    
    const currentPreference = (await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { gradingPreference: true },
    }))?.gradingPreference as { mode?: GradingMode } | null;

    const newPreference = {
      ...(currentPreference || {}),
      ...(dto.mode !== undefined && { mode: dto.mode }),
    };

    await this.prisma.user.update({
      where: { id: user.id },
      data: { gradingPreference: newPreference },
    });

    const result: GradingPreferenceResponseDto = {
      mode: dto.mode || null,
    };

    this.logger.debug(
      `Teacher grading preference updated userId=${user.id} mode=${result.mode} durationMs=${Date.now() - startedAt}`,
    );

    return result;
  }
}
```

- [ ] **Step 3: 更新模块注册**

修改 `apps/backend/src/teacher-settings/teacher-settings.module.ts`，添加新服务：

```typescript
import { Module } from '@nestjs/common';
import { TeacherSettingsController } from './teacher-settings.controller';
import { TeacherSettingsService } from './teacher-settings.service';
import { TeacherPreferenceService } from './teacher-preference.service';

@Module({
  controllers: [TeacherSettingsController],
  providers: [TeacherSettingsService, TeacherPreferenceService],
  exports: [TeacherSettingsService, TeacherPreferenceService],
})
export class TeacherSettingsModule {}
```

- [ ] **Step 4: 提交后端服务代码**

```bash
git add apps/backend/src/teacher-settings/
git commit -m "feat(backend): add teacher grading preference service"
```

---

## Task 3: 后端 - 添加评分偏好 API 端点

**Files:**
- Modify: `apps/backend/src/teacher-settings/teacher-settings.controller.ts`

- [ ] **Step 1: 添加新的 API 端点**

在 `apps/backend/src/teacher-settings/teacher-settings.controller.ts` 中添加：

```typescript
import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';
import { GradingPreferenceDto } from './dto/grading-preference.dto';
import { GradingPolicyQueryDto } from './dto/grading-policy-query.dto';
import { GradingPolicyUpdateDto } from './dto/grading-policy-update.dto';
import { TeacherPreferenceService } from './teacher-preference.service';
import { TeacherSettingsService } from './teacher-settings.service';

@Controller('teacher/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeacherSettingsController {
  constructor(
    private readonly teacherSettingsService: TeacherSettingsService,
    private readonly teacherPreferenceService: TeacherPreferenceService,
  ) {}

  // ... 保留现有方法 ...

  @Get('grading/preference')
  @Roles(Role.TEACHER, Role.ADMIN)
  async getGradingPreference(@Req() req: { user: AuthUser }) {
    return this.teacherPreferenceService.getGradingPreference(req.user);
  }

  @Post('grading/preference')
  @Roles(Role.TEACHER, Role.ADMIN)
  async updateGradingPreference(
    @Body() body: GradingPreferenceDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.teacherPreferenceService.updateGradingPreference(req.user, body);
  }
}
```

- [ ] **Step 2: 运行后端测试**

Run: `cd apps/backend && pnpm test -- teacher-settings`
Expected: 所有测试通过

- [ ] **Step 3: 提交控制器代码**

```bash
git add apps/backend/src/teacher-settings/teacher-settings.controller.ts
git commit -m "feat(backend): add grading preference API endpoints"
```

---

## Task 4: 后端 - 修改评分服务读取老师偏好

**Files:**
- Modify: `apps/backend/src/grading/grading.service.ts`

- [ ] **Step 1: 在评分服务中添加读取老师偏好的逻辑**

修改 `apps/backend/src/grading/grading.service.ts`，在 `grade` 方法中添加读取老师偏好的逻辑：

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GradingError } from './grading.errors';
import { GradingMeta, GradingResult } from './grading.types';
import { CheapProvider } from './providers/cheap.provider';
import { GradeEssayParams, GradingMode, ProviderInfo } from './providers/provider.interface';
import { BudgetTracker } from './utils/budget';
import { validateGradingResult } from './utils/schema-validate';
import { PrismaService } from '../prisma/prisma.service';

export type GradeOptions = {
  needRewrite?: boolean;
  mode?: GradingMode;
  rubric?: string;
  teacherId?: string;
};

// ... 保留现有代码 ...

@Injectable()
export class GradingService {
  private readonly logger = new Logger(GradingService.name);
  private readonly maxInputChars: number;
  private readonly defaultMaxTokens: number;
  private readonly retryMaxTokens: number;
  private readonly shortMaxTokens: number;

  constructor(
    private readonly provider: CheapProvider,
    private readonly budgetTracker: BudgetTracker,
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.maxInputChars = Number(configService.get<string>('LLM_MAX_INPUT_CHARS') || '6000');
    this.defaultMaxTokens = Number(configService.get<string>('LLM_MAX_TOKENS') || '800');
    this.retryMaxTokens = Math.max(200, Math.floor(this.defaultMaxTokens * 0.7));
    this.shortMaxTokens = Math.max(600, Math.floor(this.defaultMaxTokens * 0.9));
  }

  async grade(text: string, options: GradeOptions = {}) {
    // Validate input is not null or undefined
    if (text == null) {
      throw new GradingError('LLM_SCHEMA_INVALID', 'OCR text is null or undefined');
    }

    const trimmed = text.trim();
    if (!trimmed) {
      throw new GradingError('LLM_SCHEMA_INVALID', 'OCR text is empty after trimming');
    }

    // 读取老师评分偏好
    let effectiveMode = options.mode || 'cheap';
    if (options.teacherId && !options.mode) {
      const user = await this.prisma.user.findUnique({
        where: { id: options.teacherId },
        select: { gradingPreference: true },
      });
      const preference = user?.gradingPreference as { mode?: GradingMode } | null;
      if (preference?.mode) {
        effectiveMode = preference.mode;
      }
    }

    const rubric = options.rubric || DEFAULT_RUBRIC;
    const needRewrite = Boolean(options.needRewrite);

    // ... 保留后续代码，使用 effectiveMode 替代 mode ...
  }

  // ... 保留其他方法 ...
}
```

- [ ] **Step 2: 更新 GradingModule 导入 PrismaService**

确保 `apps/backend/src/grading/grading.module.ts` 导入了 PrismaModule：

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GradingService } from './grading.service';
import { CheapProvider } from './providers/cheap.provider';
import { BudgetTracker } from './utils/budget';

@Module({
  imports: [PrismaModule],
  providers: [GradingService, CheapProvider, BudgetTracker],
  exports: [GradingService],
})
export class GradingModule {}
```

- [ ] **Step 3: 运行后端测试**

Run: `cd apps/backend && pnpm test -- grading`
Expected: 所有测试通过

- [ ] **Step 4: 提交评分服务修改**

```bash
git add apps/backend/src/grading/
git commit -m "feat(grading): read teacher grading preference in grading service"
```

---

## Task 5: 前端 - 添加评分偏好 API 函数

**Files:**
- Modify: `apps/frontend/src/api/teacher.ts`

- [ ] **Step 1: 添加 API 函数**

在 `apps/frontend/src/api/teacher.ts` 中添加：

```typescript
export type GradingPreferenceResponse = {
  mode: 'cheap' | 'quality' | null;
};

export const fetchTeacherGradingPreference = async () => {
  const response = await api.get('/teacher/settings/grading/preference');
  return response.data as GradingPreferenceResponse;
};

export const updateTeacherGradingPreference = async (payload: { mode: 'cheap' | 'quality' }) => {
  const response = await api.post('/teacher/settings/grading/preference', payload);
  return response.data as GradingPreferenceResponse;
};
```

- [ ] **Step 2: 导出新函数**

确保在 `apps/frontend/src/api/index.ts` 中导出新函数：

```typescript
export {
  // ... 现有导出 ...
  fetchTeacherGradingPreference,
  updateTeacherGradingPreference,
} from './teacher';
```

- [ ] **Step 3: 提交 API 函数**

```bash
git add apps/frontend/src/api/
git commit -m "feat(frontend): add grading preference API functions"
```

---

## Task 6: 前端 - 创建简化版评分设置页面

**Files:**
- Create: `apps/frontend/src/pages/teacher/GradingPreference.tsx`

- [ ] **Step 1: 创建简化版评分设置页面**

创建文件 `apps/frontend/src/pages/teacher/GradingPreference.tsx`：

```typescript
import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Radio, Space, Typography, Button, Alert } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { fetchTeacherGradingPreference, updateTeacherGradingPreference } from '../../api';
import { useI18n } from '../../i18n';
import { useMessage } from '../../hooks/useMessage';

type GradingMode = 'cheap' | 'quality';

export const TeacherGradingPreferencePage = () => {
  const { t } = useI18n();
  const message = useMessage();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<GradingMode>('cheap');

  const { data, isLoading } = useQuery({
    queryKey: ['teacher-grading-preference'],
    queryFn: fetchTeacherGradingPreference,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (data?.mode) {
      setMode(data.mode);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload: { mode: GradingMode }) => updateTeacherGradingPreference(payload),
    onSuccess: async () => {
      message.success(t('teacher.settings.preferenceSaved'));
      await queryClient.invalidateQueries({ queryKey: ['teacher-grading-preference'] });
    },
    onError: () => {
      message.error(t('common.saveFailed'));
    },
  });

  const handleSave = () => {
    mutation.mutate({ mode });
  };

  return (
    <PageContainer
      title={t('teacher.settings.gradingTitle')}
      breadcrumb={{
        items: [
          { title: t('nav.teacher'), path: '/teacher/dashboard' },
          { title: t('nav.settings') },
          { title: t('nav.grading') },
        ],
      }}
    >
      <ProCard bordered loading={isLoading} className="apple-soft-card">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Alert
            showIcon
            type="info"
            message={t('teacher.settings.preferenceInfoTitle')}
            description={t('teacher.settings.preferenceInfoDesc')}
          />
          
          <div>
            <Typography.Text strong style={{ display: 'block', marginBottom: 16 }}>
              {t('teacher.settings.selectMode')}
            </Typography.Text>
            
            <Radio.Group
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Radio.Button
                  value="cheap"
                  style={{
                    width: '100%',
                    height: 'auto',
                    padding: '16px 24px',
                    textAlign: 'left',
                  }}
                >
                  <div>
                    <Typography.Text strong>
                      {t('teacher.settings.modeFast')}
                    </Typography.Text>
                    <br />
                    <Typography.Text type="secondary">
                      {t('teacher.settings.modeFastDesc')}
                    </Typography.Text>
                  </div>
                </Radio.Button>
                
                <Radio.Button
                  value="quality"
                  style={{
                    width: '100%',
                    height: 'auto',
                    padding: '16px 24px',
                    textAlign: 'left',
                  }}
                >
                  <div>
                    <Typography.Text strong>
                      {t('teacher.settings.modeQuality')}
                    </Typography.Text>
                    <br />
                    <Typography.Text type="secondary">
                      {t('teacher.settings.modeQualityDesc')}
                    </Typography.Text>
                  </div>
                </Radio.Button>
              </Space>
            </Radio.Group>
          </div>

          <Button
            type="primary"
            size="large"
            loading={mutation.isPending}
            onClick={handleSave}
          >
            {t('common.save')}
          </Button>
        </Space>
      </ProCard>
    </PageContainer>
  );
};
```

- [ ] **Step 2: 导出组件**

创建文件 `apps/frontend/src/pages/teacher/GradingPreference.tsx` 的导出：

```typescript
export { TeacherGradingPreferencePage } from './GradingPreference';
```

- [ ] **Step 3: 提交新页面**

```bash
git add apps/frontend/src/pages/teacher/GradingPreference.tsx
git commit -m "feat(frontend): create simplified grading preference page"
```

---

## Task 7: 前端 - 更新路由和导航

**Files:**
- Modify: `apps/frontend/src/routes/modules/teacher.tsx`
- Modify: `apps/frontend/src/layouts/TeacherLayout.tsx`

- [ ] **Step 1: 更新路由配置**

修改 `apps/frontend/src/routes/modules/teacher.tsx`，替换评分设置页面：

```typescript
const TeacherGradingPreferencePage = lazy(() =>
  import('../../pages/teacher/GradingPreference').then((module) => ({
    default: module.TeacherGradingPreferencePage,
  })),
);

// 更新路由
export const teacherRoutes: RouteObject[] = [
  { index: true, element: <Navigate to="/teacher/dashboard" replace /> },
  { path: 'dashboard', element: <teacherComponents.TeacherDashboardPage /> },
  { path: 'classes', element: <teacherComponents.TeacherClassesPage /> },
  { path: 'classes/:id', element: <teacherComponents.TeacherClassDetailPage /> },
  { path: 'batches/:id', element: <teacherComponents.TeacherBatchUploadDetailPage /> },
  { path: 'homeworks', element: <teacherComponents.TeacherHomeworksPage /> },
  { path: 'homeworks/:id', element: <teacherComponents.TeacherHomeworkDetailPage /> },
  { path: 'submission/:id', element: <teacherComponents.TeacherSubmissionDetailPage /> },
  { path: 'reports', element: <teacherComponents.TeacherReportPage /> },
  { path: 'reports/student/:studentId', element: <teacherComponents.TeacherStudentReportPage /> },
  { path: 'announcements', element: <teacherComponents.TeacherAnnouncementsPage /> },
  { path: 'settings', element: <Navigate to="/teacher/settings/grading" replace /> },
  { path: 'settings/grading', element: <TeacherGradingPreferencePage /> },
  { path: 'profile', element: <teacherComponents.ProfilePage /> },
];
```

- [ ] **Step 2: 更新老师端导航菜单**

修改 `apps/frontend/src/layouts/TeacherLayout.tsx`，简化导航菜单：

```typescript
const routeConfig = useMemo<ProLayoutProps['route']>(
  () => ({
    path: '/teacher',
    routes: [
      {
        path: '/teacher/dashboard',
        name: t('nav.dashboard'),
        icon: <DashboardOutlined />,
      },
      {
        path: '/teacher/classes',
        name: t('nav.classes'),
        icon: <ClusterOutlined />,
      },
      {
        path: '/teacher/homeworks',
        name: t('nav.homeworks'),
        icon: <BookOutlined />,
      },
      {
        path: '/teacher/reports',
        name: t('nav.reports'),
        icon: <BarChartOutlined />,
      },
      {
        path: '/teacher/announcements',
        name: t('nav.announcements'),
        icon: <NotificationOutlined />,
      },
      {
        path: '/teacher/settings/grading',
        name: t('nav.grading'),
        icon: <SlidersOutlined />,
      },
    ],
  }),
  [t],
);
```

- [ ] **Step 3: 提交路由和导航更新**

```bash
git add apps/frontend/src/routes/modules/teacher.tsx apps/frontend/src/layouts/TeacherLayout.tsx
git commit -m "feat(frontend): update teacher routes and navigation for simplified grading settings"
```

---

## Task 8: 前端 - 重构管理端菜单结构

**Files:**
- Modify: `apps/frontend/src/layouts/AdminLayout.tsx`

- [ ] **Step 1: 重构管理端菜单结构**

修改 `apps/frontend/src/layouts/AdminLayout.tsx`：

```typescript
import {
  AppstoreOutlined,
  AuditOutlined,
  BarChartOutlined,
  BugOutlined,
  CloudServerOutlined,
  DashboardOutlined,
  DownOutlined,
  FlagOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  LoginOutlined,
  NotificationOutlined,
  RightOutlined,
  SettingOutlined,
  TeamOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { ProLayout } from '@ant-design/pro-components';
import type { ProLayoutProps } from '@ant-design/pro-components';
import { Menu, Space, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import {
  buildLayoutActions,
  sharedLayoutContentStyle,
  sharedProLayoutMenuProps,
  sharedProLayoutToken,
} from './layoutShared';

const { SubMenu } = Menu;

export const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  const routeConfig = useMemo<ProLayoutProps['route']>(
    () => ({
      path: '/admin',
      routes: [
        {
          path: '/admin/dashboard',
          name: t('nav.dashboard'),
          icon: <DashboardOutlined />,
        },
        {
          path: '/admin/users',
          name: t('nav.users'),
          icon: <TeamOutlined />,
        },
        {
          path: '/admin/classes',
          name: t('nav.classes'),
          icon: <AppstoreOutlined />,
        },
        {
          path: '/admin/announcements',
          name: t('nav.announcements'),
          icon: <NotificationOutlined />,
        },
        {
          path: '/admin/system',
          name: t('nav.systemSettings'),
          icon: <SettingOutlined />,
          routes: [
            {
              path: '/admin/system/config',
              name: t('nav.gradingConfig'),
              icon: <SettingOutlined />,
            },
            {
              path: '/admin/system/budget',
              name: t('nav.budget'),
              icon: <WalletOutlined />,
            },
            {
              path: '/admin/system/retention',
              name: t('nav.retention'),
              icon: <HistoryOutlined />,
            },
          ],
        },
        {
          path: '/admin/advanced',
          name: t('nav.advancedTools'),
          icon: <BugOutlined />,
          hideInMenu: true,
        },
      ],
    }),
    [t],
  );

  const advancedMenuItems = useMemo(
    () => [
      { key: '/admin/usage', icon: <BarChartOutlined />, label: t('nav.usage') },
      { key: '/admin/system/queue', icon: <CloudServerOutlined />, label: t('nav.queue') },
      { key: '/admin/diagnosis', icon: <BugOutlined />, label: t('nav.diagnosis') },
      { key: '/admin/audit-logs', icon: <AuditOutlined />, label: t('nav.auditLogs') },
      { key: '/admin/login-history', icon: <LoginOutlined />, label: t('admin.loginHistory.title') },
      { key: '/admin/feature-flags', icon: <FlagOutlined />, label: t('admin.featureFlags.title') },
      { key: '/admin/system/info', icon: <InfoCircleOutlined />, label: t('admin.systemInfo.title') },
    ],
    [t],
  );

  return (
    <ProLayout
      className="app-pro-layout apple-shell apple-page-stack"
      title={t('app.title')}
      logo={false}
      navTheme="light"
      fixedHeader
      siderWidth={260}
      fixSiderbar
      route={routeConfig}
      location={{ pathname: location.pathname }}
      token={sharedProLayoutToken}
      menuProps={sharedProLayoutMenuProps}
      menuHeaderRender={() => (
        <div className="app-pro-layout__brand">
          <div className="app-pro-layout__brand-title">{t('app.title')}</div>
          <div className="app-pro-layout__brand-subtitle">{t('app.adminConsole')}</div>
        </div>
      )}
      menuItemRender={(item, dom) =>
        item.path ? (
          <span onClick={() => item.path && navigate(item.path)} style={{ cursor: 'pointer' }}>
            {dom}
          </span>
        ) : (
          dom
        )
      }
      actionsRender={() => buildLayoutActions({ navigate, t, profilePath: '/admin/profile' })}
      contentStyle={sharedLayoutContentStyle}
      menuFooterRender={(props) => {
        if (props?.collapsed) {
          return null;
        }
        return (
          <div style={{ padding: '16px', borderTop: '1px solid #f0f0f0' }}>
            <div
              onClick={() => setAdvancedExpanded(!advancedExpanded)}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: advancedExpanded ? 8 : 0,
              }}
            >
              <Space>
                <BugOutlined />
                <Typography.Text>{t('nav.advancedTools')}</Typography.Text>
              </Space>
              {advancedExpanded ? <DownOutlined /> : <RightOutlined />}
            </div>
            {advancedExpanded && (
              <Menu
                mode="inline"
                selectedKeys={[location.pathname]}
                onClick={({ key }) => navigate(key)}
                items={advancedMenuItems}
                style={{ border: 'none', background: 'transparent' }}
              />
            )}
          </div>
        );
      }}
    >
      <div className="apple-route-shell">
        <Outlet />
      </div>
    </ProLayout>
  );
};
```

- [ ] **Step 2: 提交管理端菜单重构**

```bash
git add apps/frontend/src/layouts/AdminLayout.tsx
git commit -m "feat(frontend): reorganize admin menu structure with collapsible advanced tools"
```

---

## Task 9: 前端 - 更新国际化文案

**Files:**
- Modify: `apps/frontend/src/i18n.ts`

- [ ] **Step 1: 添加新的国际化文案**

在 `apps/frontend/src/i18n.ts` 中添加/更新以下文案：

```typescript
export const i18n = {
  zh: {
    // ... 现有文案 ...
    
    nav: {
      // ... 现有导航文案 ...
      systemSettings: '系统设置',
      gradingConfig: '评分配置',
      advancedTools: '高级工具',
    },
    
    teacher: {
      settings: {
        gradingTitle: '评分设置',
        preferenceSaved: '评分偏好已保存',
        preferenceInfoTitle: '选择评分模式',
        preferenceInfoDesc: '此设置将应用到您的所有班级和作业。',
        selectMode: '选择评分模式：',
        modeFast: '快速模式',
        modeFastDesc: '适合日常作业，速度快',
        modeQuality: '高质量模式',
        modeQualityDesc: '适合重要作业，反馈详细',
      },
    },
    
    admin: {
      // ... 现有管理端文案 ...
    },
  },
  
  en: {
    // ... 现有英文文案 ...
    
    nav: {
      // ... 现有导航文案 ...
      systemSettings: 'System Settings',
      gradingConfig: 'Grading Config',
      advancedTools: 'Advanced Tools',
    },
    
    teacher: {
      settings: {
        gradingTitle: 'Grading Settings',
        preferenceSaved: 'Grading preference saved',
        preferenceInfoTitle: 'Select Grading Mode',
        preferenceInfoDesc: 'This setting will apply to all your classes and homework.',
        selectMode: 'Select grading mode:',
        modeFast: 'Fast Mode',
        modeFastDesc: 'Suitable for daily homework, faster processing',
        modeQuality: 'Quality Mode',
        modeQualityDesc: 'Suitable for important homework, detailed feedback',
      },
    },
    
    admin: {
      // ... 现有管理端文案 ...
    },
  },
};
```

- [ ] **Step 2: 提交国际化文案更新**

```bash
git add apps/frontend/src/i18n.ts
git commit -m "feat(i18n): add new i18n keys for simplified grading settings"
```

---

## Task 10: 删除旧的评分设置页面

**Files:**
- Delete: `apps/frontend/src/pages/teacher/SettingsGrading.tsx`

- [ ] **Step 1: 删除旧的评分设置页面**

删除文件 `apps/frontend/src/pages/teacher/SettingsGrading.tsx`

- [ ] **Step 2: 提交删除**

```bash
git add -A
git commit -m "refactor(frontend): remove old grading settings page"
```

---

## Task 11: 集成测试和验证

**Files:**
- 无新增文件

- [ ] **Step 1: 运行后端测试**

Run: `cd apps/backend && pnpm test`
Expected: 所有测试通过

- [ ] **Step 2: 运行前端类型检查**

Run: `cd apps/frontend && pnpm typecheck`
Expected: 无类型错误

- [ ] **Step 3: 运行前端 lint**

Run: `cd apps/frontend && pnpm lint`
Expected: 无 lint 错误

- [ ] **Step 4: 启动开发服务器进行手动测试**

Run: `pnpm dev:backend` 和 `pnpm dev:frontend`
Expected: 服务正常启动

- [ ] **Step 5: 手动测试老师端评分设置**

测试步骤：
1. 以老师身份登录
2. 访问评分设置页面
3. 验证只显示模式选择
4. 测试保存功能

- [ ] **Step 6: 手动测试管理端菜单**

测试步骤：
1. 以管理员身份登录
2. 验证菜单结构正确
3. 验证高级工具默认折叠
4. 测试展开/折叠功能

- [ ] **Step 7: 提交最终版本**

```bash
git add -A
git commit -m "feat: complete UX simplification for teacher grading settings and admin menu"
```

---

## 自审检查清单

- [x] 规格覆盖：所有设计文档中的改动都有对应的任务
- [x] 占位符扫描：没有 TBD、TODO 等占位符
- [x] 类型一致性：前后端类型定义一致
