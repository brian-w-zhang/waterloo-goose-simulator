"use client";

import dynamic from "next/dynamic";

// The game touches WebGPU and window at import time, so it never renders on the server.
const Game = dynamic(() => import("./Game"), { ssr: false });

export default function GameLoader() {
  return <Game />;
}
