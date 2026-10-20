import type { APIRoute } from 'astro';
import { tools } from '../data/tools';

export const GET: APIRoute = ({ site }) => {
  const base = site?.href ?? 'https://freestudentkits.netlify.app/';
  const paths = ['/', '/tools/', ...tools.map((t) => `/tools/${t.slug}/`), '/scholarships/', '/library/', '/library/contribute/', '/about/', '/search/'];
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    paths.map((p) => `  <url><loc>${new URL(p, base).href}</loc></url>`).join('\n') +
    '\n</urlset>\n';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
};
