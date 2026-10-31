"use client";

import Link from "next/link";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  CALLERS,
  DIMENSION_ORDER,
  PLAYBACK,
  VERDICT_COLOR,
  typeDuration,
  type Caller,
  type DimensionScore,
  type Dimensions,
  type Speaker,
  type Verdict,
} from "@/data/callers.mock";

type Wave = "idle" | "caller" | "bot" | "flat" | "both";

type View = {
  shown: number;
  typing: { index: number; count: number } | null;
  wave: Wave;
  botCollapsed: boolean;
  flash: boolean;
  stamp: boolean;
  patch: boolean;
  cellValues: (number | null)[];
  cellAfter: boolean[];
  overall: number | null;
  rerunning: boolean;
  busy: boolean;
  compared: boolean;
  ready: boolean;
  pass: "before" | "after";
  held: boolean;
  announcement: string;
};

type Action =
  | { type: "reset"; dims: number }
  | { type: "before"; caller: Caller }
  | { type: "after"; caller: Caller }
  | { type: "wave"; wave: Wave }
  | { type: "collapse" }
  | { type: "type"; index: number; count: number }
  | { type: "commit"; index: number; announcement: string }
  | { type: "flash"; on: boolean }
  | { type: "stamp" }
  | { type: "patch" }
  | { type: "cell"; index: number; value: number }
  | { type: "flip"; index: number; value: number }
  | { type: "overall"; value: number }
  | { type: "rerunning"; on: boolean }
  | { type: "busy"; on: boolean }
  | { type: "compared" }
  | { type: "ready" }
  | { type: "held" }
  | { type: "armAfter"; caller: Caller };

function emptyView(dims: number): View {
  return {
    shown: 0,
    typing: null,
    wave: "idle",
    botCollapsed: false,
    flash: false,
    stamp: false,
    patch: false,
    cellValues: Array(dims).fill(null),
    cellAfter: Array(dims).fill(false),
    overall: null,
    rerunning: false,
    busy: false,
    compared: false,
    ready: false,
    pass: "before",
    held: false,
    announcement: "",
  };
}

function finished(caller: Caller, after: boolean): View {
  const dims = dimsFor(caller);
  const source = after ? caller.afterScores : caller.scores;
  const lines = after ? caller.afterTranscript : caller.transcript;
  return {
    shown: lines.length,
    typing: null,
    wave: "idle",
    botCollapsed: !after,
    flash: false,
    stamp: !after,
    patch: true,
    cellValues: dims.map((dim) => readScore(source, dim.key).score),
    cellAfter: dims.map(() => after),
    overall: after ? caller.overallAfter : null,
    rerunning: false,
    busy: false,
    compared: after,
    ready: !after,
    pass: after ? "after" : "before",
    held: after,
    announcement: "",
  };
}

function reducer(state: View, action: Action): View {
  switch (action.type) {
    case "reset":
      return emptyView(action.dims);
    case "before":
      return finished(action.caller, false);
    case "after":
      return finished(action.caller, true);
    case "wave":
      return { ...state, wave: action.wave };
    case "collapse":
      return { ...state, botCollapsed: true, wave: "idle" };
    case "type":
      return { ...state, typing: { index: action.index, count: action.count } };
    case "commit":
      return {
        ...state,
        shown: Math.max(state.shown, action.index + 1),
        typing: state.typing?.index === action.index ? null : state.typing,
        announcement: action.announcement,
      };
    case "flash":
      return { ...state, flash: action.on };
    case "stamp":
      return { ...state, stamp: true };
    case "patch":
      return { ...state, patch: true };
    case "cell": {
      const cellValues = state.cellValues.slice();
      cellValues[action.index] = action.value;
      return { ...state, cellValues };
    }
    case "flip": {
      const cellValues = state.cellValues.slice();
      const cellAfter = state.cellAfter.slice();
      cellValues[action.index] = action.value;
      cellAfter[action.index] = true;
      return { ...state, cellValues, cellAfter };
    }
    case "overall":
      return { ...state, overall: action.value };
    case "rerunning":
      return { ...state, rerunning: action.on, wave: action.on ? "both" : "idle" };
    case "busy":
      return { ...state, busy: action.on };
    case "compared":
      return { ...state, compared: true, busy: false, rerunning: false, wave: "idle" };
    case "ready":
      return { ...state, ready: true, busy: false };
    case "held":
      return { ...state, held: true };
    case "armAfter": {
      const dims = dimsFor(action.caller);
      return {
        ...emptyView(dims.length),
        patch: true,
        pass: "after",
        cellValues: dims.map((dim) => readScore(action.caller.scores, dim.key).score),
        busy: true,
      };
    }
    default:
      return state;
  }
}

