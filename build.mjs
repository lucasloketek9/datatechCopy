// Builds the site into public/ from src/. No dependencies: `node build.mjs`.
//
// Each file in src/pages/ starts with a JSON comment holding its metadata, then the page's <main> content:
//   <!--{
//     "path": "/servicios/", "title": "...", "description": "...", "nav": "servicios",
//     "crumbs": [["Inicio", "/"], ["Servicios"]],          breadcrumb trail (HTML + BreadcrumbList)
//     "faq": [{"q": "...", "a": "..."}],                  rendered where the body says {{faq}} (HTML + FAQPage)
//     "faqTitle": "...", "faqMist": true,                 optional heading and tinted background for that FAQ block
//     "pageType": "AboutPage",                            schema.org WebPage subtype (default WebPage)
//     "schema": [{...}]                                   extra JSON-LD nodes for this page
//   }-->
// The shared head, header and footer come from src/partials/ and wrap every page.
// The build also writes sitemap.xml, llms.txt and llms-full.txt.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';

const ROOT = dirname(new URL(import.meta.url).pathname);
const SITE = 'https://www.datatech.com.ar';
const TODAY = new Date().toISOString().slice(0, 10);

// Links that live outside this site. The client area runs on Datatech's existing server.
const CONFIG = {
  clientArea: 'https://www.datatech.com.ar/jornada_de_actualizacion.asp',
  phone: '(54-11) 4374-1002',
  phoneHref: 'tel:+541143741002',
  address: 'Av. Córdoba 1184, 5º piso',
  city: 'C1055AAO · Ciudad Autónoma de Buenos Aires',
  maps: 'https://www.google.com/maps/search/?api=1&query=Av.+C%C3%B3rdoba+1184%2C+C1055AAO+CABA',
  year: '2026',
};

// The organization, described once and referenced from every page's structured data.
const ORG = {
  '@type': 'Corporation',
  '@id': SITE + '/#organizacion',
  name: 'Datatech S.A.',
  legalName: 'Datatech S.A.',
  alternateName: 'Datatech',
  url: SITE + '/',
  logo: { '@type': 'ImageObject', url: SITE + '/apple-touch-icon.png', width: 180, height: 180 },
  image: SITE + '/og.jpg',
  description: 'Empresa argentina de software de gestión para instituciones de salud: hospitales, sanatorios, laboratorios de análisis clínicos, centros de diagnóstico y empresas de medicina prepaga. Con más de 30 años en la industria de la salud.',
  disambiguatingDescription: 'Datatech S.A. es una empresa argentina con sede en Buenos Aires que desarrolla software de gestión para instituciones de salud. No está relacionada con otras empresas llamadas Datatech de otros países o rubros.',
  telephone: '+54 11 4374-1002',
  contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', telephone: '+54 11 4374-1002', areaServed: 'AR', availableLanguage: 'es' },
  address: { '@type': 'PostalAddress', streetAddress: 'Av. Córdoba 1184, 5º piso', postalCode: 'C1055AAO', addressLocality: 'Ciudad Autónoma de Buenos Aires', addressRegion: 'CABA', addressCountry: 'AR' },
  areaServed: { '@type': 'Country', name: 'Argentina' },
  knowsAbout: ['Software de gestión hospitalaria', 'Sistemas para sanatorios', 'Sistemas para laboratorios de análisis clínicos', 'Sistemas para centros de diagnóstico', 'Sistemas para medicina prepaga', 'Facturación de prestaciones médico-asistenciales', 'Liquidación de honorarios médicos', 'Historia clínica', 'Autorizaciones en línea'],
  hasCertification: { '@type': 'Certification', name: 'ISO 9001', certificationIdentification: '9000-2878', issuedBy: { '@type': 'Organization', name: 'IRAM, Instituto Argentino de Normalización y Certificación', url: 'https://www.iram.org.ar' } },
  sameAs: ['https://www.facebook.com/sistemasdatatech', 'https://www.linkedin.com/company/datatechsa'],
};
const WEBSITE = { '@type': 'WebSite', '@id': SITE + '/#sitio', url: SITE + '/', name: 'Datatech', inLanguage: 'es-AR', publisher: { '@id': ORG['@id'] } };

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const hash = (p) => createHash('sha1').update(readFileSync(join(ROOT, p))).digest('hex').slice(0, 8);
const version = { css: hash('public/assets/site.css'), js: hash('public/assets/site.js') };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const partials = Object.fromEntries(
  readdirSync(join(ROOT, 'src/partials')).map((f) => [f.replace('.html', ''), read(`src/partials/${f}`)])
);

