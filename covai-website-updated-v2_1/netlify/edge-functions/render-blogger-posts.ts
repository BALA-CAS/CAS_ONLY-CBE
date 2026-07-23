import type { Config, Context } from '@netlify/edge-functions'

type BloggerPost = {
  title: string
  published: string
  author: string
  excerpt: string
  slug: string
  url: string
}

type BloggerFeedCache = {
  fetchedAt: string
  posts: BloggerPost[]
}

const BLOGGER_HOSTNAME = 'covaiaccountingservices.blogspot.com'
const INSERTION_MARKER = '<!-- BLOGSPOT_POSTS -->'

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    }
    return entities[character]
  })
}

function isValidPost(post: BloggerPost) {
  if (!post.title || !post.excerpt || !post.slug || Number.isNaN(Date.parse(post.published))) return false

  try {
    const url = new URL(post.url)
    return url.protocol === 'https:' && url.hostname === BLOGGER_HOSTNAME
  } catch {
    return false
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value))
}

function renderPost(post: BloggerPost) {
  const href = `/blog/${escapeHtml(post.slug)}/`
  return `<article class="card">
            <span class="tag">Latest Blog &middot; ${escapeHtml(formatDate(post.published))}</span>
            <h3 style="margin-top:8px;"><a href="${href}">${escapeHtml(post.title)}</a></h3>
            <p>${escapeHtml(post.excerpt)}</p>
            <a class="card-link" href="${href}">Read full article →</a>
          </article>`
}

function renderStructuredData(posts: BloggerPost[]) {
  const entries = posts.map((post) => {
    const canonicalUrl = `https://covaiaccountingservices.in/blog/${post.slug}/`
    return {
      '@type': 'BlogPosting',
      headline: post.title,
      datePublished: post.published,
      author: { '@type': 'Person', name: post.author },
      publisher: {
        '@type': 'Organization',
        name: 'Covai Accounting Services',
        logo: { '@type': 'ImageObject', url: 'https://covaiaccountingservices.in/assets/images/logo.png' },
      },
      description: post.excerpt,
      url: canonicalUrl,
      mainEntityOfPage: canonicalUrl,
      sameAs: [post.url],
    }
  })

  const graph = {
    '@context': 'https://schema.org',
    '@graph': entries,
  }

  return `<script type="application/ld+json">${JSON.stringify(graph)}</script>`
}

function renderSection(posts: BloggerPost[]) {
  return `<section class="section-alt" aria-labelledby="latest-blog-heading"><div class="container">
    <div class="section-head">
      <span class="eyebrow">Updated automatically</span>
      <h2 id="latest-blog-heading">Latest from our Blogspot blog</h2>
      <p>Fresh GST, tax and compliance articles from Covai Accounting Services. Full articles open on our external blog.</p>
    </div>
    <div class="grid grid-3">
      ${posts.map(renderPost).join('\n')}
    </div>
  </div></section>
  ${renderStructuredData(posts)}`
}

export default async (request: Request, context: Context) => {
  const upstreamResponse = await context.next()
  if (!upstreamResponse.ok || !upstreamResponse.headers.get('content-type')?.includes('text/html')) {
    return upstreamResponse
  }

  try {
    const feedUrl = new URL('/api/blog-posts', request.url)
    const feedResponse = await fetch(feedUrl, { headers: { Accept: 'application/json' } })
    if (!feedResponse.ok) throw new Error(`Cached feed request failed with status ${feedResponse.status}`)

    const cache = (await feedResponse.json()) as BloggerFeedCache
    const posts = (cache.posts ?? []).filter(isValidPost).slice(0, 6)
    if (posts.length === 0) return upstreamResponse

    const html = await upstreamResponse.text()
    if (!html.includes(INSERTION_MARKER)) return upstreamResponse

    const headers = new Headers(upstreamResponse.headers)
    headers.set('Cache-Control', 'no-store')
    headers.delete('content-length')

    return new Response(html.replace(INSERTION_MARKER, renderSection(posts)), {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    })
  } catch (error) {
    console.error('Blogger posts could not be rendered; serving native posts only', error)
    return upstreamResponse
  }
}

export const config: Config = {
  path: ['/blog', '/blog/'],
  onError: 'bypass',
}
