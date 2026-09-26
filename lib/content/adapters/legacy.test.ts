import { describe, expect, it } from 'vitest'
import { parseLegacyPost } from './legacy'

const raw = `---
title: "EC2 기초 정리"
summary_en: EC2 purchase options and instance families, summarised for the SAA exam.
lang: ko
date: 2026-05-06
updated: "2026-05-20"
tags: [aws, aws-saa, ec2]
---

## 구매 옵션

본문.
`

describe('parseLegacyPost', () => {
  it('takes the slug from the file name', () => {
    expect(parseLegacyPost('saa-ec2-basics.mdx', raw).slug).toBe('saa-ec2-basics')
  })

  it('maps frontmatter to the Post contract', () => {
    const post = parseLegacyPost('saa-ec2-basics.mdx', raw)
    expect(post.title).toBe('EC2 기초 정리')
    expect(post.summaryEn).toBe('EC2 purchase options and instance families, summarised for the SAA exam.')
    expect(post.lang).toBe('ko')
    expect(post.tags).toEqual(['aws', 'aws-saa', 'ec2'])
    expect(post.source).toBe('legacy')
    expect(post.outgoing).toEqual([])
  })

  it('normalises an unquoted YAML date, which gray-matter parses as a Date', () => {
    const post = parseLegacyPost('saa-ec2-basics.mdx', raw)
    expect(post.date).toBe('2026-05-06')
    expect(post.updated).toBe('2026-05-20')
  })

  it('keeps the body without frontmatter', () => {
    const post = parseLegacyPost('saa-ec2-basics.mdx', raw)
    expect(post.body.trim().startsWith('## 구매 옵션')).toBe(true)
  })
})