function dimsFor(caller: Caller) {
  return DIMENSION_ORDER.filter((dim) => dim.key !== "security" || caller.scores.security);
}

function readScore(source: Dimensions, key: keyof Dimensions): DimensionScore {
  const score = source[key];
  if (!score) return { score: 0, max: 5, verdict: "fail" };
  return score;
}

function verdictWord(verdict: Verdict) {
  if (verdict === "fail") return "Fail";
  if (verdict === "review") return "Review";
  return "Pass";
}

function suiteCost() {
  const cents = CALLERS.reduce((sum, caller) => sum + Math.round(Number(caller.cost.slice(1)) * 100), 0);
  return `$${(cents / 100).toFixed(2)}`;
}

function sec(ms: number) {
  return ms / 1000;
}

type Clock = {
  kill: () => void;
  pause: () => void;
  resume: () => void;
  progress: () => number;
  duration: () => number;
  to: (target: object, vars: object, position?: number) => Clock;
  call: (fn: () => void, params?: unknown[], position?: number) => Clock;
  fromTo: (target: object, from: object, to: object, position?: number) => Clock;
};

function prefersReduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function LandingBench() {
  const first = CALLERS[0];
  const [callerId, setCallerId] = useState(first.id);
  const [token, setToken] = useState(0);
  const [mode, setMode] = useState<"play" | "after">("play");
  const [reduced, setReduced] = useState(false);
  const [toast, setToast] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [hidden, setHidden] = useState(false);
  const caller = CALLERS.find((item) => item.id === callerId) ?? first;
  const dims = dimsFor(caller);
  const [view, dispatch] = useReducer(reducer, dims.length, emptyView);
  const goRef = useRef<(id: string) => void>(() => {});
  goRef.current = (id: string) => {
    setMode("play");
    setCallerId(id);
    setToken((value) => value + 1);
  };
  const go = useCallback((id: string) => goRef.current(id), []);
  useTimelineBridge(dispatch, go);
  const heldRef = useRef(false);
  const onScreenRef = useRef(true);
  const tlRef = useRef<{ kill: () => void; pause: () => void; resume: () => void; progress: () => number } | null>(null);
  const bars = useRef<Record<string, HTMLSpanElement | null>>({});
  const stampRef = useRef<HTMLDivElement | null>(null);
  const ctaRef = useRef<HTMLButtonElement | null>(null);
  const toastRef = useRef<HTMLDivElement | null>(null);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sectionRef = useRef<HTMLElement | null>(null);
  const scriptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPlay = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (typeof id !== "string" || !CALLERS.some((item) => item.id === id)) return;
      heldRef.current = false;
      goRef.current(id);
    };
    window.addEventListener("kasauti-play", onPlay);
    return () => window.removeEventListener("kasauti-play", onPlay);
  }, []);

  useEffect(() => {
    setReduced(prefersReduced());
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        onScreenRef.current = entry.isIntersecting;
        setOnScreen(entry.isIntersecting);
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    const onHide = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  useEffect(() => {
    const gate = { ok: true };
    const current = CALLERS.find((item) => item.id === callerId) ?? CALLERS[0];
    const list = dimsFor(current);
    const reducedNow = prefersReduced();

    const resetBars = (scale: number) => {
      Object.entries(bars.current).forEach(([id, node]) => {
        if (node) node.style.transform = `scaleX(${id === current.id ? scale : 0})`;
      });
    };

    if (reducedNow) {
      dispatch(mode === "after" ? { type: "after", caller: current } : { type: "before", caller: current });
      resetBars(1);
      return;
    }

    if (mode === "play") dispatch({ type: "reset", dims: list.length });
    else dispatch({ type: "armAfter", caller: current });

    let timeline: Clock | null = null;
    (async () => {
      const { default: gsap } = await import("gsap");
      if (!gate.ok) return;
      const tl = gsap.timeline({
        paused: true,
        onUpdate: () => {
          const node = bars.current[current.id];
          if (node) node.style.transform = `scaleX(${tl.progress()})`;
        },
      });
      timeline = tl;
      tlRef.current = tl;

      if (mode === "play") buildPlay(tl, current, list, () => gate.ok);
      else buildAfter(tl, current, list, () => gate.ok, cellRefs.current);

      if (onScreenRef.current && !document.hidden) tl.resume();
    })();

    return () => {
      gate.ok = false;
      timeline?.kill();
      tlRef.current?.kill();
      tlRef.current = null;
      resetBars(0);
      cellRefs.current.forEach((node) => {
        if (node) node.style.transform = "";
      });
    };
  }, [callerId, token, mode]);

  useEffect(() => {
    const tl = tlRef.current;
    if (!tl || reduced) return;
    if (onScreen && !hidden) tl.resume();
    else tl.pause();
  }, [onScreen, hidden, reduced, callerId, token, mode]);

  useEffect(() => {
    if (reduced || (mode === "play" ? !view.stamp : !view.held)) return;
    const el = stampRef.current;
    if (!el) return;
    let tween: { kill: () => void } | null = null;
    let dead = false;
    (async () => {
      const { default: gsap } = await import("gsap");
      if (dead || !stampRef.current) return;
      tween = gsap.fromTo(
        stampRef.current,
        { opacity: 0, scale: 0.82 },
        { opacity: 1, scale: 1, duration: sec(PLAYBACK.stampSpringMs), ease: "back.out(1.7)" },
      );
    })();
    return () => {
      dead = true;
      tween?.kill();
    };
  }, [view.stamp, view.held, reduced, mode, callerId, token]);

  useEffect(() => {
    if (!view.ready || view.compared) return;
    const el = ctaRef.current;
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    if (reduced) return;
    let tween: { kill: () => void } | null = null;
    let dead = false;
    (async () => {
      const { default: gsap } = await import("gsap");
      if (dead || !ctaRef.current) return;
      tween = gsap.fromTo(
        ctaRef.current,
        { opacity: 0, scale: 0.92 },
        { opacity: 1, scale: 1, duration: sec(PLAYBACK.stampSpringMs), ease: "back.out(1.7)" },
      );
    })();
    return () => {
      dead = true;
      tween?.kill();
      if (el) el.style.transform = "";
    };
  }, [view.ready, view.compared, reduced, callerId]);

  useEffect(() => {
    if (!toast) return;
    const el = toastRef.current;
    let tween: { kill: () => void } | null = null;
    let hide: { kill: () => void } | null = null;
    let dead = false;
    (async () => {
      const { default: gsap } = await import("gsap");
      if (dead || !toastRef.current) return;
      if (!reduced) {
        tween = gsap.fromTo(
          toastRef.current,
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: sec(PLAYBACK.toastSpringMs), ease: "back.out(1.6)" },
        );
      }
      hide = gsap.delayedCall(sec(PLAYBACK.copiedMs), () => {
        if (!dead) setToast(false);
      });
    })();
    return () => {
      dead = true;
      tween?.kill();
      hide?.kill();
      if (el) el.style.transform = "";
    };
  }, [toast, reduced]);

  function selectCaller(id: string) {
    heldRef.current = false;
    setMode("play");
    setCallerId(id);
    setToken((value) => value + 1);
  }

  function rerun() {
    if (!view.ready || view.compared) return;
    heldRef.current = true;
    setMode("after");
    setToken((value) => value + 1);
  }

  async function copyPatch() {
    heldRef.current = true;
    try {
      await navigator.clipboard.writeText(caller.patch);
    } catch {
      const area = document.createElement("textarea");
      area.value = caller.patch;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setToast(false);
    window.setTimeout(() => setToast(true), 0);
  }

  const step = view.compared ? 4 : view.pass === "after" ? 3 : view.ready ? 2 : 1;
  const steps = ["Hear the call", "See where it fails", "Re-run with the patch", "Hear the fixed call"];
  const lines = view.pass === "after" ? caller.afterTranscript : caller.transcript;

  return (
    <section ref={sectionRef} className="py-16 bg-[#F8F5EE] border-y border-neutral-300/80 relative" id="test-bench">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 font-mono text-xs text-[#D97706] uppercase tracking-wider mb-2 font-semibold">
              <span>● Test suite · Bolna agent under test</span>
              <span className="text-neutral-400">|</span>
              <span>Judge: Jev (jev-1.13.0)</span>
            </div>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-[#0F0E0D]">+91 Call Simulation</h2>
          </div>
          <span className="text-xs font-mono text-neutral-600 bg-neutral-200/80 px-2.5 py-1 rounded">
            {CALLERS.length} callers · {suiteCost()}
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-4 no-scrollbar" role="toolbar" aria-label="Callers">
          {CALLERS.map((item) => {
            const on = item.id === caller.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={on}
                onClick={() => selectCaller(item.id)}
                className={
                  on
                    ? "relative overflow-hidden px-4 py-2.5 rounded-full bg-[#0E0D0C] text-white font-medium text-xs whitespace-nowrap shadow flex items-center gap-2.5 ring-2 ring-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFB800]"
                    : "relative overflow-hidden px-4 py-2.5 rounded-full bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300 font-medium text-xs whitespace-nowrap transition flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFB800]"
                }
              >
                <span className={`w-2 h-2 rounded-full ${on ? "bg-[#FFB800]" : "bg-neutral-400"}`} />
                <span className="font-bold">{item.name}</span>
                <span className={`text-[11px] ${on ? "text-neutral-400" : "text-neutral-500"}`}>
                  ({item.level} · {item.tag})
                </span>
                <span
                  ref={(node) => {
                    bars.current[item.id] = node;
                  }}
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left bg-[#FFB800]"
                  style={{ transform: "scaleX(0)" }}
                />
              </button>
            );
          })}
        </div>

        <div id="call-sim-panel" className="mt-4 bg-[#141312] rounded-3xl p-6 sm:p-8 text-white border border-neutral-800 shadow-2xl relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-neutral-800">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-3 h-3 rounded-full shrink-0 ${view.pass === "after" ? "bg-emerald-400" : "bg-red-500 animate-ping motion-reduce:animate-none"}`} />
              <span className="font-mono text-sm tracking-wide font-semibold text-neutral-200">
                {view.pass === "after" ? "AFTER THE PATCH" : "BEFORE THE PATCH"}: {caller.name} · {caller.phoneLabel} → Bolna Sehat Clinic Agent
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-neutral-400">
                Judge: <span className="text-amber-400 font-bold">Jev</span>
              </span>
              <span className="text-neutral-400">
                Recording: <span className="text-white font-bold">{caller.recording}</span>
              </span>
              <span className="text-neutral-400">
                This call: <span className="text-emerald-400 font-bold">{caller.cost}</span>
              </span>
            </div>
          </div>

          <ol className="flex flex-wrap gap-2 pt-5 text-[11px] font-mono">
            {steps.map((label, index) => {
              const n = index + 1;
              const on = n === step;
              const done = n < step;
              return (
                <li
                  key={label}
                  className={`px-2.5 py-1 rounded-full border ${
                    on
                      ? "border-[#FFB800] text-[#FFB800]"
                      : done
                        ? "border-emerald-700 text-emerald-400"
                        : "border-neutral-800 text-neutral-500"
                  }`}
                >
                  {n}. {label}
                </li>
              );
            })}
          </ol>

          <div className="py-6 border-b border-neutral-800/80 grid grid-cols-2 gap-3 sm:gap-6 items-center">
            <WaveCard
              label={caller.callerLabel}
              status={view.pass === "after" ? "Same caller" : "+91 Line"}
              statusClass={view.pass === "after" ? "text-emerald-300" : "text-[#FFB800]"}
              color="#FFB800"
              bars={16}
              mode={sideMode("caller", view)}
              animate={onScreen && !hidden && !reduced}
            />
            <WaveCard
              label="BOLNA AGENT UNDER TEST"
              status={view.pass === "after" ? "Patch applied" : "Live Call Feed"}
              statusClass={view.pass === "after" ? "text-emerald-300" : "text-neutral-500"}
              color="#F87171"
              bars={12}
              mode={sideMode("bot", view)}
              animate={onScreen && !hidden && !reduced}
            />
          </div>

          <div className="py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div
              ref={scriptRef}
              className="lg:col-span-7 space-y-4 font-mono text-sm"
            >
              <span className="sr-only" aria-live="polite">
                {view.announcement}
              </span>
              {lines.map((line, index) => {
                const done = index < view.shown;
                const active = view.typing?.index === index;
                if (!done && !active) return null;
                const text = done ? line.text : line.text.slice(0, view.typing?.count ?? 0);
                const who = line.speaker === "caller" ? "CALLER" : "BOT";
                const whoClass = line.speaker === "caller" ? "text-[#FFB800]" : "text-red-400";
                if (!line.isBreak && !line.held) {
                  return (
                    <div key={`${caller.id}-${view.pass}-${line.t}-${index}`} className="flex items-start gap-3">
                      <span className={`${whoClass} font-bold text-xs mt-1 w-20 uppercase shrink-0`}>
                        {line.t} {who}:
                      </span>
                      <div className="bg-neutral-900/90 p-3.5 rounded-lg border border-neutral-800 text-neutral-200 leading-relaxed flex-1 min-w-0">
                        “{text}”
                        {done && line.translation ? (
                          <div className="text-[11px] text-neutral-500 mt-1 font-sans">[{line.translation}]</div>
                        ) : null}
                      </div>
                    </div>
                  );
                }
                if (line.held) {
                  return (
                    <div key={`${caller.id}-held`} className="flex items-start gap-3">
                      <span className="text-emerald-400 font-bold text-xs mt-1 w-20 uppercase shrink-0">
                        {line.t} {who}:
                      </span>
                      <div className="bg-emerald-950/40 p-4 rounded-lg border border-emerald-500/50 text-emerald-100 leading-relaxed flex-1 min-w-0">
                        <div className="flex items-center justify-between pb-1 border-b border-emerald-900/50 mb-2 gap-2">
                          <span className="text-[11px] font-mono text-emerald-400 tracking-wider font-bold">PATCH HELD</span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-600 text-white font-bold">PASS</span>
                        </div>
                        <div className="font-bold">“{text}”</div>
                        {done && line.translation ? (
                          <div className="text-[11px] text-emerald-300/70 mt-1.5 font-sans">[{line.translation}]</div>
                        ) : null}
                        {view.held ? (
                          <div
                            ref={stampRef}
                            className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-500 text-emerald-300 rounded text-xs font-mono font-bold origin-left"
                            style={reduced ? undefined : { opacity: 0, transform: "scale(0.82)" }}
                          >
                            HELD · SAME CALLER, PATCH APPLIED
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={`${caller.id}-break`} className="flex items-start gap-3">
                    <span className="text-red-400 font-bold text-xs mt-1 w-20 uppercase shrink-0">
                      {line.t} {who}:
                    </span>
                    <div
                      className={`bg-red-950/40 p-4 rounded-lg border text-red-200 leading-relaxed flex-1 min-w-0 ${
                        view.flash ? "border-red-300 shadow-[0_0_24px_rgba(220,38,38,0.45)]" : "border-red-500/50"
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1 border-b border-red-900/50 mb-2 gap-2">
                        <span className="text-[11px] font-mono text-red-400 tracking-wider font-bold">EXACT BREAK LINE DETECTED</span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-red-600 text-white font-bold">FAIL</span>
                      </div>
                      <div className="font-bold text-red-100">“{text}”</div>
                      {done && line.translation ? (
                        <div className="text-[11px] text-red-300/70 mt-1.5 font-sans">[{line.translation}]</div>
                      ) : null}
                      {view.stamp ? (
                        <>
                          <div className="text-[11px] text-red-300/80 mt-1.5 font-sans">{caller.breakNote}</div>
                          <div
                            ref={stampRef}
                            className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500 text-red-300 rounded text-xs font-mono font-bold origin-left"
                            style={reduced ? undefined : { opacity: 0, transform: "scale(0.82)" }}
                          >
                            <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                              <path
                                clipRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                fillRule="evenodd"
                              />
                            </svg>
                            <span>
                              CRACKED AT {caller.breakAt} · {caller.breakReason}
                            </span>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="lg:col-span-5 bg-neutral-900 rounded-2xl p-5 border border-neutral-700/80 flex flex-col justify-between h-full relative">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                  <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider">Kasauti 1-Line Patch</span>
                  <button
                    type="button"
                    onClick={copyPatch}
                    className="text-xs font-mono text-[#FFE494] hover:underline flex items-center gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFB800] rounded"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                    <span>Copy patch block</span>
                  </button>
                </div>
                <div
                  className="mt-4 bg-black/80 rounded-xl p-3.5 font-mono text-xs leading-relaxed border border-neutral-800 whitespace-pre-wrap min-h-[7.5rem] transition-opacity"
                  style={{ opacity: view.patch ? 1 : 0 }}
                >
                  {caller.patch.split("\n").map((line, index) => (
                    <span key={index} className={line.trimStart().startsWith("//") ? "text-neutral-500" : "text-emerald-400 font-semibold"}>
                      {line}
                      {"\n"}
                    </span>
                  ))}
                </div>
                <div
                  className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-xs"
                  style={{ opacity: view.patch ? 1 : 0 }}
                >
                  <strong>Jev jev-1.13.0:</strong> {caller.judgeNote}
                </div>
              </div>
              {view.ready && !view.compared ? (
                <p className="mt-4 text-[11px] text-neutral-400">The button below re-runs this caller with the patch above.</p>
              ) : null}
              {toast ? (
                <div
                  ref={toastRef}
                  role="status"
                  className="absolute bottom-4 right-4 px-3 py-1.5 rounded-lg bg-[#FFB800] text-[#0E0D0C] text-xs font-bold font-mono shadow-lg"
                >
                  Copied
                </div>
              ) : null}
            </div>
          </div>

          <div className="py-8 border-t border-neutral-800/80 flex flex-col items-center text-center gap-3">
            {step === 1 ? (
              <p className="text-sm text-neutral-300 max-w-lg">This is the call before any patch. Listen until the agent breaks.</p>
            ) : null}
            {step === 3 ? (
              <p className="text-sm text-emerald-200 max-w-lg">Same caller, patch applied. This is the call after the fix.</p>
            ) : null}
            {step === 4 ? (
              <p className="text-sm text-neutral-200 max-w-lg">
                Same caller, after the patch. Score {caller.overallBefore} → {caller.overallAfter}.
              </p>
            ) : null}
          </div>

          <div className="mt-2 pt-4 border-t border-neutral-800/80">
            <div className="flex items-center justify-between mb-3 text-xs font-mono text-neutral-400 gap-3">
              <span>{dims.length === 7 ? "7-DIMENSION REPORT CARD (PER-CALL GRADED BY JEV)" : "REPORT CARD (PER-CALL GRADED BY JEV)"}</span>
              <span className="flex items-center gap-3">
                {view.overall !== null ? (
                  <span className="text-white font-bold">
                    {caller.overallBefore} → {view.overall}
                  </span>
                ) : null}
                <Link href="/score/sehat" className="text-amber-400/90 text-[11px] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFB800] rounded">
                  0–100 score at /score/sehat
                </Link>
              </span>
            </div>
            <div className={`grid gap-2.5 text-center ${dims.length > 7 ? "grid-cols-2 sm:grid-cols-4 lg:grid-cols-8" : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-7"}`} style={{ perspective: "600px" }}>
              {dims.map((dim, index) => {
                const phase = view.cellAfter[index] ? caller.afterScores : caller.scores;
                const score = readScore(phase, dim.key);
                const value = view.cellValues[index];
                const shown = value !== null && value !== undefined;
                return (
                  <div
                    key={dim.key}
                    ref={(node) => {
                      cellRefs.current[index] = node;
                    }}
                    className="bg-black/40 p-3 rounded-xl border border-neutral-800"
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    <span className="block text-[10px] font-mono text-neutral-400 uppercase">{dim.label}</span>
                    <span
                      className="text-xs font-bold font-mono"
                      style={{ color: shown ? VERDICT_COLOR[score.verdict] : "#A3A3A3" }}
                    >
                      {shown ? `${value}/${score.max} ${verdictWord(score.verdict)}` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="mt-4 text-[11px] text-neutral-500">*Simulated for demonstration — transcripts, scores and costs are illustrative.</p>
          {step === 2 ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0E0D0C]/80 px-6">
              <div className="max-w-lg text-center">
                <p className="text-xs font-mono uppercase tracking-wider text-red-400">This call failed · {caller.breakReason}</p>
                <p className="mt-3 text-base text-neutral-100">{caller.breakNote}</p>
                <button
                  ref={ctaRef}
                  type="button"
                  onClick={rerun}
                  className="mt-6 px-10 py-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-display font-bold text-lg sm:text-xl uppercase tracking-wide shadow-lg shadow-emerald-900/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFB800]"
                  style={reduced ? undefined : { opacity: 0, transform: "scale(0.92)" }}
                >
                  Re-run with this patch
                </button>
                <p className="mt-4 text-sm text-neutral-300">Same caller. The next conversation is after this patch is in the prompt.</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function sideMode(side: Speaker, view: View): "speak" | "idle" | "flat" | "collapse" {
  if (view.rerunning || view.wave === "both") return "speak";
  if (view.wave === "flat") return "flat";
  if (side === "bot" && view.botCollapsed) return "collapse";
  if (view.wave === side) return "speak";
  return "idle";
}

function emit(action: Action) {
  listeners.forEach((fn) => fn(action));
}

function buildPlay(
  tl: Clock,
  caller: Caller,
  dims: { key: keyof Dimensions; label: string }[],
  live: () => boolean,
) {
  const say = (action: Action) => {
    tl.call(() => {
      if (live()) emit(action);
    });
  };

  tl.to({}, { duration: sec(PLAYBACK.introDelayMs) });
  caller.transcript.forEach((line, index) => {
    if (line.isBreak) {
      say({ type: "wave", wave: "flat" });
      tl.to({}, { duration: sec(PLAYBACK.silenceBeforeBreakMs) });
    }
    say({ type: "wave", wave: line.speaker });
    tl.to({}, { duration: sec(PLAYBACK.speakerWaveLeadMs) });
    const chars = { n: 0 };
    tl.to(chars, {
      n: line.text.length,
      duration: sec(typeDuration(line.text)),
      ease: "none",
      onUpdate: () => {
        if (live()) emit({ type: "type", index, count: Math.round(chars.n) });
      },
    });
    tl.call(() => {
      if (!live()) return;
      const who = line.speaker === "caller" ? caller.name : "Bot";
      emit({ type: "commit", index, announcement: `${who}: ${line.text}` });
    });
    if (line.isBreak) {
      say({ type: "flash", on: true });
      tl.to({}, { duration: sec(PLAYBACK.breakFlashMs) });
      say({ type: "flash", on: false });
      tl.to({}, { duration: sec(PLAYBACK.stampDelayMs) });
      say({ type: "stamp" });
    }
    tl.to({}, { duration: sec(PLAYBACK.speakerWaveTailMs) });
    if (line.isBreak) say({ type: "collapse" });
    else say({ type: "wave", wave: "idle" });
    tl.to({}, { duration: sec(line.holdMs ?? PLAYBACK.gapAfterLineMs) });
  });

  tl.to({}, { duration: sec(PLAYBACK.holdAfterBreakMs) });
  say({ type: "patch" });
  say({ type: "ready" });
  const at = tl.duration();
  dims.forEach((dim, index) => {
    const score = readScore(caller.scores, dim.key);
    const proxy = { n: 0 };
    const start = at + index * sec(PLAYBACK.cellStaggerMs);
    tl.call(() => {
      if (live()) emit({ type: "cell", index, value: 0 });
    }, [], start);
    tl.to(
      proxy,
      {
        n: score.score,
        duration: sec(PLAYBACK.cellCountUpMs),
        ease: "power1.out",
        onUpdate: () => {
          if (live()) emit({ type: "cell", index, value: Math.round(proxy.n) });
        },
      },
      start,
    );
  });
  tl.to({}, { duration: sec(PLAYBACK.holdOnResultMs) });
}

const listeners = new Set<(action: Action) => void>();
const advance = new Set<(id: string) => void>();

function setCallerNext(id: string) {
  advance.forEach((fn) => fn(id));
}

function buildAfter(
  tl: Clock,
  caller: Caller,
  dims: { key: keyof Dimensions; label: string }[],
  live: () => boolean,
  cells: (HTMLDivElement | null)[],
) {
  const say = (action: Action) => {
    tl.call(() => {
      if (live()) emit(action);
    });
  };

  tl.to({}, { duration: sec(PLAYBACK.introDelayMs) });
  caller.afterTranscript.forEach((line, index) => {
    say({ type: "wave", wave: line.speaker });
    tl.to({}, { duration: sec(PLAYBACK.speakerWaveLeadMs) });
    const chars = { n: 0 };
    tl.to(chars, {
      n: line.text.length,
      duration: sec(typeDuration(line.text)),
      ease: "none",
      onUpdate: () => {
        if (live()) emit({ type: "type", index, count: Math.round(chars.n) });
      },
    });
    tl.call(() => {
      if (!live()) return;
      const who = line.speaker === "caller" ? caller.name : "Bot";
      emit({ type: "commit", index, announcement: `${who}: ${line.text}` });
    });
    if (line.held) {
      tl.to({}, { duration: sec(PLAYBACK.stampDelayMs) });
      say({ type: "held" });
    }
    tl.to({}, { duration: sec(PLAYBACK.speakerWaveTailMs) });
    say({ type: "wave", wave: "idle" });
    tl.to({}, { duration: sec(line.holdMs ?? PLAYBACK.gapAfterLineMs) });
  });

  tl.to({}, { duration: sec(PLAYBACK.holdAfterBreakMs) });
  const start = tl.duration();
  const proxy = { n: caller.overallBefore };
  tl.call(() => {
    if (live()) emit({ type: "overall", value: caller.overallBefore });
  }, [], start);
  tl.to(
    proxy,
    {
      n: caller.overallAfter,
      duration: sec(PLAYBACK.scoreTickMs),
      ease: "power2.out",
      onUpdate: () => {
        if (live()) emit({ type: "overall", value: Math.round(proxy.n) });
      },
    },
    start,
  );
  dims.forEach((dim, index) => {
    const after = readScore(caller.afterScores, dim.key);
    const when = start + index * sec(PLAYBACK.flipStaggerMs);
    tl.call(() => {
      if (live()) emit({ type: "flip", index, value: after.score });
    }, [], when);
    const el = cells[index];
    if (el) {
      tl.fromTo(
        el,
        { rotateX: -80, opacity: 0.35 },
        { rotateX: 0, opacity: 1, duration: sec(PLAYBACK.flipMs), ease: "back.out(1.5)" },
        when,
      );
    }
  });
  const end = start + (dims.length - 1) * sec(PLAYBACK.flipStaggerMs) + sec(PLAYBACK.flipMs);
  if (tl.duration() < end) tl.to({}, { duration: end - tl.duration() });
  tl.call(() => {
    if (live()) emit({ type: "compared" });
  });
}

function WaveCard({
  label,
  status,
  statusClass,
  color,
  bars,
  mode,
  animate,
}: {
  label: string;
  status: string;
  statusClass: string;
  color: string;
  bars: number;
  mode: "speak" | "idle" | "flat" | "collapse";
  animate: boolean;
}) {
  const nodes = useRef<(HTMLSpanElement | null)[]>([]);
  const levels = useRef<number[]>(Array.from({ length: bars }, () => 0.2));

  useEffect(() => {
    nodes.current.forEach((el, i) => {
      if (!el) return;
      const resting = mode === "collapse" || mode === "flat" ? 0.06 : 0.2;
      levels.current[i] = resting;
      el.style.transform = `scaleY(${resting})`;
    });
    if (!animate) return;
    let raf = 0;
    let next = 0;
    const targets = Array.from({ length: bars }, () => 0.2);
    const loop = (now: number) => {
      if (now > next) {
        next = now + 110;
        for (let i = 0; i < bars; i += 1) {
          if (mode === "collapse" || mode === "flat") targets[i] = 0.05;
          else if (mode === "speak") targets[i] = 0.28 + Math.random() * 0.72;
          else targets[i] = 0.14 + Math.sin(now / 900 + i) * 0.06;
        }
      }
      for (let i = 0; i < bars; i += 1) {
        const nextLevel = levels.current[i] + (targets[i] - levels.current[i]) * 0.16;
        levels.current[i] = nextLevel;
        const el = nodes.current[i];
        if (el) el.style.transform = `scaleY(${nextLevel})`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animate, mode, bars]);

  return (
    <div className="bg-black/40 rounded-xl p-3 sm:p-4 border border-neutral-800 min-w-0">
      <div className="flex items-center justify-between text-[10px] sm:text-xs font-mono mb-2 gap-2">
        <span className="text-neutral-400 font-medium truncate">{label}</span>
        <span className={`${statusClass} shrink-0`}>{status}</span>
      </div>
      <div className="h-8 flex items-center gap-0.5">
        {Array.from({ length: bars }, (_, i) => (
          <span
            key={i}
            ref={(node) => {
              nodes.current[i] = node;
            }}
            className="w-1 flex-1 max-w-[5px] h-full origin-center rounded-full"
            style={{ background: color, transform: "scaleY(0.2)" }}
          />
        ))}
      </div>
    </div>
  );
}

// The timeline builders live outside the component so they can call dispatch.
// Subscribe once, from the component, so the module helpers reach the live reducer.
function useTimelineBridge(dispatch: (action: Action) => void, go: (id: string) => void) {
  useEffect(() => {
    listeners.add(dispatch);
    advance.add(go);
    return () => {
      listeners.delete(dispatch);
      advance.delete(go);
    };
  }, [dispatch, go]);
}
