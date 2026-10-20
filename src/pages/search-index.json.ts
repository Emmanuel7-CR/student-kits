import type { APIRoute } from 'astro';
import { tools } from '../data/tools';
import scholarships from '../data/scholarships.json';

export const GET: APIRoute = () => {
  const items = [
    ...tools.map((t) => ({
      title: t.title,
      url: `/tools/${t.slug}/`,
      kind: 'Tool',
      text: `${t.blurb} ${t.keywords.join(' ')}`,
    })),
    ...scholarships.entries.map((s) => ({
      title: s.name,
      url: '/scholarships/',
      kind: s.kind === 'loan' ? 'Loan' : 'Scholarship',
      text: `${s.provider} ${s.level} ${s.who}`,
    })),
    { title: 'All tools', url: '/tools/', kind: 'Page', text: 'tools calculators generators' },
    { title: 'Scholarships and loans', url: '/scholarships/', kind: 'Page', text: 'scholarship loan funding deadline' },
    { title: 'Library', url: '/library/', kind: 'Page', text: 'past questions notes lecture notes project material department level course code' },
    { title: 'Share past questions or notes', url: '/library/contribute/', kind: 'Page', text: 'contribute upload share past questions notes' },
    { title: 'Use without data', url: '/offline/', kind: 'Page', text: 'offline save no data internet airtime install app home screen' },
    { title: 'About and sources', url: '/about/', kind: 'Page', text: 'about sources how we check' },
  ];
  return new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json' } });
};
