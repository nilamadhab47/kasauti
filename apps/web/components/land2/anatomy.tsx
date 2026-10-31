"use client";

import { useEffect, useRef, useState } from "react";

type PartId = "ears" | "rules" | "memory" | "voice" | "settings";

type Part = {
  id: PartId;
  label: string;
  tech: string;
  broke: string;
  fix: string;
  bolna: string;
  prompt?: string;
};

const FLOW: Part[] = [
  {
    id: "ears",
    label: "Ears",
    tech: "speech-to-text",
    broke: "A caller said his name in Hindi. The bot couldn't hear it and asked again.",
    fix: "Switch its ears to Hindi + English.",
    bolna: "transcriber Deepgram nova-3 (en) → language hi, or add Hindi to the language hints",
  },
  {
    id: "rules",
    label: "Rules",
    tech: "prompt",
    broke: "It read a customer's phone number and PAN to someone who only knew a name.",
    fix: "Add a privacy rule. This is the one that's a prompt fix.",
    bolna: "paste the privacy block after the current instructions",
    prompt:
      "+ Never read out a phone number, a PAN, a balance, or another customer's name.\n" +
      "+ A name is not proof of identity.\n" +
      "+ If you cannot verify the caller, refuse and ask the account holder to call.",
  },
  {
    id: "memory",
    label: "Memory",
    tech: "facts",
    broke: "It said a loan closed in 2020. The records say 2026. It also made up office hours.",
    fix: "Give it the real facts, and let it say 'I'll check' instead of guessing.",
    bolna: 'attach a knowledge base or save facts in context_data; remove "always give an answer"',
  },
  {
    id: "voice",
    label: "Voice",
    tech: "text-to-speech",
    broke: "Its Hindi reply came out as English spelled in Hindi letters: 'हाउ कैन आई हेल्प यू'.",
    fix: "Use a Hindi or code-mixed voice.",
    bolna: "switch to a Sarvam code-mixed voice",
  },
];

const SETTINGS: Part = {
  id: "settings",
  label: "Call settings",
  tech: "timeouts",
  broke: "It hung up when a caller asked an odd question.",
  fix: "Give it more patience before hanging up, and answer in one line instead of ending the call.",
  bolna: 'raise hangup_after_silence above 6; add a "don\'t end the call" line',
};

const ORDER: PartId[] = ["ears", "rules", "memory", "voice", "settings"];
const CYCLE_MS = 4000;

const ALL = [...FLOW, SETTINGS];

function partById(id: PartId) {
  return ALL.find((part) => part.id === id) ?? FLOW[0];
}

function signalPoint(id: PartId, dot: HTMLElement, stage: HTMLElement, target: HTMLElement) {
  const stageBox = stage.getBoundingClientRect();
  const box = target.getBoundingClientRect();
  const vertical = window.matchMedia("(max-width: 767px)").matches;
  if (id === "settings") {
    return {
      x: box.left - stageBox.left - dot.offsetWidth - 4,
      y: box.top + box.height / 2 - stageBox.top - dot.offsetHeight / 2,
    };
  }
  if (vertical) {
    return {
      x: box.left + box.width / 2 - stageBox.left - dot.offsetWidth / 2,
      y: (id === "ears" ? box.bottom : box.top) - stageBox.top - dot.offsetHeight / 2,
    };
  }
  return {
    x: (id === "ears" ? box.right : box.left) - stageBox.left - dot.offsetWidth / 2,
    y: box.top + box.height / 2 - stageBox.top - dot.offsetHeight / 2,
  };
}

