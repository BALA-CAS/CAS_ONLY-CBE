import type { Config } from '@netlify/functions'
import {
  readCachedBloggerPosts,
  refreshBloggerPosts,
  type BloggerFeedCache,
} from '../lib/blogger-feed.mts'

const EMPTY_CACHE: BloggerFeedCache = { fetchedAt: '', posts: [] }

export default async () => {
  let cache = await readCachedBloggerPosts()

  if (!cache) {
    try {
      cache = await refreshBloggerPosts()
    } catch (error) {
      console.error('Blogger feed unavailable and no cache exists', error)
    }
  }

  return Response.json(cache ?? EMPTY_CACHE, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}

export const config: Config = {
  path: '/api/blog-posts',
  method: 'GET',
}
