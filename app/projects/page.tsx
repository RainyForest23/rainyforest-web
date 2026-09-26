import type { Metadata } from 'next'
import { ProjectCard } from '@/components/site/project-card'
import { loadProjects } from '@/lib/content/projects'

export const metadata: Metadata = {
  title: 'Projects — Woorim Shin',
  description: 'Selected engineering and research projects.',
}

export default function ProjectsPage() {
  const projects = loadProjects()
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Projects</h1>
      <div className="mt-10">
        {projects.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
    </main>
  )
}
