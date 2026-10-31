"use client";

import { Mli } from "./m";
import { useEffect, useState } from "react";
import { CALLERS } from "./callers";
import { pickCaller } from "./sim";
import { Waveform } from "./wave";

export function CallerList() {
  const [live, setLive] = useState<string | null>(null);

  return (
    <ul className="rows">
      {CALLERS.map((caller, index) => (
        <Mli
          key={caller.id}
          initial={{ opacity: 0, transform: "translateY(12px)" }}
          whileInView={{ opacity: 1, transform: "translateY(0px)" }}
          viewport={{ once: true, margin: "-8%" }}
          transition={{ duration: 0.4, delay: index * 0.05, ease: [0.23, 1, 0.32, 1] }}
        >
          <button
            type="button"
            className="row"
            onClick={() => pickCaller(caller.id)}
            onPointerEnter={() => setLive(caller.id)}
            onPointerLeave={() => setLive(null)}
            onPointerDown={() => setLive(caller.id)}
            onFocus={() => setLive(caller.id)}
            onBlur={() => setLive(null)}
          >
            <span>
              <span className="row-name">
                {caller.name}
                <Waveform live={live === caller.id} />
              </span>
              <span className="row-who">{caller.who}</span>
              <span
                className={caller.quoteLang === "hi" ? "row-quote deva" : "row-quote"}
                lang={caller.quoteLang === "hi" ? "hi" : "en"}
              >
                “{live === caller.id ? <Typed text={caller.quote} /> : caller.quote}”
              </span>
            </span>
            <span className="row-test">{caller.tests}</span>
          </button>
        </Mli>
      ))}
    </ul>
  );
}

function Typed({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const id = window.setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          window.clearInterval(id);
          return v;
        }
        return v + 1;
      });
    }, 14);
    return () => window.clearInterval(id);
  }, [text]);
  return <>{text.slice(0, n)}</>;
}
