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
const STANDARD_SCROLL_EFFORT = 65;
const MAX_SELECTION_POINTS = Math.max(
  ...ALBUM_DATA.layers
    .filter((l) => !l.collageItems)
    .map((l) => l.selection.points.length),
);

interface ScrollState {
  phase: ScrollPhase;
  selectionIndex: number;
  sectionProgress: number;
  drawnSegments: number;
  dragProgress: number;
  dragInProgress: number;
  bsodProgress: number;
}

export function useScrollHijack() {
  const [state, setState] = useState<ScrollState>({
    phase: "idle",
    selectionIndex: 0,
    sectionProgress: 0,
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

  const bsodRestartRef = useRef(false);
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
            const nextSel = curSel + 1;
            setState({
              phase: nextSel >= totalSelections ? "complete" : "idle",
              selectionIndex: nextSel,
              sectionProgress: 0,
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
          if (curBsod >= 0.95) slowdown = 0.05;
          else if (curBsod >= 0.85) slowdown = 0.1;
          else if (curBsod >= 0.7) slowdown = 0.2;
          else if (curBsod >= 0.5) slowdown = 0.4;
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
          bsodRestartRef.current = true;
        } else {
          setState((s) => ({ ...s, bsodProgress: next }));
        }
        return;
      }

      if (selectionIndex >= totalSelections) return;

      const pointCount = getPointCount(selectionIndex);
      let next: number;

      if (isCollageLayer(selectionIndex)) {
        momentumRef.current = 0;
        if (momentumTimer.current) {
          clearInterval(momentumTimer.current);
          momentumTimer.current = null;
        }

        const layer = ALBUM_DATA.layers[selectionIndex];
        const normalItemCount = layer.collageItems!.filter((item) => !item.trail).length;
        const { sectionProgress: curProgress } = stateRef.current;

        if (curProgress >= 1) {
          if (bsodSeenRef.current) {
            animatingRef.current = true;
            setState((s) => ({ ...s, phase: "closing", sectionProgress: 1, drawnSegments: normalItemCount }));
            setTimeout(() => {
              setState((s) => ({ ...s, phase: "masking" }));
              setTimeout(() => {
                setState((s) => ({ ...s, phase: "dissolving" }));
                setTimeout(() => {
                  const nextSel = selectionIndex + 1;
                  setState({
                    phase: nextSel >= totalSelections ? "complete" : "idle",
                    selectionIndex: nextSel,
                    sectionProgress: 0,
                    drawnSegments: 0,
                    dragProgress: 0,
                    dragInProgress: 0,
                    bsodProgress: 0,
                  });
                  requestAnimationFrame(() => { animatingRef.current = false; });
                }, DISSOLVE_DURATION);
              }, MASK_DURATION);
            }, 50);
          }
          return;
        }

        const rawIncrement = steps / STANDARD_SCROLL_EFFORT;
        const progressRemaining = 1 - curProgress;
        const nearEdge = curProgress < 0.10 || progressRemaining < 0.15;
        const easedIncrement = nearEdge
          ? Math.max(0.004, rawIncrement * 0.3)
          : rawIncrement;
        const nextProgress = Math.min(curProgress + easedIncrement, 1);
        const drawnItems = Math.min(
          Math.ceil(nextProgress * normalItemCount),
          normalItemCount,
        );

        if (nextProgress < 1) {
          setState((s) => ({
            ...s,
            phase: "drawing",
            sectionProgress: nextProgress,
            drawnSegments: drawnItems,
          }));
          return;
        }

        setState((s) => ({ ...s, sectionProgress: 1, drawnSegments: normalItemCount }));

        if (!bsodSeenRef.current) {
          animatingRef.current = true;
          const totalTrailTicks = layer.collageItems!.reduce(
            (sum, item) => sum + (item.trail ? item.trail.count : 0),
            0,
          );
          let tick = 0;
          const autoAdvance = setInterval(() => {
            tick++;
            if (tick >= totalTrailTicks) {
              clearInterval(autoAdvance);
              setState((s) => ({ ...s, phase: "closing", drawnSegments: normalItemCount + totalTrailTicks }));
              setTimeout(() => {
                setState((s) => ({ ...s, phase: "masking" }));
                setTimeout(() => {
                  setState((s) => ({ ...s, phase: "dissolving" }));
                  setTimeout(() => {
                    if (selectionIndex === BSOD_AFTER_SELECTION) {
                      setState((s) => ({
                        ...s,
                        phase: "bsod",
                        selectionIndex: selectionIndex + 1,
                        sectionProgress: 0,
                        drawnSegments: 0,
                        bsodProgress: 0,
                      }));
                    } else {
                      const nextSel = selectionIndex + 1;
                      setState({
                        phase: nextSel >= totalSelections ? "complete" : "idle",
                        selectionIndex: nextSel,
                        sectionProgress: 0,
                        drawnSegments: 0,
                        dragProgress: 0,
                        dragInProgress: 0,
                        bsodProgress: 0,
                      });
                    }
                    animatingRef.current = false;
                  }, selectionIndex === BSOD_AFTER_SELECTION ? PRE_BSOD_GLITCH : DISSOLVE_DURATION);
                }, MASK_DURATION);
              }, 50);
              return;
            }
            setState((s) => ({ ...s, phase: "drawing", drawnSegments: normalItemCount + tick }));
          }, 30);
        } else {
          animatingRef.current = true;
          setState((s) => ({ ...s, phase: "closing" }));
          setTimeout(() => {
            setState((s) => ({ ...s, phase: "masking" }));
            setTimeout(() => {
              setState((s) => ({ ...s, phase: "dissolving" }));
              setTimeout(() => {
                const nextSel = selectionIndex + 1;
                setState({
                  phase: nextSel >= totalSelections ? "complete" : "idle",
                  selectionIndex: nextSel,
                  sectionProgress: 0,
                  drawnSegments: 0,
                  dragProgress: 0,
                  dragInProgress: 0,
                  bsodProgress: 0,
                });
                requestAnimationFrame(() => { animatingRef.current = false; });
              }, DISSOLVE_DURATION);
            }, MASK_DURATION);
          }, 50);
        }
        return;
      }

      const { sectionProgress: curProgress } = stateRef.current;
      const rawIncrement = steps / STANDARD_SCROLL_EFFORT;
      const progressRemaining = 1 - curProgress;
      const nearEdge = curProgress < 0.10 || progressRemaining < 0.15;
      const easedIncrement = nearEdge
        ? Math.max(0.004, rawIncrement * 0.3)
        : rawIncrement;
      const nextProgress = Math.min(curProgress + easedIncrement, 1);
      next = Math.min(
        Math.floor(nextProgress * MAX_SELECTION_POINTS),
        pointCount,
      );

      if (nextProgress < 1) {
        setState((s) => ({ ...s, phase: "drawing", sectionProgress: nextProgress, drawnSegments: next }));
      } else {
        animatingRef.current = true;
        momentumRef.current = 0;
        setState((s) => ({ ...s, phase: "closing", sectionProgress: 1, drawnSegments: pointCount }));

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
                sectionProgress: 0,
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
                  sectionProgress: 0,
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
      if (animatingRef.current) return;
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
            sectionProgress: 1,
            drawnSegments: pointCount,
            dragProgress: 0,
          }));
        } else {
          setState((s) => ({ ...s, dragProgress: next }));
        }
        return;
      }

      // The error section is a one-way gate: you can't scroll backward out of it.
      // (Backing out before completing the crash left it "unseen", so it would
      // re-trigger every time you crossed the boundary — and risked losing
      // forward progress.) You go forward through it, which marks it seen and
      // skips it for good. Forward exit / the restart click are the only ways out.
      if (curPhase === "bsod") {
        return;
      }

      if (drawnSegments > 0 || stateRef.current.sectionProgress > 0) {
        if (isCollageLayer(selectionIndex)) {
          momentumRef.current = 0;
          if (momentumTimer.current) {
            clearInterval(momentumTimer.current);
            momentumTimer.current = null;
          }
          const layer = ALBUM_DATA.layers[selectionIndex];
          const normalItemCount = layer.collageItems!.filter((item) => !item.trail).length;
          const { sectionProgress: curProgress } = stateRef.current;
          const rawDecrement = steps / STANDARD_SCROLL_EFFORT;
          const nearEdge = curProgress < 0.15 || curProgress > 0.90;
          const easedDecrement = nearEdge
            ? Math.max(0.004, rawDecrement * 0.3)
            : rawDecrement;
          const nextProgress = Math.max(curProgress - easedDecrement, 0);
          const drawnItems = Math.min(
            Math.floor(nextProgress * MAX_SELECTION_POINTS),
            normalItemCount,
          );
          setState((s) => ({ ...s, phase: "drawing", sectionProgress: nextProgress, drawnSegments: drawnItems }));
        } else {
          const { sectionProgress: curProgress } = stateRef.current;
          const pointCount = getPointCount(selectionIndex);
          const rawDecrement = steps / STANDARD_SCROLL_EFFORT;
          const nearEdge = curProgress < 0.15 || curProgress > 0.90;
          const easedDecrement = nearEdge
            ? Math.max(0.004, rawDecrement * 0.3)
            : rawDecrement;
          const nextProgress = Math.max(curProgress - easedDecrement, 0);
          const nextDrawn = Math.min(
            Math.floor(nextProgress * MAX_SELECTION_POINTS),
            pointCount,
          );
          setState((s) => ({ ...s, phase: "drawing", sectionProgress: nextProgress, drawnSegments: nextDrawn }));
        }
      } else if (selectionIndex > 0) {
        const prevIdx = selectionIndex - 1;
        if (prevIdx === DRAG_AFTER_SELECTION - 1) {
          setState((s) => ({
            ...s,
            phase: "dragging",
            selectionIndex: prevIdx,
            sectionProgress: 1,
            drawnSegments: getPointCount(prevIdx),
            dragProgress: 1,
          }));
          return;
        }
        if (prevIdx === BSOD_AFTER_SELECTION && !bsodSeenRef.current) {
          setState((s) => ({
            ...s,
            phase: "bsod",
            sectionProgress: 1,
            bsodProgress: 1,
          }));
          return;
        }
        const prevPointCount = getPointCount(prevIdx);
        setState({
          phase: "idle",
          selectionIndex: prevIdx,
          sectionProgress: 1,
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
      const noMomentum = isCollageLayer(idx);
      if (!noMomentum) startMomentum(steps * 0.6);
    },
    [advanceRaw, startMomentum, isCollageLayer],
  );

  const retreat = useCallback(
    (steps: number) => {
      retreatRaw(steps);
      const { selectionIndex: idx } = stateRef.current;
      const noMomentum = isCollageLayer(idx);
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
        sectionProgress: segments > 0 ? 1 : 0,
        drawnSegments: segments,
        dragProgress: 0,
        dragInProgress: 0,
        bsodProgress: 0,
      });
    },
    [totalSelections],
  );

  const effectiveProgress = (() => {
    const { phase: p, sectionProgress: sp, selectionIndex: idx, dragProgress: dp } = state;
    if (p === "complete") return 0;

    const isDragSection = idx === DRAG_AFTER_SELECTION - 1;

    if (p === "dragging") return isDragSection ? 0.85 + dp * 0.15 : 1;
    if (p === "closing" || p === "masking" || p === "dissolving") return isDragSection ? 0.85 : 1;
    if (p === "bsod") return 1;

    return isDragSection ? sp * 0.85 : sp;
  })();

  const { selectionIndex: si, drawnSegments: ds } = state;
  const isStamping = si < totalSelections
    && !!ALBUM_DATA.layers[si].collageItems
    && state.sectionProgress >= 1
    && ds > ALBUM_DATA.layers[si].collageItems!.filter((item) => !item.trail).length;

  const restartFromBsod = useCallback(() => {
    bsodShutdownRef.current = false;
    bsodShutdownStartRef.current = 0;
    bsodRestartRef.current = false;
    momentumRef.current = 0;
    if (momentumTimer.current) {
      clearInterval(momentumTimer.current);
      momentumTimer.current = null;
    }
    const sel = stateRef.current.selectionIndex;
    setState({
      phase: sel >= totalSelections ? "complete" : "idle",
      selectionIndex: sel,
      sectionProgress: 0,
      drawnSegments: 0,
      dragProgress: 0,
      dragInProgress: 0,
      bsodProgress: 0,
    });
    animatingRef.current = false;
  }, [totalSelections]);

  return { ...state, sectionProgress: effectiveProgress, isStamping, goToSection, restartFromBsod, bsodSeen: bsodSeenRef.current };
}
