"use client";

import { useReducer } from "react";
import { CounterBoard } from "@/components/counter/counter-board";
import { demoReducer } from "@/lib/queue/demo-store";
import { sampleCounter } from "@/lib/queue/sample";

export function DemoCounter() {
  const [state, dispatch] = useReducer(demoReducer, undefined, sampleCounter);
  return (
    <CounterBoard
      state={state}
      onNext={(barberId, expectedCurrent) => dispatch({ type: "next", barberId, expectedCurrent })}
      onNoShow={(entryId) => dispatch({ type: "no_show", entryId })}
      onMove={(entryId, delta) => dispatch({ type: "move", entryId, delta })}
      onWalkIn={(name) => dispatch({ type: "walk_in", name, service: "قصة شعر" })}
      onToggleOpen={() => dispatch({ type: "toggle_open" })}
      onToggleDuty={(barberId) => dispatch({ type: "toggle_duty", barberId })}
    />
  );
}
