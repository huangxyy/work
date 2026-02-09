import { api } from './client';

export const fetchPublicOverview = async (days = 7) => {
  const response = await api.get('/public/overview', { params: { days } });
  return response.data as {
    days: number;
    homeworks: number;
    submissions: number;
    completionRate: number;
    updatedAt: string;
  };
};

export type PublicLandingPayload = {
  version: number;
  generatedAt: string;
  ttlSeconds: number;
  theme: {
    background: string;
    surface: string;
    surfaceStrong: string;
    text: string;
    muted: string;
    border: string;
    accent: string;
    accentAlt: string;
    glow: string;
    orb1: string;
    orb2: string;
    orb3: string;
    noiseOpacity: number;
  };
  content: {
    zh: {
      brand: { title: string; tagline: string; description: string };
      hero: { headline: string; subhead: string; note: string; primaryCta: string; secondaryCta: string };
      highlights: Array<{ title: string; desc: string }>;
      capabilities: Array<{ title: string; desc: string }>;
      workflow: Array<{ title: string; desc: string }>;
      metrics: Array<{ label: string; value: string; hint?: string }>;
      proof: Array<{ title: string; desc: string }>;
      faq: Array<{ question: string; answer: string }>;
      cta: { title: string; subtitle: string; primary: string; secondary: string };
      consult: {
        title: string;
        subtitle: string;
        fields: { name: string; org: string; contact: string; need: string };
        submit: string;
        success: string;
      };
    };
    en: {
      brand: { title: string; tagline: string; description: string };
      hero: { headline: string; subhead: string; note: string; primaryCta: string; secondaryCta: string };
      highlights: Array<{ title: string; desc: string }>;
      capabilities: Array<{ title: string; desc: string }>;
      workflow: Array<{ title: string; desc: string }>;
      metrics: Array<{ label: string; value: string; hint?: string }>;
      proof: Array<{ title: string; desc: string }>;
      faq: Array<{ question: string; answer: string }>;
      cta: { title: string; subtitle: string; primary: string; secondary: string };
      consult: {
        title: string;
        subtitle: string;
        fields: { name: string; org: string; contact: string; need: string };
        submit: string;
        success: string;
      };
    };
  };
};

export const fetchPublicLanding = async () => {
  const response = await api.get('/public/landing', { timeout: 8000 });
  return response.data as PublicLandingPayload;
};
