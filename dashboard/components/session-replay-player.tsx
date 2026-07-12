"use client";

import { useEffect, useRef } from "react";
import type { eventWithTime } from "@rrweb/types";

type session_replay_player_props = {
  events: Record<string, unknown>[];
  className?: string;
};

// AI : rrweb Replayer throws if events.length < 2 (full snapshot + at least one update).
const MIN_RRWEB_EVENTS = 2;

export function SessionReplayPlayer({ events, className }: session_replay_player_props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || events.length < MIN_RRWEB_EVENTS) return;

    // AI : rrweb-player instance — destroy via getReplayer().destroy() when available.
    let instance: { getReplayer?: () => { destroy?: () => void } } | null = null;
    let cancelled = false;

    void Promise.all([import("rrweb-player"), import("rrweb-player/dist/style.css")]).then(
      ([{ default: rrwebPlayer }]) => {
        if (cancelled || !hostRef.current) return;
        host.innerHTML = "";
        instance = new rrwebPlayer({
          target: host,
          props: {
            events: events as eventWithTime[],
            width: host.clientWidth || 1024,
            height: 480,
            autoPlay: false,
            showController: true,
          },
        });
      },
    );

    return () => {
      cancelled = true;
      instance?.getReplayer?.()?.destroy?.();
      if (host) host.innerHTML = "";
    };
  }, [events]);

  if (events.length === 0) {
    return <p className="text-sm text-muted">No replay events in this session.</p>;
  }

  if (events.length < MIN_RRWEB_EVENTS) {
    return (
      <p className="text-sm text-muted">
        Recording too short to play back — wait for more interaction or try a longer session.
      </p>
    );
  }

  return <div ref={hostRef} className={className} />;
}
