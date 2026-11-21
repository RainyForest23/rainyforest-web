// 언어와 주소를 다루는 함수들.
// 영어는 접두어가 없고(/cv/), 한국어는 /ko가 붙는다(/ko/cv/).

export type Locale = 'en' | 'ko'

export const LOCALES: readonly Locale[] = ['en', 'ko']
export const DEFAULT_LOCALE: Locale = 'en'

/** 언어 없는 경로('/cv/')를 그 언어의 주소로 바꾼다. */
export function localePath(locale: Locale, path: string): string {
  if (!path.startsWith('/') || !path.endsWith('/')) {
    throw new Error(`path must start and end with "/": ${path}`)
  }
  return locale === DEFAULT_LOCALE ? path : `/${locale}${path}`
}

/** 주소('/ko/cv/')를 언어와 언어 없는 경로로 나눈다. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue
    const prefix = `/${locale}/`
    // '/korea-notes/'는 '/ko/'로 시작하지 않으므로 영어 경로로 남는다.
    if (pathname.startsWith(prefix)) {
      return { locale, path: pathname.slice(prefix.length - 1) }
    }
  }
  return { locale: DEFAULT_LOCALE, path: pathname }
}

/** 같은 페이지의 언어별 주소. hreflang 링크와 언어 전환 버튼이 쓴다. */
export function alternates(path: string): { locale: Locale; href: string }[] {
  return LOCALES.map((locale) => ({ locale, href: localePath(locale, path) }))
}
