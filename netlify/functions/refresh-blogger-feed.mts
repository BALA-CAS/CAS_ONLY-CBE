import type { Config } from '@netlify/functions'
import { refreshBloggerPosts } from '../lib/blogger-feed.mts'

export default async () => {
  try {
    const cache = await refreshBloggerPosts()
    console.log(`Blogger feed cache refreshed with ${cache.posts.length} posts`)
  } catch (error) {
    console.error('Blogger feed cache refresh failed', error)
    throw error
  }
}

export const config: Config = {
  schedule: '0 */6 * * *',
}
