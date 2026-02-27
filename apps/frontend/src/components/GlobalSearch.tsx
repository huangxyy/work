import { SearchOutlined } from '@ant-design/icons';
import { AutoComplete, Input, Tag } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { globalSearch } from '../api/search';
import { useI18n } from '../i18n';

const TYPE_COLORS: Record<string, string> = {
  homework: 'blue',
  student: 'green',
  class: 'orange',
  submission: 'purple',
};

export const GlobalSearch = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');

  const { data: results = [] } = useQuery({
    queryKey: ['global-search', keyword],
    queryFn: () => globalSearch(keyword),
    enabled: keyword.length >= 2,
    staleTime: 10_000,
  });

  const options = results.map((r) => ({
    value: r.linkTo,
    label: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Tag color={TYPE_COLORS[r.type] || 'default'} className="apple-tag-pill" style={{ margin: 0 }}>
          {r.type}
        </Tag>
        <span>{r.title}</span>
        {r.subtitle ? (
          <span style={{ color: 'var(--apple-text-muted)', fontSize: 12 }}>{r.subtitle}</span>
        ) : null}
      </div>
    ),
  }));

  return (
    <AutoComplete
      className="apple-search"
      options={options}
      onSearch={setKeyword}
      onSelect={(value) => {
        navigate(value);
        setKeyword('');
      }}
    >
      <Input
        prefix={<SearchOutlined />}
        placeholder={t('search.placeholder')}
        allowClear
        size="middle"
      />
    </AutoComplete>
  );
};
