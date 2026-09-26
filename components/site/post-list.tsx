import Link from 'next/link'
import type { Post } from '@/lib/content/model'
import { formatDate } from '@/lib/content/posts'

export function PostList({ posts }: { posts: Post[] }) {
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.slug} className="border-t border-line py-5 first:border-t-0 first:pt-0">
          <p className="text-sm text-fg-muted">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            {post.lang === 'ko' ? ' — in Korean' : ''}
          </p>
          <h3 className="mt-1 text-lg font-semibold">
            <Link href={`/blog/${post.slug}/`} className="hover:underline">
              {post.title}
            </Link>
          </h3>
          <p className="mt-1 text-fg-muted">{post.summaryEn}</p>
        </li>
      ))}
    </ul>
  )
}
