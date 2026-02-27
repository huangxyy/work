import { Typography } from 'antd';

export const TermsOfServicePage = () => (
  <div className="apple-page-stack" style={{ maxWidth: 800, margin: '40px auto', padding: '0 24px' }}>
    <Typography.Title level={2}>Terms of Service</Typography.Title>
    <Typography.Title level={4}>1. Acceptance of Terms</Typography.Title>
    <Typography.Paragraph>
      By accessing and using Homework AI, you agree to be bound by these Terms of Service. If you do not agree, please do not use our service.
    </Typography.Paragraph>
    <Typography.Title level={4}>2. Service Description</Typography.Title>
    <Typography.Paragraph>
      Homework AI provides AI-powered English essay grading services for educational institutions. Students upload handwritten homework images which are processed through OCR and graded by AI.
    </Typography.Paragraph>
    <Typography.Title level={4}>3. User Accounts</Typography.Title>
    <Typography.Paragraph>
      Users are responsible for maintaining the confidentiality of their account credentials. You must not share your account with others.
    </Typography.Paragraph>
    <Typography.Title level={4}>4. Data Privacy</Typography.Title>
    <Typography.Paragraph>
      We collect and process student homework data solely for grading purposes. Please refer to our Privacy Policy for detailed information about data handling.
    </Typography.Paragraph>
    <Typography.Title level={4}>5. Intellectual Property</Typography.Title>
    <Typography.Paragraph>
      All uploaded homework content remains the property of the students. AI-generated grading results are provided as educational feedback only.
    </Typography.Paragraph>
    <Typography.Title level={4}>6. Limitation of Liability</Typography.Title>
    <Typography.Paragraph>
      AI grading is provided as a supplementary tool and should not be used as the sole basis for academic evaluation. Teachers retain final authority over grades.
    </Typography.Paragraph>
    <Typography.Title level={4}>7. Contact</Typography.Title>
    <Typography.Paragraph>
      For questions about these terms, please contact us through the platform's support channels.
    </Typography.Paragraph>
  </div>
);
