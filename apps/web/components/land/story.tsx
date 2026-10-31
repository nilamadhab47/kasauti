"use client";

import { useEffect, useRef, useState } from "react";
import { Waveform } from "./wave";

const STEPS = [
  { title: "Sharma ji gets on the line.", body: "He wants the ₹500 back. The bot is Sehat Clinic." },
  { title: "The bot invents a fact.", body: "He asked for a refund. It cancelled an appointment he never had." },
  { title: "The line is quoted.", body: "I have cancelled appointment ID 241 for you." },
  {
    title: "One line changes.",
    body: "You cannot process refunds. Take the transaction ID, apologise, and promise a callback within 24 hours.",
  },
  { title: "The same call goes green.", body: "Task, facts and tone flip. Language was already fine." },
];

const FIX = "You cannot process refunds. Take the transaction ID, apologise, and promise a callback within 24 hours.";

export function Story() {
  const pin = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);

  useEffect(() => {
    if (document.documentElement.dataset.motion !== "on") {
      setP(1);
      return;
    }
    let revert: (() => void) | undefined;
    (async () => {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);
      const ctx = gsap.context(() => {
        ScrollTrigger.create({
          trigger: pin.current,
          start: "top top+=80",
          end: "bottom bottom",
          scrub: 0.35,
          onUpdate: (self) => setP(self.progress),
        });
      }, pin);
      revert = () => ctx.revert();
    })();
    return () => revert?.();
  }, []);

  const step = p < 0.18 ? 0 : p < 0.38 ? 1 : p < 0.55 ? 2 : p < 0.78 ? 3 : 4;
  const green = step === 4;
  const rerunning = p > 0.62 && p < 0.82;
  const cells = [
    p > 0.78 ? "Pass" : "Fail",
    p > 0.84 ? "Pass" : "Fail",
    "Pass",
    p > 0.9 ? "Pass" : "Fail",
  ];
  const quote =
    step === 0
      ? "देखिए, मेरा ₹500 कटा है।"
      : step === 3
        ? FIX.slice(0, Math.max(8, Math.round(((p - 0.55) / 0.2) * FIX.length)))
        : green
          ? "I can't refund that from here. Share the transaction ID and I'll have someone call you within 24 hours."
          : "I have cancelled appointment ID 241 for you.";

  return (
    <div className="story-pin" ref={pin}>
    <div className="story">
      <div className="story-steps">
        {STEPS.map((item, index) => (
          <article key={item.title} className={index === step ? "step on" : "step"}>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </article>
        ))}
      </div>
      <div className="story-stage">
        <div className={`stage-card${green ? " stage-green" : " stage-fail"}`} data-ui>
          <p className="mono">{green ? "Rerun · same caller" : "Sehat Clinic · Sharma ji"}</p>
          <p className={green ? "stamp stamp-pass" : "stamp stamp-fail"}>
            {green ? "Passed on rerun" : rerunning ? "Rerunning…" : "Cracked at 00:18"}
          </p>
          {rerunning ? (
            <div className="wave">
              <Waveform live />
            </div>
          ) : (
            <blockquote className={`${step === 0 ? "deva" : ""}${step >= 2 && !green ? " broke" : ""}`} lang={step === 0 ? "hi" : "en"}>
              {quote}
            </blockquote>
          )}
          <dl className="cells">
            {["Task", "Facts", "Language", "Tone"].map((name, index) => (
              <div key={name} className={`cell cell-${cells[index] === "Pass" ? "pass" : "fail"}`}>
                <dt>{name}</dt>
                <dd>{cells[index]}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
    </div>
  );
}
