"use client";

import { useEffect, useState } from "react";

/** Untitled Goose Game style to-do list: a taped notebook page, pencil ticks and a wobbly strikethrough. */
export interface Task { text: string; done: boolean }

const TICK = "M3 12.5 L8.5 18 L20 3.5";
// a slightly uneven pencil line, stretched to the task's width
const STRIKE = "M0 4.6 C 18 3.2, 40 5.4, 60 4.2 S 88 3.4, 100 4.8";

export function TodoCard({ area, clock, tasks }: { area: string; clock: string; tasks: Task[] }) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.code === "Tab") { e.preventDefault(); setCollapsed((c) => !c); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [time, rest] = clock.split(" · ");
  const rush = rest?.startsWith("class change");
  const left = tasks.filter((t) => !t.done).length;
  return (
    <div className={`hud todo${collapsed ? " collapsed" : ""}`} onClick={() => setCollapsed((c) => !c)} title="To-do list (Tab)">
      <div className="todo-head">
        <span className="todo-title hand">To do{collapsed && left ? ` (${left})` : ""}</span>
        <span className="todo-area">{area}</span>
      </div>
      <ul>
        {tasks.map((t) => {
          const locked = t.text.startsWith("???");
          return (
            <li key={t.text} className={`${t.done ? "done" : ""}${locked ? " locked" : ""} hand`}>
              <span className="todo-box"><svg viewBox="0 0 24 24"><path d={TICK} pathLength={40} /></svg></span>
              <span className="todo-text">
                {locked ? "???" : t.text}
                {t.done && <svg className="todo-strike" viewBox="0 0 100 8" preserveAspectRatio="none"><path d={STRIKE} pathLength={1} /></svg>}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="todo-foot">
        <span>{time}</span>·<span className={rush ? "rush" : ""}>{rest}</span>
      </div>
    </div>
  );
}

/** "Crossed off!" slip shown when a task is done. */
export function TaskToast({ text }: { text: string }) {
  return (
    <div key={text} className="hud task-toast hand">
      <svg viewBox="0 0 24 24"><path d={TICK} pathLength={40} /></svg>
      <div><small>CROSSED OFF</small><div>{text}</div></div>
    </div>
  );
}
