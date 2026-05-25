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
const DRAG_STEPS = 60;
const DRAG_IN_STEPS = 50;
const BSOD_AFTER_SELECTION = 6;
const BSOD_STEPS = 40;
const PRE_BSOD_GLITCH = 800;

interface ScrollState {
  phase: ScrollPhase;
  selectionIndex: number;
  drawnSegments: number;
  dragProgress: number;
  dragInProgress: number;
  bsodProgress: number;
}

export function useScrollHijack() {
  const [state, setState] = useState<ScrollState>({
    phase: "idle",
    selectionIndex: 0,
    drawnSegments: 0,
    dragProgress: 0,
    dragInProgress: 0,
    bsodProgress: 0,
  });

  const animatingRef = useRef(false);
  const bsodSeenRef = useRef(false);
  const bsodShutdownRef = useRef(false);
  const bsodShutdownStartRef = useRef(0);
  const touchStartRef = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const momentumRef = useRef(0);
  const momentumTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSelections = ALBUM_DATA.layers.length;

  const getPointCount = useCallback(
    (idx: number) => {
      if (idx >= totalSelections) return 0;
      const layer = ALBUM_DATA.layers[idx];
      if (layer.collageItems) {
        if (bsodSeenRef.current) {
          return layer.collageItems.filter((item) => !item.trail).length;
        }
        return layer.collageItems.reduce(
          (sum, item) => sum + (item.trail ? item.trail.count : 1),
          0,
        );
      }
      return layer.selection.points.length;
    },
    [totalSelections],
  );

  const isCollageLayer = useCallback(
    (idx: number) => {
      if (idx >= totalSelections) return false;
      return !!ALBUM_DATA.layers[idx].collageItems;
    },
    [totalSelections],
  );

  const advanceRaw = useCallback(
    (steps: number) => {
      if (animatingRef.current) {
        if (bsodShutdownRef.current && performance.now() - bsodShutdownStartRef.current >= 4000) {
          animatingRef.current = false;
          momentumRef.current = 0;
          if (momentumTimer.current) { clearInterval(momentumTimer.current); momentumTimer.current = null; }
          const sel = stateRef.current.selectionIndex;
          setState({ phase: sel >= totalSelections ? "complete" : "idle", selectionIndex: sel, drawnSegments: 0, dragProgress: 0, dragInProgress: 0, bsodProgress: 0 });
        }
        return;
      }
      const { selectionIndex, drawnSegments, phase: curPhase } = stateRef.current;

      if (curPhase === "dragging") {
        const inc = steps / DRAG_STEPS;
        const { dragProgress: curDrag, selectionIndex: curSel } = stateRef.current;
        const next = Math.min(curDrag + inc, 1);

        if (next >= 1) {
          setState((s) => ({ ...s, dragProgress: 1 }));
          animatingRef.current = true;
          setTimeout(() => {
            const nextSel = curSel + 1;
            setState({
              phase: nextSel >= totalSelections ? "complete" : "idle",
              selectionIndex: nextSel,
              drawnSegments: 0,
              dragProgress: 0,
              dragInProgress: 0,
              bsodProgress: 0,
            });
            animatingRef.current = false;
          }, 300);
        } else {
          setState((s) => ({ ...s, dragProgress: next }));
        }
        return;
      }

      if (curPhase === "bsod") {
        const { bsodProgress: curBsod, selectionIndex: curSel } = stateRef.current;
        const isTouch = "ontouchstart" in window;
        let slowdown: number;
        if (isTouch) {
          if (curBsod >= 0.95) slowdown = 0.008;
          else if (curBsod >= 0.85) slowdown = 0.02;
          else if (curBsod >= 0.7) slowdown = 0.06;
          else if (curBsod >= 0.5) slowdown = 0.15;
          else slowdown = 1;
        } else {
          if (curBsod >= 0.95) slowdown = 0.001;
          else if (curBsod >= 0.85) slowdown = 0.005;
          else if (curBsod >= 0.7) slowdown = 0.03;
          else if (curBsod >= 0.5) slowdown = 0.1;
          else slowdown = 1;
        }
        if (curBsod >= 0.5) {
          momentumRef.current = 0;
          if (momentumTimer.current) {
            clearInterval(momentumTimer.current);
            momentumTimer.current = null;
          }
        }
        const inc = (steps / BSOD_STEPS) * slowdown;
        const next = Math.min(curBsod + inc, 1);

        if (next >= 1 && !bsodShutdownRef.current) {
          bsodShutdownRef.current = true;
          bsodShutdownStartRef.current = performance.now();
          setState((s) => ({ ...s, bsodProgress: 1 }));
          animatingRef.current = true;
          momentumRef.current = 0;
          bsodSeenRef.current = true;
          if (momentumTimer.current) {
            clearInterval(momentumTimer.current);
            momentumTimer.current = null;
          }
          // Hold 1800ms + CRT off 400ms + dark 1600ms = 3800ms
          // CRT-on is a visual overlay that doesn't block scroll
          // Use both setTimeout AND rAF polling as safety net
          // (mobile browsers throttle setTimeout in background/low-power)
          const shutdownStart = performance.now();
          let shutdownDone = false;
          let failsafeInterval: ReturnType<typeof setInterval> | null = null;
          const unlockScroll = () => {
            if (shutdownDone) return;
            shutdownDone = true;
            if (failsafeInterval) { clearInterval(failsafeInterval); failsafeInterval = null; }
            momentumRef.current = 0;
            if (momentumTimer.current) {
              clearInterval(momentumTimer.current);
              momentumTimer.current = null;
            }
            setState({
              phase: curSel >= totalSelections ? "complete" : "idle",
              selectionIndex: curSel,
              drawnSegments: 0,
              dragProgress: 0,
              dragInProgress: 0,
              bsodProgress: 0,
            });
            animatingRef.current = false;
          };
          setTimeout(unlockScroll, 3800);
          const pollShutdown = () => {
            if (shutdownDone) return;
            if (performance.now() - shutdownStart >= 3800) { unlockScroll(); return; }
            requestAnimationFrame(pollShutdown);
          };
          requestAnimationFrame(pollShutdown);
          failsafeInterval = setInterval(() => {
            if (performance.now() - shutdownStart >= 3800) unlockScroll();
          }, 200);
        } else {
          setState((s) => ({ ...s, bsodProgress: next }));
        }
        return;
      }

      if (selectionIndex >= totalSelections) return;

      const pointCount = getPointCount(selectionIndex);
      let next: number;

      if (isCollageLayer(selectionIndex)) {
        const layer = ALBUM_DATA.layers[selectionIndex];
        const items = bsodSeenRef.current
          ? layer.collageItems!.filter((item) => !item.trail)
          : layer.collageItems!;
        let tickAcc = 0;
        let isTrailTick = false;
        for (const item of items) {
          const weight = item.trail ? item.trail.count : 1;
          if (drawnSegments < tickAcc + weight) {
            isTrailTick = !!item.trail;
            break;
          }
          tickAcc += weight;
        }

        momentumRef.current = 0;
        if (momentumTimer.current) {
          clearInterval(momentumTimer.current);
          momentumTimer.current = null;
        }

        if (isTrailTick && !bsodSeenRef.current) {
          // Auto-advance all trail ticks (first visit only)
          animatingRef.current = true;
          const autoAdvance = setInterval(() => {
            const { drawnSegments: cur } = stateRef.current;
            if (cur >= pointCount) {
              clearInterval(autoAdvance);
              // Auto-trigger closing → masking → BSOD
              setState((s) => ({ ...s, phase: "closing", drawnSegments: pointCount }));
              setTimeout(() => {
                setState((s) => ({ ...s, phase: "masking" }));
                setTimeout(() => {
                  setState((s) => ({ ...s, phase: "dissolving" }));
                  setTimeout(() => {
                    if (selectionIndex === BSOD_AFTER_SELECTION && !bsodSeenRef.current) {
                      setState((s) => ({
                        ...s,
                        phase: "bsod",
                        selectionIndex: selectionIndex + 1,
                        drawnSegments: 0,
                        bsodProgress: 0,
                      }));
                    } else {
                      const nextSel = selectionIndex + 1;
                      setState({
                        phase: nextSel >= totalSelections ? "complete" : "idle",
                        selectionIndex: nextSel,
                        drawnSegments: 0,
                        dragProgress: 0,
                        dragInProgress: 0,
                        bsodProgress: 0,
                      });
                    }
                    animatingRef.current = false;
                  }, selectionIndex === BSOD_AFTER_SELECTION && !bsodSeenRef.current ? PRE_BSOD_GLITCH : DISSOLVE_DURATION);
                }, MASK_DURATION);
              }, 50);
              return;
            }
            setState((s) => ({ ...s, phase: "drawing", drawnSegments: cur + 1 }));
          }, 30);
          return;
        }

        if (drawnSegments >= pointCount) {
          if (bsodSeenRef.current && curPhase === "idle") {
            setState((s) => ({ ...s, phase: "drawing" }));
            return;
          }
          animatingRef.current = true;
          setState((s) => ({ ...s, phase: "closing", drawnSegments: pointCount }));
          setTimeout(() => {
            setState((s) => ({ ...s, phase: "masking" }));
            setTimeout(() => {
              setState((s) => ({ ...s, phase: "dissolving" }));
              setTimeout(() => {
                if (selectionIndex === BSOD_AFTER_SELECTION && !bsodSeenRef.current) {
                  setState((s) => ({
                    ...s,
                    phase: "bsod",
                    selectionIndex: selectionIndex + 1,
                    drawnSegments: 0,
                    bsodProgress: 0,
                  }));
                } else {
                  const nextSel = selectionIndex + 1;
                  setState({
                    phase: nextSel >= totalSelections ? "complete" : "idle",
                    selectionIndex: nextSel,
                    drawnSegments: 0,
                    dragProgress: 0,
                    dragInProgress: 0,
                    bsodProgress: 0,
                  });
                }
                requestAnimationFrame(() => { animatingRef.current = false; });
              }, selectionIndex === BSOD_AFTER_SELECTION && !bsodSeenRef.current ? PRE_BSOD_GLITCH : DISSOLVE_DURATION);
            }, MASK_DURATION);
          }, 50);
          return;
        }

        if (!bsodSeenRef.current) {
          animatingRef.current = true;
          setTimeout(() => { animatingRef.current = false; }, 400);
        }
        setState((s) => ({ ...s, phase: "drawing", drawnSegments: drawnSegments + 1 }));
        return;
      }

      const TARGET_POINTS = 50;
      const layerSlowdown = selectionIndex === 7 ? 0.35 : 1;
      const weight = Math.max(0.2, pointCount / TARGET_POINTS) * layerSlowdown;
      const normalizedSteps = Math.max(1, Math.round(steps * weight));
      const progress = drawnSegments / pointCount;
      const remaining = 1 - (drawnSegments + normalizedSteps) / pointCount;
      const nearEdge = progress < 0.12 || remaining < 0.12;
      const easedSteps = nearEdge ? Math.max(1, Math.ceil(normalizedSteps * 0.3)) : normalizedSteps;
      next = Math.min(drawnSegments + easedSteps, pointCount);

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
          } else if (selectionIndex === totalSelections - 1) {
            // Last section — skip dissolve, go straight to complete
            setTimeout(() => {
              setState({
                phase: "complete",
                selectionIndex: selectionIndex + 1,
                drawnSegments: 0,
                dragProgress: 0,
                dragInProgress: 0,
                bsodProgress: 0,
              });
              animatingRef.current = false;
            }, 100);
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
                  dragInProgress: 0,
                  bsodProgress: 0,
                });
                animatingRef.current = false;
              }, DISSOLVE_DURATION);
            }, MASK_DURATION);
          }
        }, 50);
      }
    },
    [totalSelections, getPointCount, isCollageLayer],
  );

  const retreatRaw = useCallback(
    (steps: number) => {
      if (animatingRef.current) {
        if (bsodShutdownRef.current && performance.now() - bsodShutdownStartRef.current >= 4000) {
          animatingRef.current = false;
          momentumRef.current = 0;
          if (momentumTimer.current) { clearInterval(momentumTimer.current); momentumTimer.current = null; }
          const sel = stateRef.current.selectionIndex;
          setState({ phase: sel >= totalSelections ? "complete" : "idle", selectionIndex: sel, drawnSegments: 0, dragProgress: 0, dragInProgress: 0, bsodProgress: 0 });
        }
        return;
      }
      const { selectionIndex, drawnSegments, phase: curPhase } = stateRef.current;

      if (curPhase === "dragging") {
        const { dragProgress: curDrag } = stateRef.current;
        const dec = steps / DRAG_STEPS;
        const next = Math.max(curDrag - dec, 0);
        if (next <= 0) {
          const pointCount = getPointCount(selectionIndex);
          setState((s) => ({
            ...s,
            phase: "idle",
            drawnSegments: pointCount,
            dragProgress: 0,
          }));
        } else {
          setState((s) => ({ ...s, dragProgress: next }));
        }
        return;
      }

      if (curPhase === "bsod") {
        const { bsodProgress: curBsod } = stateRef.current;
        const dec = steps / BSOD_STEPS;
        const next = Math.max(curBsod - dec, 0);
        if (next <= 0) {
          const prevIdx = selectionIndex - 1;
          const pointCount = getPointCount(prevIdx);
          setState((s) => ({
            ...s,
            phase: "drawing",
            selectionIndex: prevIdx,
            drawnSegments: pointCount,
            bsodProgress: 0,
          }));
        } else {
          setState((s) => ({ ...s, bsodProgress: next }));
        }
        return;
      }

      if (drawnSegments > 0) {
        if (isCollageLayer(selectionIndex)) {
          momentumRef.current = 0;
          if (momentumTimer.current) {
            clearInterval(momentumTimer.current);
            momentumTimer.current = null;
          }

          const layer = ALBUM_DATA.layers[selectionIndex];
          const items = bsodSeenRef.current
            ? layer.collageItems!.filter((item) => !item.trail)
            : layer.collageItems!;
          // Find where we are and if it's a trail
          let tickAcc = 0;
          let isTrailTick = false;
          let trailStartTick = 0;
          for (const item of items) {
            const weight = item.trail ? item.trail.count : 1;
            if (drawnSegments <= tickAcc + weight) {
              isTrailTick = !!item.trail;
              trailStartTick = tickAcc;
              break;
            }
            tickAcc += weight;
          }

          if (isTrailTick) {
            // Auto-reverse all trail ticks back to the start of trails
            // Find where the first trail item starts
            let firstTrailTick = 0;
            for (const item of items) {
              if (item.trail) break;
              firstTrailTick += 1;
            }
            animatingRef.current = true;
            const autoRetreat = setInterval(() => {
              const { drawnSegments: cur } = stateRef.current;
              if (cur <= firstTrailTick) {
                clearInterval(autoRetreat);
                animatingRef.current = false;
                return;
              }
              setState((s) => ({ ...s, phase: "drawing", drawnSegments: cur - 1 }));
            }, 30);
            return;
          }

          if (!bsodSeenRef.current) {
            animatingRef.current = true;
            setTimeout(() => { animatingRef.current = false; }, 400);
          }
          const next = Math.max(drawnSegments - 1, 0);
          setState((s) => ({ ...s, phase: "drawing", drawnSegments: next }));
        } else {
          const next = Math.max(drawnSegments - steps, 0);
          setState((s) => ({ ...s, phase: "drawing", drawnSegments: next }));
        }
      } else if (selectionIndex > 0) {
        const prevIdx = selectionIndex - 1;
        if (prevIdx === DRAG_AFTER_SELECTION - 1) {
          setState((s) => ({
            ...s,
            phase: "dragging",
            selectionIndex: prevIdx,
            drawnSegments: getPointCount(prevIdx),
            dragProgress: 1,
          }));
          return;
        }
        if (prevIdx === BSOD_AFTER_SELECTION && !bsodSeenRef.current) {
          setState((s) => ({
            ...s,
            phase: "bsod",
            bsodProgress: 1,
          }));
          return;
        }
        const prevPointCount = getPointCount(prevIdx);
        setState({
          phase: "idle",
          selectionIndex: prevIdx,
          drawnSegments: prevPointCount,
          dragProgress: 0,
          dragInProgress: 0,
          bsodProgress: 0,
        });
      }
    },
    [getPointCount, isCollageLayer],
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
      const { selectionIndex: idx } = stateRef.current;
      const noMomentum = idx === 7 || isCollageLayer(idx);
      if (!noMomentum) startMomentum(steps * 0.6);
    },
    [advanceRaw, startMomentum, isCollageLayer],
  );

  const retreat = useCallback(
    (steps: number) => {
      retreatRaw(steps);
      const { selectionIndex: idx } = stateRef.current;
      const noMomentum = idx === 7 || isCollageLayer(idx);
      if (!noMomentum) startMomentum(-steps * 0.6);
    },
    [retreatRaw, startMomentum, isCollageLayer],
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
      let segments = 0;
      if (index < totalSelections) {
        const layer = ALBUM_DATA.layers[index];
        if (layer.collageItems && bsodSeenRef.current) {
          segments = layer.collageItems.filter((item) => !item.trail).length;
        }
      }
      setState({
        phase: index >= totalSelections ? "complete" : "idle",
        selectionIndex: index,
        drawnSegments: segments,
        dragProgress: 0,
        dragInProgress: 0,
        bsodProgress: 0,
      });
    },
    [totalSelections],
  );

  return { ...state, goToSection, bsodSeen: bsodSeenRef.current };
}
