// @refresh reset
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Formation = "middle" | "sides";
type Gate = { id: number; formation: Formation; value?: number; y: number; tutorial?: boolean; isFalse?: boolean; kind?: "number" | "spikes" };
type CrashDetails = { player: string; obstacle: string; reason: string };

// Spawn just below the horizon so every incoming formation is visible immediately.
const START_Y = 6;
// Kept in sync with the player’s visual road position in globals.css.
const PLAYER_Y = 71;
const SPEED = 20;
const LEVEL_2_SPEED_MULTIPLIER = 1.2;
const WIN_VALUE = 8192;
// The next row enters only after the previous row has moved far enough ahead
// to preserve roughly one full cube of clear space as both grow in perspective.
const SPAWN_GAP = 30;
const LEVEL_3_SPAWN_GAP = 14;
const MAX_OBSTACLES = 5;
const LEVEL_3_MAX_OBSTACLES = 6;
const GAME_RULESET_VERSION = "single-valid-gate-v2";
function valueForGate(gate: Gate, playerValue: number) {
  const validValue = gate.formation === "middle" ? playerValue : Math.max(1, playerValue / 2);
  const falseValue = gate.formation === "middle" ? playerValue * 2 : playerValue;
  return gate.isFalse ? falseValue : validValue;
}

function nextGate(id: number, y: number, playerValue: number): Gate {
  const isFinal = playerValue * 2 >= WIN_VALUE;
  const formation: Formation = isFinal ? "middle" : Math.random() > 0.5 ? "middle" : "sides";
  if (!isFinal && Math.random() < 0.22) return { id, formation, y, kind: "spikes" };
  const isFalse = !isFinal && Math.random() < 0.55;
  const gate: Gate = { id, formation, y, isFalse, kind: "number" };
  return { ...gate, value: valueForGate(gate, playerValue) };
}

function startingGates(level: 1 | 2 | 3) {
  const tutorial: Gate = { id: 0, formation: "middle", value: 1, y: 40, tutorial: true };
  if (level !== 3) return { gates: [tutorial], nextId: 1 };

  let projectedValue = 2;
  const second = nextGate(1, 23, projectedValue);
  if (second.kind === "number" && !second.isFalse) projectedValue *= 2;
  const third = nextGate(2, 6, projectedValue);
  return { gates: [tutorial, second, third], nextId: 3 };
}

