import { Empty } from 'antd';
import type { ReactNode } from 'react';

type SoftEmptyProps = {
  description?: string;
  imageHeight?: number;
  children?: ReactNode;
};

const emptySvg = encodeURIComponent(`
<svg width="200" height="120" viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="18" y="28" width="164" height="72" rx="16" stroke="#9AA6B2" stroke-width="2" stroke-dasharray="4 6" fill="#F8FAFC" />
  <path d="M38 64H94" stroke="#B0BAC7" stroke-width="2" stroke-linecap="round"/>
  <path d="M38 50H120" stroke="#C0CAD6" stroke-width="2" stroke-linecap="round"/>
  <path d="M38 78H112" stroke="#C0CAD6" stroke-width="2" stroke-linecap="round"/>
  <circle cx="150" cy="58" r="18" fill="#E8EEF6" stroke="#9AA6B2" stroke-width="2" />
  <path d="M142 58H158" stroke="#9AA6B2" stroke-width="2" stroke-linecap="round"/>
  <path d="M150 50V66" stroke="#9AA6B2" stroke-width="2" stroke-linecap="round"/>
</svg>
`);

const image = `data:image/svg+xml;utf8,${emptySvg}`;

export const SoftEmpty = ({ description, imageHeight = 96, children }: SoftEmptyProps) => (
  <Empty className="soft-empty" image={image} styles={{ image: { height: imageHeight } }} description={description}>
    {children}
  </Empty>
);
