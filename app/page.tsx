// @refresh reset
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Formation = "middle" | "sides";
type Gate = { id: number; formation: Formation; value?: number; y: number; tutorial?: boolean; isFalse?: boolean; kind?: "number" | "spikes" };

// Spawn just below the horizon so every incoming formation is visible immediately.
const START_Y = 6;
// Kept in sync with the player’s visual road position in globals.css.
const PLAYER_Y = 71;
const SPEED = 17;
const WIN_VALUE = 8192;
const GAME_RULESET_VERSION = "single-valid-gate-v2";
function nextGate(id: number, y: number, playerValue: number): Gate {
  const isFinal = playerValue * 2 >= WIN_VALUE;
  const formation: Formation = isFinal ? "middle" : Math.random() > 0.5 ? "middle" : "sides";
  if (!isFinal && Math.random() < 0.22) return { id, formation, y, kind: "spikes" };
  const isFalse = !isFinal && Math.random() < 0.55;
  const validValue = formation === "middle" ? playerValue : Math.max(1, playerValue / 2);
  const falseValue = formation === "middle" ? playerValue * 2 : playerValue;
  return { id, formation, value: isFalse ? falseValue : validValue, y, isFalse, kind: "number" };
}

export default function Home() {
  const [gates, setGates] = useState<Gate[]>([{ id: 0, formation: "middle", value: 1, y: 40, tutorial: true }]);
  const [split, setSplit] = useState(false);
  const [value, setValue] = useState(1);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<"intro" | "playing" | "won" | "gameover">("intro");
  const state = useRef({ gates, split, value, score, status, nextId: 1 });

  useEffect(() => {
    state.current = { ...state.current, gates, split, value, score, status };
  }, [gates, split, value, score, status]);

  const reset = useCallback(() => {
    state.current = { gates: [{ id: 0, formation: "middle", value: 1, y: 40, tutorial: true }], split: false, value: 1, score: 0, status: "intro", nextId: 1 };
    setGates(state.current.gates); setSplit(false); setValue(1); setScore(0); setStatus("intro");
  }, []);

  // Fast Refresh preserves state in development, including any formations that
  // were queued under an older version of the game rules.
  useEffect(() => {
    reset();
  }, [reset]);

  const toggle = useCallback(() => {
    if (state.current.status === "gameover" || state.current.status === "won") { reset(); return; }
    if (state.current.status === "playing" && state.current.value >= 2) {
      state.current.split = !state.current.split;
      setSplit(state.current.split);
    }
  }, [reset]);

  useEffect(() => {
    let previous = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const elapsed = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      const current = state.current;
      if (current.status !== "gameover" && current.status !== "won") {
        let crashed = false;
        let upgraded = false;
        let resolved = false;
        const moved: Gate[] = [];
        for (const gate of current.gates) {
          const y = gate.y + SPEED * elapsed;
          if (y >= PLAYER_Y && gate.y < PLAYER_Y) {
            const sharesLane = (gate.formation === "middle" && !current.split) ||
              (gate.formation === "sides" && current.split);
            resolved = true;
            if (gate.kind === "spikes") {
              if (sharesLane) crashed = true;
            } else if (!sharesLane) {
              // The formation passes harmlessly through the empty lane(s).
            } else if (gate.isFalse) {
              crashed = true;
            } else {
              upgraded = true;
              current.score += 1;
              if (current.status === "intro") { current.value = 2; current.status = "playing"; }
              else current.value *= 2;
              if (current.value >= WIN_VALUE) current.status = "won";
            }
          } else if (y < 106) moved.push({ ...gate, y });
        }
        if (!crashed) {
          // Create the next challenge only once this one has been collected.
          // That keeps its number aligned with the player's newly doubled value.
          let result = moved;
          if (resolved && current.status !== "won") result = [...result, nextGate(current.nextId++, START_Y, current.value)];
          current.gates = result;
          setGates(result);
          if (upgraded) { setValue(current.value); setScore(current.score); setStatus(current.status); }
        } else {
          current.status = "gameover"; setStatus("gameover");
        }
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  const isIntro = status === "intro";
  return (
    <main className="game" onPointerDown={toggle}>
      <div className="sky" data-ruleset={GAME_RULESET_VERSION}><div className="sun" /></div>
      <header>
        <div className="brand"><span>POWER</span> RUN</div>
        <div className="score"><small>RUN</small>{score.toString().padStart(3, "0")}</div>
      </header>
      <section className="road" aria-label="Three lane number path">
        <svg className="lane-guides" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M50 0 L33.33 100 M50 0 L66.67 100" />
        </svg>
        <div className="road-markers" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        {gates.map((gate) => <GateBlock key={gate.id} gate={gate} />)}
        <Player value={value} split={split} />
      </section>
      <div className="instruction">
        {status === "gameover" ? <><b>RUN OVER</b><span>tap anywhere to restart</span></> : status === "won" ? <><b>YOU MADE 8192!</b><span>tap anywhere to run again</span></> : isIntro ? <><b>COLLECT THE 1</b><span>same values fuse into the next power</span></> : <><b>{split ? "SPLIT" : "JOIN"} MODE</b><span>match the number — dodge false blocks</span></>}
      </div>
      {(status === "gameover" || status === "won") && (
        <section className={`end-screen end-${status}`} aria-live="assertive">
          <div className="end-card">
            <p>{status === "won" ? "MISSION COMPLETE" : "RUN TERMINATED"}</p>
            <h1>{status === "won" ? "8192" : "GAME OVER"}</h1>
            <strong>{status === "won" ? "You mastered the powers of two." : "A false number or spike stopped your run."}</strong>
            <div className="end-score"><span>MERGES</span>{score.toString().padStart(2, "0")}</div>
            <small>TAP ANYWHERE TO {status === "won" ? "PLAY AGAIN" : "RESTART"}</small>
          </div>
        </section>
      )}
    </main>
  );
}

function GateBlock({ gate }: { gate: Gate }) {
  const side = gate.formation === "sides";
  const scale = Math.max(0.34, Math.min(1, gate.y / 70));
  const sideOffset = 2 + 31.33 * (gate.y / 100);
  return <div className={`gate ${gate.kind === "spikes" ? "gate-spikes" : ""}`} style={{ "--y": `${gate.y}%`, "--scale": scale, "--side-offset": `${sideOffset}%` } as React.CSSProperties}>
    {gate.kind === "spikes"
      ? side ? <><Spike lane="block-side-left" /><Spike lane="block-side-right" /></> : <Spike lane="block-middle" />
      : side ? <><Block value={gate.value!} lane="block-side-left" /><Block value={gate.value!} lane="block-side-right" /></> : <Block value={gate.value!} lane="block-middle" />}
  </div>;
}

function Player({ value, split }: { value: number; split: boolean }) {
  const isSplit = split && value >= 2;
  const sideOffset = 2 + 31.33 * (PLAYER_Y / 100);
  return <div className={`player ${isSplit ? "player-split" : ""}`} style={{ "--side-offset": `${sideOffset}%` } as React.CSSProperties}>
    {isSplit ? <><Block value={value / 2} player lane="block-side-left" /><Block value={value / 2} player lane="block-side-right" /></> : <Block value={value} player lane="block-middle" />}
  </div>;
}

function Block({ value, player = false, lane }: { value: number; player?: boolean; lane: string }) {
  const hue = (Math.log2(value) * 43 + 28) % 360;
  return <div className={`block ${player ? "player-block" : ""} ${lane}`} style={{ "--block-hue": hue } as React.CSSProperties}><span>{value}</span><em>2<sup>{Math.log2(value)}</sup></em></div>;
}

function Spike({ lane }: { lane: string }) {
  return <div className={`spike ${lane}`} aria-label="metal caltrop hazard">
    <i className="spike-up" /><i className="spike-left" /><i className="spike-right" /><i className="spike-down" /><b />
  </div>;
}
