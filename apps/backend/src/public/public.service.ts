import { Injectable, Logger } from '@nestjs/common';
import { SubmissionStatus } from '@prisma/client';
import { LlmConfigService, type LlmRuntimeConfig } from '../llm/llm-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { PublicLandingQueryDto } from './dto/public-landing-query.dto';
import { PublicOverviewQueryDto } from './dto/public-overview-query.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const LANDING_CONFIG_KEY = 'landing';
const LANDING_TTL_SECONDS = 6 * 60 * 60;

type LandingTheme = {
  background: string;
  surface: string;
  surfaceStrong: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentAlt: string;
  glow: string;
  orb1: string;
  orb2: string;
  orb3: string;
  noiseOpacity: number;
};

type LandingContent = {
  brand: { title: string; tagline: string; description: string };
  hero: { headline: string; subhead: string; note: string; primaryCta: string; secondaryCta: string };
  highlights: Array<{ title: string; desc: string }>;
  capabilities: Array<{ title: string; desc: string }>;
  workflow: Array<{ title: string; desc: string }>;
  metrics: Array<{ label: string; value: string; hint?: string }>;
  proof: Array<{ title: string; desc: string }>;
  faq: Array<{ question: string; answer: string }>;
  cta: { title: string; subtitle: string; primary: string; secondary: string };
  consult: {
    title: string;
    subtitle: string;
    fields: { name: string; org: string; contact: string; need: string };
    submit: string;
    success: string;
  };
};

type LandingPayload = {
  version: number;
  generatedAt: string;
  ttlSeconds: number;
  theme: LandingTheme;
  content: { zh: LandingContent; en: LandingContent };
};

