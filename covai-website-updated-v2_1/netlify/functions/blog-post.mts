import type { Config, Context } from '@netlify/functions'
import {
  refreshBloggerPosts,
  readCachedBloggerPosts,
  RESERVED_SLUGS,
  type BloggerPost,
} from '../lib/blogger-feed.mts'

const SITE_URL = 'https://covaiaccountingservices.in'

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    }
    return entities[character]
  })
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata',
  }).format(new Date(value))
}

// Header, nav, and footer copied verbatim from the site's static templates
// so a dynamically rendered post page is visually indistinguishable from a
// pre-built one.
const HEAD_TOP = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">`

const HEADER_NAV = `<body>
<a href="#main-content" class="skip-link">Skip to content</a>

  <div class="topbar">
    <div class="container">
      <span class="tb-item"><svg class="icon icon-xs" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 38s12-10.5 12-20a12 12 0 1 0-24 0c0 9.5 12 20 12 20z"/><circle cx="20" cy="18" r="4.5"/></svg> Vadavalli, Coimbatore – 641041</span>
      <span class="tb-item"><a href="tel:+919095723458"><svg class="icon icon-xs" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6h6l3 8-4 3a17 17 0 0 0 9 9l3-4 8 3v6a3 3 0 0 1-3 3C17 34 6 23 6 9a3 3 0 0 1 3-3z"/></svg> +91 90957 23458</a> &nbsp;&middot;&nbsp; <a href="mailto:admin@covaiaccountingservices.in">admin@covaiaccountingservices.in</a> &nbsp;&middot;&nbsp; Mon – Sat, 10:00 AM – 7:00 PM</span>
    </div>
  </div>

  <header class="site-header">
    <div class="container nav-wrap">
      <a href="/" class="brand">
        <img src="/assets/images/logo.png" alt="Covai Accounting Services logo" width="42" height="42">
        <span>Covai Accounting Services</span>
      </a>
      <nav class="main-nav" aria-label="Primary">
        <button class="nav-toggle" aria-label="Toggle menu" aria-expanded="false">☰</button>
        <ul>
          <li><a class="nav-link" href="/" aria-current="false">Home</a></li>
          <li class="has-mega">
            <a class="nav-link" href="/services/">Services</a>
            <div class="mega-panel">
              <a href="/services/gst-advisory-compliance/">GST Advisory &amp; Compliance</a>
<a href="/services/direct-tax-income-tax-advisory/">Direct Tax &amp; Income Tax Advisory</a>
<a href="/services/accounting-financial-reporting/">Accounting &amp; Financial Reporting</a>
<a href="/services/payroll-labour-law-hr-compliance/">Payroll, Labour Law &amp; Statutory HR Compliance</a>
<a href="/services/business-incorporation-corporate-compliance/">Business Incorporation &amp; Corporate Compliance</a>
<a href="/services/msme-trade-digital-certification/">MSME, Trade &amp; Digital Certification Services</a>
              <div class="mega-foot"><a href="/services/"><strong>View all 19 services →</strong></a></div>
            </div>
          </li>
          <li class="has-mega">
            <a class="nav-link" href="/areas/">Areas We Serve</a>
            <div class="mega-panel">
              <a href="/areas/rs-puram/">RS Puram</a>
<a href="/areas/gandhipuram/">Gandhipuram</a>
<a href="/areas/peelamedu/">Peelamedu</a>
<a href="/areas/saibaba-colony/">Saibaba Colony</a>
<a href="/areas/ramanathapuram/">Ramanathapuram</a>
<a href="/areas/singanallur/">Singanallur</a>
<a href="/areas/saravanampatti/">Saravanampatti</a>
<a href="/areas/vadavalli/">Vadavalli</a>
<a href="/areas/ganapathy/">Ganapathy</a>
<a href="/areas/thudiyalur/">Thudiyalur</a>
              <div class="mega-foot"><a href="/areas/"><strong>View all Coimbatore areas →</strong></a></div>
            </div>
          </li>
          <li><a class="nav-link" href="/about/">About</a></li>
          <li><a class="nav-link" href="/blog/">Blog</a></li>
          <li><a class="nav-link cta-btn" href="/contact/">Contact Us</a></li>
        </ul>
      </nav>
    </div>
  </header>`

