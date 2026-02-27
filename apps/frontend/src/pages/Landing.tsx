import { Button, Collapse, Form, Input, Modal, Typography, Layout, Space } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { fetchPublicLanding, type PublicLandingPayload } from '../api';
import { useI18n } from '../i18n';
import { useMessage } from '../hooks/useMessage';
import {
  ArrowRightOutlined,
  PlayCircleOutlined,
  ScanOutlined,
  RobotOutlined,
  BarChartOutlined,
  TeamOutlined,
  FileTextOutlined,
  ReloadOutlined,
  GlobalOutlined,
  CheckCircleOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import './landing.css';

const DEFAULT_LANDING_PAYLOAD: PublicLandingPayload = {
  version: 1,
  generatedAt: new Date(0).toISOString(),
  ttlSeconds: 21600,
  theme: {
    background: '#f8f9fc',
    surface: '#ffffff',
    surfaceStrong: '#edeef3',
    text: '#1f1f1f',
    muted: '#49454f',
    border: '#dde1e9',
    accent: '#1a73e8',
    accentAlt: '#4f9cf7',
    glow: 'rgba(26,115,232,0.1)',
    orb1: 'transparent',
    orb2: 'transparent',
    orb3: 'transparent',
    noiseOpacity: 0,
  },
  content: {
    zh: {
      brand: {
        title: 'Homework AI',
        tagline: 'AI驱动的英语作文智能批改系统',
        description: '基于深度学习与 OCR 技术，为教师和学生打造的下一代智能作业批改系统。精准识别手写笔迹，多维点评，让批改更高效。',
      },
      hero: {
        headline: '让批改更快，教学更有温度',
        subhead: '老师批改从小时变成分钟，学生拿到结构化反馈与改写建议。',
        note: '支持拍照作业、批量上传与班级级别的学情分析。',
        primaryCta: '进入系统',
        secondaryCta: '预约演示',
      },
      highlights: [
        { title: '深度学习 AI 批改引擎', desc: '接入 DeepSeek LLM，从语法、词汇、句子结构到篇章逻辑，进行全方位的深度点评与打分，提供详细的改进建议。' },
        { title: '精准手写 OCR 识别', desc: '集成百度 OCR，支持高精度的手写英文识别。即使是潦草笔迹，也能准确转化为文本进行分析。' },
        { title: '极速批量处理', desc: '教师可一键批量上传全班作业，系统基于 BullMQ 队列实现异步高效批改，无需等待，随时查看结果。' },
      ],
      capabilities: [
        { title: '多角色系统', desc: '支持学生、教师、管理员三种角色，权限隔离，协同高效。' },
        { title: '数据导出', desc: '支持 PDF、CSV 格式的详细报告导出，方便归档与分析。' },
        { title: '跳过文件重试', desc: '对无法识别的文件支持手动指定学生并重新批改，确保无一遗漏。' },
        { title: '中英双语', desc: '完整的中英文界面支持，无缝适配双语教学场景。' },
      ],
      workflow: [
        { title: '上传与识别', desc: '图像进入 OCR 与学号识别。' },
        { title: '分发与归档', desc: '匹配学生并分组生成提交。' },
        { title: 'AI批改', desc: '评分、结构化反馈与改写建议输出。' },
        { title: '教学复盘', desc: '趋势、错因与班级对比自动生成。' },
      ],
      metrics: [
        { label: 'OCR 识别准确率', value: '99%', hint: '手写英文精准转化' },
        { label: '平均批改耗时', value: '1s', hint: '深度模型快速响应' },
        { label: '多维评分标准', value: '5+', hint: '词汇、语法、结构等' },
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
        title: '准备好革新你的教学体验了吗？',
        subtitle: '无需复杂配置，只需登录即可开始体验下一代的智能批改流程。',
        primary: '立即开始',
        secondary: '咨询方案',
      },
      consult: {
        title: '预约产品演示',
        subtitle: '请留下您的联系方式，我们将安排专属顾问为您演示系统功能。',
        fields: { name: '姓名', org: '学校/机构', contact: '工作邮箱', need: '需求描述' },
        submit: '提交申请',
        success: '提交成功，我们会尽快联系你。',
      },
    },
    en: {
      brand: {
        title: 'Homework AI',
        tagline: 'AI-driven English Essay Intelligent Grading System',
        description: 'The next-generation smart grading system for teachers and students, powered by Deep Learning and OCR. Highly accurate handwriting recognition and multi-dimensional feedback for efficient grading.',
      },
      hero: {
        headline: 'Grade faster, teach with clarity.',
        subhead: 'Turn hours of grading into minutes while students receive structured feedback and rewrite suggestions.',
        note: 'Supports photo uploads, batch imports, and class-level insight dashboards.',
        primaryCta: 'Enter System',
        secondaryCta: 'Book a Demo',
      },
      highlights: [
        { title: 'Deep Learning AI Engine', desc: 'Powered by DeepSeek LLM, providing comprehensive grading from grammar and vocabulary to sentence structure and logic, along with detailed suggestions.' },
        { title: 'Precise Handwriting OCR', desc: 'Integrated with Baidu OCR for high-accuracy handwritten English recognition. Accurately converts even messy handwriting into text.' },
        { title: 'Lightning Batch Processing', desc: 'Teachers can batch upload class assignments with one click. Asynchronous grading via BullMQ queue means no waiting and instant results.' },
      ],
      capabilities: [
        { title: 'Multi-role System', desc: 'Supports Student, Teacher, and Admin roles with isolated permissions for efficient collaboration.' },
        { title: 'Data Export', desc: 'Export detailed reports in PDF or CSV formats for easy archiving and analysis.' },
        { title: 'Skip & Retry', desc: 'Manually assign unreadable files to students and retry grading to ensure no assignment is missed.' },
        { title: 'Bilingual Support', desc: 'Full English and Chinese interface support, perfect for bilingual teaching environments.' },
      ],
      workflow: [
        { title: 'Upload & OCR', desc: 'Images enter OCR with student matching.' },
        { title: 'Match & Group', desc: 'Students are identified and submissions grouped.' },
        { title: 'AI Grading', desc: 'Structured feedback and rewrite suggestions delivered.' },
        { title: 'Class Review', desc: 'Trends and gaps are summarized automatically.' },
      ],
      metrics: [
        { label: 'OCR Accuracy', value: '99%', hint: 'Precise handwriting conversion' },
        { label: 'Avg. Grading Time', value: '1s', hint: 'Fast deep model response' },
        { label: 'Scoring Dimensions', value: '5+', hint: 'Vocabulary, grammar, structure, etc.' },
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
        title: 'Ready to Revolutionize Your Teaching Experience?',
        subtitle: 'No complex configuration required. Just log in and start experiencing the next generation of intelligent grading.',
        primary: 'Start Now',
        secondary: 'Request a Demo',
      },
      consult: {
        title: 'Book a Product Demo',
        subtitle: 'Please leave your contact info, and our dedicated consultant will arrange a system demo for you.',
        fields: { name: 'Name', org: 'School / Institution', contact: 'Work Email', need: 'Your Requirements' },
        submit: 'Submit Application',
        success: 'Thanks! We will reach out soon.',
      },
    },
  },
};

const HIGHLIGHT_ICONS = [ScanOutlined, RobotOutlined, BarChartOutlined];
const CAPABILITY_ICONS = [TeamOutlined, FileTextOutlined, ReloadOutlined, GlobalOutlined];

export const LandingPage = () => {
  const navigate = useNavigate();
  const { language } = useI18n();
  const message = useMessage();

  const [consultOpen, setConsultOpen] = useState(false);
  const [heroReady, setHeroReady] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [form] = Form.useForm();

  const landingQuery = useQuery({
    queryKey: ['public-landing'],
    queryFn: fetchPublicLanding,
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const frame = window.requestAnimationFrame(() => setHeroReady(true));
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const languageKey: 'zh' | 'en' = language.startsWith('zh') ? 'zh' : 'en';
  const landing = landingQuery.data ?? DEFAULT_LANDING_PAYLOAD;
  const fallbackContent = DEFAULT_LANDING_PAYLOAD.content[languageKey];
  const content = landing.content[languageKey] ?? fallbackContent;
  const zh = languageKey === 'zh';

  const handleConsultSubmit = () => {
    message.success(content.consult.success);
    setConsultOpen(false);
    form.resetFields();
  };

  return (
    <Layout className="apple-landing-layout">
      <div className="apple-ambient-bg" />

      {/* Nav */}
      <header className={`apple-landing-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="apple-landing-nav-inner">
          <div className="apple-landing-logo">{content.brand.title}</div>
          <div className="apple-landing-actions">
            <LanguageSwitcher />
            <Button type="primary" className="apple-nav-btn" onClick={() => navigate('/login')}>
              {zh ? '登录' : 'Sign In'}
            </Button>
          </div>
        </div>
      </header>

      <main className="apple-landing-main">
        {/* ── 1. Hero ── */}
        <section className={`apple-hero-section ${heroReady ? 'ready' : ''}`}>
          <div className="apple-hero-content">
            <div className="apple-hero-badge">{content.brand.tagline}</div>
            <Typography.Title className="apple-hero-title">
              {content.hero.headline}
            </Typography.Title>
            <Typography.Paragraph className="apple-hero-subtitle">
              {content.hero.subhead}
            </Typography.Paragraph>
            <div className="apple-hero-cta">
              <Button type="primary" size="large" className="apple-btn-primary" onClick={() => navigate('/login')}>
                {content.hero.primaryCta}
              </Button>
              <Button type="link" size="large" className="apple-btn-link" onClick={() => setConsultOpen(true)}>
                {content.hero.secondaryCta} <ArrowRightOutlined />
              </Button>
            </div>

            <div className="apple-hero-visual">
              <div className="apple-glass-panel">
                <div className="apple-glass-panel-inner">
                  <div className="mock-window-header">
                    <span className="mock-dot close" />
                    <span className="mock-dot minimize" />
                    <span className="mock-dot maximize" />
                  </div>
                  <div className="mock-window-body">
                    <div className="mock-sidebar">
                      <div className="mock-item active" />
                      <div className="mock-item" />
                      <div className="mock-item" />
                      <div className="mock-item" />
                    </div>
                    <div className="mock-content">
                      <div className="mock-title" />
                      <div className="mock-paragraph" />
                      <div className="mock-paragraph short" />
                      <div className="mock-chart-area">
                        <PlayCircleOutlined className="apple-play-icon" />
                        <div className="play-text">{zh ? '交互演示' : 'Interactive Demo'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Highlights (bento grid) ── */}
        <section className="apple-section apple-features-section">
          <div className="apple-section-header">
            <Typography.Title level={2} className="apple-section-title">
              {zh ? '核心功能，尽在掌握。' : 'Core Features. Mastered.'}
            </Typography.Title>
            <Typography.Paragraph className="apple-section-desc">
              {content.brand.description}
            </Typography.Paragraph>
          </div>
          <div className="apple-bento-grid">
            {content.highlights.map((item, i) => {
              const Icon = HIGHLIGHT_ICONS[i % HIGHLIGHT_ICONS.length];
              return (
                <div key={i} className={`apple-bento-card bento-${i}`}>
                  <div className="bento-icon-wrapper"><Icon /></div>
                  <Typography.Title level={4} className="apple-bento-title">{item.title}</Typography.Title>
                  <Typography.Paragraph className="apple-bento-desc">{item.desc}</Typography.Paragraph>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 3. How it works (workflow) ── */}
        <section className="apple-section apple-workflow-section">
          <div className="apple-section-header">
            <Typography.Title level={2} className="apple-section-title">
              {zh ? '四步完成，从上传到复盘。' : 'Four Steps. Upload to Insight.'}
            </Typography.Title>
            <Typography.Paragraph className="apple-section-desc">
              {zh ? '简单流程，强大结果。' : 'Simple process, powerful results.'}
            </Typography.Paragraph>
          </div>
          <div className="apple-workflow-grid">
            {content.workflow.map((step, i) => (
              <div key={i} className="apple-workflow-step">
                <div className="apple-workflow-num">{String(i + 1).padStart(2, '0')}</div>
                <Typography.Title level={4} className="apple-workflow-step-title">{step.title}</Typography.Title>
                <Typography.Paragraph className="apple-workflow-step-desc">{step.desc}</Typography.Paragraph>
              </div>
            ))}
          </div>
        </section>

        {/* ── 4. Metrics ── */}
        <section className="apple-section apple-metrics-section">
          <div className="apple-section-header">
            <Typography.Title level={2} className="apple-section-title">
              {zh ? '用数据说话。' : 'Numbers that speak.'}
            </Typography.Title>
          </div>
          <div className="apple-metrics-grid">
            {content.metrics.map((item, i) => (
              <div key={i} className="apple-metric-item">
                <div className="apple-metric-value">{item.value}</div>
                <div className="apple-metric-label">{item.label}</div>
                <div className="apple-metric-hint">{item.hint}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 5. Platform capabilities (4-col grid) ── */}
        <section className="apple-section apple-capabilities-section">
          <div className="apple-section-header">
            <Typography.Title level={2} className="apple-section-title">
              {zh ? '不只是批改，更是平台。' : 'More than grading. A platform.'}
            </Typography.Title>
            <Typography.Paragraph className="apple-section-desc">
              {zh ? '覆盖教学场景的全方位能力。' : 'Comprehensive capabilities for every teaching scenario.'}
            </Typography.Paragraph>
          </div>
          <div className="apple-capabilities-grid">
            {content.capabilities.map((cap, i) => {
              const Icon = CAPABILITY_ICONS[i % CAPABILITY_ICONS.length];
              return (
                <div key={i} className="apple-capability-card">
                  <div className="bento-icon-wrapper"><Icon /></div>
                  <Typography.Title level={5} className="apple-capability-title">{cap.title}</Typography.Title>
                  <Typography.Paragraph className="apple-capability-desc">{cap.desc}</Typography.Paragraph>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 6. Social proof ── */}
        <section className="apple-section apple-proof-section">
          <div className="apple-section-header">
            <Typography.Title level={2} className="apple-section-title">
              {zh ? '为什么选择我们？' : 'Why educators choose us.'}
            </Typography.Title>
          </div>
          <div className="apple-proof-grid">
            {content.proof.map((item, i) => (
              <div key={i} className="apple-proof-card">
                <CheckCircleOutlined className="apple-proof-icon" />
                <Typography.Title level={4} className="apple-proof-title">{item.title}</Typography.Title>
                <Typography.Paragraph className="apple-proof-desc">{item.desc}</Typography.Paragraph>
              </div>
            ))}
          </div>
        </section>

        {/* ── 7. FAQ ── */}
        <section className="apple-section apple-faq-section">
          <div className="apple-section-header">
            <Typography.Title level={2} className="apple-section-title">
              <QuestionCircleOutlined style={{ marginRight: 8 }} />
              {zh ? '常见问题' : 'Frequently Asked Questions'}
            </Typography.Title>
          </div>
          <Collapse
            className="apple-faq-collapse"
            bordered={false}
            expandIconPosition="end"
            items={content.faq.map((item, i) => ({
              key: String(i),
              label: <span className="apple-faq-question">{item.question}</span>,
              children: <Typography.Paragraph className="apple-faq-answer">{item.answer}</Typography.Paragraph>,
            }))}
          />
        </section>

        {/* ── 8. CTA ── */}
        <section className="apple-section apple-cta-section">
          <div className="apple-cta-content">
            <Typography.Title level={2} className="apple-cta-title">
              {content.cta?.title ?? (zh ? '准备好革新你的教学体验了吗？' : 'Ready to Revolutionize Your Teaching?')}
            </Typography.Title>
            <Typography.Paragraph className="apple-cta-subtitle">
              {content.cta?.subtitle ?? ''}
            </Typography.Paragraph>
            <Space size="middle" style={{ marginTop: 16 }}>
              <Button type="primary" size="large" className="apple-btn-primary" onClick={() => navigate('/login')}>
                {content.cta?.primary ?? (zh ? '立即开始' : 'Start Now')}
              </Button>
              <Button size="large" className="apple-btn-ghost" onClick={() => setConsultOpen(true)}>
                {content.cta?.secondary ?? (zh ? '咨询方案' : 'Request a Demo')}
              </Button>
            </Space>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="apple-footer">
        <div className="apple-footer-inner">
          <div className="apple-footer-brand">{content.brand.title}</div>
          <div className="apple-footer-links">
            <a onClick={() => navigate('/terms')}>{zh ? '服务条款' : 'Terms'}</a>
            <a onClick={() => navigate('/privacy')}>{zh ? '隐私政策' : 'Privacy'}</a>
            <a onClick={() => setConsultOpen(true)}>{zh ? '联系我们' : 'Contact'}</a>
          </div>
          <div className="apple-footer-text">
            {zh ? '© ' : 'Copyright '}{new Date().getFullYear()} {content.brand.title}. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Consult modal */}
      <Modal
        title={content.consult.title}
        open={consultOpen}
        onCancel={() => setConsultOpen(false)}
        footer={[
          <Button key="cancel" className="apple-btn-ghost" onClick={() => setConsultOpen(false)}>
            {zh ? '取消' : 'Cancel'}
          </Button>,
          <Button key="submit" type="primary" className="apple-btn-primary small-btn" onClick={() => form.submit()}>
            {content.consult.submit}
          </Button>,
        ]}
        className="apple-modal"
        centered
      >
        <Typography.Paragraph style={{ color: 'var(--apple-text-muted)', marginBottom: 24, fontSize: '16px' }}>
          {content.consult.subtitle}
        </Typography.Paragraph>
        <Form form={form} layout="vertical" onFinish={handleConsultSubmit} size="large">
          <Form.Item label={<span className="apple-form-label">{content.consult.fields.name}</span>} name="name" rules={[{ required: true }]}>
            <Input className="apple-input" placeholder={content.consult.fields.name} />
          </Form.Item>
          <Form.Item label={<span className="apple-form-label">{content.consult.fields.org}</span>} name="org" rules={[{ required: true }]}>
            <Input className="apple-input" placeholder={content.consult.fields.org} />
          </Form.Item>
          <Form.Item label={<span className="apple-form-label">{content.consult.fields.contact}</span>} name="contact" rules={[{ required: true }]}>
            <Input className="apple-input" placeholder={content.consult.fields.contact} />
          </Form.Item>
          <Form.Item label={<span className="apple-form-label">{content.consult.fields.need}</span>} name="need">
            <Input.TextArea className="apple-input ant-input" rows={4} placeholder={content.consult.fields.need} />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default LandingPage;