const DEFAULT_LANDING_PAYLOAD: LandingPayload = {
  version: 1,
  generatedAt: new Date(0).toISOString(),
  ttlSeconds: LANDING_TTL_SECONDS,
  theme: {
    background:
      'linear-gradient(140deg, #f8fafc 0%, #e0f2fe 42%, #fef3c7 100%)',
    surface: 'rgba(255, 255, 255, 0.7)',
    surfaceStrong: 'rgba(255, 255, 255, 0.92)',
    text: '#0f172a',
    muted: 'rgba(15, 23, 42, 0.6)',
    border: 'rgba(148, 163, 184, 0.35)',
    accent: '#0f766e',
    accentAlt: '#2563eb',
    glow: 'rgba(37, 99, 235, 0.25)',
    orb1: 'rgba(45, 212, 191, 0.35)',
    orb2: 'rgba(59, 130, 246, 0.28)',
    orb3: 'rgba(251, 191, 36, 0.28)',
    noiseOpacity: 0.08,
  },
  content: {
    zh: {
      brand: {
        title: '作业AI',
        tagline: 'AI驱动的作业批改与学情洞察',
        description: '一套流程打通上传、识别、批改、反馈与数据看板。',
      },
      hero: {
        headline: '让批改更快，教学更有温度',
        subhead: '老师批改从小时变成分钟，学生拿到结构化反馈与改写建议。',
        note: '支持拍照作业、批量上传与班级级别的学情分析。',
        primaryCta: '进入登录',
        secondaryCta: '咨询方案',
      },
      highlights: [
        { title: '拍照上传识别', desc: '手机上传作业，OCR自动还原正文与关键标识。' },
        { title: '批改与建议', desc: 'AI评分、错误定位、写作建议一次输出。' },
        { title: '班级学情看板', desc: '班级差异、错因分布与学习趋势清晰可见。' },
      ],
      capabilities: [
        { title: '多张合成', desc: '多页作文自动合并，避免漏页。' },
        { title: '自定义评分', desc: '支持评分维度与评分细则配置。' },
        { title: '批量导入', desc: '支持 zip 批量与教师端集中上传。' },
        { title: '数据闭环', desc: '全链路追踪提交、批改与改写。' },
      ],
      workflow: [
        { title: '上传与识别', desc: '图像进入 OCR 与学号识别。' },
        { title: '分发与归档', desc: '匹配学生并分组生成提交。' },
        { title: 'AI批改', desc: '评分、结构化反馈与改写建议输出。' },
        { title: '教学复盘', desc: '趋势、错因与班级对比自动生成。' },
      ],
      metrics: [
        { label: '批改效率提升', value: '10x', hint: '从小时到分钟' },
        { label: '反馈覆盖率', value: '98%', hint: '结构化建议' },
        { label: '班级学情掌握', value: '实时', hint: '可视化看板' },
      ],
      proof: [
        { title: '教研更聚焦', desc: '把时间用在策略和反馈质量上。' },
        { title: '学生更投入', desc: '更快获得可执行的改写方案。' },
      ],
      faq: [
        { question: '是否支持纸质作业？', answer: '支持拍照上传与批量扫描上传。' },
        { question: '评分标准可以自定义吗？', answer: '支持班级或作业级别的评分配置。' },
        { question: '如何保障数据安全？', answer: '采用分权限访问与可追溯日志。' },
      ],
      cta: {
        title: '把 AI 融入教学日常',
        subtitle: '30 分钟完成试用配置，最快当天上线。',
        primary: '进入登录',
        secondary: '咨询方案',
      },
      consult: {
        title: '咨询作业AI方案',
        subtitle: '留下信息，我们将在 1 个工作日内联系你。',
        fields: {
          name: '姓名',
          org: '学校/机构',
          contact: '联系方式',
          need: '需求描述',
        },
        submit: '提交咨询',
        success: '提交成功，我们会尽快联系你。',
      },
    },
    en: {
      brand: {
        title: 'Homework AI',
        tagline: 'AI grading and learning insight for modern classrooms',
        description: 'One flow for upload, recognition, grading, feedback, and analytics.',
      },
      hero: {
        headline: 'Grade faster, teach with clarity',
        subhead: 'Turn hours of grading into minutes while students receive structured feedback.',
        note: 'Supports photo uploads, batch imports, and class-level insight dashboards.',
        primaryCta: 'Go to Login',
        secondaryCta: 'Request a Demo',
      },
      highlights: [
        { title: 'Photo to text', desc: 'OCR turns handwritten essays into searchable text.' },
        { title: 'AI grading', desc: 'Scores, error tags, and revision advice in one pass.' },
        { title: 'Class insights', desc: 'See trends, gaps, and learning progress at a glance.' },
      ],
      capabilities: [
        { title: 'Multi-page merge', desc: 'Combine 1-3 pages into a single submission.' },
        { title: 'Rubric control', desc: 'Customize dimensions and scoring rules.' },
        { title: 'Batch imports', desc: 'Upload zip files or bulk images at once.' },
        { title: 'Closed-loop data', desc: 'Track submissions, grading, and rewrites.' },
      ],
      workflow: [
        { title: 'Upload & OCR', desc: 'Images enter OCR with student matching.' },
        { title: 'Match & group', desc: 'Students are identified and submissions grouped.' },
        { title: 'AI grading', desc: 'Structured feedback and rewrite suggestions delivered.' },
        { title: 'Class review', desc: 'Trends and gaps are summarized automatically.' },
      ],
      metrics: [
        { label: 'Grading speed', value: '10x', hint: 'Hours to minutes' },
        { label: 'Feedback coverage', value: '98%', hint: 'Structured suggestions' },
        { label: 'Class visibility', value: 'Live', hint: 'Insight dashboards' },
      ],
      proof: [
        { title: 'More time for teaching', desc: 'Shift time from grading to coaching.' },
        { title: 'Students improve faster', desc: 'Clear revision paths improve outcomes.' },
      ],
      faq: [
        { question: 'Can we grade paper essays?', answer: 'Yes. Upload photos or scans.' },
        { question: 'Do we control the rubric?', answer: 'Rubrics can be customized per class.' },
        { question: 'How is data protected?', answer: 'Access is role-based with audit logs.' },
      ],
      cta: {
        title: 'Bring AI into daily teaching',
        subtitle: 'Set up a pilot in 30 minutes and go live quickly.',
        primary: 'Go to Login',
        secondary: 'Request a Demo',
      },
      consult: {
        title: 'Talk to our team',
        subtitle: 'Leave your info and we will contact you within one business day.',
        fields: {
          name: 'Name',
          org: 'School / Organization',
          contact: 'Contact',
          need: 'What do you need',
        },
        submit: 'Submit',
        success: 'Thanks! We will reach out soon.',
      },
    },
  },
};

