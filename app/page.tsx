import Link from 'next/link'
import { PostList } from '@/components/site/post-list'
import { ProjectCard } from '@/components/site/project-card'
import { Section } from '@/components/site/section'
import { loadPosts } from '@/lib/content/posts'
import { loadProjects } from '@/lib/content/projects'
import { loadResume } from '@/lib/cv/resume'

export default function Home() {
  const resume = loadResume()
  const featured = loadProjects().filter((project) => project.featured)
  const recent = loadPosts().slice(0, 5)

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold">{resume.basics.name}</h1>
      <p className="mt-4 text-lg">{resume.basics.summary}</p>
      <p className="mt-4 text-sm text-fg-muted">
        {resume.basics.location?.city}, {resume.basics.location?.region} —{' '}
        <a href={`mailto:${resume.basics.email}`} className="underline">
          {resume.basics.email}
        </a>
        {resume.basics.profiles?.map((profile) => (
          <span key={profile.network}>
            {' — '}
            <a href={profile.url} className="underline">
              {profile.network}
            </a>
          </span>
        ))}
      </p>

      <Section title="Selected work">
        <div>
          {featured.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </div>
        <p className="mt-6 text-sm">
          <Link href="/projects/" className="underline">
            All projects
          </Link>
        </p>
      </Section>

      <Section title="Recent writing">
        <PostList posts={recent} />
        <p className="mt-6 text-sm">
          <Link href="/blog/" className="underline">
            All posts
          </Link>
        </p>
      </Section>
    </main>
  )
}
