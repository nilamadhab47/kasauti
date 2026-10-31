"use client";

import { Mp } from "./m";
import { useEffect, useState } from "react";
import { BOT_NAME, CALLERS, CLINIC, type Caller, type Cell, type Turn } from "./callers";
import { Waveform } from "./wave";

type Phase = "talk" | "crack" | "fix" | "rerun" | "pass";

export function pickCaller(id: string) {
  window.dispatchEvent(new CustomEvent("kasauti-caller", { detail: id }));
  document.getElementById("run")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function Sim() {
  const [id, setId] = useState(CALLERS[0].id);
  const [motion, setMotion] = useState(false);
  const [glow, setGlow] = useState({ x: 50, y: 40 });
  const [phase, setPhase] = useState<Phase>("talk");
  const [lineI, setLineI] = useState(0);
  const [typed, setTyped] = useState("");
  const [fixTyped, setFixTyped] = useState("");
  const [cellN, setCellN] = useState(0);
  const [play, setPlay] = useState(0);
  const caller = CALLERS.find((c) => c.id === id) ?? CALLERS[0];

  useEffect(() => {
    setMotion(document.documentElement.dataset.motion === "on");
    const onPick = (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      if (CALLERS.some((c) => c.id === next)) {
        setId(next);
        setPlay((n) => n + 1);
      }
    };
    window.addEventListener("kasauti-caller", onPick);
    return () => window.removeEventListener("kasauti-caller", onPick);
  }, []);

  useEffect(() => {
    if (!motion) {
      setPhase("fix");
      setLineI(99);
      setTyped(caller.breakLines.at(-1)?.text ?? "");
      setFixTyped(caller.fix);
      setCellN(4);
      return;
    }
    const lines = caller.breakLines;
    setPhase("talk");
    setLineI(0);
    setTyped("");
    setFixTyped("");
    setCellN(0);

    const timers: number[] = [];
    let t = 200;
    lines.forEach((line, i) => {
      timers.push(
        window.setTimeout(() => {
          setLineI(i);
          setTyped("");
        }, t),
      );
      t += Math.min(1400, 320 + line.text.length * 18);
    });
    timers.push(
      window.setTimeout(() => {
        setPhase("crack");
        setLineI(lines.length - 1);
        setTyped(lines[lines.length - 1].text);
      }, t),
    );
    t += 900;
    timers.push(
      window.setTimeout(() => {
        setPhase("fix");
        setFixTyped("");
      }, t),
    );
    t += 1600;
    timers.push(window.setTimeout(() => setPhase("rerun"), t));
    t += 1100;
    timers.push(
      window.setTimeout(() => {
        setPhase("pass");
        setLineI(0);
        setTyped("");
        setCellN(0);
      }, t),
    );
    t += 280;
    [1, 2, 3, 4].forEach((n, i) => {
      timers.push(window.setTimeout(() => setCellN(n), t + i * 140));
    });
    timers.push(
      window.setTimeout(() => {
        const idx = CALLERS.findIndex((c) => c.id === caller.id);
        setId(CALLERS[(idx + 1) % CALLERS.length].id);
        setPlay((n) => n + 1);
      }, t + 1600),
    );

    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [id, motion, play, caller]);

  useEffect(() => {
    if (!motion) return;
    const source =
      phase === "fix"
        ? caller.fix
        : phase === "pass" || phase === "rerun"
          ? caller.rerunLines[Math.min(lineI, caller.rerunLines.length - 1)]?.text ?? ""
          : caller.breakLines[Math.min(lineI, caller.breakLines.length - 1)]?.text ?? "";
    if (phase === "fix") {
      let i = 0;
      const tick = window.setInterval(() => {
        i += 1;
        setFixTyped(caller.fix.slice(0, i));
        if (i >= caller.fix.length) window.clearInterval(tick);
      }, 12);
      return () => window.clearInterval(tick);
    }
    let i = 0;
    const tick = window.setInterval(() => {
      i += 1;
      setTyped(source.slice(0, i));
      if (i >= source.length) window.clearInterval(tick);
    }, 16);
    return () => window.clearInterval(tick);
  }, [phase, lineI, motion, caller, play]);

  const rerun = phase === "rerun" || phase === "pass";
  const script = rerun ? caller.rerunLines : caller.breakLines;
  const visible = script.slice(0, Math.max(1, lineI + 1));
  const passed = phase === "pass" || (!motion && false);
  const cracked = phase === "crack" || phase === "fix";
  const talking = visible[visible.length - 1];
  const cells = passed && cellN > 0 ? caller.rerunCells : caller.cells;

  return (
    <article
      className="sim"
      id="run"
      data-ui
      aria-label={`${caller.name} calling ${CLINIC}`}
      onMouseMove={(event) => {
        if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
        const box = event.currentTarget.getBoundingClientRect();
        setGlow({
          x: ((event.clientX - box.left) / box.width) * 100,
          y: ((event.clientY - box.top) / box.height) * 100,
        });
      }}
    >
      <span className="grain" aria-hidden="true" />
      <span className="glow" aria-hidden="true" style={{ left: `${glow.x}%`, top: `${glow.y}%` }} />
      <header className="sim-top">
        <span className="mono">Sample run</span>
        <span className="sim-who">
          {caller.name} <span aria-hidden>→</span> {CLINIC}
        </span>
        <span className={`pill pill-${passed ? "pass" : cracked ? "fail" : "live"}`}>
          {passed ? "Passed" : cracked ? "Failed" : "On the line"}
        </span>
      </header>

      <div className="waves">
        <div className="wave">
          <span className="wave-name">{caller.name}</span>
          <Waveform live={motion && talking?.who === "caller" && !passed} tone="gold" />
        </div>
        <div className="wave">
          <span className="wave-name">{BOT_NAME}</span>
          <Waveform
            live={motion && talking?.who === "bot" && phase !== "pass"}
            tone={passed ? "pass" : phase === "crack" ? "fail" : "gold"}
            collapsed={phase === "crack"}
          />
        </div>
      </div>

      <div className="sim-split">
        <ol className="transcript" aria-live="polite">
          {visible.map((turn, index) => (
            <Line
              key={`${caller.id}-${rerun}-${index}`}
              turn={
                index === visible.length - 1 && motion && phase !== "crack" && phase !== "fix"
                  ? { ...turn, text: typed || turn.text }
                  : turn
              }
              caller={caller.name}
              failFlash={phase === "crack" && turn.fail}
            />
          ))}
        </ol>
        <aside className="verdict" aria-label="Verdict">
          <Mp
            key={passed ? "pass" : cracked ? "fail" : "listen"}
            className={`stamp ${passed ? "stamp-pass" : cracked ? "stamp-fail" : ""}`}
            initial={motion ? { transform: "scale(0.96)", opacity: 0 } : false}
            animate={{ transform: "scale(1)", opacity: 1 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.22 }}
          >
            {passed ? "Passed on rerun" : cracked ? `Cracked at ${caller.crackedAt}` : "Listening"}
          </Mp>
          <p className="reason">
            {passed ? "Same caller. The line held." : cracked ? caller.reason : "The call is still going."}
          </p>
          {(cracked || passed) && (
            <dl className="cells">
              {(["task", "facts", "language", "tone"] as const).map((key, index) => {
                const value = passed && index < cellN ? caller.rerunCells[key] : cells[key];
                return <Cell key={key} name={key[0].toUpperCase() + key.slice(1)} value={value} />;
              })}
            </dl>
          )}
          {(phase === "fix" || phase === "rerun" || phase === "pass") && (
            <div className="fix">
              <p className="fix-label">The one line to change</p>
              <code>{motion ? fixTyped : caller.fix}</code>
            </div>
          )}
        </aside>
      </div>

      <div className="chips" role="tablist" aria-label="Choose a caller">
        {CALLERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === caller.id}
            className={item.id === caller.id ? "chip on" : "chip"}
            onClick={() => {
              setId(item.id);
              setPlay((n) => n + 1);
            }}
          >
            {item.name}
            {item.id === caller.id ? <span className="chip-progress" aria-hidden="true" key={play} /> : null}
          </button>
        ))}
      </div>
    </article>
  );
}

function Line({ turn, caller, failFlash }: { turn: Turn; caller: string; failFlash?: boolean }) {
  const name = turn.who === "caller" ? caller : BOT_NAME;
  return (
    <li className={`${turn.fail ? "turn fail" : turn.who === "bot" ? "turn bot" : "turn"}${failFlash ? " flash" : ""}`}>
      <span className="turn-name">{name}</span>
      <span className={turn.lang === "hi" ? "deva" : undefined} lang={turn.lang === "hi" ? "hi" : "en"}>
        {turn.text}
      </span>
    </li>
  );
}

function Cell({ name, value }: { name: string; value: Cell }) {
  return (
    <div className={`cell cell-${value === "Fail" ? "fail" : value === "Pass" ? "pass" : "na"}`}>
      <dt>{name}</dt>
      <dd>{value}</dd>
    </div>
  );
}
