import { Select } from 'antd';
import { useI18n, type Language } from '../i18n';

const options: Array<{ value: Language; label: string }> = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en-US', label: 'English' },
];

export const LanguageSwitcher = () => {
  const { language, setLanguage, t } = useI18n();

  return (
    <Select
      value={language}
      onChange={(value) => setLanguage(value)}
      options={options}
      size="small"
      style={{ width: 120 }}
      aria-label={t('common.language')}
    />
  );
};
