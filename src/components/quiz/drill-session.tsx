"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Lightbulb, Pause, Play, X } from "lucide-react";
import { toast } from "sonner";
import { finishSession, getHint, startSession, submitAnswer } from "@/app/train/actions";
import { Button } from "@/components/ui/button";
import { useLocalFlag } from "@/hooks/use-local-flag";
import { ensureSession } from "@/lib/auth-client";
import { CONDITIONS, EXPOSURES } from "@/lib/deck/config";
import { decodeDeck } from "@/lib/deck/url";
import type { AnswerResult, ClientQuestion, FamilyReveal, PickedSummary, SessionSummary } from "@/lib/quiz/types";
import { ChoiceGrid, type ChoiceStatus } from "./choice-grid";
import { HintPanel } from "./hint-panel";
import { PhotoViewport, type ViewportState } from "./photo-viewport";
import { ProgressTape, type TapeMark } from "./progress-tape";
import { RevealCard } from "./reveal-card";
import { SessionSummaryView } from "./session-summary";

type Phase =
  | { kind: "booting" }
  | { kind: "error"; message: string }
  | { kind: "running" }
  | { kind: "summary"; summary: SessionSummary };

type QState = {
  attempt: 1 | 2;
  statuses: Record<string, ChoiceStatus>;
  hint: { lookFor: string; picked?: PickedSummary } | null;
  hintUsed: boolean;
  result: { outcome: "first" | "second" | "missed"; reveal: FamilyReveal; picked?: PickedSummary } | null;
  shake: number;
};

const freshQ = (): QState => ({ attempt: 1, statuses: {}, hint: null, hintUsed: false, result: null, shake: 0 });
const AUTO_KEY = "tally:auto-advance";

function preload(q?: ClientQuestion) {
  if (!q || typeof window === "undefined") return;
  const img = new Image();
  img.srcset = `${q.image.srcSmall} 800w, ${q.image.src} 1600w`;
  img.sizes = "(max-width: 768px) 100vw, 900px";
  img.src = q.image.src;
}

/** Remounts the drill whenever the deck or run changes (search params alone don't remount a page). */
export function DrillSessionRoute() {
  const params = useSearchParams();
  const key = `${params.get("deck") ?? ""}|${params.get("run") ?? ""}`;
  return <DrillSession key={key} deckParam={params.get("deck")} />;
}