const FOOTER = `  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <div class="brand" style="margin-bottom:14px;">
            <img src="/assets/images/logo.png" alt="Covai Accounting Services logo" width="38" height="38">
            <span>Covai Accounting Services</span>
          </div>
          <p style="max-width:280px;">GST Practitioner (Enrolment No. 331800001760GPU) serving Coimbatore since 2012. 4.9★ rated on Google.</p>
          <p class="mono" style="font-size:.82rem;">352, Mullai Nagar, Opp. Vallalar Hospital, Maruthamalai Main Road, Vadavalli, Coimbatore – 641041</p>
        </div>
        <div>
          <h4>Practice Areas</h4>
          <ul><li><a href="/services/gst-advisory-compliance/">GST Advisory &amp; Compliance</a></li><li><a href="/services/direct-tax-income-tax-advisory/">Direct Tax &amp; Income Tax Advisory</a></li><li><a href="/services/accounting-financial-reporting/">Accounting &amp; Financial Reporting</a></li><li><a href="/services/payroll-labour-law-hr-compliance/">Payroll, Labour Law &amp; Statutory HR Compliance</a></li><li><a href="/services/business-incorporation-corporate-compliance/">Business Incorporation &amp; Corporate Compliance</a></li><li><a href="/services/msme-trade-digital-certification/">MSME, Trade &amp; Digital Certification Services</a></li></ul>
        </div>
        <div>
          <h4>Coimbatore Areas</h4>
          <ul><li><a href="/areas/rs-puram/">RS Puram</a></li><li><a href="/areas/gandhipuram/">Gandhipuram</a></li><li><a href="/areas/peelamedu/">Peelamedu</a></li><li><a href="/areas/saibaba-colony/">Saibaba Colony</a></li><li><a href="/areas/ramanathapuram/">Ramanathapuram</a></li><li><a href="/areas/singanallur/">Singanallur</a></li><li><a href="/areas/saravanampatti/">Saravanampatti</a></li><li><a href="/areas/vadavalli/">Vadavalli</a></li><li><a href="/areas/ganapathy/">Ganapathy</a></li><li><a href="/areas/thudiyalur/">Thudiyalur</a></li><li><a href="/areas/podanur/">Podanur</a></li><li><a href="/areas/sulur/">Sulur</a></li></ul>
          <p style="margin-top:10px;"><a href="/areas/">View all areas →</a></p>
        </div>
        <div>
          <h4>Company</h4>
          <ul>
            <li><a href="/about/">About Us</a></li>
            <li><a href="/blog/">Blog</a></li>
            <li><a href="/contact/">Contact</a></li>
            <li><a href="/sitemap-page/">Sitemap</a></li>
            <li><a href="/privacy-policy/">Privacy Policy</a></li>
            <li><a href="/terms-of-service/">Terms of Service</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>&copy; 2026 Covai Accounting Services. All rights reserved.</span>
        <span>Coimbatore, Tamil Nadu, India &middot; GST Practitioner Enrolment No. 331800001760GPU</span>
      </div>
    </div>
  </footer>
<a class="wa-float" href="https://wa.me/919095723458?text=Hi%2C%20I%27d%20like%20to%20know%20more%20about%20your%20services" aria-label="Chat on WhatsApp" target="_blank" rel="noopener">
    <svg viewBox="0 0 32 32" width="28" height="28" fill="#fff" aria-hidden="true"><path d="M16 3C9 3 3.3 8.6 3.3 15.6c0 2.5.7 4.9 2 7L3 29l6.6-2.2c2 1.1 4.2 1.7 6.4 1.7 7 0 12.7-5.6 12.7-12.6C28.7 8.6 23 3 16 3zm0 22.9c-2 0-3.9-.5-5.6-1.5l-.4-.2-4 1.3 1.3-3.9-.3-.4a10.3 10.3 0 0 1-1.7-5.6C5.3 9.7 10.1 5 16 5s10.7 4.7 10.7 10.6S21.9 25.9 16 25.9zm5.8-7.9c-.3-.2-1.9-.9-2.1-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.7 8.7 0 0 1-2.5-1.6 9.4 9.4 0 0 1-1.7-2.2c-.2-.3 0-.5.1-.6l.4-.5.3-.4a.6.6 0 0 0 0-.5c-.1-.2-.7-1.7-1-2.3-.2-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.8.4 3.5 3.5 0 0 0-1.1 2.6 6.1 6.1 0 0 0 1.3 3.2 13.9 13.9 0 0 0 5.4 4.8c.7.3 1.3.5 1.8.6a4.3 4.3 0 0 0 2-.1 3.2 3.2 0 0 0 2.1-1.5 2.6 2.6 0 0 0 .2-1.5c-.1-.2-.3-.3-.6-.4z"/></svg>
  </a>
<script src="/assets/js/main.js"></script>
</body>
</html>`

