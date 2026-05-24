import { useCallback, useEffect, useRef, useState } from "react";
import type { ScrollPhase } from "./types";
import { ALBUM_DATA } from "./album-data";

const MASK_DURATION = 30;
const DISSOLVE_DURATION = 60;
const WHEEL_THRESHOLD = 3;
const TOUCH_THRESHOLD = 30;
const MOMENTUM_FRICTION = 0.88;
const MOMENTUM_MIN = 0.4;
const MOMENTUM_INTERVAL = 40;

const DRAG_AFTER_SELECTION = 4;
const DRAG_STEPS = 30;

interface ScrollState {
  phase: ScrollPhase;
  selectionIndex: number;
  drawnSegments: number;
  dragProgress: number;
}

export function useScrollHijack() {
  const [state, setState] = useState<ScrollState>({
    phase: "idle",
    selectionIndex: 0,
    drawnSegments: 0,
    dragProgress: 0,
  });

  const animatingRef = useRef(false);
  const touchStartRef = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const momentumRef = useRef(0);
  const momentumTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSelections = ALBUM_DATA.layers.length;

  const getPointCount = useCallback(
    (idx: number) => {
      if (idx >= totalSelections) return 0;
      return ALBUM_DATA.layers[idx].selection.points.length;
    },
    [totalSelections],
  );

  const advanceRaw = useCallback(
    (steps: number) => {
      if (animatingRef.current) return;
      const { selectionIndex, drawnSegments, phase: curPhase } = stateRef.current;

      if (curPhase === "dragging") {
        const inc = steps / DRAG_STEPS;
        const { dragProgress: curDrag, selectionIndex: curSel } = stateRef.current;
        const next = Math.min(curDrag + inc, 1);

        if (next >= 1) {
          setState((s) => ({ ...s, dragProgress: 1 }));
          animatingRef.current = true;
          setTimeout(() => {
            setState((s) => ({ ...s, phase: "masking" }));
            setTimeout(() => {
              setState((s) => ({ ...s, phase: "dissolving" }));
              setTimeout(() => {
                const nextSel = curSel + 1;
                setState({
                  phase: nextSel >= totalSelections ? "complete" : "idle",
                  selectionIndex: nextSel,
                  drawnSegments: 0,
                  dragProgress: 0,
                });
                animatingRef.current = false;
              }, DISSOLVE_DURATION);
            }, MASK_DURATION);
          }, 200);
        } else {
          setState((s) => ({ ...s, dragProgress: next }));
        }
        return;
      }

      if (selectionIndex >= totalSelections) return;

      const pointCount = getPointCount(selectionIndex);
      const progress = drawnSegments / pointCount;
      const remaining = 1 - (drawnSegments + steps) / pointCount;
      const nearEdge = progress < 0.12 || remaining < 0.12;
      const easedSteps = nearEdge ? Math.max(1, Math.ceil(steps * 0.3)) : steps;
      const next = Math.min(drawnSegments + easedSteps, pointCount);

      if (next < pointCount) {
        setState((s) => ({ ...s, phase: "drawing", drawnSegments: next }));
      } else {
        animatingRef.current = true;
        momentumRef.current = 0;
        setState((s) => ({ ...s, phase: "closing", drawnSegments: pointCount }));

        setTimeout(() => {
          if (selectionIndex === DRAG_AFTER_SELECTION - 1) {
            setState((s) => ({
              ...s,
              phase: "dragging",
              dragProgress: 0,
            }));
            animatingRef.current = false;
          } else {
            setState((s) => ({ ...s, phase: "masking" }));
            setTimeout(() => {
              setState((s) => ({ ...s, phase: "dissolving" }));
              setTimeout(() => {
                const nextSel = selectionIndex + 1;
                setState({
                  phase: nextSel >= totalSelections ? "complete" : "idle",
                  selectionIndex: nextSel,
                  drawnSegments: 0,
                  dragProgress: 0,
                });
                animatingRef.current = false;
              }, DISSOLVE_DURATION);
            }, MASK_DURATION);
          }
        }, 50);
      }
    },
    [totalSelections, getPointCount],
  );

  const retreatRaw = useCallback(
    (steps: number) => {
      if (animatingRef.current) return;
      const { selectionIndex, drawnSegments, phase: curPhase } = stateRef.current;

      if (curPhase === "dragging") {
        const dec = steps / DRAG_STEPS;
        setState((s) => {
          const next = Math.max(s.dragProgress - dec, 0);
          return { ...s, dragProgress: next };
        });
        return;
      }

      if (drawnSegments > 0) {
        const next = Math.max(drawnSegments - steps, 0);
        setState((s) => ({ ...s, phase: "drawing", drawnSegments: next }));
      } else if (selectionIndex > 0) {
        const prevPointCount = getPointCount(selectionIndex - 1);
        setState({
          phase: "idle",
          selectionIndex: selectionIndex - 1,
          drawnSegments: prevPointCount,
        });
      }
    },
    [getPointCount],
  );

  const startMomentum = useCallback(
    (velocity: number) => {
      if (momentumTimer.current) clearInterval(momentumTimer.current);
      momentumRef.current = velocity;

      momentumTimer.current = setInterval(() => {
        momentumRef.current *= MOMENTUM_FRICTION;

        if (Math.abs(momentumRef.current) < MOMENTUM_MIN) {
          if (momentumTimer.current) clearInterval(momentumTimer.current);
          momentumTimer.current = null;
          return;
        }

        const steps = Math.max(1, Math.round(Math.abs(momentumRef.current)));
        if (momentumRef.current > 0) advanceRaw(steps);
        else retreatRaw(steps);
      }, MOMENTUM_INTERVAL);
    },
    [advanceRaw, retreatRaw],
  );

  const advance = useCallback(
    (steps: number) => {
      advanceRaw(steps);
      startMomentum(steps * 0.6);
    },
    [advanceRaw, startMomentum],
  );

  const retreat = useCallback(
    (steps: number) => {
      retreatRaw(steps);
      startMomentum(-steps * 0.6);
    },
    [retreatRaw, startMomentum],
  );

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaY);
      if (delta < WHEEL_THRESHOLD) return;

      if (momentumTimer.current) {
        clearInterval(momentumTimer.current);
        momentumTimer.current = null;
      }

      const steps = Math.max(1, Math.floor(delta / 15));
      if (e.deltaY > 0) advance(steps);
      else retreat(steps);
    };

    const onTouchStart = (e: TouchEvent) => {
      touchStartRef.current = e.touches[0].clientY;
      if (momentumTimer.current) {
        clearInterval(momentumTimer.current);
        momentumTimer.current = null;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const delta = touchStartRef.current - e.changedTouches[0].clientY;
      if (Math.abs(delta) < TOUCH_THRESHOLD) return;
      const steps = Math.max(1, Math.floor(Math.abs(delta) / 20));
      if (delta > 0) advance(steps);
      else retreat(steps);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        advance(e.key === "PageDown" ? 10 : 3);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        retreat(e.key === "PageUp" ? 10 : 3);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
      if (momentumTimer.current) clearInterval(momentumTimer.current);
    };
  }, [advance, retreat]);

  const goToSection = useCallback(
    (index: number) => {
      if (animatingRef.current) return;
      if (index < 0 || index > totalSelections) return;
      if (momentumTimer.current) {
        clearInterval(momentumTimer.current);
        momentumTimer.current = null;
      }
      momentumRef.current = 0;
      setState({
        phase: index >= totalSelections ? "complete" : "idle",
        selectionIndex: index,
        drawnSegments: 0,
        dragProgress: 0,
      });
    },
    [totalSelections],
  );

  return { ...state, goToSection };
}