@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfigService: SystemConfigService,
    private readonly llmConfigService: LlmConfigService,
  ) {}

  async getOverview(query: PublicOverviewQueryDto) {
    const days = query.days ?? 7;
    const cutoff = new Date(Date.now() - days * DAY_MS);

    const [homeworks, submissions, completed] = await this.prisma.$transaction([
      this.prisma.homework.count(),
      this.prisma.submission.count({ where: { createdAt: { gte: cutoff } } }),
      this.prisma.submission.count({
        where: { createdAt: { gte: cutoff }, status: SubmissionStatus.DONE },
      }),
    ]);

    const completionRate = submissions ? completed / submissions : 0;

    return {
      days,
      homeworks,
      submissions,
      completionRate,
      updatedAt: new Date().toISOString(),
    };
  }

  async getLanding(query: PublicLandingQueryDto) {
    const refresh = Boolean(query.refresh);
    const cached = await this.systemConfigService.getValue<LandingPayload>(LANDING_CONFIG_KEY);
    if (!refresh && cached && this.isLandingFresh(cached)) {
      return cached;
    }

    const generated = await this.generateLandingConfig();
    await this.systemConfigService.setValue(LANDING_CONFIG_KEY, generated);
    return generated;
  }

  private isLandingFresh(payload: LandingPayload) {
    const generatedAt = Date.parse(payload.generatedAt || '');
    if (!Number.isFinite(generatedAt)) {
      return false;
    }
    const ttlSeconds = payload.ttlSeconds || LANDING_TTL_SECONDS;
    return Date.now() - generatedAt < ttlSeconds * 1000;
  }

  private async generateLandingConfig(): Promise<LandingPayload> {
    const base = {
      ...DEFAULT_LANDING_PAYLOAD,
      generatedAt: new Date().toISOString(),
      ttlSeconds: LANDING_TTL_SECONDS,
    };

    let runtime: LlmRuntimeConfig | null = null;
    try {
      runtime = await this.llmConfigService.resolveRuntimeConfig();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Landing config resolve LLM failed: ${message}`);
    }

    if (!runtime?.baseUrl || !runtime.model) {
      return base;
    }

    const generated = await this.requestLandingFromLlm(runtime);
    if (!generated) {
      return base;
    }

    return this.mergeLandingPayload(base, generated);
  }

  private mergeLandingPayload(base: LandingPayload, incoming: Partial<LandingPayload>): LandingPayload {
    const theme = this.mergeTheme(base.theme, incoming.theme || {});
    const content = {
      zh: this.mergeContent(base.content.zh, incoming.content?.zh),
      en: this.mergeContent(base.content.en, incoming.content?.en),
    };
    return {
      ...base,
      theme,
      content,
    };
  }

  private mergeTheme(base: LandingTheme, incoming: Partial<LandingTheme>): LandingTheme {
    const merged = { ...base };
    (Object.keys(base) as Array<keyof LandingTheme>).forEach((key) => {
      const value = incoming[key];
      if (key === 'noiseOpacity') {
        const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value));
        if (Number.isFinite(numeric)) {
          merged.noiseOpacity = Math.max(0, Math.min(0.4, numeric));
        }
        return;
      }
      if (typeof value === 'string' && value.trim()) {
        merged[key] = value.trim() as LandingTheme[typeof key];
      }
    });
    return merged;
  }

  private mergeContent(base: LandingContent, incoming?: Partial<LandingContent>): LandingContent {
    return {
      brand: this.mergeTextBlock(base.brand, incoming?.brand),
      hero: this.mergeTextBlock(base.hero, incoming?.hero),
      highlights: this.mergeList(base.highlights, incoming?.highlights),
      capabilities: this.mergeList(base.capabilities, incoming?.capabilities),
      workflow: this.mergeList(base.workflow, incoming?.workflow),
      metrics: this.mergeList(base.metrics, incoming?.metrics),
      proof: this.mergeList(base.proof, incoming?.proof),
      faq: this.mergeList(base.faq, incoming?.faq),
      cta: this.mergeTextBlock(base.cta, incoming?.cta),
      consult: {
        title: this.pickText(incoming?.consult?.title, base.consult.title),
        subtitle: this.pickText(incoming?.consult?.subtitle, base.consult.subtitle),
        fields: {
          name: this.pickText(incoming?.consult?.fields?.name, base.consult.fields.name),
          org: this.pickText(incoming?.consult?.fields?.org, base.consult.fields.org),
          contact: this.pickText(incoming?.consult?.fields?.contact, base.consult.fields.contact),
          need: this.pickText(incoming?.consult?.fields?.need, base.consult.fields.need),
        },
        submit: this.pickText(incoming?.consult?.submit, base.consult.submit),
        success: this.pickText(incoming?.consult?.success, base.consult.success),
      },
    };
  }

  private mergeTextBlock<T extends Record<string, string>>(base: T, incoming?: Partial<T>): T {
    const result: Record<string, string> = { ...base };
    if (!incoming) {
      return result as T;
    }
    (Object.keys(base) as Array<keyof T>).forEach((key) => {
      const value = incoming[key];
      if (typeof value === 'string' && value.trim()) {
        result[key as string] = value.trim();
      }
    });
    return result as T;
  }

  private mergeList<T>(base: T[], incoming?: unknown): T[] {
    if (!Array.isArray(incoming) || incoming.length === 0) {
      return base;
    }
    const filtered = incoming.filter((item) => typeof item === 'object' && item !== null) as T[];
    return filtered.length ? filtered : base;
  }

  private pickText(value: unknown, fallback: string) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    return fallback;
  }

  private async requestLandingFromLlm(runtime: LlmRuntimeConfig): Promise<Partial<LandingPayload> | null> {
    const payload: Record<string, unknown> = {
      model: runtime.model,
      messages: [
        { role: 'system', content: this.buildLandingSystemPrompt() },
        { role: 'user', content: this.buildLandingPrompt() },
      ],
      max_tokens: Math.min(runtime.maxTokens ?? 1200, 1400),
      temperature: 0.6,
      response_format: { type: 'json_object' },
    };

    const apiUrl = this.resolveLlmApiUrl(runtime);
    let response: {
      ok: boolean;
      status: number;
      errorText: string;
      data: { choices?: Array<{ message?: { content?: string }; text?: string }> } | null;
    };
    try {
      response = await this.fetchCompletion(apiUrl, payload, runtime);
      if (!response.ok && this.isResponseFormatUnsupported(response.status, response.errorText)) {
        const fallbackPayload = { ...payload };
        delete (fallbackPayload as { response_format?: unknown }).response_format;
        response = await this.fetchCompletion(apiUrl, fallbackPayload, runtime);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Landing LLM request failed: ${message}`);
      return null;
    }

    if (!response.ok) {
      this.logger.warn(`Landing LLM request failed: ${response.status} ${response.errorText}`);
      return null;
    }

    let content = '';
    try {
      content = this.extractLlmContent(response.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Missing response content';
      this.logger.warn(`Landing LLM response missing content: ${message}`);
      return null;
    }

    const parsed = this.tryParseJson(content);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return parsed as Partial<LandingPayload>;
  }

  private buildLandingSystemPrompt() {
    return [
      'You are a product marketing assistant for an AI homework grading platform.',
      'Return JSON only, no markdown.',
      'Output must include: theme and content with zh and en.',
      'Use professional, concise language. No emojis.',
      'Keep arrays length between 3 and 4 items.',
    ].join('\n');
  }

  private buildLandingPrompt() {
    return [
      'Generate landing content for Homework AI (作业AI).',
      'Required JSON shape:',
      '{',
      '  "theme": {',
      '    "background": string,',
      '    "surface": string,',
      '    "surfaceStrong": string,',
      '    "text": string,',
      '    "muted": string,',
      '    "border": string,',
      '    "accent": string,',
      '    "accentAlt": string,',
      '    "glow": string,',
      '    "orb1": string,',
      '    "orb2": string,',
      '    "orb3": string,',
      '    "noiseOpacity": number',
      '  },',
      '  "content": {',
      '    "zh": {',
      '      "brand": {"title": string, "tagline": string, "description": string},',
      '      "hero": {"headline": string, "subhead": string, "note": string, "primaryCta": string, "secondaryCta": string},',
      '      "highlights": [{"title": string, "desc": string}],',
      '      "capabilities": [{"title": string, "desc": string}],',
      '      "workflow": [{"title": string, "desc": string}],',
      '      "metrics": [{"label": string, "value": string, "hint": string}],',
      '      "proof": [{"title": string, "desc": string}],',
      '      "faq": [{"question": string, "answer": string}],',
      '      "cta": {"title": string, "subtitle": string, "primary": string, "secondary": string},',
      '      "consult": {"title": string, "subtitle": string, "fields": {"name": string, "org": string, "contact": string, "need": string}, "submit": string, "success": string}',
      '    },',
      '    "en": {',
      '      "brand": {"title": string, "tagline": string, "description": string},',
      '      "hero": {"headline": string, "subhead": string, "note": string, "primaryCta": string, "secondaryCta": string},',
      '      "highlights": [{"title": string, "desc": string}],',
      '      "capabilities": [{"title": string, "desc": string}],',
      '      "workflow": [{"title": string, "desc": string}],',
      '      "metrics": [{"label": string, "value": string, "hint": string}],',
      '      "proof": [{"title": string, "desc": string}],',
      '      "faq": [{"question": string, "answer": string}],',
      '      "cta": {"title": string, "subtitle": string, "primary": string, "secondary": string},',
      '      "consult": {"title": string, "subtitle": string, "fields": {"name": string, "org": string, "contact": string, "need": string}, "submit": string, "success": string}',
      '    }',
      '  }',
      '}',
      'Theme colors should be modern and avoid purple.',
      'Keep tone: reliable, modern, education-focused.',
    ].join('\n');
  }

  private resolveLlmApiUrl(runtime: LlmRuntimeConfig): string {
    const base = (runtime.baseUrl || '').replace(/\/$/, '');
    if (base.endsWith('/chat/completions') || base.endsWith('/v1/chat/completions')) {
      return base;
    }
    const path = runtime.path?.trim();
    if (path) {
      if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
      }
      return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
    }
    return `${base}/v1/chat/completions`;
  }

  private async fetchCompletion(
    url: string,
    payload: Record<string, unknown>,
    runtime: LlmRuntimeConfig,
  ): Promise<{
    ok: boolean;
    status: number;
    errorText: string;
    data: { choices?: Array<{ message?: { content?: string }; text?: string }> } | null;
  }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...runtime.headers,
    };
    if (runtime.apiKey) {
      headers.Authorization = `Bearer ${runtime.apiKey}`;
    }

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      },
      runtime.timeoutMs ?? 20000,
    );

    const text = await response.text();
    if (!response.ok) {
      return { ok: false, status: response.status, errorText: text, data: null };
    }

    let data: { choices?: Array<{ message?: { content?: string }; text?: string }> } | null = null;
    try {
      data = text ? (JSON.parse(text) as typeof data) : null;
    } catch {
      data = null;
    }
    return { ok: true, status: response.status, errorText: '', data };
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractLlmContent(data: {
    choices?: Array<{ message?: { content?: string }; text?: string }>;
  } | null): string {
    const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text;
    if (!content) {
      throw new Error('LLM response missing content');
    }
    return content.trim();
  }

  private isResponseFormatUnsupported(status: number, errorText: string): boolean {
    if (status !== 400 && status !== 422) {
      return false;
    }
    const text = errorText.toLowerCase();
    return text.includes('response_format') || text.includes('json_object') || text.includes('unsupported');
  }

  private tryParseJson(input: string): unknown | null {
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  }
}
