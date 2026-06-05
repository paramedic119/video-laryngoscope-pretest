import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { QUESTIONS, type Question, type Segment } from "@/questions"

type Level = 1 | 2 | 3

const LEVELS: { value: Level; label: string }[] = [
  { value: 1, label: "初級" },
  { value: 2, label: "中級" },
  { value: 3, label: "上級" },
]

function pageLabel(page: string) {
  return /^[0-9]+$/.test(page) ? `P.${page}` : page
}

function Blank({ term, revealAll }: { term: string; revealAll: boolean }) {
  const [revealed, setRevealed] = React.useState(revealAll)

  React.useEffect(() => {
    setRevealed(revealAll)
  }, [revealAll])

  const placeholder = "□".repeat([...term].length)

  return (
    <button
      type="button"
      aria-pressed={revealed}
      aria-label="虫食い。タップで答えを表示"
      onClick={() => setRevealed((v) => !v)}
      className={cn(
        "mx-0.5 inline cursor-pointer rounded-md px-1.5 py-0.5 transition-colors",
        revealed
          ? "bg-primary/10 font-medium text-primary"
          : "bg-muted tracking-[0.08em] text-muted-foreground/40 hover:bg-muted/70"
      )}
    >
      {revealed ? term : placeholder}
    </button>
  )
}

function renderSegment(
  seg: Segment,
  index: number,
  level: Level,
  revealAll: boolean
) {
  if (typeof seg === "string") {
    return <React.Fragment key={index}>{seg}</React.Fragment>
  }
  if (seg.lv <= level) {
    return <Blank key={index} term={seg.t} revealAll={revealAll} />
  }
  return <React.Fragment key={index}>{seg.t}</React.Fragment>
}

function QuestionCard({
  question,
  level,
  revealAll,
}: {
  question: Question
  level: Level
  revealAll: boolean
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary">No.{question.id}</Badge>
          <Badge variant="outline" className="text-muted-foreground">
            記載：{pageLabel(question.page)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-[1.0625rem] leading-[2.1] [overflow-wrap:anywhere]">
          {question.seg.map((seg, i) => renderSegment(seg, i, level, revealAll))}
        </p>
      </CardContent>
    </Card>
  )
}

export function App() {
  const [level, setLevel] = React.useState<Level>(1)
  const [revealAll, setRevealAll] = React.useState(false)

  return (
    <div className="min-h-svh bg-background pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
      <header className="px-5 pt-8 pb-3 text-center">
        <h1 className="text-3xl font-bold">ビデオ喉頭鏡プレテスト</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          虫食い暗記 ・ 全{QUESTIONS.length}問
        </p>
      </header>

      <div className="sticky top-0 z-20 flex flex-col items-center gap-2.5 border-b bg-background/80 px-4 py-2.5 backdrop-blur-md backdrop-saturate-150">
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          value={String(level)}
          onValueChange={(v) => v && setLevel(Number(v) as Level)}
          className="w-full max-w-90"
        >
          {LEVELS.map((l) => (
            <ToggleGroupItem
              key={l.value}
              value={String(l.value)}
              className="flex-1"
            >
              {l.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button
          variant={revealAll ? "outline" : "default"}
          size="sm"
          onClick={() => setRevealAll((v) => !v)}
        >
          {revealAll ? (
            <EyeOff data-icon="inline-start" />
          ) : (
            <Eye data-icon="inline-start" />
          )}
          {revealAll ? "答えを隠す" : "答えを表示"}
        </Button>
      </div>

      <main className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4">
        {QUESTIONS.map((q) => (
          <QuestionCard
            key={q.id}
            question={q}
            level={level}
            revealAll={revealAll}
          />
        ))}
      </main>

      <footer className="mx-auto max-w-3xl px-5 pt-2 text-xs leading-relaxed text-muted-foreground">
        <p className="mb-2">
          グレーの部分をタップすると答えが出ます。もう一度タップで隠せます。
        </p>
        <p className="opacity-85">
          記載ページ：へるす出版「ビデオ喉頭鏡（エアウェイスコープ）気管挿管のポイントとトラブル対策」／救急救命士標準テキスト
          第10版。「プロトコール」＝愛知県救急隊心肺蘇生法プロトコール（令和3年10月11日
          一部改正）。ビデオ喉頭鏡はAWSについての問とする。
        </p>
      </footer>
    </div>
  )
}

export default App
