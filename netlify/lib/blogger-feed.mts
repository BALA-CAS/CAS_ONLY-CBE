import { getStore } from '@netlify/blobs'

const BLOGGER_FEED_URL = 'https://covaiaccountingservices.blogspot.com/feeds/posts/default'
const BLOGGER_HOSTNAME = 'covaiaccountingservices.blogspot.com'
const CACHE_STORE = 'blogger-feed-cache'
const CACHE_KEY = 'latest-posts'
const MAX_POSTS = 9

export type BloggerPost = {
  title: string
  published: string
  author: string
  excerpt: string
  content: string
  slug: string
  url: string
}

export type BloggerFeedCache = {
  fetchedAt: string
  posts: BloggerPost[]
}

type BloggerEntry = {
  title?: { $t?: string }
  published?: { $t?: string }
  author?: Array<{ name?: { $t?: string } }>
  content?: { $t?: string }
  summary?: { $t?: string }
  link?: Array<{ rel?: string; href?: string }>
}

type BloggerResponse = {
  feed?: {
    entry?: BloggerEntry[]
  }
}

function decodeEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    hellip: '…',
    laquo: '«',
    ldquo: '“',
    lsquo: '‘',
    lt: '<',
    mdash: '—',
    nbsp: ' ',
    ndash: '–',
    quot: '"',
    raquo: '»',
    rdquo: '”',
    rsquo: '’',
  }

  const decoded = value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith('#')) {
      const isHex = code[1]?.toLowerCase() === 'x'
      const numericCode = Number.parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10)
      return Number.isFinite(numericCode) ? String.fromCodePoint(numericCode) : entity
    }

    return namedEntities[code.toLowerCase()] ?? entity
  })

  return decoded === value ? decoded : decodeEntities(decoded)
}

function htmlToText(value: string) {
  return decodeEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

// Allow-list of tags we keep when rendering the full post body on our own
// site. Everything else (script, style, iframe, form, object, embed, etc.)
// is stripped, along with any inline event handlers or javascript: URLs —
// this content originates from our own Blogger account, but we still don't
// trust it as raw HTML since Blogger's editor can embed third-party embeds.
const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li',
  'h2', 'h3', 'h4', 'blockquote', 'img', 'table', 'thead', 'tbody',
  'tr', 'th', 'td', 'hr', 'span', 'div', 'figure', 'figcaption',
])

function sanitizeContent(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<(object|embed|form|input|button|link|meta)\b[^>]*>/gi, '')
    .replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (full, tagName: string, attrs: string) => {
      const tag = tagName.toLowerCase()
      if (!ALLOWED_TAGS.has(tag)) return ''
      const isClosing = full.startsWith('</')
      if (isClosing) return `</${tag}>`

      // Strip every attribute except a small safe set, and reject any
      // javascript: URL or inline event handler in what remains.
      const safeAttrs: string[] = []
      const attrPattern = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)')/g
      let match: RegExpExecArray | null
      while ((match = attrPattern.exec(attrs)) !== null) {
        const name = match[1].toLowerCase()
        const val = match[3] ?? match[4] ?? ''
        if (name.startsWith('on')) continue
        if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(val)) continue
        if (['href', 'src', 'alt', 'title', 'class', 'colspan', 'rowspan'].includes(name)) {
          safeAttrs.push(`${name}="${val.replace(/"/g, '&quot;')}"`)
        }
      }
      // External links open in a new tab; images/links don't need target on other tags.
      if (tag === 'a') safeAttrs.push('target="_blank"', 'rel="noopener nofollow"')
      return `<${tag}${safeAttrs.length ? ' ' + safeAttrs.join(' ') : ''}>`
    })
    .trim()
}

// Defense in depth: even though the Netlify function is configured with
// preferStatic so these pre-existing static pages always win at the routing
// layer, we also refuse to match these slugs here so the dynamic post page
// can never render in place of them under any circumstance.
export const RESERVED_SLUGS = new Set([
  'itr-filing-presumptive-taxation-guide',
  'asmt-10-vs-drc-01-gst-notices-explained',
  'gst-registration-checklist-coimbatore',
])

