// 날짜와 기간을 화면에 보여 줄 말로 바꾸는 함수들.
// [직접] 이 파일의 본문은 사이트 주인이 쓴다. 설명: docs/learning/01-typescript-basics.md
import type { Locale } from '../i18n/paths'

/** 기간. start와 end는 'YYYY' 또는 'YYYY-MM'. end가 없으면 지금도 진행 중이다. */
export interface Period {
  start: string
  end?: string
  /** 정확한 시점을 모르는 옛 기록이면 true */
  approximate?: boolean
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * 'YYYY-MM-DD' 날짜 하나를 바꾼다.
 *   formatDate('2026-05-06', 'en') → 'May 6, 2026'
 *   formatDate('2026-05-06', 'ko') → '2026년 5월 6일'
 *
 * TODO
 *  1. iso를 '-'로 나누고 숫자로 바꿔 year, month, day를 얻는다.
 *  2. locale이 'ko'면 한국어 모양으로, 아니면 영어 모양으로 돌려준다.
 *     영어 달 이름은 MONTHS에서 꺼낸다 (배열은 0부터 센다).
 *  new Date(iso)는 쓰지 않는다 (노트의 5번).
 */
export function formatDate(iso: string, locale: Locale): string {
  throw new Error('TODO: formatDate')
}

/**
 * 'YYYY' 또는 'YYYY-MM' 하나를 바꾼다. formatPeriod가 시작과 끝에 각각 쓴다.
 *   label('2025-06', 'en') → 'Jun 2025'      label('2025-06', 'ko') → '2025년 6월'
 *   label('2023', 'en')    → '2023'          label('2023', 'ko')    → '2023'
 *
 * TODO
 *  1. value를 '-'로 나눈다. 달이 없으면 (undefined) 연도만 돌려준다.
 *  2. 달이 있으면 locale에 맞는 모양으로 돌려준다.
 */
function label(value: string, locale: Locale): string {
  throw new Error('TODO: label')
}

/** 기간의 시작과 끝 사이에 넣는 줄표. 하이픈(-)이 아니라 엔 대시(–)다. */
const DASH = ' – '

/**
 * 기간을 바꾼다.
 *   { start: '2025-06', end: '2026-02' }               → 'Jun 2025 – Feb 2026'
 *   { start: '2026-06' }                               → 'Jun 2026 – Present' / '2026년 6월 – 현재'
 *   { start: '2025', end: '2025' }                     → '2025'
 *   { start: '2023', end: '2025', approximate: true }  → 'c. 2023 – 2025' / '2023 – 2025 (대략)'
 *
 * 가운데 줄표는 위의 DASH를 쓴다.
 *
 * TODO
 *  1. 시작을 label로 바꾼다.
 *  2. 끝이 없거나 'Present'면 끝은 "지금"이다 (en 'Present', ko '현재').
 *     아니면 끝도 label로 바꾼다.
 *  3. 시작과 끝이 같은 말이면 하나만 쓴다. 다르면 `${시작}${DASH}${끝}`.
 *  4. period.approximate가 true면 "대략" 표시를 붙인다.
 *     영어는 앞에 'c. ', 한국어는 뒤에 ' (대략)'.
 */
export function formatPeriod(period: Period, locale: Locale): string {
  throw new Error('TODO: formatPeriod')
}
