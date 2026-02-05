import { Button, Form, Input, Modal, Segmented, Typography } from 'antd';
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

export const LandingPage = () => {
  const navigate = useNavigate();
  const { language } = useI18n();
  const message = useMessage();
  const [consultOpen, setConsultOpen] = useState(false);
  const [loaderVisible, setLoaderVisible] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSection, setActiveSection] = useState('features');
  const [activeFeatureKey, setActiveFeatureKey] = useState('grading');
  const [compareValue, setCompareValue] = useState(50);
  const [form] = Form.useForm();
  const scrollFrameRef = useRef<number | null>(null);

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

  const languageKey: 'zh' | 'en' = language.startsWith('zh') ? 'zh' : 'en';
  const landing = landingQuery.data ?? DEFAULT_LANDING_PAYLOAD;
  const fallbackContent = DEFAULT_LANDING_PAYLOAD.content[languageKey];
  const content = landing.content[languageKey] ?? fallbackContent;
  const theme = DEFAULT_LANDING_PAYLOAD.theme;
  const showLoader = loaderVisible || (landingQuery.isLoading && !landingQuery.data);

  const themeStyle = useMemo(
    () =>
      ({
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
      }) as CSSProperties,
    [theme],
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

  const sectionIds = useMemo(() => ['features', 'compare', 'workflow', 'insight', 'faq'], []);

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

  const handleConsultSubmit = async (values: Record<string, string>) => {
    if (!values) {
      return;
    }
    form.resetFields();
    setConsultOpen(false);
    message.success(content.consult.success);
  };

  return (
    <div className="landing-shell" style={themeStyle}>
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
          <button
            type="button"
            onClick={() => scrollTo('features')}
            className={`landing-nav__link${activeSection === 'features' ? ' is-active' : ''}`}
          >
            {languageKey === 'zh' ? '功能' : 'Features'}
          </button>
          <button
            type="button"
            onClick={() => scrollTo('compare')}
            className={`landing-nav__link${activeSection === 'compare' ? ' is-active' : ''}`}
          >
            {languageKey === 'zh' ? '对比' : 'Compare'}
          </button>
          <button
            type="button"
            onClick={() => scrollTo('workflow')}
            className={`landing-nav__link${activeSection === 'workflow' ? ' is-active' : ''}`}
          >
            {languageKey === 'zh' ? '流程' : 'Workflow'}
          </button>
          <button
            type="button"
            onClick={() => scrollTo('insight')}
            className={`landing-nav__link${activeSection === 'insight' ? ' is-active' : ''}`}
          >
            {languageKey === 'zh' ? '洞察' : 'Insight'}
          </button>
          <button
            type="button"
            onClick={() => scrollTo('faq')}
            className={`landing-nav__link${activeSection === 'faq' ? ' is-active' : ''}`}
          >
            FAQ
          </button>
        </nav>
        <div className="landing-actions">
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
          <div className="landing-faq">
            {content.faq.map((item) => (
              <div key={item.question} className="landing-faq__item">
                <div className="landing-faq__question">{item.question}</div>
                <div className="landing-faq__answer">{item.answer}</div>
              </div>
            ))}
          </div>
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
