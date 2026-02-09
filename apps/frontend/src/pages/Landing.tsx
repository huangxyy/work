import { Button, Collapse, Form, Input, Modal, Segmented, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { CountUpNumber } from '../components/CountUpNumber';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { fetchPublicLanding, type PublicLandingPayload } from '../api';
import { useI18n } from '../i18n';
import { useMessage } from '../hooks/useMessage';

const DEFAULT_LANDING_PAYLOAD: PublicLandingPayload = {
  version: 1,
  generatedAt: new Date(0).toISOString(),
  ttlSeconds: 21600,
  theme: {
    background: 'linear-gradient(140deg, #f8fafc 0%, #e0f2fe 42%, #fef3c7 100%)',
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

type LandingVariant = 'narrative' | 'dashboard';

export const LandingPage = () => {
  const navigate = useNavigate();
  const { language } = useI18n();
  const message = useMessage();
  const [variant, setVariant] = useState<LandingVariant>(() => {
    if (typeof window === 'undefined') {
      return 'narrative';
    }
    const fromQuery = new URLSearchParams(window.location.search).get('variant');
    if (fromQuery === 'b' || fromQuery === 'dashboard') {
      return 'dashboard';
    }
    if (fromQuery === 'a' || fromQuery === 'narrative') {
      return 'narrative';
    }
    const stored = window.localStorage.getItem('landing-variant');
    return stored === 'dashboard' ? 'dashboard' : 'narrative';
  });
  const [consultOpen, setConsultOpen] = useState(false);
  const [loaderVisible, setLoaderVisible] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSection, setActiveSection] = useState('scenes');
  const [activeFeatureKey, setActiveFeatureKey] = useState('grading');
  const [compareValue, setCompareValue] = useState(50);
  const [demoMode, setDemoMode] = useState<'quick' | 'quality'>('quality');
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoProgress, setDemoProgress] = useState(0);
  const [demoStepIndex, setDemoStepIndex] = useState(0);
  const [faqQuery, setFaqQuery] = useState('');
  const [form] = Form.useForm();
  const scrollFrameRef = useRef<number | null>(null);
  const demoFrameRef = useRef<number | null>(null);

  const landingQuery = useQuery({
    queryKey: ['public-landing'],
    queryFn: fetchPublicLanding,
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setLoaderVisible(false), 900);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem('landing-variant', variant);
  }, [variant]);

  const languageKey: 'zh' | 'en' = language.startsWith('zh') ? 'zh' : 'en';
  const landing = landingQuery.data ?? DEFAULT_LANDING_PAYLOAD;
  const fallbackContent = DEFAULT_LANDING_PAYLOAD.content[languageKey];
  const content = landing.content[languageKey] ?? fallbackContent;
  const theme = DEFAULT_LANDING_PAYLOAD.theme;
  const showLoader = loaderVisible;

  const variantOptions = useMemo(
    () =>
      languageKey === 'zh'
        ? [
            { label: 'A 叙事版', value: 'narrative' },
            { label: 'B 仪表版', value: 'dashboard' },
          ]
        : [
            { label: 'A Narrative', value: 'narrative' },
            { label: 'B Dashboard', value: 'dashboard' },
          ],
    [languageKey],
  );

  const themeStyle = useMemo(
    () => {
      const overrides =
        variant === 'dashboard'
          ? {
              '--landing-bg': 'linear-gradient(138deg, #fff7ed 0%, #ecfeff 46%, #eff6ff 100%)',
              '--landing-surface': 'rgba(255, 255, 255, 0.78)',
              '--landing-surface-strong': 'rgba(255, 255, 255, 0.95)',
              '--landing-accent': '#b45309',
              '--landing-accent-alt': '#0c4a6e',
              '--landing-glow': 'rgba(14, 116, 144, 0.22)',
              '--landing-orb-1': 'rgba(251, 191, 36, 0.25)',
              '--landing-orb-2': 'rgba(34, 211, 238, 0.24)',
              '--landing-orb-3': 'rgba(14, 116, 144, 0.18)',
            }
          : {};

      const styleVars: Record<string, string> = {
        '--landing-bg': theme.background,
        '--landing-surface': theme.surface,
        '--landing-surface-strong': theme.surfaceStrong,
        '--landing-text': theme.text,
        '--landing-muted': theme.muted,
        '--landing-border': theme.border,
        '--landing-accent': theme.accent,
        '--landing-accent-alt': theme.accentAlt,
        '--landing-glow': theme.glow,
        '--landing-orb-1': theme.orb1,
        '--landing-orb-2': theme.orb2,
        '--landing-orb-3': theme.orb3,
        '--landing-noise': String(theme.noiseOpacity ?? 0.12),
        ...overrides,
      };
      return styleVars as unknown as CSSProperties;
    },
    [theme, variant],
  );

  const heroStats = useMemo(() => {
    if (languageKey === 'zh') {
      return [
        { label: '批改效率', value: '10x', hint: '节省老师时间' },
        { label: '结构化反馈', value: '全覆盖', hint: '改写建议清晰' },
        { label: '班级洞察', value: '实时', hint: '趋势看板' },
      ];
    }
    return [
      { label: 'Grading speed', value: '10x', hint: 'Save teacher time' },
      { label: 'Structured feedback', value: 'Full', hint: 'Clear revision guidance' },
      { label: 'Class insight', value: 'Live', hint: 'Trend dashboard' },
    ];
  }, [languageKey]);

  const heroChips = useMemo(() => {
    if (languageKey === 'zh') {
      return ['拍照上传', 'AI 批改', '班级洞察'];
    }
    return ['Photo OCR', 'AI Grading', 'Class Insight'];
  }, [languageKey]);

  const compareContent = useMemo(() => {
    if (languageKey === 'zh') {
      return {
        title: '一眼看懂对比',
        subtitle: '拖动滑块，比较传统批改与智能批改体验。',
        before: {
          tag: '传统方式',
          title: '人工批改流程',
          points: ['耗时 30-60 分钟/班', '反馈分散，标准难统一', '数据统计依赖人工整理'],
        },
        after: {
          tag: '智能方式',
          title: '作业AI批改',
          points: ['分钟级批改与建议', '结构化反馈与改写引导', '班级洞察自动生成'],
        },
      };
    }
    return {
      title: 'See the difference',
      subtitle: 'Drag the slider to compare manual grading with AI grading.',
      before: {
        tag: 'Traditional',
        title: 'Manual grading',
        points: ['30-60 min per class', 'Scattered feedback', 'Manual data summarization'],
      },
      after: {
        tag: 'AI Powered',
        title: 'Homework AI',
        points: ['Minutes per class', 'Structured feedback', 'Auto class insights'],
      },
    };
  }, [languageKey]);

  const workflowBadgeLabel = languageKey === 'zh' ? '阶段' : 'Step';
  const compareInsight = Math.max(0, Math.min(100, Math.round(((compareValue - 20) / 60) * 100)));
  const workflowChips = useMemo(() => {
    if (languageKey === 'zh') {
      return [
        ['上传', 'OCR'],
        ['匹配', '归档'],
        ['评分', '反馈'],
        ['趋势', '看板'],
      ];
    }
    return [
      ['Upload', 'OCR'],
      ['Match', 'Archive'],
      ['Score', 'Feedback'],
      ['Trend', 'Dashboard'],
    ];
  }, [languageKey]);

  const sectionMeta = useMemo(
    () => [
      { id: 'scenes', label: languageKey === 'zh' ? '场景' : 'Scenes' },
      { id: 'demo', label: languageKey === 'zh' ? '演示' : 'Demo' },
      { id: 'features', label: languageKey === 'zh' ? '功能' : 'Features' },
      { id: 'compare', label: languageKey === 'zh' ? '对比' : 'Compare' },
      { id: 'workflow', label: languageKey === 'zh' ? '流程' : 'Workflow' },
      { id: 'insight', label: languageKey === 'zh' ? '洞察' : 'Insight' },
      { id: 'faq', label: 'FAQ' },
    ],
    [languageKey],
  );

  const sectionIds = useMemo(() => sectionMeta.map((item) => item.id), [sectionMeta]);

  const sceneCards = useMemo(() => {
    if (languageKey === 'zh') {
      return [
        {
          title: '课堂后 10 分钟',
          desc: '老师拍照上传，系统完成识别和归档，直接进入待批改队列。',
          tag: '高频场景',
        },
        {
          title: '晚自习讲评前',
          desc: '批改结果自动汇总成错因分布，讲评内容更聚焦。',
          tag: '教学复盘',
        },
        {
          title: '月度教研会',
          desc: '按班级对比趋势与能力项变化，快速定位共性问题。',
          tag: '数据洞察',
        },
      ];
    }
    return [
      {
        title: '10 minutes after class',
        desc: 'Teachers upload photos, OCR and filing finish automatically, and grading starts.',
        tag: 'Daily flow',
      },
      {
        title: 'Before review session',
        desc: 'Error patterns are summarized so review time focuses on key gaps.',
        tag: 'Class review',
      },
      {
        title: 'Monthly teaching meeting',
        desc: 'Compare class trends and rubric dimensions to find shared issues fast.',
        tag: 'Insight',
      },
    ];
  }, [languageKey]);

  const marqueeItems = useMemo(
    () => [...content.capabilities, ...content.workflow].map((item) => item.title).filter(Boolean),
    [content.capabilities, content.workflow],
  );

  const processingSignals = useMemo(() => {
    if (languageKey === 'zh') {
      return [
        { label: '识别队列', value: '实时' },
        { label: '批改吞吐', value: '稳定' },
        { label: '反馈生成', value: '结构化' },
      ];
    }
    return [
      { label: 'OCR queue', value: 'Live' },
      { label: 'Grading throughput', value: 'Stable' },
      { label: 'Feedback output', value: 'Structured' },
    ];
  }, [languageKey]);

  const demoModeOptions = useMemo(
    () =>
      languageKey === 'zh'
        ? [
            { label: '快速模式', value: 'quick' },
            { label: '高质量模式', value: 'quality' },
          ]
        : [
            { label: 'Quick Mode', value: 'quick' },
            { label: 'Quality Mode', value: 'quality' },
          ],
    [languageKey],
  );

  const demoStages = useMemo(() => {
    if (languageKey === 'zh') {
      return [
        { title: '上传校验', detail: '接收 3 张图片并完成格式检查', log: 'images accepted (3/3)' },
        { title: 'OCR 识别', detail: '提取正文并识别关键信息', log: 'ocr text extracted (468 chars)' },
        { title: '学生匹配', detail: '通过学号/姓名匹配学生档案', log: 'student matched: class-7a / student03' },
        { title: 'AI 批改', detail: '按评分策略生成分项得分和建议', log: 'grading model completed with rubric' },
        { title: '反馈生成', detail: '输出讲评要点与改写方向', log: 'feedback package generated' },
      ];
    }
    return [
      { title: 'Upload check', detail: 'Validate 3 images and file quality', log: 'images accepted (3/3)' },
      { title: 'OCR extraction', detail: 'Extract essay content and key markers', log: 'ocr text extracted (468 chars)' },
      { title: 'Student match', detail: 'Resolve account by id/name cues', log: 'student matched: class-7a / student03' },
      { title: 'AI grading', detail: 'Run rubric scoring with writing analysis', log: 'grading model completed with rubric' },
      { title: 'Feedback package', detail: 'Generate actionable classroom feedback', log: 'feedback package generated' },
    ];
  }, [languageKey]);

  const demoOutcome = useMemo(() => {
    if (languageKey === 'zh') {
      return demoMode === 'quality'
        ? {
            score: '92',
            duration: '31s',
            feedback: '12条建议',
            hint: '高质量模式：反馈更细，适合讲评前使用。',
            bullets: ['结构完整，论据更充分', '语法错误 3 处，已定位', '推荐改写段落 2 段'],
          }
        : {
            score: '86',
            duration: '18s',
            feedback: '6条建议',
            hint: '快速模式：响应更快，适合课堂随堂批改。',
            bullets: ['核心问题已提取', '语法错误 2 处', '给出简短改进路径'],
          };
    }
    return demoMode === 'quality'
      ? {
          score: '92',
          duration: '31s',
          feedback: '12 tips',
          hint: 'Quality mode gives richer feedback for review sessions.',
          bullets: ['Strong structure with clearer argument depth', '3 grammar errors auto-located', '2 rewrite-focused paragraph suggestions'],
        }
      : {
          score: '86',
          duration: '18s',
          feedback: '6 tips',
          hint: 'Quick mode is optimized for in-class fast grading.',
          bullets: ['Core issues extracted instantly', '2 grammar errors highlighted', 'Short next-step guidance included'],
        };
  }, [demoMode, languageKey]);

  const faqQuickFilters = useMemo(
    () =>
      languageKey === 'zh'
        ? ['纸质作业', '评分标准', '数据安全']
        : ['Paper essays', 'Rubric', 'Data security'],
    [languageKey],
  );

  const filteredFaq = useMemo(() => {
    const query = faqQuery.trim().toLowerCase();
    if (!query) {
      return content.faq;
    }
    return content.faq.filter((item) => `${item.question} ${item.answer}`.toLowerCase().includes(query));
  }, [content.faq, faqQuery]);

  const featureTabs = useMemo(() => {
    const highlight0 = content.highlights[0] ?? fallbackContent.highlights[0];
    const highlight1 = content.highlights[1] ?? fallbackContent.highlights[1];
    const highlight2 = content.highlights[2] ?? fallbackContent.highlights[2];
    const cap0 = content.capabilities[0] ?? fallbackContent.capabilities[0];
    const cap1 = content.capabilities[1] ?? fallbackContent.capabilities[1];
    const cap2 = content.capabilities[2] ?? fallbackContent.capabilities[2];
    const cap3 = content.capabilities[3] ?? fallbackContent.capabilities[3];
    const wf0 = content.workflow[0] ?? fallbackContent.workflow[0];
    const wf1 = content.workflow[1] ?? fallbackContent.workflow[1];
    const wf2 = content.workflow[2] ?? fallbackContent.workflow[2];
    const wf3 = content.workflow[3] ?? fallbackContent.workflow[3];
    const metric0 = content.metrics[0] ?? fallbackContent.metrics[0];
    const metric1 = content.metrics[1] ?? fallbackContent.metrics[1];
    const metric2 = content.metrics[2] ?? fallbackContent.metrics[2];
    const proof0 = content.proof[0] ?? fallbackContent.proof[0];
    const proof1 = content.proof[1] ?? fallbackContent.proof[1];

    return [
      {
        key: 'recognition',
        label: languageKey === 'zh' ? '识别归档' : 'Recognition',
        title: highlight0.title,
        desc: highlight0.desc,
        bullets: [wf0, wf1, cap0],
        metric: metric0,
        quote: proof0?.desc ?? '',
      },
      {
        key: 'grading',
        label: languageKey === 'zh' ? '智能批改' : 'AI Grading',
        title: highlight1.title,
        desc: highlight1.desc,
        bullets: [cap1, cap2, wf2],
        metric: metric1,
        quote: proof1?.desc ?? '',
      },
      {
        key: 'insight',
        label: languageKey === 'zh' ? '教学洞察' : 'Learning Insight',
        title: highlight2.title,
        desc: highlight2.desc,
        bullets: [cap3, wf3, wf2],
        metric: metric2,
        quote: proof0?.desc ?? '',
      },
    ];
  }, [content, fallbackContent, languageKey]);

  useEffect(() => {
    if (!featureTabs.length) {
      return;
    }
    if (!featureTabs.some((tab) => tab.key === activeFeatureKey)) {
      setActiveFeatureKey(featureTabs[0].key);
    }
  }, [activeFeatureKey, featureTabs]);

  useEffect(() => {
    setDemoRunning(false);
    setDemoProgress(0);
    setDemoStepIndex(0);
  }, [demoMode]);

  useEffect(() => {
    if (!demoRunning) {
      return undefined;
    }
    const duration = demoMode === 'quality' ? 6400 : 4600;
    const stageCount = demoStages.length;
    const startedAt = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startedAt;
      const ratio = Math.min(1, elapsed / duration);
      const nextProgress = Math.round(ratio * 100);
      setDemoProgress(nextProgress);
      setDemoStepIndex(Math.min(stageCount - 1, Math.floor(ratio * stageCount)));

      if (ratio >= 1) {
        setDemoRunning(false);
        demoFrameRef.current = null;
        return;
      }
      demoFrameRef.current = window.requestAnimationFrame(animate);
    };

    demoFrameRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (demoFrameRef.current !== null) {
        window.cancelAnimationFrame(demoFrameRef.current);
        demoFrameRef.current = null;
      }
    };
  }, [demoMode, demoRunning, demoStages.length]);

  useEffect(() => {
    const updateProgress = () => {
      scrollFrameRef.current = null;
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const scrollHeight = doc.scrollHeight - doc.clientHeight;
      const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
      setScrollProgress(Math.min(100, Math.max(0, progress)));
    };

    const handleScroll = () => {
      if (scrollFrameRef.current === null) {
        scrollFrameRef.current = window.requestAnimationFrame(updateProgress);
      }
    };

    updateProgress();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((item): item is HTMLElement => Boolean(item));
    if (!elements.length) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length) {
          const nextId = visible[0].target.id;
          setActiveSection(nextId);
        }
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: [0.1, 0.25, 0.6] },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [sectionIds]);

  const scrollTo = (targetId: string) => {
    const target = document.getElementById(targetId);
    if (!target) {
      return;
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    setActiveSection(targetId);
  };

  const startDemo = () => {
    if (demoFrameRef.current !== null) {
      window.cancelAnimationFrame(demoFrameRef.current);
      demoFrameRef.current = null;
    }
    setDemoProgress(0);
    setDemoStepIndex(0);
    setDemoRunning(true);
  };

  const demoCompleted = demoProgress >= 100;

  const handleConsultSubmit = async (values: Record<string, string>) => {
    if (!values) {
      return;
    }
    form.resetFields();
    setConsultOpen(false);
    message.success(content.consult.success);
  };

  return (
    <div className={`landing-shell landing-shell--${variant}`} style={themeStyle}>
      <div className={`landing-loader${showLoader ? '' : ' is-hidden'}`} aria-hidden={!showLoader}>
        <div className="landing-loader__ripple" />
        <div className="landing-loader__ripple landing-loader__ripple--alt" />
        <div className="landing-loader__ring" />
        <div className="landing-loader__orb" />
        <div className="landing-loader__text">{languageKey === 'zh' ? '加载中' : 'Loading'}</div>
      </div>
      <div className="landing-shell__backdrop" aria-hidden="true">
        <div className="landing-shell__aurora" />
        <div className="landing-shell__grid" />
        <div className="landing-shell__noise" />
      </div>

      <header className="landing-header landing-container">
        <div className="landing-header__progress" aria-hidden="true">
          <span style={{ width: `${scrollProgress}%` }} />
        </div>
        <div className="landing-brand">
          <span className="landing-brand__title">{content.brand.title}</span>
          <span className="landing-brand__tagline">{content.brand.tagline}</span>
        </div>
        <nav className="landing-nav">
          {sectionMeta.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollTo(item.id)}
              className={`landing-nav__link${activeSection === item.id ? ' is-active' : ''}`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="landing-actions">
          <Segmented
            className="landing-variant-switch"
            size="small"
            value={variant}
            onChange={(value) => setVariant(value as LandingVariant)}
            options={variantOptions}
          />
          <LanguageSwitcher />
          <Button className="landing-button landing-button--ghost" onClick={() => setConsultOpen(true)}>
            {content.hero.secondaryCta}
          </Button>
          <Button
            type="primary"
            className="landing-button landing-button--primary"
            onClick={() => navigate('/login')}
          >
            {content.hero.primaryCta}
          </Button>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero landing-container">
          <div className="landing-hero__content">
            <Typography.Text className="landing-kicker">{content.brand.description}</Typography.Text>
            <Typography.Title level={1} className="landing-hero__headline">
              {content.hero.headline}
            </Typography.Title>
            <Typography.Paragraph className="landing-hero__subhead">
              {content.hero.subhead}
            </Typography.Paragraph>
            <div className="landing-hero__actions">
              <Button
                type="primary"
                size="large"
                className="landing-button landing-button--primary"
                onClick={() => navigate('/login')}
              >
                {content.hero.primaryCta}
              </Button>
              <Button
                size="large"
                className="landing-button landing-button--ghost"
                onClick={() => setConsultOpen(true)}
              >
                {content.hero.secondaryCta}
              </Button>
            </div>
            <Typography.Text className="landing-hero__note">{content.hero.note}</Typography.Text>
            <div className="landing-hero__chips">
              {heroChips.map((chip) => (
                <span key={chip} className="landing-hero__chip">
                  {chip}
                </span>
              ))}
            </div>
            <div className="landing-hero__stats">
              {heroStats.map((item) => (
                <div key={item.label} className="landing-stat">
                  <div className="landing-stat__value">
                    {typeof item.value === 'number' ? (
                      <CountUpNumber value={item.value} decimals={0} />
                    ) : (
                      item.value ?? '--'
                    )}
                  </div>
                  <div className="landing-stat__label">{item.label}</div>
                  <div className="landing-stat__hint">{item.hint}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="landing-hero__visual">
            <div className="landing-hero__stack">
              <div className="landing-hero__stack-head">
                <div className="landing-hero__stack-title">
                  {languageKey === 'zh' ? '教学功能看板' : 'Teaching Suite'}
                </div>
                <div className="landing-hero__stack-subtitle">
                  {languageKey === 'zh' ? '从上传到洞察的一体化流程' : 'From upload to insight in one flow'}
                </div>
              </div>
              {content.highlights.map((item) => (
                <div key={item.title} className="landing-hero__stack-card">
                  <div className="landing-hero__stack-card-title">{item.title}</div>
                  <div className="landing-hero__stack-card-desc">{item.desc}</div>
                </div>
              ))}
            </div>
            <div className="landing-hero__pulse">
              <div className="landing-hero__pulse-title">
                {languageKey === 'zh' ? '教学流程状态' : 'Teaching Flow Status'}
              </div>
              <div className="landing-hero__pulse-list">
                {processingSignals.map((item) => (
                  <div key={item.label} className="landing-hero__pulse-item">
                    <span className="landing-hero__pulse-dot" aria-hidden="true" />
                    <span className="landing-hero__pulse-label">{item.label}</span>
                    <strong className="landing-hero__pulse-value">{item.value}</strong>
                  </div>
                ))}
              </div>
              <div className="landing-hero__pulse-foot">
                {languageKey === 'zh' ? '当前浏览模块' : 'Current section'}: {sectionMeta.find((item) => item.id === activeSection)?.label || '--'}
              </div>
            </div>
          </div>
        </section>

        <section className="landing-marquee landing-container" aria-label={languageKey === 'zh' ? '能力标签' : 'Capability tags'}>
          <div className="landing-marquee__track">
            {[...marqueeItems, ...marqueeItems].map((item, index) => (
              <span key={`${item}-${index}`} className="landing-marquee__item">
                {item}
              </span>
            ))}
          </div>
        </section>

        <section
          id="scenes"
          className={`landing-section landing-container${activeSection === 'scenes' ? ' is-active' : ''}`}
        >
          <div className="landing-section__header">
            <Typography.Title level={3}>{languageKey === 'zh' ? '典型落地场景' : 'Real Classroom Scenarios'}</Typography.Title>
            <Typography.Text className="landing-section__subtitle">
              {languageKey === 'zh'
                ? '围绕老师真实节奏设计，让 AI 更自然地进入教学流程。'
                : 'Designed for real teacher rhythms so AI fits naturally into class operations.'}
            </Typography.Text>
          </div>
          <div className="landing-scene-grid">
            {sceneCards.map((item) => (
              <article key={item.title} className="landing-scene-card">
                <span className="landing-scene-card__tag">{item.tag}</span>
                <h4 className="landing-scene-card__title">{item.title}</h4>
                <p className="landing-scene-card__desc">{item.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="demo"
          className={`landing-section landing-container${activeSection === 'demo' ? ' is-active' : ''}`}
        >
          <div className="landing-section__header">
            <Typography.Title level={3}>{languageKey === 'zh' ? '交互式批改演示' : 'Interactive Grading Demo'}</Typography.Title>
            <Typography.Text className="landing-section__subtitle">
              {languageKey === 'zh'
                ? '点击开始，查看一次从上传到反馈的完整模拟流程。'
                : 'Run a simulated flow from upload to actionable feedback in one click.'}
            </Typography.Text>
          </div>
          <div className="landing-demo-grid">
            <div className="landing-demo-panel">
              <div className="landing-demo-toolbar">
                <Segmented
                  className="landing-demo-mode"
                  value={demoMode}
                  onChange={(value) => setDemoMode(value as 'quick' | 'quality')}
                  options={demoModeOptions}
                />
                <Button
                  type="primary"
                  className="landing-button landing-button--primary"
                  onClick={startDemo}
                  loading={demoRunning}
                >
                  {demoRunning
                    ? languageKey === 'zh'
                      ? '演示进行中'
                      : 'Running Demo'
                    : languageKey === 'zh'
                      ? '开始演示'
                      : 'Start Demo'}
                </Button>
              </div>
              <div className="landing-demo-progress">
                <div className="landing-demo-progress__label">
                  {languageKey === 'zh' ? '处理进度' : 'Pipeline Progress'}
                </div>
                <div className="landing-demo-progress__bar" aria-hidden="true">
                  <span style={{ width: `${demoProgress}%` }} />
                </div>
                <div className="landing-demo-progress__value">{demoProgress}%</div>
              </div>
              <div className="landing-demo-steps">
                {demoStages.map((stage, index) => {
                  const isDone = demoCompleted ? index <= demoStepIndex : index < demoStepIndex;
                  const isActive = !demoCompleted && demoRunning && index === demoStepIndex;
                  return (
                    <div
                      key={stage.title}
                      className={`landing-demo-step${isDone ? ' is-done' : ''}${isActive ? ' is-active' : ''}`}
                    >
                      <span className="landing-demo-step__index">{String(index + 1).padStart(2, '0')}</span>
                      <div className="landing-demo-step__content">
                        <div className="landing-demo-step__title">{stage.title}</div>
                        <div className="landing-demo-step__desc">{stage.detail}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <aside className="landing-demo-console">
              <div className="landing-demo-console__head">
                {languageKey === 'zh' ? '模拟结果快照' : 'Simulation Snapshot'}
              </div>
              <div className="landing-demo-console__stats">
                <div className="landing-demo-console__stat">
                  <span>{languageKey === 'zh' ? '总分' : 'Score'}</span>
                  <strong>{demoOutcome.score}</strong>
                </div>
                <div className="landing-demo-console__stat">
                  <span>{languageKey === 'zh' ? '耗时' : 'Duration'}</span>
                  <strong>{demoOutcome.duration}</strong>
                </div>
                <div className="landing-demo-console__stat">
                  <span>{languageKey === 'zh' ? '反馈量' : 'Feedback'}</span>
                  <strong>{demoOutcome.feedback}</strong>
                </div>
              </div>
              <div className="landing-demo-console__logs">
                {demoStages.map((stage, index) => {
                  const state = demoCompleted
                    ? 'done'
                    : index < demoStepIndex
                      ? 'done'
                      : demoRunning && index === demoStepIndex
                        ? 'active'
                        : 'wait';
                  return (
                    <div key={`${stage.title}-log`} className={`landing-demo-log landing-demo-log--${state}`}>
                      <span className="landing-demo-log__dot" aria-hidden="true" />
                      <span className="landing-demo-log__text">{stage.log}</span>
                    </div>
                  );
                })}
              </div>
              <div className="landing-demo-console__hint">{demoOutcome.hint}</div>
              <ul className="landing-demo-console__bullets">
                {demoOutcome.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </aside>
          </div>
        </section>

        <section
          id="features"
          className={`landing-section landing-container${activeSection === 'features' ? ' is-active' : ''}`}
        >
          <div className="landing-section__header">
            <Typography.Title level={3}>
              {languageKey === 'zh' ? '核心功能' : 'Core Features'}
            </Typography.Title>
            <Typography.Text className="landing-section__subtitle">
              {content.brand.tagline}
            </Typography.Text>
          </div>
          <div className="landing-feature-tabs">
            <Segmented
              className="landing-segmented"
              value={activeFeatureKey}
              onChange={(value) => setActiveFeatureKey(String(value))}
              options={featureTabs.map((tab) => ({ label: tab.label, value: tab.key }))}
            />
            {featureTabs
              .filter((tab) => tab.key === activeFeatureKey)
              .map((tab) => (
                <div key={tab.key} className="landing-feature-panel">
                  <div className="landing-feature-panel__title">{tab.title}</div>
                  <div className="landing-feature-panel__desc">{tab.desc}</div>
                  <div className="landing-feature-panel__grid">
                    <div className="landing-feature-panel__list">
                      {tab.bullets.filter(Boolean).map((item) => (
                        <div key={item.title} className="landing-feature-panel__item">
                          <div className="landing-feature-panel__item-title">{item.title}</div>
                          <div className="landing-feature-panel__item-desc">{item.desc}</div>
                        </div>
                      ))}
                    </div>
                    <div className="landing-feature-panel__meta">
                      <div className="landing-feature-panel__metric">
                        <div className="landing-feature-panel__metric-value">{tab.metric.value}</div>
                        <div className="landing-feature-panel__metric-label">{tab.metric.label}</div>
                        {tab.metric.hint ? (
                          <div className="landing-feature-panel__metric-hint">{tab.metric.hint}</div>
                        ) : null}
                      </div>
                      {tab.quote ? (
                        <div className="landing-feature-panel__quote">{tab.quote}</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </section>

        <section
          id="compare"
          className={`landing-section landing-container${activeSection === 'compare' ? ' is-active' : ''}`}
        >
          <div className="landing-section__header">
            <Typography.Title level={3}>{compareContent.title}</Typography.Title>
            <Typography.Text className="landing-section__subtitle">{compareContent.subtitle}</Typography.Text>
          </div>
          <div className="landing-compare">
            <div className="landing-compare__frame">
              <div className="landing-compare__meter" aria-hidden="true">
                <span>{languageKey === 'zh' ? 'AI 增益感知' : 'AI Impact'}</span>
                <strong>{compareInsight}%</strong>
              </div>
              <div className="landing-compare__overlay" style={{ width: `${compareValue}%` }} />
              <div className="landing-compare__cards">
                <div className="landing-compare__card landing-compare__card--before">
                  <div className="landing-compare__card-tag">{compareContent.before.tag}</div>
                  <div className="landing-compare__card-title">{compareContent.before.title}</div>
                  <div className="landing-compare__card-list">
                    {compareContent.before.points.map((item) => (
                      <div key={item} className="landing-compare__card-item">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="landing-compare__card landing-compare__card--after">
                  <div className="landing-compare__card-tag">{compareContent.after.tag}</div>
                  <div className="landing-compare__card-title">{compareContent.after.title}</div>
                  <div className="landing-compare__card-list">
                    {compareContent.after.points.map((item) => (
                      <div key={item} className="landing-compare__card-item">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <input
                className="landing-compare__range"
                type="range"
                min={20}
                max={80}
                value={compareValue}
                aria-label={languageKey === 'zh' ? '对比滑块' : 'Compare slider'}
                onChange={(event) => setCompareValue(Number(event.target.value))}
              />
            </div>
          </div>
        </section>

        <section
          id="workflow"
          className={`landing-section landing-container${activeSection === 'workflow' ? ' is-active' : ''}`}
        >
          <div className="landing-section__header">
            <Typography.Title level={3}>{languageKey === 'zh' ? '工作流' : 'Workflow'}</Typography.Title>
            <Typography.Text className="landing-section__subtitle">
              {languageKey === 'zh'
                ? '从上传到复盘的完整闭环'
                : 'From upload to review in one continuous loop'}
            </Typography.Text>
          </div>
          <div className="landing-workflow">
            {content.workflow.map((item, index) => (
              <div key={item.title} className="landing-step">
                <div className="landing-step__badge">
                  <span>{workflowBadgeLabel}</span>
                  <strong>{String(index + 1).padStart(2, '0')}</strong>
                </div>
                <div className="landing-step__body">
                  <div className="landing-step__title">{item.title}</div>
                  <div className="landing-step__desc">{item.desc}</div>
                </div>
                <div className="landing-step__chips">
                  {(workflowChips[index] || []).map((chip) => (
                    <span key={chip} className="landing-step__chip">
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          id="insight"
          className={`landing-section landing-container${activeSection === 'insight' ? ' is-active' : ''}`}
        >
          <div className="landing-section__header">
            <Typography.Title level={3}>{languageKey === 'zh' ? '能力矩阵' : 'Capabilities'}</Typography.Title>
            <Typography.Text className="landing-section__subtitle">
              {languageKey === 'zh'
                ? '从批改到数据洞察的完整能力'
                : 'Coverage from grading to learning insight'}
            </Typography.Text>
          </div>
          <div className="landing-pill-grid">
            {content.capabilities.map((item) => (
              <div key={item.title} className="landing-pill">
                <div className="landing-pill__title">{item.title}</div>
                <div className="landing-pill__desc">{item.desc}</div>
              </div>
            ))}
          </div>
          <div className="landing-metric-grid">
            {content.metrics.map((item) => (
              <div key={item.label} className="landing-metric">
                <div className="landing-metric__value">{item.value}</div>
                <div className="landing-metric__label">{item.label}</div>
                {item.hint ? <div className="landing-metric__hint">{item.hint}</div> : null}
              </div>
            ))}
          </div>
          <div className="landing-proof-grid">
            {content.proof.map((item) => (
              <div key={item.title} className="landing-proof">
                <div className="landing-proof__title">{item.title}</div>
                <div className="landing-proof__desc">{item.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section
          id="faq"
          className={`landing-section landing-container${activeSection === 'faq' ? ' is-active' : ''}`}
        >
          <div className="landing-section__header">
            <Typography.Title level={3}>FAQ</Typography.Title>
            <Typography.Text className="landing-section__subtitle">
              {languageKey === 'zh' ? '常见问题快速解答' : 'Quick answers before you start'}
            </Typography.Text>
          </div>
          <div className="landing-faq-tools">
            <Input.Search
              allowClear
              value={faqQuery}
              placeholder={languageKey === 'zh' ? '搜索问题或答案' : 'Search questions or answers'}
              onChange={(event) => setFaqQuery(event.target.value)}
              className="landing-faq-tools__search"
            />
            <div className="landing-faq-tools__chips">
              {faqQuickFilters.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`landing-faq-tools__chip${faqQuery === item ? ' is-active' : ''}`}
                  onClick={() => setFaqQuery(item)}
                >
                  {item}
                </button>
              ))}
              {faqQuery ? (
                <button type="button" className="landing-faq-tools__chip" onClick={() => setFaqQuery('')}>
                  {languageKey === 'zh' ? '清空' : 'Clear'}
                </button>
              ) : null}
            </div>
            <Typography.Text className="landing-faq-tools__count">
              {languageKey === 'zh'
                ? `匹配 ${filteredFaq.length} / ${content.faq.length}`
                : `${filteredFaq.length} of ${content.faq.length} matched`}
            </Typography.Text>
          </div>
          {filteredFaq.length ? (
            <Collapse
              className="landing-faq-collapse"
              ghost
              items={filteredFaq.map((item) => ({
                key: item.question,
                label: item.question,
                children: <div className="landing-faq-collapse__answer">{item.answer}</div>,
              }))}
            />
          ) : (
            <div className="landing-faq-empty">
              {languageKey === 'zh' ? '未找到相关问题，换个关键词试试。' : 'No FAQ found. Try another keyword.'}
            </div>
          )}
        </section>

        <section className="landing-cta landing-container">
          <div className="landing-cta__content">
            <Typography.Title level={2}>{content.cta.title}</Typography.Title>
            <Typography.Text className="landing-cta__subtitle">{content.cta.subtitle}</Typography.Text>
          </div>
          <div className="landing-cta__actions">
            <Button
              type="primary"
              size="large"
              className="landing-button landing-button--primary"
              onClick={() => navigate('/login')}
            >
              {content.cta.primary}
            </Button>
            <Button size="large" className="landing-button landing-button--ghost" onClick={() => setConsultOpen(true)}>
              {content.cta.secondary}
            </Button>
          </div>
        </section>
      </main>

      <footer className="landing-footer landing-container">
        <div className="landing-footer__brand">{content.brand.title}</div>
        <div className="landing-footer__note">{content.brand.description}</div>
      </footer>

      <Modal
        open={consultOpen}
        onCancel={() => setConsultOpen(false)}
        onOk={() => form.submit()}
        okText={content.consult.submit}
        cancelText={languageKey === 'zh' ? '取消' : 'Cancel'}
        title={content.consult.title}
        className="landing-consult-modal"
      >
        <Typography.Paragraph className="landing-consult-subtitle">
          {content.consult.subtitle}
        </Typography.Paragraph>
        <Form form={form} layout="vertical" onFinish={handleConsultSubmit}>
          <Form.Item
            label={content.consult.fields.name}
            name="name"
            rules={[{ required: true, message: languageKey === 'zh' ? '请填写姓名' : 'Please enter your name' }]}
          >
            <Input placeholder={content.consult.fields.name} />
          </Form.Item>
          <Form.Item
            label={content.consult.fields.org}
            name="org"
            rules={[{ required: true, message: languageKey === 'zh' ? '请填写学校或机构' : 'Please enter organization' }]}
          >
            <Input placeholder={content.consult.fields.org} />
          </Form.Item>
          <Form.Item
            label={content.consult.fields.contact}
            name="contact"
            rules={[{ required: true, message: languageKey === 'zh' ? '请填写联系方式' : 'Please enter contact' }]}
          >
            <Input placeholder={content.consult.fields.contact} />
          </Form.Item>
          <Form.Item label={content.consult.fields.need} name="need">
            <Input.TextArea rows={4} placeholder={content.consult.fields.need} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