export default function Home() {
  const [gates, setGates] = useState<Gate[]>([{ id: 0, formation: "middle", value: 1, y: 40, tutorial: true }]);
  const [split, setSplit] = useState(false);
  const [value, setValue] = useState(1);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState<1 | 2 | 3>(1);
  const [status, setStatus] = useState<"intro" | "playing" | "levelcomplete" | "won" | "gameover">("intro");
  const [crashDetails, setCrashDetails] = useState<CrashDetails | null>(null);
  const state = useRef({ gates, split, value, score, level, status, nextId: 1, crashDetails: null as CrashDetails | null });

  useEffect(() => {
    state.current = { ...state.current, gates, split, value, score, level, status };
  }, [gates, split, value, score, level, status]);

  const reset = useCallback(() => {
    state.current = { gates: [{ id: 0, formation: "middle", value: 1, y: 40, tutorial: true }], split: false, value: 1, score: 0, level: 1, status: "intro", nextId: 1, crashDetails: null };
    setGates(state.current.gates); setSplit(false); setValue(1); setScore(0); setLevel(1); setStatus("intro"); setCrashDetails(null);
  }, []);

  const selectLevel = useCallback((targetLevel: 1 | 2 | 3) => {
    const opening = startingGates(targetLevel);
    state.current = { gates: opening.gates, split: false, value: 1, score: 0, level: targetLevel, status: "intro", nextId: opening.nextId, crashDetails: null };
    setGates(opening.gates); setSplit(false); setValue(1); setScore(0); setLevel(targetLevel); setStatus("intro"); setCrashDetails(null);
  }, []);

  // Fast Refresh preserves state in development, including any formations that
  // were queued under an older version of the game rules.
  useEffect(() => {
    reset();
  }, [reset]);

  const toggle = useCallback(() => {
    if (state.current.status === "gameover" || state.current.status === "won") { reset(); return; }
    if (state.current.status === "levelcomplete") {
      const nextLevel = (state.current.level + 1) as 2 | 3;
      const opening = startingGates(nextLevel);
      state.current = { ...state.current, gates: opening.gates, split: false, value: 1, level: nextLevel, status: "intro", nextId: opening.nextId, crashDetails: null };
      setGates(opening.gates); setSplit(false); setValue(1); setLevel(nextLevel); setStatus("intro"); setCrashDetails(null);
      return;
    }
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
      if (current.status !== "gameover" && current.status !== "won" && current.status !== "levelcomplete") {
        let crashed = false;
        let crash: CrashDetails | null = null;
        let upgraded = false;
        const moved: Gate[] = [];
        for (const gate of current.gates) {
          // Compensate for the widening perspective so motion does not appear
          // to slow as a gate approaches the player.
          const perspectiveSpeed = 0.5 + 1.5 * Math.min(1, gate.y / PLAYER_Y);
          const levelSpeed = current.level >= 2 ? LEVEL_2_SPEED_MULTIPLIER : 1;
          const y = gate.y + SPEED * levelSpeed * perspectiveSpeed * elapsed;
          if (y >= PLAYER_Y && gate.y < PLAYER_Y) {
            const sharesLane = (gate.formation === "middle" && !current.split) ||
              (gate.formation === "sides" && current.split);
            const playerDescription = current.split ? `two ${current.value / 2} cubes` : `one ${current.value} cube`;
            const obstacleDescription = gate.kind === "spikes"
              ? `${gate.formation === "sides" ? "two side spikes" : "one center spike"}`
              : `${gate.formation === "sides" ? "two side" : "one center"} ${gate.value} cube${gate.formation === "sides" ? "s" : ""}`;
            if (gate.kind === "spikes") {
              if (sharesLane) {
                crashed = true;
                crash = { player: playerDescription, obstacle: obstacleDescription, reason: "You hit spikes." };
              }
            } else {
              // Decide from the numbers shown, never from hidden gate metadata.
              // Compare individual cubes, not the combined value of a split
              // player. Two 64 cubes must not treat one center 128 as a match.
              const playerBlockValue = current.split ? current.value / 2 : current.value;
              const isMatching = gate.value === playerBlockValue;
              if (!isMatching && sharesLane) {
                crashed = true;
                crash = { player: playerDescription, obstacle: obstacleDescription, reason: "You hit a non-matching cube." };
              } else if (isMatching && sharesLane) {
                upgraded = true;
                current.score += 1;
                if (current.status === "intro") { current.value = 2; current.status = "playing"; }
                else current.value *= 2;
                if (current.value >= WIN_VALUE) current.status = current.level < 3 ? "levelcomplete" : "won";
              }
            }
          } else if (y < 106) moved.push({ ...gate, y });
        }
        if (!crashed) {
          let result = moved;
          // Maintain a stream of spaced challenges so 3-5 obstacle pieces can
          // be visible. A cube's number is fixed permanently when it spawns.
          const furthestY = result.length ? Math.min(...result.map((gate) => gate.y)) : Infinity;
          const obstacleCount = result.reduce((count, gate) => count + (gate.formation === "sides" ? 2 : 1), 0);
          const maxObstacles = current.level === 3 ? LEVEL_3_MAX_OBSTACLES : MAX_OBSTACLES;
          const spawnGap = current.level === 3 ? LEVEL_3_SPAWN_GAP : SPAWN_GAP;
          if (current.status !== "won" && furthestY >= spawnGap && obstacleCount < maxObstacles) {
            // Project through closer correct gates so the new fixed label is
            // right when the player eventually reaches it.
            const projectedValue = [...result]
              .sort((a, b) => b.y - a.y)
              .reduce((nextValue, gate) => gate.kind === "number" && !gate.isFalse ? nextValue * 2 : nextValue, current.value);
            const candidate = nextGate(current.nextId, START_Y, projectedValue);
            const candidateSize = candidate.formation === "sides" ? 2 : 1;
            if (obstacleCount + candidateSize <= maxObstacles) {
              current.nextId += 1;
              result = [...result, candidate];
            }
          }
          current.gates = result;
          setGates(result);
          if (upgraded) { setValue(current.value); setScore(current.score); setStatus(current.status); }
        } else {
          current.status = "gameover";
          current.crashDetails = crash;
          setCrashDetails(crash);
          setStatus("gameover");
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
        <nav className="level-picker" aria-label="Jump to level" onPointerDown={(event) => event.stopPropagation()}>
          {([1, 2, 3] as const).map((targetLevel) => (
            <button key={targetLevel} className={level === targetLevel ? "active" : ""} onClick={() => selectLevel(targetLevel)}>
              LEVEL {targetLevel}
            </button>
          ))}
        </nav>
        <div className="score"><small>LEVEL {level}</small>{score.toString().padStart(3, "0")}</div>
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
      {(status === "gameover" || status === "levelcomplete" || status === "won") && (
        <section className={`end-screen end-${status}`} aria-live="assertive">
          <div className="end-card">
            <p>{status === "won" ? "MISSION COMPLETE" : status === "levelcomplete" ? "STAGE CLEARED" : "RUN TERMINATED"}</p>
            <h1>{status === "won" ? "YOU WIN" : status === "levelcomplete" ? `LEVEL ${level + 1}` : "GAME OVER"}</h1>
            <strong>{status === "won" ? "You mastered all three levels." : status === "levelcomplete" ? level === 1 ? "Same challenge, now 20% quicker." : "Same speed, now with 4–6 obstacles onscreen." : crashDetails?.reason ?? "An obstacle stopped your run."}</strong>
            {status === "gameover" && crashDetails && (
              <div className="crash-details">
                <span><b>PLAYER</b>{crashDetails.player}</span>
                <span><b>OBSTACLE</b>{crashDetails.obstacle}</span>
              </div>
            )}
            <div className="end-score"><span>MERGES</span>{score.toString().padStart(2, "0")}</div>
            <small>TAP ANYWHERE TO {status === "won" ? "PLAY AGAIN" : status === "levelcomplete" ? `START LEVEL ${level + 1}` : "RESTART"}</small>
          </div>
        </section>
      )}
    </main>
  );
}

function GateBlock({ gate }: { gate: Gate }) {
  const side = gate.formation === "sides";
  const scale = Math.max(0.14, Math.min(1, gate.y / 70));
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
