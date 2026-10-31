"use client";

import { Mli } from "./m";
import { DONT, NEXT, NOW } from "./callers";

export function Fit() {
  return (
    <div className="groups">
      <Group label="Now" rows={NOW} />
      <Group label="Next" rows={NEXT} shimmer />
      <Group label="What we don't claim" rows={DONT} />
    </div>
  );
}

function Group({ label, rows, shimmer = false }: { label: string; rows: string[][]; shimmer?: boolean }) {
  return (
    <div className="group">
      <h3>{label}</h3>
      <ul className="rows">
        {rows.map(([name, value], i) => (
          <Mli
            key={name}
            className={shimmer ? "pair shimmer" : "pair"}
            initial={{ opacity: 0, transform: "translateY(10px)" }}
            whileInView={{ opacity: 1, transform: "translateY(0px)" }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.4, delay: i * 0.06, ease: [0.23, 1, 0.32, 1] }}
          >
            <span>{name}</span>
            <span className="pair-value">{value}</span>
          </Mli>
        ))}
      </ul>
    </div>
  );
}
