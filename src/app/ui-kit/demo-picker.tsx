"use client";

import { useState } from "react";
import { Chip } from "@/components/ui";
import { formatMinutes } from "@/lib/format";

const EXTRAS = [
  { id: "towel", name: "فوطة سخنة", minutes: 10 },
  { id: "mask", name: "ماسك وش", minutes: 15 },
  { id: "wash", name: "غسيل شعر", minutes: 10 },
];

export function DemoPicker() {
  const [picked, setPicked] = useState<string[]>(["towel"]);
  const total = 30 + EXTRAS.filter((e) => picked.includes(e.id)).reduce((a, e) => a + e.minutes, 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {EXTRAS.map((e) => (
          <Chip
            key={e.id}
            selected={picked.includes(e.id)}
            onClick={() => setPicked((p) => (p.includes(e.id) ? p.filter((x) => x !== e.id) : [...p, e.id]))}
          >
            {e.name}
          </Chip>
        ))}
      </div>
      <p className="text-ink-soft">قصة + دقن ومعاها الإضافات: حوالي {formatMinutes(total)}</p>
    </div>
  );
}
