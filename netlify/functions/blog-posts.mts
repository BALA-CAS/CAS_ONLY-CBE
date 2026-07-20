import type { Config } from '@netlify/functions'
import {
  refreshBloggerPosts,
  readCachedBloggerPosts,
  type BloggerFeedCache,
} from '../lib/blogger-feed.mts'

const EMPTY_CACHE: BloggerFeedCache = { fetchedAt: '', posts: [] }

export default async () => {
  try {
    // Always fetch live so a newly published Blogspot post shows up on the
    // very next page view, instead of waiting for the scheduled cache refresh.
    // This also refreshes the cache store, which we fall back to below if
    // Blogger is temporarily unreachable.
    const cache = await refreshBloggerPosts()
    return Response.json(cache, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('Live Blogger feed fetch failed, serving last-known-good cache', error)
    const cached = await readCachedBloggerPosts()
    return Response.json(cached ?? EMPTY_CACHE, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}

export const config: Config = {
  path: '/api/blog-posts',
  method: 'GET',
}
