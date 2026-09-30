const SITE = 'https://www.zander88llc.net';
const DEFAULT_IMAGE = SITE + '/og.jpg';

function escapeAttr(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function absoluteMedia(src) {
  const value = String(src || '').trim();
  if (!value || /[\s<>'"\\]/.test(value) || value.indexOf('..') !== -1) return DEFAULT_IMAGE;
  if (/^https?:\/\//i.test(value)) {
    return value.replace(/w_\d+,h_\d+/g, 'w_1200,h_1200').replace(/,enc_avif/g, '');
  }
  if (/^assets\//i.test(value)) return SITE + '/' + value.replace(/^\/+/, '');
  return DEFAULT_IMAGE;
}

function imageType(src) {
  const value = String(src || '').toLowerCase();
  if (value.indexOf('.png') !== -1) return 'image/png';
  if (value.indexOf('.webp') !== -1) return 'image/webp';
  if (value.indexOf('.gif') !== -1) return 'image/gif';
  return 'image/jpeg';
}

function shareTags(meta) {
  const title = escapeAttr(meta.title || 'Zander88LLC');
  const description = escapeAttr(meta.description || 'Shop style, home, and everyday essentials from Zander88LLC.');
  const url = escapeAttr(meta.url || SITE + '/');
  const image = escapeAttr(absoluteMedia(meta.image));
  const type = escapeAttr(meta.type || 'website');
  const isCard = image.indexOf('/og.jpg') !== -1 || image.indexOf('/assets/og-share.jpg') !== -1;
  const mime = escapeAttr(isCard ? 'image/jpeg' : imageType(image));
  const height = isCard ? '630' : '1200';
  return [
    '<link rel="canonical" href="' + url + '">',
    '<meta property="og:type" content="' + type + '">',
    '<meta property="og:locale" content="en_US">',
    '<meta property="og:site_name" content="Zander88LLC">',
    '<meta property="og:title" content="' + title + '">',
    '<meta property="og:description" content="' + description + '">',
    '<meta property="og:url" content="' + url + '">',
    '<meta property="og:image" content="' + image + '">',
    '<meta property="og:image:secure_url" content="' + image + '">',
    '<meta property="og:image:type" content="' + mime + '">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="' + height + '">',
    '<meta property="og:image:alt" content="' + title + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + title + '">',
    '<meta name="twitter:description" content="' + description + '">',
    '<meta name="twitter:image" content="' + image + '">',
    '<link rel="image_src" href="' + image + '">'
  ].join('\n  ');
}

function injectShareMeta(html, meta) {
  const tags = '  <!-- share-meta -->\n  ' + shareTags(meta) + '\n  <!-- /share-meta -->';
  const marked = html.replace(/<!-- share-meta -->[\s\S]*?<!-- \/share-meta -->/, tags);
  if (marked !== html) return marked;
  return html.replace(/<\/head>/i, tags + '\n</head>');
}

module.exports = {
  SITE: SITE,
  DEFAULT_IMAGE: DEFAULT_IMAGE,
  absoluteMedia: absoluteMedia,
  shareTags: shareTags,
  injectShareMeta: injectShareMeta
};