function getPostSlug(url: string) {
  try {
    const pathname = new URL(url).pathname
    const filename = pathname.split('/').filter(Boolean).pop() ?? ''
    return filename.replace(/\.html?$/i, '')
  } catch {
    return null
  }
}

function createExcerpt(value: string, maxLength = 600) {
  const qualifyingParagraphs = Array.from(value.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map((match) => htmlToText(match[1]))
    .filter((paragraph) => {
      const normalized = paragraph.toLowerCase()
      return (
        paragraph.length >= 80 &&
        !normalized.startsWith('by ') &&
        !normalized.startsWith('last updated') &&
        !normalized.startsWith('home >') &&
        !normalized.includes('meta tags') &&
        !normalized.includes('gst practitioner reg no')
      )
    })

  // Join consecutive qualifying paragraphs (not just the first) so the
  // crawlable preview on our own site carries real substance — several
  // paragraphs of unique text rather than one short snippet — while still
  // stopping well short of the full article, which stays exclusive to the
  // canonical Blogspot post we link out to.
  const text = qualifyingParagraphs.length > 0 ? qualifyingParagraphs.join(' ') : htmlToText(value)

  if (text.length <= maxLength) {
    return text
  }

  const shortened = text.slice(0, maxLength + 1)
  const lastSpace = shortened.lastIndexOf(' ')
  return `${shortened.slice(0, lastSpace > 120 ? lastSpace : maxLength).trim()}…`
}

function getPostUrl(entry: BloggerEntry) {
  const href = entry.link?.find((link) => link.rel === 'alternate')?.href
  if (!href) return null

  try {
    const url = new URL(href)
    if (url.protocol !== 'https:' || url.hostname !== BLOGGER_HOSTNAME) return null
    return url.toString()
  } catch {
    return null
  }
}

function normalizeEntry(entry: BloggerEntry): BloggerPost | null {
  const title = htmlToText(entry.title?.$t ?? '')
  const published = entry.published?.$t ?? ''
  const url = getPostUrl(entry)
  const source = entry.content?.$t ?? entry.summary?.$t ?? ''
  const slug = url ? getPostSlug(url) : null

  if (!title || !published || !url || !slug || Number.isNaN(Date.parse(published))) {
    return null
  }

  return {
    title,
    published: new Date(published).toISOString(),
    author: htmlToText(entry.author?.[0]?.name?.$t ?? 'Covai Accounting Services'),
    excerpt: createExcerpt(source),
    content: sanitizeContent(source),
    slug,
    url,
  }
}

export async function fetchBloggerPosts(): Promise<BloggerFeedCache> {
  const url = new URL(BLOGGER_FEED_URL)
  url.searchParams.set('alt', 'json')
  url.searchParams.set('max-results', String(MAX_POSTS))
  url.searchParams.set('start-index', '1')

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    throw new Error(`Blogger feed request failed with status ${response.status}`)
  }

  const payload = (await response.json()) as BloggerResponse
  const posts = (payload.feed?.entry ?? [])
    .map(normalizeEntry)
    .filter((post): post is BloggerPost => post !== null && !RESERVED_SLUGS.has(post.slug))
    .sort((first, second) => Date.parse(second.published) - Date.parse(first.published))

  return { fetchedAt: new Date().toISOString(), posts }
}

export async function readCachedBloggerPosts() {
  const store = getStore({ name: CACHE_STORE, consistency: 'strong' })
  return store.get(CACHE_KEY, { type: 'json' }) as Promise<BloggerFeedCache | null>
}

export async function refreshBloggerPosts() {
  const cache = await fetchBloggerPosts()
  const store = getStore({ name: CACHE_STORE, consistency: 'strong' })
  await store.setJSON(CACHE_KEY, cache)
  return cache
}
