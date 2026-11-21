# 01. TypeScript 첫 연습: 날짜 표시 함수

**직접 쓸 파일:** `src/lib/format.ts` (함수 2개와 도우미 1개)
**통과시킬 테스트:** `src/lib/format.test.ts` (11개)
**예상 시간:** 1~2시간

이 함수들은 CV의 근무 기간, 블로그 글의 날짜, 나중에 타임라인의 막대 라벨에 쓰인다. 지금은 CV와 블로그 페이지가 이 함수를 부르다가 `TODO` 오류로 멈춘다. 테스트가 전부 통과하면 사이트가 빌드된다.

## 실행 방법

```bash
npx vitest src/lib/format.test.ts
```

파일을 저장할 때마다 테스트가 다시 돈다. 처음에는 11개가 전부 빨강이다. 하나씩 초록으로 바꾸면 된다. 끝낼 때는 `q`.

## 알아야 할 것 다섯 가지

### 1. 타입은 "이 값이 어떤 모양인지"를 적어 둔 것

```ts
function double(n: number): number {
  return n * 2
}
double('3') // 실행하기 전에 편집기가 빨간 줄로 알려 준다
```

`n: number`는 "n은 숫자"라는 뜻이고, 괄호 뒤의 `: number`는 "돌려주는 값도 숫자"라는 뜻이다. Python의 타입 힌트와 비슷하지만, TypeScript는 틀리면 빌드(`npm run typecheck`)가 실패한다.

### 2. `interface`와 `?`

```ts
interface Period {
  start: string
  end?: string          // ?가 붙으면 없어도 된다
  approximate?: boolean
}
```

`period.end`의 타입은 `string | undefined`다. 그래서 그냥 쓰면 TypeScript가 막는다. 먼저 있는지 확인해야 한다.

```ts
if (period.end) {
  // 이 안에서는 period.end가 string이라고 TypeScript가 안다
}
```

### 3. 유니언 타입: 정해진 값 중 하나

```ts
type Locale = 'en' | 'ko'
```

`Locale`은 문자열 `'en'` 아니면 `'ko'`만 될 수 있다. `'kr'`을 넣으면 오류다. 언어에 따라 갈라질 때는 이렇게 쓴다.

```ts
return locale === 'ko' ? '현재' : 'Present'
```

### 4. 문자열 나누기와 숫자로 바꾸기

```ts
'2026-05-06'.split('-')              // ['2026', '05', '06']
'2026-05-06'.split('-').map(Number)  // [2026, 5, 6]
const [year, month, day] = '2026-05-06'.split('-').map(Number)
'2026'.split('-')                    // ['2026']  ← month는 undefined가 된다
```

마지막 줄이 중요하다. `'YYYY'`만 들어오면 `month`가 없다. "달이 있는가"를 이것으로 구분할 수 있다.

문자열 안에 값을 넣을 때는 백틱을 쓴다 (Python의 f-string과 같다).

```ts
`${year}년 ${month}월`   // '2026년 5월'
```

배열은 0부터 센다. `MONTHS[0]`이 `'Jan'`이므로 5월은 `MONTHS[5 - 1]`이다.

### 5. `new Date('2026-05-06')`를 쓰지 않는 이유

JavaScript의 `new Date('2026-05-06')`는 이 날짜를 **UTC 자정**으로 읽는다. 그걸 미국 시간대에서 꺼내 보면 5월 5일 저녁이 된다. 빌드하는 컴퓨터의 시간대에 따라 날짜가 하루 밀리는 것이다. 이전 사이트에서 실제로 겪은 문제다.

우리가 받는 값은 이미 `'2026-05-06'` 같은 문자열이니, `Date`로 바꾸지 않고 4번처럼 직접 나눠 읽으면 시간대와 상관이 없다.

## 권하는 순서

1. `formatDate`의 영어 테스트 하나부터. 문자열을 나누고 `MONTHS`에서 달 이름을 꺼낸다.
2. `formatDate`의 한국어 테스트.
3. 도우미 `label`: `'2025-06'` → `'Jun 2025'`, `'2023'` → `'2023'`. `formatPeriod`가 시작과 끝에 각각 쓴다.
4. `formatPeriod`의 `month range`, `year range`.
5. 끝이 없는 경우(`ongoing`)와 `'Present'`가 들어온 경우.
6. 시작과 끝이 같은 경우.
7. 마지막으로 `approximate`.

한 번에 테스트 하나만 초록으로 만든다. 앞에서 통과한 테스트가 다시 빨강이 되면 방금 고친 곳에 원인이 있다.

## 막히면

Claude에게 이렇게 요청한다. 순서대로 조금씩만 받는 것이 공부에 좋다.

1. "힌트 줘": 방향만 알려 준다.
2. "비슷한 예시 보여 줘": 다른 문제를 푼 코드를 보여 준다.
3. "답 보여 줘": 정답 코드. 본 뒤에는 파일을 닫고 직접 다시 써 본다.

## 끝나면

```bash
npm run verify
git add src/lib/format.ts
git commit -m "feat: formatDate and formatPeriod"
```

그다음 Claude에게 리뷰를 요청하고, "`formatPeriod`가 `approximate`를 어떻게 처리하는지"를 한두 문장으로 설명해 본다. 그 설명과 막혔던 곳을 아래에 적어 둔다.

## 배운 것

(구현을 마친 뒤 적는다. 5단계에서 첫 Study 기록이 된다.)