export function Layers() {
  const root = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const nodeRefs = useRef<Partial<Record<PartId, HTMLButtonElement | null>>>({});
  const [active, setActive] = useState<PartId>("ears");
  const [cycling, setCycling] = useState(true);
  const [seen, setSeen] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const [bolnaOn, setBolnaOn] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reduced, setReduced] = useState(false);
  const part = partById(active);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const prefers = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(prefers);
    if (prefers) {
      setActive("rules");
      setCycling(false);
      setSeen(true);
      return;
    }
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        el.dataset.armed = "1";
        timers.push(window.setTimeout(() => setDrawn(true), 40));
        timers.push(window.setTimeout(() => setSeen(true), 7 * 160 + 220));
        io.disconnect();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  useEffect(() => {
    if (!seen || !cycling || reduced) return;
    const id = window.setInterval(() => {
      setActive((current) => ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]);
    }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, [seen, cycling, reduced]);

  useEffect(() => {
    if (!seen || reduced) return;
    const dot = dotRef.current;
    const stage = stageRef.current;
    const target = nodeRefs.current[active];
    if (!dot || !stage || !target) return;
    let dead = false;
    let timeline: { kill: () => void } | null = null;
    const onResize = () => {
      const point = signalPoint(active, dot, stage, target);
      import("gsap").then(({ default: gsap }) => {
        if (!dead) gsap.set(dot, { ...point, opacity: 1 });
      });
    };
    window.addEventListener("resize", onResize);
    (async () => {
      const { default: gsap } = await import("gsap");
      if (dead) return;
      const point = signalPoint(active, dot, stage, target);
      const jump = !dot.dataset.placed || active === "settings" || dot.dataset.part === "settings";
      dot.dataset.part = active;
      dot.classList.remove("is-red");
      timeline = gsap.timeline();
      if (jump) {
        timeline.set(dot, { ...point, opacity: 1 });
        dot.dataset.placed = "1";
      } else {
        timeline.set(dot, { opacity: 1 });
        timeline.to(dot, { ...point, duration: 0.7, ease: "power2.inOut" });
      }
      timeline.call(() => {
        if (!dead) dot.classList.add("is-red");
      });
      timeline.call(
        () => {
          if (!dead) dot.classList.remove("is-red");
        },
        undefined,
        "+=0.9",
      );
    })();
    return () => {
      dead = true;
      timeline?.kill();
      window.removeEventListener("resize", onResize);
    };
  }, [active, seen, reduced]);

  function choose(id: PartId) {
    setCycling(false);
    setActive(id);
    setCopied(false);
  }

  async function copyPrompt() {
    if (!part.prompt) return;
    setCycling(false);
    try {
      await navigator.clipboard.writeText(part.prompt);
    } catch {
      const area = document.createElement("textarea");
      area.value = part.prompt;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section ref={root} className="kx-anatomy py-24 bg-[#FAF6F0] border-t border-neutral-200" id="layers">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12 space-y-3">
          <span className="text-xs font-mono text-[#D97706] tracking-wider uppercase font-semibold">Diagnosis, not just a score</span>
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-neutral-900">Not every fix is a prompt fix.</h2>
          <p className="text-neutral-600 text-sm sm:text-base">
            A voice bot has ears, a memory, rules, a voice and call settings. Kasauti tells you which one failed, and what to change.
          </p>
        </div>

        <div
          ref={stageRef}
          className={`relative rounded-3xl border bg-white shadow-paper px-4 py-8 sm:px-8 ${
            active === "settings" ? "border-red-500 border-solid kx-node-hot" : "border-dashed border-neutral-300"
          }`}
        >
          <button
            type="button"
            ref={(node) => {
              nodeRefs.current.settings = node;
            }}
            aria-pressed={active === "settings"}
            onClick={() => choose("settings")}
            className={`absolute -top-3 left-6 z-10 inline-flex items-center gap-2 bg-[#FAF6F0] px-2 font-display font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFB800] rounded ${
              active === "settings" ? "text-red-700" : "text-neutral-800"
            }`}
          >
            Call settings
            <span className="font-mono text-[10px] font-normal text-neutral-500">timeouts</span>
          </button>

          <ol className="flex flex-col items-center md:flex-row md:items-center">
            {FLOW.map((item, index) => (
              <li
                key={item.id}
                className={`flex w-full flex-col items-center md:w-auto md:flex-row md:items-center ${
                  index < FLOW.length - 1 ? "md:flex-1" : ""
                }`}
              >
                <NodeButton
                  part={item}
                  on={active === item.id}
                  drawn={drawn}
                  delay={index * 320}
                  onChoose={choose}
                  nodeRef={(node) => {
                    nodeRefs.current[item.id] = node;
                  }}
                />
                {index < FLOW.length - 1 ? (
                  <span className="kx-wire relative my-1 h-8 w-px overflow-hidden bg-neutral-200 md:mx-3 md:my-0 md:h-0.5 md:min-w-[1.5rem] md:flex-1" aria-hidden="true">
                    <span
                      className={`kx-wire-fill absolute inset-0 bg-[#FFB800] ${drawn ? "is-in" : ""}`}
                      style={drawn ? { transitionDelay: `${index * 320 + 160}ms` } : undefined}
                    />
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
          <span ref={dotRef} className="kx-signal pointer-events-none absolute left-0 top-0 z-20 h-3 w-3 rounded-full bg-[#FFB800]" aria-hidden="true" />

          <div key={part.id} className="kx-detail mt-8 rounded-2xl border border-neutral-200 bg-[#FFFDFB] p-5 sm:p-6" aria-live="polite">
            <h3 className="font-display font-bold text-xl text-neutral-900">{part.label}</h3>
            <p className="mt-3 text-sm sm:text-base text-neutral-800 leading-relaxed">
              <span className="font-semibold text-red-700">Broke. </span>
              {part.broke}
            </p>
            <p className="mt-2 text-sm sm:text-base text-neutral-800 leading-relaxed">
              <span className="font-semibold text-neutral-900">Fix. </span>
              {part.fix}
            </p>
            {part.prompt ? (
              <div className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">Privacy rule</span>
                  <button
                    type="button"
                    onClick={copyPrompt}
                    className="text-xs font-mono font-semibold text-[#D97706] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFB800] rounded"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="mt-2 overflow-x-auto rounded-xl bg-[#141312] p-3 font-mono text-xs leading-relaxed text-emerald-400 whitespace-pre-wrap">{part.prompt}</pre>
              </div>
            ) : null}
            <button
              type="button"
              aria-pressed={bolnaOn}
              onClick={() => {
                setCycling(false);
                setBolnaOn((value) => !value);
              }}
              className="mt-4 text-xs font-mono text-neutral-600 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFB800] rounded"
            >
              Show the Bolna setting
            </button>
            {bolnaOn ? <p className="mt-2 font-mono text-xs text-neutral-500 leading-relaxed">{part.bolna}</p> : null}
          </div>
        </div>

        <p className="mt-6 text-base font-semibold text-[#D97706]">One report. Every part of the bot. The exact change for each.</p>
      </div>
    </section>
  );
}

function NodeButton({
  part,
  on,
  drawn,
  delay,
  onChoose,
  nodeRef,
}: {
  part: Part;
  on: boolean;
  drawn: boolean;
  delay: number;
  onChoose: (id: PartId) => void;
  nodeRef: (node: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      type="button"
      ref={nodeRef}
      aria-pressed={on}
      onClick={() => onChoose(part.id)}
      style={drawn ? { transitionDelay: `${delay}ms` } : undefined}
      className={`kx-node relative z-10 flex w-full max-w-[11rem] flex-col items-center rounded-2xl border bg-white px-4 py-3 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFB800] md:w-auto ${
        drawn ? "is-in" : ""
      } ${on ? "border-red-500 text-red-700 kx-node-hot" : "border-neutral-200 text-neutral-900 hover:border-neutral-400"}`}
    >
      <PartIcon id={part.id} />
      <span className="mt-1 font-display font-bold text-base">{part.label}</span>
      <span className="mt-0.5 font-mono text-[10px] text-neutral-500">{part.tech}</span>
    </button>
  );
}

function PartIcon({ id }: { id: PartId }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      {id === "ears" ? (
        <>
          <path {...common} d="M4 13a8 8 0 0 1 16 0" />
          <path {...common} d="M4 13v4a2 2 0 0 0 2 2h1v-6H6a2 2 0 0 0-2 2z" />
          <path {...common} d="M20 13v4a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2z" />
        </>
      ) : null}
      {id === "rules" ? <path {...common} d="M7 3h8l4 4v14H7zM15 3v4h4M9 12h6M9 16h6" /> : null}
      {id === "memory" ? <path {...common} d="M6 6h12v4H6zM6 14h12v4H6zM8 8h.01M8 16h.01" /> : null}
      {id === "voice" ? <path {...common} d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" /> : null}
    </svg>
  );
}