export function DrillSession({ deckParam }: { deckParam: string | null }) {
  const router = useRouter();
  const deck = useMemo(() => decodeDeck(deckParam), [deckParam]);
  const [phase, setPhase] = useState<Phase>({ kind: "booting" });
  const [sessionId, setSessionId] = useState("");
  const [queue, setQueue] = useState<ClientQuestion[]>([]);
  const [marks, setMarks] = useState<TapeMark[]>([]);
  const [index, setIndex] = useState(0);
  const [q, setQ] = useState<QState>(freshQ);
  const [pending, startTransition] = useTransition();
  const [autoAdvance, setAutoAdvance] = useLocalFlag(AUTO_KEY, true);
  const [paused, setPaused] = useState(false);
  const shownAt = useRef<number>(0);
  const [shown, setShown] = useState(false);
  const booted = useRef(false);

  // Boot: ensure a (guest) session, then fetch questions.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    (async () => {
      const ok = await ensureSession();
      if (!ok) return setPhase({ kind: "error", message: "Couldn't start a guest session. Check your connection and try again." });
      const res = await startSession(deck);
      if (!res.ok) {
        return setPhase({
          kind: "error",
          message:
            res.error === "empty-deck"
              ? "No aircraft with photos match this deck. Widen the filters and try again."
              : "Your session expired. Reload the page to continue.",
        });
      }
      setSessionId(res.sessionId);
      setQueue(res.questions);
      setMarks(res.questions.map((_, i) => (i === 0 ? "current" : "pending")));
      preload(res.questions[1]);
      setPhase({ kind: "running" });
    })();
  }, [deck]);

  const current = queue[index];

  const onShown = useCallback(() => {
    shownAt.current = performance.now();
    setShown(true);
  }, []);

  const finish = useCallback(async () => {
    const summary = await finishSession(sessionId);
    if (summary) setPhase({ kind: "summary", summary });
    else router.push("/stats");
  }, [router, sessionId]);

  const next = useCallback(() => {
    setPaused(false);
    if (index + 1 >= queue.length) {
      startTransition(finish);
      return;
    }
    shownAt.current = 0;
    setShown(false);
    setIndex((i) => i + 1);
    setQ(freshQ());
    setMarks((m) => m.map((x, i) => (i === index + 1 ? "current" : x)));
    preload(queue[index + 2]);
  }, [finish, index, queue]);

  const applyResult = useCallback(
    (res: AnswerResult, chosenId: string) => {
      if (res.status === "retry") {
        setQ((s) => ({
          ...s,
          attempt: 2,
          statuses: { ...s.statuses, [res.eliminated]: "eliminated" },
          hint: { lookFor: res.hint.lookFor, picked: res.hint.picked },
          shake: s.shake + 1,
        }));
        return;
      }
      if (res.status === "correct") {
        const outcome = res.attemptNo === 1 && !q.hintUsed ? "first" : "second";
        setQ((s) => ({ ...s, statuses: { ...s.statuses, [chosenId]: "correct" }, result: { outcome, reveal: res.reveal } }));
        setMarks((m) => m.map((x, i) => (i === index ? outcome : x)));
        return;
      }
      // revealed
      setQ((s) => ({
        ...s,
        statuses: { ...s.statuses, [chosenId]: "wrong-final", [res.reveal.id]: "answer" },
        result: { outcome: "missed", reveal: res.reveal, picked: res.picked },
        hint: null,
        shake: s.shake + 1,
      }));
      setMarks((m) => m.map((x, i) => (i === index ? "missed" : x)));
      if (res.requeue) {
        const insertAt = Math.min(index + 4, queue.length);
        setQueue((qs) => [...qs.slice(0, insertAt), res.requeue!, ...qs.slice(insertAt)]);
        setMarks((m) => [...m.slice(0, insertAt), "pending" as TapeMark, ...m.slice(insertAt)]);
      }
    },
    [index, q.hintUsed, queue.length],
  );

  const choose = useCallback(
    (chosenId: string) => {
      if (!current || q.result || pending || !shown) return;
      const latencyMs = shownAt.current ? performance.now() - shownAt.current : 0;
      startTransition(async () => {
        const res = await submitAnswer({ token: current.token, chosenId, attemptNo: q.attempt, latencyMs, hintUsed: q.hintUsed });
        if (res.status === "error") {
          toast.error(res.message === "Invalid question" ? "Session expired — reload to continue." : res.message);
          return;
        }
        applyResult(res, chosenId);
      });
    },
    [applyResult, current, pending, q.attempt, q.hintUsed, q.result, shown],
  );

  const askHint = useCallback(() => {
    if (!current || q.hint || q.result || pending) return;
    startTransition(async () => {
      const h = await getHint(current.token);
      if (h) setQ((s) => ({ ...s, hint: { lookFor: h.lookFor }, hintUsed: true }));
    });
  }, [current, pending, q.hint, q.result]);

  // Auto-advance after a correct answer.
  useEffect(() => {
    if (!q.result || q.result.outcome === "missed" || !autoAdvance || paused) return;
    const t = setTimeout(next, q.result.outcome === "first" ? 2200 : 3200);
    return () => clearTimeout(t);
  }, [autoAdvance, next, paused, q.result]);

  // Keyboard: 1–6 answer, H hint, Enter/Space/→ next, P pause.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase.kind !== "running" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      const n = Number(e.key);
      if (n >= 1 && current && n <= current.options.length && !q.result) {
        const opt = current.options[n - 1];
        if (!q.statuses[opt.id]) choose(opt.id);
      } else if (e.key.toLowerCase() === "h") askHint();
      else if ((e.key === "Enter" || e.key === " " || e.key === "ArrowRight") && q.result) {
        e.preventDefault();
        next();
      } else if (e.key.toLowerCase() === "p" && q.result) setPaused((p) => !p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [askHint, choose, current, next, phase.kind, q.result, q.statuses]);

  if (phase.kind === "summary") return <SessionSummaryView summary={phase.summary} deck={deck} />;

  if (phase.kind === "error") {
    return (
      <div className="mx-auto grid max-w-md flex-1 place-items-center px-4 text-center">
        <div>
          <p className="type-readout text-[var(--caution)]">Can&apos;t start</p>
          <p className="mt-2 text-lg">{phase.message}</p>
          <Button asChild className="mt-6">
            <Link href="/train">Back to deck setup</Link>
          </Button>
        </div>
      </div>
    );
  }

  const viewportState: ViewportState = q.result ? (q.result.outcome === "missed" ? "missed" : "locked") : "live";
  const total = queue.length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-3 pb-6 pt-3 sm:px-4">
      {/* Session bar */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="End session">
          <Link href="/train">
            <X className="size-5" />
          </Link>
        </Button>
        <div className="flex-1">
          {marks.length ? <ProgressTape marks={marks} /> : <div className="h-2 animate-pulse rounded bg-muted" />}
        </div>
        <span className="type-readout w-16 text-right text-muted-foreground">
          {phase.kind === "running" ? `${String(index + 1).padStart(2, "0")}/${String(total).padStart(2, "0")}` : "--/--"}
        </span>
      </div>

      <div className="mt-3 grid flex-1 content-start gap-4 lg:mt-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-6">
        {/* Left: scope */}
        <div className="min-w-0">
          {current ? (
            <PhotoViewport
              key={current.token}
              src={current.image.src}
              srcSmall={current.image.srcSmall}
              width={current.image.width}
              height={current.image.height}
              conditions={current.conditions}
              exposureMs={current.exposureMs}
              state={viewportState}
              revealed={!!q.result}
              onShown={onShown}
              onError={() => {
                toast.error("That photo didn't load — skipping to the next aircraft.");
                next();
              }}
              shakeKey={q.shake}
              readouts={{
                left: current.isNew ? "New contact" : "Review",
                right: `Exp ${EXPOSURES[deck.exposure].label} · ${CONDITIONS[current.conditions].label}`,
              }}
            />
          ) : (
            <div className="chart-grid grid aspect-[16/10] place-items-center rounded-xl border bg-card">
              <p className="type-readout animate-pulse text-muted-foreground">Preparing your deck…</p>
            </div>
          )}
        </div>

        {/* Right: answer / debrief */}
        <div className="flex min-w-0 flex-col gap-4">
          <AnimatePresence mode="wait" initial={false}>
            {q.result ? (
              <motion.div key="result" className="flex flex-col gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <RevealCard
                  reveal={q.result.reveal}
                  outcome={q.result.outcome}
                  picked={q.result.picked}
                  showWeft={q.result.outcome !== "first"}
                  actions={
                    <div className="relative flex items-center gap-2">
                      <Button size="lg" className="relative flex-1 overflow-hidden" onClick={next} disabled={pending} autoFocus>
                        {q.result.outcome !== "missed" && autoAdvance && !paused && (
                          <motion.span
                            aria-hidden
                            className="absolute inset-y-0 left-0 bg-white/15"
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: q.result.outcome === "first" ? 2.2 : 3.2, ease: "linear" }}
                          />
                        )}
                        <span className="relative inline-flex items-center gap-2">
                          {index + 1 >= queue.length ? "Finish session" : "Next aircraft"} <ArrowRight />
                        </span>
                      </Button>
                      {q.result.outcome !== "missed" && autoAdvance && (
                        <Button variant="outline" size="lg" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Resume auto-advance" : "Hold this card"}>
                          {paused ? <Play /> : <Pause />}
                        </Button>
                      )}
                    </div>
                  }
                />
              </motion.div>
            ) : (
              <motion.div key="ask" className="flex flex-col gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="type-readout text-muted-foreground">{q.attempt === 2 ? "Second look" : "Identify"}</p>
                    <h1 className="type-condensed text-2xl sm:text-3xl">What aircraft is this?</h1>
                  </div>
                  <Button variant="outline" size="sm" onClick={askHint} disabled={!current || !!q.hint || pending} aria-keyshortcuts="h">
                    <Lightbulb /> Hint
                  </Button>
                </div>
                <AnimatePresence>{q.hint && <HintPanel lookFor={q.hint.lookFor} picked={q.hint.picked} />}</AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {current && !q.result && (
            <ChoiceGrid key={current.token} options={current.options} statuses={q.statuses} disabled={!!q.result || pending || !shown} onChoose={choose} />
          )}


          <div className="mt-auto hidden items-center justify-between gap-3 pt-2 text-xs text-muted-foreground lg:flex">
            <span className="type-readout">1–{current?.options.length ?? 4} answer · H hint · Enter next · P hold</span>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="accent-[var(--primary)]"
                checked={autoAdvance}
                onChange={(e) => setAutoAdvance(e.target.checked)}
              />
              Auto-advance
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
