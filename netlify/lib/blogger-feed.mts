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

function createExcerpt(value: string, maxLength = 190) {
  const paragraphText = Array.from(value.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map((match) => htmlToText(match[1]))
    .find((paragraph) => {
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
  const text = paragraphText ?? htmlToText(value)

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
  const source = entry.summary?.$t ?? entry.content?.$t ?? ''

  if (!title || !published || !url || Number.isNaN(Date.parse(published))) {
    return null
  }

  return {
    title,
    published: new Date(published).toISOString(),
    author: htmlToText(entry.author?.[0]?.name?.$t ?? 'Covai Accounting Services'),
    excerpt: createExcerpt(source),
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
    .filter((post): post is BloggerPost => post !== null)
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
