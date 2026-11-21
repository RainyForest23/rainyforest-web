// 화면에 고정으로 나오는 문구 사전. 글 본문은 여기에 넣지 않는다.
// 키를 추가할 때는 en과 ko에 모두 넣는다 (ui.test.ts가 확인한다).
import type { Locale } from './paths'

const en = {
  'nav.home': 'Home',
  'nav.cv': 'CV',
  'nav.blog': 'Blog',
  'lang.switch': '한국어',
  'home.comingSoon': 'Timeline coming soon.',
  'cv.download': 'Download PDF',
  'cv.education': 'Education',
  'cv.experience': 'Experience',
  'cv.publications': 'Publications',
  'cv.talks': 'Talks',
  'cv.awards': 'Awards',
  'cv.skills': 'Skills',
  'cv.languages': 'Languages',
  'cv.contentInEnglish': 'The CV is written in English.',
  'blog.title': 'Blog',
  'blog.tags': 'Tags',
  'post.koreanOnly': 'This post is written in Korean. Summary in English:',
  'post.englishOnly': 'This post is written in English only.',
  'post.updated': 'Updated',
  'notFound.title': 'Page not found',
}

export type UiKey = keyof typeof en

const ko: Record<UiKey, string> = {
  'nav.home': '홈',
  'nav.cv': 'CV',
  'nav.blog': '블로그',
  'lang.switch': 'English',
  'home.comingSoon': '타임라인을 준비하고 있습니다.',
  'cv.download': 'PDF 내려받기',
  'cv.education': '학력',
  'cv.experience': '경력',
  'cv.publications': '논문',
  'cv.talks': '발표',
  'cv.awards': '수상',
  'cv.skills': '기술',
  'cv.languages': '언어',
  'cv.contentInEnglish': 'CV 내용은 영어로 되어 있습니다.',
  'blog.title': '블로그',
  'blog.tags': '태그',
  'post.koreanOnly': '이 글은 한국어로만 있습니다.',
  'post.englishOnly': '이 글은 영어로만 있습니다.',
  'post.updated': '수정',
  'notFound.title': '페이지를 찾을 수 없습니다',
}

export const ui: Record<Locale, Record<UiKey, string>> = { en, ko }

export function t(locale: Locale, key: UiKey): string {
  return ui[locale][key]
}
