import { Typography, Button, Divider } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export const PrivacyPolicyPage = () => {
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
          {isZh ? '隐私政策' : 'Privacy Policy'}
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="apple-legal-update">
          {isZh ? '最后更新：2024�?�? : 'Last Updated: January 2024'}
        </Typography.Paragraph>

        <Divider />

        <section className="apple-legal-section">
          <Typography.Title level={3}>
            {isZh ? '1. 信息收集' : '1. Information We Collect'}
          </Typography.Title>
          <Typography.Paragraph>
            {isZh
              ? '为了提供作业批改服务，我们收集以下类型的信息�?
              : 'To provide homework grading services, we collect the following types of information:'}
          </Typography.Paragraph>
          <ul className="apple-legal-list">
            <li>
              <strong>{isZh ? '账户信息' : 'Account Information'}</strong>
              {isZh ? '：姓名、账号、角色（学生/教师/管理员）' : ': Name, account ID, role (Student/Teacher/Administrator)'}
            </li>
            <li>
              <strong>{isZh ? '作业数据' : 'Homework Data'}</strong>
              {isZh ? '：上传的作业图片、OCR 识别文本、批改结�? : ': Uploaded homework images, OCR-recognized text, grading results'}
            </li>
            <li>
              <strong>{isZh ? '使用记录' : 'Usage Records'}</strong>
              {isZh ? '：登录时间、操作日志、系统访问记�? : ': Login time, operation logs, system access records'}
            </li>
          </ul>
        </section>

        <section className="apple-legal-section">
          <Typography.Title level={3}>
            {isZh ? '2. 数据使用' : '2. How We Use Your Data'}
          </Typography.Title>
          <Typography.Paragraph>
            {isZh
              ? '您的数据仅用于以下目的：'
              : 'Your data is used only for the following purposes:'}
          </Typography.Paragraph>
          <ul className="apple-legal-list">
            <li>{isZh ? '提供作业批改服务' : 'Provide homework grading services'}</li>
            <li>{isZh ? '生成学习报告和统计分�? : 'Generate learning reports and statistical analysis'}</li>
            <li>{isZh ? '改进 AI 模型和服务质�? : 'Improve AI models and service quality'}</li>
            <li>{isZh ? '保障系统安全和防止滥�? : 'Ensure system security and prevent abuse'}</li>
          </ul>
          <Typography.Paragraph>
            {isZh
              ? '我们承诺不会将您的个人数据出售给第三方�?
              : 'We promise not to sell your personal data to third parties.'}
          </Typography.Paragraph>
        </section>

        <section className="apple-legal-section">
          <Typography.Title level={3}>
            {isZh ? '3. 数据存储与安�? : '3. Data Storage and Security'}
          </Typography.Title>
          <Typography.Paragraph>
            {isZh
              ? '所有数据采用加密传输（HTTPS）进行保护。上传的图片和批改数据存储在安全的服务器上，访问权限受到严格控制。我们采取以下安全措施：'
              : 'All data is protected using encrypted transmission (HTTPS). Uploaded images and grading data are stored on secure servers with strictly controlled access. We implement the following security measures:'}
          </Typography.Paragraph>
          <ul className="apple-legal-list">
            <li>{isZh ? '数据传输加密（TLS/SSL�? : 'Data transmission encryption (TLS/SSL)'}</li>
            <li>{isZh ? '基于角色的访问控�? : 'Role-based access control'}</li>
            <li>{isZh ? '操作日志审计' : 'Operation log auditing'}</li>
            <li>{isZh ? '定期安全检�? : 'Regular security audits'}</li>
          </ul>
        </section>

        <section className="apple-legal-section">
          <Typography.Title level={3}>
            {isZh ? '4. 数据保留' : '4. Data Retention'}
          </Typography.Title>
          <Typography.Paragraph>
            {isZh
              ? '作业提交数据将根据系统配置的保留期限进行存储。默认保留期限为 7 天，期满后数据可能被自动删除。管理员可以调整保留期限设置�?
              : 'Homework submission data is stored according to the system\'s configured retention period. The default retention period is 7 days, after which data may be automatically deleted. Administrators can adjust the retention period settings.'}
          </Typography.Paragraph>
        </section>

        <section className="apple-legal-section">
          <Typography.Title level={3}>
            {isZh ? '5. 第三方服�? : '5. Third-Party Services'}
          </Typography.Title>
          <Typography.Paragraph>
            {isZh
              ? '本服务使用以下第三方服务处理您的数据�?
              : 'This service uses the following third-party services to process your data:'}
          </Typography.Paragraph>
          <ul className="apple-legal-list">
            <li>
              <strong>百度 OCR</strong>
              {isZh
                ? '：用于手写文字识别，处理上传的作业图�?
                : ': Used for handwriting recognition, processing uploaded homework images'}
            </li>
            <li>
              <strong>DeepSeek LLM</strong>
              {isZh
                ? '：用�?AI 批改，分析作文内容并生成反馈'
                : ': Used for AI grading, analyzing essay content and generating feedback'}
            </li>
          </ul>
          <Typography.Paragraph>
            {isZh
              ? '这些服务提供商将按照各自的隐私政策处理您的数据。我们已与这些服务提供商签订数据处理协议，确保您的数据得到妥善保护�?
              : 'These service providers process your data according to their respective privacy policies. We have entered into data processing agreements with these providers to ensure your data is properly protected.'}
          </Typography.Paragraph>
        </section>

        <section className="apple-legal-section">
          <Typography.Title level={3}>
            {isZh ? '6. 您的权利' : '6. Your Rights'}
          </Typography.Title>
          <Typography.Paragraph>
            {isZh ? '您对您的个人数据享有以下权利�? : 'You have the following rights regarding your personal data:'}
          </Typography.Paragraph>
          <ul className="apple-legal-list">
            <li>
              <strong>{isZh ? '访问�? : 'Right to Access'}</strong>
              {isZh ? '：您可以查看自己的作业数据和批改记录' : ': You can view your homework data and grading records'}
            </li>
            <li>
              <strong>{isZh ? '更正�? : 'Right to Rectification'}</strong>
              {isZh ? '：您可以请求更正不准确的个人信息' : ': You can request correction of inaccurate personal information'}
            </li>
            <li>
              <strong>{isZh ? '删除�? : 'Right to Deletion'}</strong>
              {isZh ? '：您可以请求删除您的个人数据' : ': You can request deletion of your personal data'}
            </li>
            <li>
              <strong>{isZh ? '导出�? : 'Right to Export'}</strong>
              {isZh ? '：您可以导出自己的作业数�? : ': You can export your homework data'}
            </li>
          </ul>
          <Typography.Paragraph>
            {isZh
              ? '如需行使上述权利，请联系您的管理员或通过平台支持渠道提出请求�?
              : 'To exercise these rights, please contact your administrator or submit a request through the platform\'s support channels.'}
          </Typography.Paragraph>
        </section>

        <section className="apple-legal-section">
          <Typography.Title level={3}>
            {isZh ? '7. 儿童隐私保护' : '7. Children\'s Privacy'}
          </Typography.Title>
          <Typography.Paragraph>
            {isZh
              ? '本服务面向教育机构使用。如果您未满 18 岁，请在家长或监护人的指导下使用本服务，并在他们的同意下阅读本隐私政策。我们不会故意收集未�?14 岁儿童的个人信息，除非获得其家长或监护人的同意�?
              : 'This service is intended for use by educational institutions. If you are under 18, please use this service under the guidance of a parent or guardian, and read this Privacy Policy with their consent. We do not knowingly collect personal information from children under 14 without parental or guardian consent.'}
          </Typography.Paragraph>
        </section>

        <section className="apple-legal-section">
          <Typography.Title level={3}>
            {isZh ? '8. Cookie 和本地存�? : '8. Cookies and Local Storage'}
          </Typography.Title>
          <Typography.Paragraph>
            {isZh
              ? '本服务使用以下本地存储技术：'
              : 'This service uses the following local storage technologies:'}
          </Typography.Paragraph>
          <ul className="apple-legal-list">
            <li>
              <strong>LocalStorage</strong>
              {isZh ? '：存储登录状态和用户偏好设置' : ': Stores login status and user preferences'}
            </li>
            <li>
              <strong>SessionStorage</strong>
              {isZh ? '：存储临时会话数�? : ': Stores temporary session data'}
            </li>
          </ul>
          <Typography.Paragraph>
            {isZh
              ? '您可以通过浏览器设置清除这些数据，但可能会影响服务的正常使用�?
              : 'You can clear this data through browser settings, but it may affect the normal use of the service.'}
          </Typography.Paragraph>
        </section>

        <section className="apple-legal-section">
          <Typography.Title level={3}>
            {isZh ? '9. 政策更新' : '9. Policy Updates'}
          </Typography.Title>
          <Typography.Paragraph>
            {isZh
              ? '我们可能会不时更新本隐私政策。更新后的政策将在本页面公布，重大变更将通过系统通知告知您。继续使用本服务即表示您接受更新后的隐私政策�?
              : 'We may update this Privacy Policy from time to time. Updated policies will be published on this page, and significant changes will be notified through system notifications. Continued use of the Service constitutes acceptance of the updated Privacy Policy.'}
          </Typography.Paragraph>
        </section>

        <section className="apple-legal-section">
          <Typography.Title level={3}>
            {isZh ? '10. 联系我们' : '10. Contact Us'}
          </Typography.Title>
          <Typography.Paragraph>
            {isZh
              ? '如有关于本隐私政策的疑问或需要行使您的数据权利，请通过以下方式联系我们�?
              : 'If you have questions about this Privacy Policy or need to exercise your data rights, please contact us through:'}
          </Typography.Paragraph>
          <ul className="apple-legal-list">
            <li>{isZh ? '联系您所在学校的管理�? : 'Contact your school administrator'}</li>
            <li>{isZh ? '通过平台内的反馈功能' : 'Through the platform\'s feedback function'}</li>
          </ul>
        </section>

        <Divider />

        <div className="apple-legal-footer">
          <Button type="link" onClick={() => navigate('/terms')}>
            {isZh ? '查看服务条款' : 'View Terms of Service'}
          </Button>
          <Button type="primary" onClick={() => navigate('/login')}>
            {isZh ? '返回登录' : 'Back to Login'}
          </Button>
        </div>
      </main>
    </div>
  );
};
