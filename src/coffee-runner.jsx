import React, { useEffect, useRef, useState } from "react";

const WIDTH = 720;
const HEIGHT = 280;
const FLOOR = 226;
const CUP_X = 92;
const CUP_WIDTH = 42;
const CUP_HEIGHT = 46;
const HIGH_SCORE_KEY = "cg-coffee-runner-high-score";

function newRun() {
  return {
    y: FLOOR - CUP_HEIGHT,
    velocity: 0,
    obstacles: [],
    spawnIn: 88,
    distance: 0,
    lastFrame: 0,
  };
}

function drawCup(ctx, y) {
  ctx.fillStyle = "#fff9ed";
  ctx.beginPath();
  ctx.roundRect(CUP_X, y, CUP_WIDTH, CUP_HEIGHT, [6, 6, 12, 12]);
  ctx.fill();
  ctx.strokeStyle = "#174f43";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(CUP_X + CUP_WIDTH + 3, y + 18, 11, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.fillStyle = "#9b613e";
  ctx.fillRect(CUP_X + 4, y + 6, CUP_WIDTH - 8, 7);
  ctx.fillStyle = "#174f43";
  ctx.beginPath();
  ctx.arc(CUP_X + 15, y + 27, 2, 0, Math.PI * 2);
  ctx.arc(CUP_X + 29, y + 27, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(CUP_X + 22, y + 29, 6, 0, Math.PI);
  ctx.stroke();
  ctx.strokeStyle = "#b5b99d";
  ctx.lineWidth = 2;
  for (const x of [CUP_X + 15, CUP_X + 27]) {
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.quadraticCurveTo(x - 5, y - 12, x, y - 19);
    ctx.stroke();
  }
}

function drawObstacle(ctx, obstacle) {
  if (obstacle.kind === "donut") {
    ctx.fillStyle = "#ad7046";
    ctx.beginPath();
    ctx.ellipse(obstacle.x + 18, FLOOR - 17, 18, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#dfac79";
    ctx.beginPath();
    ctx.ellipse(obstacle.x + 18, FLOOR - 21, 17, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff4e0";
    ctx.beginPath();
    ctx.arc(obstacle.x + 18, FLOOR - 19, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#174f43";
    for (const [dx, dy] of [
      [9, -23],
      [26, -25],
      [29, -16],
    ])
      ctx.fillRect(obstacle.x + dx, FLOOR + dy, 3, 2);
  } else {
    ctx.fillStyle = "#8b5335";
    ctx.beginPath();
    ctx.ellipse(obstacle.x + 20, FLOOR - 10, 20, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b57b55";
    ctx.beginPath();
    ctx.ellipse(obstacle.x + 20, FLOOR - 12, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawScene(ctx, game) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#f7f2e7";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#e8e4d4";
  for (const [x, y, w] of [
    [80, 50, 76],
    [360, 70, 108],
    [610, 44, 65],
  ]) {
    ctx.beginPath();
    ctx.ellipse(x, y, w / 2, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#d9e1cc";
  ctx.fillRect(0, FLOOR, WIDTH, HEIGHT - FLOOR);
  ctx.strokeStyle = "#76936d";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, FLOOR);
  ctx.lineTo(WIDTH, FLOOR);
  ctx.stroke();
  ctx.fillStyle = "#afbf9e";
  const offset = game.distance % 48;
  for (let x = -offset; x < WIDTH; x += 48) ctx.fillRect(x, FLOOR + 23, 22, 3);
  for (const obstacle of game.obstacles) drawObstacle(ctx, obstacle);
  drawCup(ctx, game.y);
}

function readHighScore() {
  try {
    return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

export default function CoffeeRunner() {
  const canvas = useRef(null);
  const game = useRef(newRun());
  const phaseRef = useRef("ready");
  const [phase, setPhase] = useState("ready");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(readHighScore);

  function start() {
    game.current = newRun();
    phaseRef.current = "running";
    setPhase("running");
    setScore(0);
  }

  function jump() {
    if (phaseRef.current !== "running") {
      start();
      return;
    }
    const current = game.current;
    if (current.y >= FLOOR - CUP_HEIGHT - 0.5) current.velocity = -12;
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      if (["Space", "ArrowUp"].includes(event.code)) {
        event.preventDefault();
        if (!event.repeat) jump();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    let frame;
    const tick = (now) => {
      const current = game.current;
      const step = current.lastFrame
        ? Math.min((now - current.lastFrame) / 16.67, 2)
        : 1;
      current.lastFrame = now;
      if (phaseRef.current === "running") {
        current.velocity += 0.64 * step;
        current.y = Math.min(
          FLOOR - CUP_HEIGHT,
          current.y + current.velocity * step,
        );
        if (current.y === FLOOR - CUP_HEIGHT) current.velocity = 0;
        const speed = Math.min(9.5, 5 + current.distance / 1100);
        current.distance += speed * step;
        const nextScore = Math.floor(current.distance / 10);
        setScore((old) => (old === nextScore ? old : nextScore));
        current.spawnIn -= step;
        if (current.spawnIn <= 0) {
          const kind = Math.random() > 0.35 ? "donut" : "spill";
          current.obstacles.push({
            x: WIDTH + 10,
            kind,
            width: kind === "donut" ? 36 : 40,
            height: kind === "donut" ? 34 : 19,
          });
          current.spawnIn = 75 + Math.random() * 40;
        }
        for (const obstacle of current.obstacles) obstacle.x -= speed * step;
        current.obstacles = current.obstacles.filter(
          (obstacle) => obstacle.x + obstacle.width > 0,
        );
        const hit = current.obstacles.some(
          (obstacle) =>
            CUP_X + 6 < obstacle.x + obstacle.width - 5 &&
            CUP_X + CUP_WIDTH - 5 > obstacle.x + 5 &&
            current.y + CUP_HEIGHT - 3 > FLOOR - obstacle.height,
        );
        if (hit) {
          phaseRef.current = "over";
          setPhase("over");
          setHighScore((old) => {
            const best = Math.max(old, nextScore);
            try {
              localStorage.setItem(HIGH_SCORE_KEY, String(best));
            } catch {}
            return best;
          });
        }
      }
      drawScene(ctx, current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="coffee-runner">
      <div className="coffee-runner-scores" aria-live="polite">
        <span>
          Score <strong>{score}</strong>
        </span>
        <span>
          Best <strong>{highScore}</strong>
        </span>
      </div>
      <div className="coffee-runner-board">
        <canvas
          ref={canvas}
          width={WIDTH}
          height={HEIGHT}
          role="img"
          aria-label="A smiling coffee cup jumps over donuts and coffee spills"
          onPointerDown={jump}
        />
        {phase !== "running" && (
          <div className="coffee-runner-message">
            <strong>
              {phase === "ready" ? "Ready to roll?" : "Coffee break over!"}
            </strong>
            <span>
              {phase === "ready"
                ? "Hop past the pastries."
                : `You scored ${score} points.`}
            </span>
          </div>
        )}
      </div>
      <p>
        Press Space or ↑ to jump, or tap the game. Dodge donuts and coffee
        spills.
      </p>
      <div className="coffee-runner-actions">
        {phase === "running" ? (
          <button
            className="primary"
            onPointerDown={(event) => {
              event.preventDefault();
              jump();
            }}
          >
            Jump
          </button>
        ) : (
          <button className="primary" onClick={start}>
            {phase === "ready" ? "Start run" : "Play again"}
          </button>
        )}
      </div>
    </div>
  );
}
