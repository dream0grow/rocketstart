// 여러 className 을 조건부로 합칩니다 (shadcn/ui 스타일 헬퍼).
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