function fill(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
}

function crumbsHtml(crumbs) {
  if (!crumbs) return '';
  const items = crumbs.map(([name, path], i) =>
    i === crumbs.length - 1 || !path ? `<li aria-current="page">${esc(name)}</li>` : `<li><a href="${path}">${esc(name)}</a></li>`);
  return `<ol class="crumbs" aria-label="Ubicación">${items.join('')}</ol>`;
}

function faqHtml(faq, title, mist) {
  if (!faq) return '';
  const items = faq.map((f, i) =>
    `<details class="faq-item"${i === 0 ? ' open' : ''}><summary><h3>${esc(f.q)}</h3></summary><div class="faq-a"><p>${esc(f.a)}</p></div></details>`).join('\n      ');
  return `<section class="section faq-section${mist ? ' section-mist' : ''}" aria-labelledby="faq-title">
  <div class="container faq-grid">
    <div class="section-head"><div><span class="eyebrow">Preguntas frecuentes</span><h2 class="h2" id="faq-title">${title || 'Preguntas <b>frecuentes</b>'}</h2></div></div>
    <div class="faq">
      ${items}
    </div>
  </div>
</section>`;
}

function jsonLd(meta, url) {
  const graph = [ORG, WEBSITE];
  const page = {
    '@type': meta.pageType || 'WebPage', '@id': url + '#pagina', url, name: meta.title, description: meta.description,
    inLanguage: 'es-AR', isPartOf: { '@id': WEBSITE['@id'] }, about: { '@id': ORG['@id'] }, dateModified: TODAY,
    primaryImageOfPage: meta.image ? { '@type': 'ImageObject', url: SITE + meta.image } : undefined,
  };
  if (meta.crumbs) {
    page.breadcrumb = { '@id': url + '#migas' };
    graph.push({
      '@type': 'BreadcrumbList', '@id': url + '#migas',
      itemListElement: meta.crumbs.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + (path || meta.path) })),
    });
  }
  graph.push(page);
  if (meta.faq) {
    graph.push({
      '@type': 'FAQPage', '@id': url + '#preguntas', url, inLanguage: 'es-AR', isPartOf: { '@id': url + '#pagina' },
      mainEntity: meta.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
  }
  if (meta.article) {
    graph.push({
      '@type': 'Article', '@id': url + '#articulo', headline: meta.h1 || meta.title, description: meta.description, inLanguage: 'es-AR',
      mainEntityOfPage: { '@id': url + '#pagina' }, datePublished: meta.article.published, dateModified: meta.article.modified || meta.article.published,
      author: { '@type': 'Organization', name: 'Equipo Datatech', url: SITE + '/empresa/' }, publisher: { '@id': ORG['@id'] }, image: SITE + '/og.jpg',
    });
  }
  for (const node of meta.schema || []) graph.push(node['@type'] === 'Service' || node['@type'] === 'SoftwareApplication' ? { provider: { '@id': ORG['@id'] }, ...node } : node);
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>\n`;
}

// Plain-text version of a page body, for llms-full.txt.
function toText(html) {
  return html
    .replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, '')
    .replace(/<summary>/g, '\n### ').replace(/<\/(h1|h2)>/g, '\n\n').replace(/<h1[^>]*>/g, '\n# ').replace(/<h2[^>]*>/g, '\n## ')
    .replace(/<h3[^>]*>/g, '\n### ').replace(/<\/h3>/g, '\n').replace(/<(li|dt)[^>]*>/g, '\n- ').replace(/<dd[^>]*>/g, ': ')
    .replace(/<\/(p|div|section|ul|ol|dl|details|blockquote)>/g, '\n').replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter((l, i, a) => l || (a[i - 1] && a[i - 1].trim()))
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const pages = readdirSync(join(ROOT, 'src/pages')).filter((f) => f.endsWith('.html'));
const built = [];

for (const file of pages) {
  const src = read(`src/pages/${file}`);
  const m = src.match(/^<!--(\{[\s\S]*?\})-->\n?/);
  if (!m) throw new Error(`${file}: missing metadata comment`);
  const meta = JSON.parse(m[1]);
  const body = src.slice(m[0].length);
  const nav = meta.nav || '';
  const url = SITE + (meta.path === '/404' ? '/404.html' : meta.path);
  const vars = {
    ...CONFIG,
    title: meta.title,
    description: meta.description,
    canonical: url,
    ogImage: SITE + '/og.jpg',
    cssv: version.css,
    jsv: version.js,
    robots: meta.noindex ? 'noindex' : 'index, follow, max-image-preview:large',
    jsonld: meta.noindex ? '' : jsonLd(meta, url),
    flow: partials.flow,
    cta: fill(partials.cta, CONFIG),
    crumbs: crumbsHtml(meta.crumbs),
    faq: faqHtml(meta.faq, meta.faqTitle, meta.faqMist),
  };
  for (const key of ['soluciones', 'servicios', 'casos', 'empresa', 'contacto']) {
    vars[`cur_${key}`] = nav === key ? ' aria-current="page"' : '';
  }
  const main = fill(body, vars);
  if (/\{\{\w+\}\}/.test(main)) throw new Error(`${file}: unfilled placeholder ${main.match(/\{\{\w+\}\}/)[0]}`);
  const html = fill(partials.head, vars) + fill(partials.header, vars) + '<main id="contenido">\n' + main + '</main>\n' + fill(partials.footer, vars);

  const out = meta.path === '/404' ? 'public/404.html' : join('public', meta.path, 'index.html');
  mkdirSync(join(ROOT, dirname(out)), { recursive: true });
  writeFileSync(join(ROOT, out), html);
  if (!meta.noindex) built.push({ meta, url, text: toText(main) });
  console.log('built', out);
}

built.sort((a, b) => (b.meta.priority || 0.7) - (a.meta.priority || 0.7) || a.url.localeCompare(b.url));
writeFileSync(
  join(ROOT, 'public/sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    built.map((p) => `  <url><loc>${p.url}</loc><lastmod>${TODAY}</lastmod><priority>${p.meta.priority || '0.7'}</priority></url>`).join('\n') +
    '\n</urlset>\n'
);

// llms.txt (https://llmstxt.org): a short, link-rich summary for AI assistants; llms-full.txt has every page as text.
const group = (pred) => built.filter(pred).map((p) => `- [${p.meta.title.replace(/ · Datatech$/, '')}](${p.url}): ${p.meta.description}`).join('\n');
const intro = `# Datatech S.A.

> Empresa argentina de software de gestión para instituciones de salud. Con sede en Buenos Aires y más de 30 años en la industria de la salud. Desarrolla sistemas para hospitales y sanatorios, laboratorios de análisis clínicos, centros de diagnóstico y empresas de medicina prepaga, y presta servicios de implementación, capacitación, soporte y desarrollo. Más de 600 establecimientos asistenciales usan sus sistemas. Certificación de calidad ISO 9001 vigente.

No confundir con otras empresas llamadas Datatech de otros países o rubros: esta es Datatech S.A., de Buenos Aires, Argentina, especializada en software para salud.

Contacto: Av. Córdoba 1184, 5º piso (C1055AAO), Ciudad Autónoma de Buenos Aires, Argentina. Teléfono (54-11) 4374-1002. Sitio: ${SITE}/
`;
writeFileSync(join(ROOT, 'public/llms.txt'), `${intro}
## Soluciones

${group((p) => p.meta.path.startsWith('/soluciones/'))}

## Empresa y servicios

${group((p) => !p.meta.path.startsWith('/soluciones/') && !p.meta.path.startsWith('/recursos/') && p.meta.path !== '/')}
${built.some((p) => p.meta.path.startsWith('/recursos/')) ? `\n## Guías\n\n${group((p) => p.meta.path.startsWith('/recursos/'))}\n` : ''}
## Optional

- [Versión completa en texto](${SITE}/llms-full.txt): el contenido de todas las páginas en texto plano.
`);
writeFileSync(join(ROOT, 'public/llms-full.txt'), intro + '\n' + built.map((p) => `\n---\n\nURL: ${p.url}\nTítulo: ${p.meta.title}\nResumen: ${p.meta.description}\n\n${p.text}\n`).join(''));
console.log('built sitemap.xml, llms.txt, llms-full.txt');
