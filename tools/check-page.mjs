// Validates one page source file without building the site: `node tools/check-page.mjs src/pages/x.html`
// Checks the metadata comment, placeholders, headings, and SEO lengths. Exits 1 on errors.
import { readFileSync } from 'node:fs';

const KNOWN = ['crumbs', 'faq', 'cta', 'flow', 'phone', 'phoneHref', 'address', 'city', 'maps', 'clientArea', 'year'];
const file = process.argv[2];
const src = readFileSync(file, 'utf8');
const errors = [], warnings = [];
const m = src.match(/^<!--(\{[\s\S]*?\})-->\n?/);
if (!m) { console.log('ERROR: file must start with <!--{json metadata}-->'); process.exit(1); }
let meta;
try { meta = JSON.parse(m[1]); } catch (e) { console.log('ERROR: metadata is not valid JSON: ' + e.message); process.exit(1); }
const body = src.slice(m[0].length);
for (const k of ['path', 'title', 'description']) if (!meta[k]) errors.push(`metadata: missing "${k}"`);
if (meta.path && !/^\/([a-z0-9-]+\/)*$/.test(meta.path) && meta.path !== '/404') errors.push('metadata: path must look like /a/b/');
if (meta.title && meta.title.length > 65) warnings.push(`title is ${meta.title.length} chars (aim for <= 60)`);
if (meta.description && (meta.description.length < 110 || meta.description.length > 165)) warnings.push(`description is ${meta.description.length} chars (aim for 120-160)`);
if (meta.faq) {
  if (!Array.isArray(meta.faq) || meta.faq.some((f) => !f.q || !f.a)) errors.push('metadata: faq must be [{"q": "...", "a": "..."}]');
  else { if (!body.includes('{{faq}}')) errors.push('metadata has faq but the body has no {{faq}} placeholder'); meta.faq.forEach((f, i) => { const w = f.a.split(/\s+/).length; if (w < 25 || w > 120) warnings.push(`faq ${i + 1} answer is ${w} words (aim for 35-100)`); }); }
} else if (body.includes('{{faq}}')) errors.push('body has {{faq}} but metadata has no faq');
if (meta.crumbs && !body.includes('{{crumbs}}')) errors.push('metadata has crumbs but the body has no {{crumbs}} placeholder');
for (const [, k] of body.matchAll(/\{\{(\w+)\}\}/g)) if (!KNOWN.includes(k)) errors.push(`unknown placeholder {{${k}}}`);
const h1 = (body.match(/<h1[\s>]/g) || []).length;
if (h1 !== 1) errors.push(`page must have exactly one <h1> (found ${h1})`);
if (/style="/.test(body)) errors.push('inline style="" attributes are blocked by the site CSP; use classes');
if (/<script(?![^>]*application\/ld\+json)/.test(body)) errors.push('inline <script> is blocked by the site CSP');
for (const [, href] of body.matchAll(/href="(\/[^"#]*)"/g)) if (!href.endsWith('/') && !/\.\w+$/.test(href)) warnings.push(`internal link without trailing slash: ${href}`);
const open = (body.match(/<(section|div|ul|ol|li|p|a|details|table|tr|td|th|h[1-6])[\s>]/g) || []).length;
const close = (body.match(/<\/(section|div|ul|ol|li|p|a|details|table|tr|td|th|h[1-6])>/g) || []).length;
if (open !== close) warnings.push(`tag balance looks off: ${open} opening vs ${close} closing tags (section/div/ul/ol/li/p/a/details/table/h*)`);
const words = body.replace(/<[^>]+>/g, ' ').replace(/\{\{\w+\}\}/g, '').split(/\s+/).filter(Boolean).length + (meta.faq || []).reduce((n, f) => n + f.a.split(/\s+/).length, 0);
console.log(`${file}: ${words} words, ${meta.faq ? meta.faq.length : 0} FAQs`);
warnings.forEach((w) => console.log('WARN: ' + w));
errors.forEach((e) => console.log('ERROR: ' + e));
process.exit(errors.length ? 1 : 0);
