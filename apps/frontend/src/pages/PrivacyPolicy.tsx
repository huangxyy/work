import { Typography } from 'antd';

export const PrivacyPolicyPage = () => (
  <div className="apple-page-stack" style={{ maxWidth: 800, margin: '40px auto', padding: '0 24px' }}>
    <Typography.Title level={2}>Privacy Policy</Typography.Title>
    <Typography.Title level={4}>1. Information We Collect</Typography.Title>
    <Typography.Paragraph>
      We collect account information (name, account ID, email), homework submission images, and grading results.
    </Typography.Paragraph>
    <Typography.Title level={4}>2. How We Use Your Data</Typography.Title>
    <Typography.Paragraph>
      Your data is used to provide grading services, generate performance reports, and improve our AI models. We do not sell your personal data to third parties.
    </Typography.Paragraph>
    <Typography.Title level={4}>3. Data Storage</Typography.Title>
    <Typography.Paragraph>
      All data is stored securely with encryption in transit. Uploaded images and grading data are subject to the configured retention policy.
    </Typography.Paragraph>
    <Typography.Title level={4}>4. Data Retention</Typography.Title>
    <Typography.Paragraph>
      Submission data is retained according to the system's configured retention period. After this period, data may be automatically deleted.
    </Typography.Paragraph>
    <Typography.Title level={4}>5. Third-Party Services</Typography.Title>
    <Typography.Paragraph>
      We use third-party services for OCR (Baidu OCR) and AI grading (DeepSeek LLM). These services process your data according to their respective privacy policies.
    </Typography.Paragraph>
    <Typography.Title level={4}>6. Your Rights</Typography.Title>
    <Typography.Paragraph>
      You have the right to access, correct, or delete your personal data. Contact your administrator or our support team to exercise these rights.
    </Typography.Paragraph>
    <Typography.Title level={4}>7. Contact</Typography.Title>
    <Typography.Paragraph>
      For privacy-related inquiries, please contact us through the platform.
    </Typography.Paragraph>
  </div>
);
