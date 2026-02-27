import { Modal, Steps } from 'antd';
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { authStore } from '../api/client';

type OnboardingGuideProps = {
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
};

const STUDENT_STEPS = [
  { titleKey: 'onboarding.student.step1Title', descKey: 'onboarding.student.step1Desc' },
  { titleKey: 'onboarding.student.step2Title', descKey: 'onboarding.student.step2Desc' },
  { titleKey: 'onboarding.student.step3Title', descKey: 'onboarding.student.step3Desc' },
];

const TEACHER_STEPS = [
  { titleKey: 'onboarding.teacher.step1Title', descKey: 'onboarding.teacher.step1Desc' },
  { titleKey: 'onboarding.teacher.step2Title', descKey: 'onboarding.teacher.step2Desc' },
  { titleKey: 'onboarding.teacher.step3Title', descKey: 'onboarding.teacher.step3Desc' },
];

export const OnboardingGuide = ({ role }: OnboardingGuideProps) => {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const user = authStore.getUser();

  useEffect(() => {
    if (!user) return;
    const key = `onboarding_done_${user.id}`;
    if (!localStorage.getItem(key)) {
      setVisible(true);
    }
  }, [user]);

  const handleClose = () => {
    if (user) {
      localStorage.setItem(`onboarding_done_${user.id}`, '1');
    }
    setVisible(false);
  };

  if (role === 'ADMIN') return null;

  const steps = role === 'STUDENT' ? STUDENT_STEPS : TEACHER_STEPS;

  return (
    <Modal
      open={visible}
      title={t('onboarding.welcome')}
      onCancel={handleClose}
      onOk={step < steps.length - 1 ? () => setStep(step + 1) : handleClose}
      okText={step < steps.length - 1 ? t('onboarding.next') : t('onboarding.start')}
      cancelText={t('onboarding.skip')}
      width={520}
    >
      <Steps current={step} direction="vertical" style={{ marginTop: 16 }}>
        {steps.map((s, i) => (
          <Steps.Step
            key={i}
            title={t(s.titleKey)}
            description={i <= step ? t(s.descKey) : undefined}
          />
        ))}
      </Steps>
    </Modal>
  );
};
