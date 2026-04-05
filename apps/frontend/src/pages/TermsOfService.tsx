import { Typography, Button, Divider } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export const TermsOfServicePage = () => {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const isZh = language.startsWith('zh');

  return (
    <div className="apple-legal-page">
      <header className="apple-legal-header">
        <div className="apple-legal-header-inner">
          <div className="apple-legal-logo" onClick={() => navigate('/')}>
            {t('app.title')}
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="apple-legal-content">
        <Typography.Title level={1} className="apple-legal-title">
          {isZh ? '服务条款' : 'Terms of Service'}
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="apple-legal-update">
          {isZh ? '最后更新：2024年1月' : 'Last Updated: January 2024'}
        </Typography.Paragraph>

        <Divider />

        <section className="apple-legal-section">
          <Typography.Title level={3}>
            {isZh ? '1. 服务接受' : '1. Acceptance of Terms'}
          </Typography.Title>
          <Typography.Paragraph>
            {isZh
              ? '使用 Homework AI（以下称"本服务"）即表示您同意受本服务条款的约束。如果您不同意这些条款，请勿使用本服务。本服务由教育机构提供，旨在为师生提供智能作业批改服务。'
              : 'By accessing and using Homework AI (hereinafter "the Service"), you agree to be bound by these Terms of Service. If you do not agree with these terms, please do not use the Service. The Service is provided by educational institutions to offer intelligent homework grading for teachers and students.'}
          </Typography.Paragraph>
        </section>

        <section className="apple-legal-section">
          <Typography.Title level={3}>
            {isZh ? '2. 服务描述' : '2. Service Description'}
          </Typography.Title>
          <Typography.Paragraph>
            {isZh
              ? 'Homework AI 是一款基于人工智能的英语作文智能批改系统。学生可以上传手写作业图片，系统通过 OCR 技术识别文字，并由 AI 进行批改评分。服务功能包括：'
              : 'Homework AI is an AI-powered English essay intelligent grading system. Students can upload handwritten homework images, which are processed through OCR for text recognition and graded by AI. Service features include:'}
          </Typography.Paragraph>
          <ul className="apple-legal-list">
            <li>{isZh ? '手写作业图片上传与识别' : 'Handwritten homework image upload and recognition'}</li>
            <li>{isZh ? 'AI 智能批改与评分' : 'AI-powered grading and scoring'}</li>
            <li>{isZh ? '多维度作文分析与反馈' : 'Multi-dimensional essay analysis and feedback'}</li>
            <li>{isZh ? '班级作业管理与统计' : 'Class homework management and statistics'}</li>
            <li>{isZh ? '学习报告与数据导出' : 'Learning reports and data export'}</li>
          </ul>
        </section>

        <section className="apple-legal-section">
          <Typography.Title level={3}>
            {isZh ? '3. 用户账户' : '3. User Accounts'}
          </Typography.Title>
          <Typography.Paragraph>
            {isZh
              ? '本服务支持三种用户角色：学生、教师和管理员。您需要使用教育机构提供的账户信息登录。您有责任保管好账户凭据的机密性，不得与他人共享账户。如发现账户被盗用，请立即通知管理员。'
              : 'The Service supports three user roles: Student, Teacher, and Administrator. You need to log in using account credentials provided by your educational institution. You are responsible for maintaining the confidentiality of your account credentials and must not share your account with others. If you discover unauthorized use of your account, please notify the administrator immediately.'}
          </Typography.Paragraph>
        </section>

        <section className="apple-legal-section">
          <Typography.Title level={3}>
            {isZh ? '4. 使用规范' : '4. Acceptable Use'}
          </Typography.Title>
          <Typography.Paragraph>
            {isZh ? '使用本服务时，您承诺：' : 'When using the Service, you agree to:'}
          </Typography.Paragraph>
          <ul className="apple-legal-list">
            <li>{isZh ? '仅上传与学习相关的作业内容' : 'Only upload homework content related to learning'}</li>
            <li>{isZh ? '不上传违法、侵权或不当内容' : 'Not upload illegal, infringing, or inappropriate content'}</li>
            <li>{isZh ? '不尝试破坏系统安全或干扰其他用户' : 'Not attempt to compromise system security or interfere with other users'}</li>
            <li>{isZh ? '遵守所在教育机构的相关规定' : 'Comply with relevant regulations of your educational institution'}</li>
          </ul>
        </section>

        <section className="apple-legal-section">
          <Typography.Title level={3}>
            {isZh ? '5. 数据隐私' : '5. Data Privacy'}
          </Typography.Title>
          <Typography.Paragraph>
            {isZh
              ? '我们仅出于批改目的收集和处理学生作业数据。关于数据处理的详细信息，请参阅我们的《隐私政策》。我们承诺保护用户数据安全，不会将个人数据出售给第三方。'
              : 'We collect and process student homework data solely for grading purposes. Please refer to our Privacy Policy for detailed information about data handling. We are committed to protecting user data security and will not sell personal data to third parties.'}
          </Typography.Paragraph>
        </section>

        <section className="apple-legal-section">
          <Typography.Title level={3}>
            {isZh ? '6. 知识产权' : '6. Intellectual Property'}
          </Typography.Title>
          <Typography.Paragraph>
            {isZh
              ? '学生上传的作业内容归学生本人所有。AI 生成的批改结果仅作为教育反馈参考，不构成对作业内容的知识产权主张。本系统的软件、界面设计、技术文档等归开发者所有。'
              : 'All uploaded homework content remains the property of the students. AI-generated grading results are provided as educational feedback only and do not constitute any intellectual property claims over the homework content. The software, interface design, and technical documentation of this system are owned by the developers.'}
          </Typography.Paragraph>
        </section>

        <section className="apple-legal-section">
          <Typography.Title level={3}>
            {isZh ? '7. 免责声明' : '7. Disclaimer'}
          </Typography.Title>
          <Typography.Paragraph>
            {isZh
              ? 'AI 批改结果仅供参考，不应作为学业评价的唯一依据。教师对最终评分拥有决定权。我们不保证服务不会中断或无错误，对于因使用或无法使用服务而导致的任何损失，我们不承担责任。'
              : 'AI grading results are for reference only and should not be used as the sole basis for academic evaluation. Teachers retain final authority over grades. We do not guarantee uninterrupted or error-free service, and we are not liable for any losses resulting from the use or inability to use the service.'}
          </Typography.Paragraph>
        </section>

        <section className="apple-legal-section">
          <Typography.Title level={3}>
            {isZh ? '8. 条款修改' : '8. Modifications'}
          </Typography.Title>
          <Typography.Paragraph>
            {isZh
              ? '我们保留随时修改本服务条款的权利。修改后的条款将在本页面公布，继续使用本服务即表示您接受修改后的条款。'
              : 'We reserve the right to modify these Terms of Service at any time. Modified terms will be published on this page, and continued use of the Service constitutes acceptance of the modified terms.'}
          </Typography.Paragraph>
        </section>

        <section className="apple-legal-section">
          <Typography.Title level={3}>
            {isZh ? '9. 联系我们' : '9. Contact'}
          </Typography.Title>
          <Typography.Paragraph>
            {isZh
              ? '如有关于本服务条款的疑问，请通过平台支持渠道或联系管理员获取帮助。'
              : 'For questions about these Terms of Service, please contact us through the platform\'s support channels or contact your administrator.'}
          </Typography.Paragraph>
        </section>

        <Divider />

        <div className="apple-legal-footer">
          <Button type="link" onClick={() => navigate('/privacy')}>
            {isZh ? '查看隐私政策' : 'View Privacy Policy'}
          </Button>
          <Button type="primary" onClick={() => navigate('/login')}>
            {isZh ? '返回登录' : 'Back to Login'}
          </Button>
        </div>
      </main>
    </div>
  );
};
