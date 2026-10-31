"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Mdiv, Mpath, Mrect } from "./m";

/** Five bars, the logo's waveform. Heights match the touchstone symbol. */
export const BAR_REST = [0.46, 0.72, 1, 0.82, 0.48];

/** Real brand file. Do not recolour. */
export function LogoMark({
  size = 40,
  className = "",
  id,
}: {
  size?: number;
  className?: string;
  animateBars?: boolean;
  id?: string;
}) {
  return (
    <Image
      id={id}
      className={`logo-mark ${className}`}
      src="/brand/touchstone.png"
      alt=""
      width={size}
      height={size}
      draggable={false}
    />
  );
}

export function LogoIntro() {
  const markRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [fly, setFly] = useState({ x: 0, y: 0, s: 1 });
  const [phase, setPhase] = useState<"rise" | "fly">("rise");

  useEffect(() => {
    const reduce = document.documentElement.dataset.motion !== "on";
    const seen = sessionStorage.getItem("kasauti-intro") === "1";
    if (reduce || seen) {
      document.documentElement.dataset.intro = "done";
      setShow(false);
      return;
    }
    document.documentElement.dataset.intro = "on";

    const done = () => {
      sessionStorage.setItem("kasauti-intro", "1");
      document.documentElement.dataset.intro = "done";
      setShow(false);
    };

    const flyAt = window.setTimeout(() => {
      const from = markRef.current?.getBoundingClientRect();
      const nav = document.getElementById("nav-mark")?.getBoundingClientRect();
      if (from && nav) {
        const targetW = nav.height;
        const s = targetW / from.width;
        setFly({
          x: nav.left + targetW / 2 - (from.left + from.width / 2),
          y: nav.top + nav.height / 2 - (from.top + from.height / 2),
          s,
        });
      }
      setPhase("fly");
    }, 720);

    const t = window.setTimeout(done, 1380);
    const skip = () => {
      window.clearTimeout(t);
      window.clearTimeout(flyAt);
      done();
    };
    window.addEventListener("keydown", skip, { once: true });
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(flyAt);
      window.removeEventListener("keydown", skip);
    };
  }, []);

  if (!show) return null;

  return (
    <div className="intro" role="dialog" aria-label="Kasauti">
      <Mdiv
        className="intro-bg"
        initial={{ opacity: 1 }}
        animate={{ opacity: phase === "fly" ? 0 : 1 }}
        transition={{ duration: 0.38, ease: [0.23, 1, 0.32, 1] }}
      />
      <Mdiv
        ref={markRef}
        className="intro-mark"
        initial={{ transform: "translate(0px, 10px) scale(1.06)", opacity: 0 }}
        animate={{
          transform:
            phase === "fly"
              ? `translate(${fly.x}px, ${fly.y}px) scale(${fly.s})`
              : "translate(0px, 0px) scale(1)",
          opacity: 1,
        }}
        transition={{
          duration: phase === "fly" ? 0.52 : 0.36,
          ease: phase === "fly" ? [0.77, 0, 0.175, 1] : [0.23, 1, 0.32, 1],
        }}
      >
        <Image src="/brand/touchstone.png" alt="" width={168} height={168} priority draggable={false} />
        <svg className="intro-trace" viewBox="0 0 80 80" aria-hidden="true">
          <Mpath
            d="M12 22c10-12 28-14 36-8"
            fill="none"
            stroke="#E8B530"
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: [0, 1, 0] }}
            transition={{ duration: 0.7, delay: 0.32, ease: [0.23, 1, 0.32, 1] }}
          />
          {BAR_REST.map((h, i) => {
            const height = 44 * h;
            const x = 18 + i * 10;
            const y = 40 - height / 2;
            return (
              <Mrect
                key={i}
                x={x}
                y={y}
                width="7"
                height={height}
                rx="3.5"
                fill="#E8B530"
                initial={{ transform: "scaleY(0.22)", opacity: 0 }}
                animate={{ transform: "scaleY(1)", opacity: [0, 0.95, 0] }}
                style={{ transformOrigin: "center bottom" }}
                transition={{ duration: 0.42, delay: 0.07 * i, ease: [0.23, 1, 0.32, 1] }}
              />
            );
          })}
        </svg>
      </Mdiv>
      <button
        type="button"
        className="intro-skip"
        onClick={() => {
          sessionStorage.setItem("kasauti-intro", "1");
          document.documentElement.dataset.intro = "done";
          setShow(false);
        }}
      >
        Skip
      </button>
    </div>
  );
}