function renderPostPage(post: BloggerPost): string {
  const canonicalUrl = `${SITE_URL}/blog/${post.slug}/`
  const title = escapeHtml(post.title)
  const description = escapeHtml(post.excerpt.slice(0, 300))
  const dateLabel = escapeHtml(formatDate(post.published))

  const head = `${HEAD_TOP}
<title>${title} | Covai Accounting Services Blog</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonicalUrl}">
<link rel="icon" href="/assets/images/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/images/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/assets/images/favicon-16x16.png">
<link rel="apple-touch-icon" href="/assets/images/apple-touch-icon.png">
<meta name="geo.region" content="IN-TN">
<meta name="geo.placename" content="Coimbatore">
<meta property="og:type" content="article">
<meta property="og:title" content="${title} | Covai Accounting Services Blog">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:site_name" content="Covai Accounting Services">
<meta property="og:image" content="${SITE_URL}/assets/images/logo.png">
<meta property="og:locale" content="en_IN">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title} | Covai Accounting Services Blog">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${SITE_URL}/assets/images/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/style.css">
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog/` },
      { '@type': 'ListItem', position: 3, name: post.title, item: canonicalUrl },
    ],
  })}</script>
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.published,
    author: { '@type': 'Organization', name: post.author || 'Covai Accounting Services' },
    publisher: {
      '@type': 'Organization',
      name: 'Covai Accounting Services',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/images/logo.png` },
    },
    mainEntityOfPage: canonicalUrl,
    // The same article also exists on our Blogspot account; sameAs
    // records that relationship without weakening this page's own
    // canonical status.
    sameAs: [post.url],
  })}</script>
</head>`

  const body = `${HEADER_NAV}
<nav class="breadcrumbs" aria-label="Breadcrumb"><div class="container"><ol><li><a href="/">Home</a></li><li><a href="/blog/">Blog</a></li><li aria-current="page">${title}</li></ol></div></nav>

<main id="main-content">

  <section><div class="container two-col">
    <article>
      <span class="tag">Blog &middot; ${dateLabel}</span>
      <h1 style="margin-top:8px;">${title}</h1>
      ${post.content}
      <p style="margin-top:24px;font-size:.85rem;color:var(--ink-400);">This article is for general information and does not constitute specific tax advice. Provisions and thresholds referenced are subject to change — please confirm current applicability for your situation before acting.</p>
    </article>
    <div class="sidebar-card">
      <h4>Need help with this?</h4>
      <p style="font-size:.9rem;">Talk to our Coimbatore team about your specific situation.</p>
      <a class="btn btn-primary" style="width:100%;justify-content:center;margin-bottom:10px;" href="tel:+919095723458">Call +91 90957 23458</a>
      <a class="btn btn-outline" style="width:100%;justify-content:center;" href="/contact/">Send a message</a>
    </div>
  </div></section>
  <section><div class="container">
    <div class="cta-banner">
      <h2>Ready to talk to a Coimbatore GST practitioner?</h2>
      <p>Call, WhatsApp or drop by our Vadavalli office — we usually respond within the hour.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="tel:+919095723458">Call +91 90957 23458</a>
        <a class="btn btn-ghost" href="/contact/">Send a message</a>
      </div>
    </div>
  </div></section>

</main>

${FOOTER}`

  return `${head}\n${body}`
}

function renderNotFoundPage(): string {
  const head = `${HEAD_TOP}
<title>Post Not Found | Covai Accounting Services Blog</title>
<meta name="robots" content="noindex">
<link rel="stylesheet" href="/assets/css/style.css">
</head>`
  const body = `${HEADER_NAV}
<main id="main-content">
  <section class="page-hero"><div class="container">
    <h1>Post not found</h1>
    <p>That article may have moved. See the latest posts on our <a href="/blog/">blog</a>.</p>
  </div></section>
</main>
${FOOTER}`
  return `${head}\n${body}`
}

export default async (request: Request, context: Context) => {
  const slug = context.params.slug

  if (!slug || RESERVED_SLUGS.has(slug)) {
    return new Response(renderNotFoundPage(), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  let posts: BloggerPost[] = []
  try {
    posts = (await refreshBloggerPosts()).posts
  } catch (error) {
    console.error('Live Blogger feed fetch failed for post page, falling back to cache', error)
    const cached = await readCachedBloggerPosts()
    posts = cached?.posts ?? []
  }

  const post = posts.find((candidate) => candidate.slug === slug)

  if (!post) {
    return new Response(renderNotFoundPage(), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  return new Response(renderPostPage(post), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

export const config: Config = {
  path: '/blog/:slug',
  method: 'GET',
  preferStatic: true,
}
