"use client";

import { useEffect, useRef } from "react";

const VERT = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const ADVECT_FRAG = `
precision highp float;
uniform sampler2D u_velocity;
uniform sampler2D u_source;
uniform vec2 u_texelSize;
uniform float u_dt;
uniform float u_dissipation;
varying vec2 v_uv;
void main() {
    vec2 vel = texture2D(u_velocity, v_uv).xy;
    vec2 coord = v_uv - u_dt * vel * u_texelSize;
    gl_FragColor = u_dissipation * texture2D(u_source, coord);
}`;

const JACOBI_FRAG = `
precision highp float;
uniform sampler2D u_x;
uniform sampler2D u_b;
uniform vec2 u_texelSize;
uniform float u_alpha;
uniform float u_rBeta;
varying vec2 v_uv;
void main() {
    vec4 xL = texture2D(u_x, v_uv - vec2(u_texelSize.x, 0.0));
    vec4 xR = texture2D(u_x, v_uv + vec2(u_texelSize.x, 0.0));
    vec4 xB = texture2D(u_x, v_uv - vec2(0.0, u_texelSize.y));
    vec4 xT = texture2D(u_x, v_uv + vec2(0.0, u_texelSize.y));
    vec4 bC = texture2D(u_b, v_uv);
    gl_FragColor = (xL + xR + xB + xT + u_alpha * bC) * u_rBeta;
}`;

const DIVERGENCE_FRAG = `
precision highp float;
uniform sampler2D u_velocity;
uniform vec2 u_texelSize;
varying vec2 v_uv;
void main() {
    float vR = texture2D(u_velocity, v_uv + vec2(u_texelSize.x, 0.0)).x;
    float vL = texture2D(u_velocity, v_uv - vec2(u_texelSize.x, 0.0)).x;
    float vT = texture2D(u_velocity, v_uv + vec2(0.0, u_texelSize.y)).y;
    float vB = texture2D(u_velocity, v_uv - vec2(0.0, u_texelSize.y)).y;
    gl_FragColor = vec4(0.5 * (vR - vL + vT - vB), 0.0, 0.0, 1.0);
}`;

const GRADIENT_FRAG = `
precision highp float;
uniform sampler2D u_pressure;
uniform sampler2D u_velocity;
uniform vec2 u_texelSize;
varying vec2 v_uv;
void main() {
    float pR = texture2D(u_pressure, v_uv + vec2(u_texelSize.x, 0.0)).x;
    float pL = texture2D(u_pressure, v_uv - vec2(u_texelSize.x, 0.0)).x;
    float pT = texture2D(u_pressure, v_uv + vec2(0.0, u_texelSize.y)).x;
    float pB = texture2D(u_pressure, v_uv - vec2(0.0, u_texelSize.y)).x;
    vec2 vel = texture2D(u_velocity, v_uv).xy;
    vel -= 0.5 * vec2(pR - pL, pT - pB);
    gl_FragColor = vec4(vel, 0.0, 1.0);
}`;

const VORTICITY_FRAG = `
precision highp float;
uniform sampler2D u_velocity;
uniform vec2 u_texelSize;
varying vec2 v_uv;
void main() {
    float vR = texture2D(u_velocity, v_uv + vec2(u_texelSize.x, 0.0)).y;
    float vL = texture2D(u_velocity, v_uv - vec2(u_texelSize.x, 0.0)).y;
    float vT = texture2D(u_velocity, v_uv + vec2(0.0, u_texelSize.y)).x;
    float vB = texture2D(u_velocity, v_uv - vec2(0.0, u_texelSize.y)).x;
    float curl = 0.5 * ((vR - vL) - (vT - vB));
    gl_FragColor = vec4(curl, 0.0, 0.0, 1.0);
}`;

const FORCE_FRAG = `
precision highp float;
uniform sampler2D u_velocity;
uniform sampler2D u_vorticity;
uniform sampler2D u_density;
uniform vec2 u_texelSize;
uniform float u_dt;
uniform float u_curl;
uniform float u_intensity;
uniform float u_time;
varying vec2 v_uv;
void main() {
    vec2 vel = texture2D(u_velocity, v_uv).xy;
    float dens = texture2D(u_density, v_uv).x;

    float cL = texture2D(u_vorticity, v_uv - vec2(u_texelSize.x, 0.0)).x;
    float cR = texture2D(u_vorticity, v_uv + vec2(u_texelSize.x, 0.0)).x;
    float cB = texture2D(u_vorticity, v_uv - vec2(0.0, u_texelSize.y)).x;
    float cT = texture2D(u_vorticity, v_uv + vec2(0.0, u_texelSize.y)).x;
    float cC = texture2D(u_vorticity, v_uv).x;
    vec2 eta = vec2(abs(cR) - abs(cL), abs(cT) - abs(cB));
    eta /= length(eta) + 1e-5;
    vec2 vortForce = u_curl * vec2(eta.y, -eta.x) * cC;

    vec2 buoyancy = vec2(0.0, dens * 20.0);
    vec2 gravity = vec2(0.0, -1.0);

    float emitMask = smoothstep(0.08, 0.0, v_uv.y);
    float hvar = sin(v_uv.x * 30.0 + u_time * 2.0) * 0.3 + 0.7;
    vec2 emitVel = vec2(
        sin(v_uv.x * 15.0 + u_time * 3.0) * 4.0,
        40.0
    ) * emitMask * u_intensity * hvar;

    vel += (vortForce + buoyancy + gravity + emitVel) * u_dt;
    gl_FragColor = vec4(vel, 0.0, 1.0);
}`;

const EMIT_FRAG = `
precision highp float;
uniform sampler2D u_density;
uniform float u_intensity;
uniform float u_dt;
uniform float u_time;
varying vec2 v_uv;
void main() {
    vec4 d = texture2D(u_density, v_uv);
    float emitMask = smoothstep(0.05, 0.0, v_uv.y);
    float h1 = sin(v_uv.x * 20.0 + u_time * 1.5) * 0.5 + 0.5;
    float h2 = sin(v_uv.x * 47.0 - u_time * 0.7) * 0.3 + 0.7;
    float emission = emitMask * u_intensity * h1 * h2 * u_dt * 12.0;
    d.x = min(1.0, d.x + emission);
    d.y = mix(d.y, 1.0, emission * 0.5);
    gl_FragColor = d;
}`;

const DISPLAY_FRAG = `
precision highp float;
uniform sampler2D u_density;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform float u_time;
varying vec2 v_uv;

float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

void main() {
    // Pixelate: snap UVs to a coarse grid
    vec2 pixels = vec2(160.0, 120.0);
    vec2 puv = floor(v_uv * pixels) / pixels;

    vec4 data = texture2D(u_density, puv);
    float density = data.x;
    float freshness = data.y;
    float height = smoothstep(0.0, 0.35, puv.y);
    vec3 color = mix(u_colorA, u_colorB, height);
    float alpha = smoothstep(0.0, 0.05, density) * min(density * 1.5, 0.75);

    // Film grain — animated per-pixel noise
    float grain = hash(v_uv * 800.0 + fract(u_time * 7.0) * 200.0) - 0.5;

    // Grain in smoke areas: roughens the smoke texture
    color += grain * 0.12 * alpha;

    // Base grain everywhere: faint CRT-like noise over the full screen
    float baseGrain = grain * 0.025;
    float baseAlpha = abs(baseGrain);
    color = color * alpha + vec3(baseGrain + 0.5 * baseAlpha) * baseAlpha;
    alpha = alpha + baseAlpha;

    gl_FragColor = vec4(color, alpha);
}`;

const PRESSURE_ITERS = 40;
const SIM_MAX = 384;

interface FBO {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
}
interface DblFBO {
  read: FBO;
  write: FBO;
  swap: () => void;
}
interface Prog {
  pg: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}

export function SmokeOverlay({ intensity }: { intensity: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) {
      console.warn("Smoke: no WebGL support");
      return;
    }
    if (gl.isContextLost()) {
      console.warn("Smoke: context already lost, skipping init");
      return;
    }

    const hfExt = gl.getExtension("OES_texture_half_float");
    gl.getExtension("OES_texture_half_float_linear");
    gl.getExtension("EXT_color_buffer_half_float");
    const fExt = gl.getExtension("OES_texture_float");
    gl.getExtension("OES_texture_float_linear");
    gl.getExtension("WEBGL_color_buffer_float");

    function testFormat(type: number): boolean {
      const t = gl!.createTexture()!;
      gl!.bindTexture(gl!.TEXTURE_2D, t);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, 4, 4, 0, gl!.RGBA, type, null);
      const fb = gl!.createFramebuffer()!;
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, fb);
      gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, t, 0);
      const ok = gl!.checkFramebufferStatus(gl!.FRAMEBUFFER) === gl!.FRAMEBUFFER_COMPLETE;
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
      gl!.deleteFramebuffer(fb);
      gl!.deleteTexture(t);
      return ok;
    }

    let texType: number;
    if (hfExt && testFormat(hfExt.HALF_FLOAT_OES)) {
      texType = hfExt.HALF_FLOAT_OES;
    } else if (fExt && testFormat(gl.FLOAT)) {
      texType = gl.FLOAT;
    } else {
      console.warn("Smoke: no float texture support");
      return;
    }

    function compile(type: number, src: string): WebGLShader | null {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
        console.error("Smoke shader error:", gl!.getShaderInfoLog(s));
        gl!.deleteShader(s);
        return null;
      }
      return s;
    }

    const vertShader = compile(gl.VERTEX_SHADER, VERT);
    if (!vertShader) return;

    function makeProg(fragSrc: string): Prog | null {
      const pg = gl!.createProgram()!;
      gl!.attachShader(pg, vertShader!);
      const fs = compile(gl!.FRAGMENT_SHADER, fragSrc);
      if (!fs) return null;
      gl!.attachShader(pg, fs);
      gl!.bindAttribLocation(pg, 0, "a_position");
      gl!.linkProgram(pg);
      if (!gl!.getProgramParameter(pg, gl!.LINK_STATUS)) {
        console.error("Smoke link error:", gl!.getProgramInfoLog(pg));
        return null;
      }
      const u: Record<string, WebGLUniformLocation | null> = {};
      const n = gl!.getProgramParameter(pg, gl!.ACTIVE_UNIFORMS) as number;
      for (let i = 0; i < n; i++) {
        const info = gl!.getActiveUniform(pg, i)!;
        u[info.name] = gl!.getUniformLocation(pg, info.name);
      }
      return { pg, u };
    }

    function makeFBO(w: number, h: number): FBO {
      const texture = gl!.createTexture()!;
      gl!.bindTexture(gl!.TEXTURE_2D, texture);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, w, h, 0, gl!.RGBA, texType, null);
      const fbo = gl!.createFramebuffer()!;
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
      gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, texture, 0);
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
      return { texture, fbo, w, h };
    }

    function makeDbl(w: number, h: number): DblFBO {
      const a = makeFBO(w, h);
      const b = makeFBO(w, h);
      return {
        read: a,
        write: b,
        swap() {
          const tmp = this.read;
          this.read = this.write;
          this.write = tmp;
        },
      };
    }

    function bindTex(unit: number, tex: WebGLTexture) {
      gl!.activeTexture(gl!.TEXTURE0 + unit);
      gl!.bindTexture(gl!.TEXTURE_2D, tex);
    }

    function blit(target: FBO) {
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, target.fbo);
      gl!.viewport(0, 0, target.w, target.h);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
    }

    // --- Compile all programs ---
    const advectP = makeProg(ADVECT_FRAG);
    const jacobiP = makeProg(JACOBI_FRAG);
    const divP = makeProg(DIVERGENCE_FRAG);
    const gradP = makeProg(GRADIENT_FRAG);
    const vortP = makeProg(VORTICITY_FRAG);
    const forceP = makeProg(FORCE_FRAG);
    const emitP = makeProg(EMIT_FRAG);
    const displayP = makeProg(DISPLAY_FRAG);

    if (!advectP || !jacobiP || !divP || !gradP || !vortP || !forceP || !emitP || !displayP) {
      console.error("Smoke: one or more shader programs failed to compile");
      return;
    }
    const progs = { advect: advectP, jacobi: jacobiP, div: divP, grad: gradP, vort: vortP, force: forceP, emit: emitP, display: displayP };

    // --- Quad geometry ---
    const quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // --- Simulation state ---
    let simW = 0;
    let simH = 0;
    let velocity: DblFBO;
    let density: DblFBO;
    let pressure: DblFBO;
    let divFBO: FBO;
    let vortFBO: FBO;

    function clearFBO(f: FBO) {
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, f.fbo);
      gl!.viewport(0, 0, f.w, f.h);
      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
    }

    function initSim() {
      const aspect = canvas!.width / canvas!.height;
      if (aspect >= 1) {
        simH = Math.min(SIM_MAX, Math.floor(canvas!.height * 0.5));
        simW = Math.floor(simH * aspect);
      } else {
        simW = Math.min(SIM_MAX, Math.floor(canvas!.width * 0.5));
        simH = Math.floor(simW / aspect);
      }
      simW = Math.max(64, simW);
      simH = Math.max(64, simH);

      velocity = makeDbl(simW, simH);
      density = makeDbl(simW, simH);
      pressure = makeDbl(simW, simH);
      divFBO = makeFBO(simW, simH);
      vortFBO = makeFBO(simW, simH);

      [velocity.read, velocity.write, density.read, density.write,
       pressure.read, pressure.write, divFBO, vortFBO].forEach(clearFBO);
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = canvas!.offsetWidth * dpr;
      canvas!.height = canvas!.offsetHeight * dpr;
      initSim();
    }
    resize();
    window.addEventListener("resize", resize);

    gl.disable(gl.BLEND);

    let raf = 0;
    let lastTime = performance.now();
    let alive = true;

    console.log(`Smoke: WebGL fluid sim ready (${simW}×${simH})`);

    function step(now: number) {
      if (!alive || gl!.isContextLost()) return;

      const dt = Math.min((now - lastTime) / 1000, 0.033);
      lastTime = now;
      const ci = intensityRef.current;
      const ts: [number, number] = [1.0 / simW, 1.0 / simH];
      const t = now * 0.001;

      // 1 — Advect velocity
      gl!.useProgram(progs.advect.pg);
      gl!.uniform2fv(progs.advect.u.u_texelSize, ts);
      gl!.uniform1f(progs.advect.u.u_dt, dt);
      gl!.uniform1f(progs.advect.u.u_dissipation, 0.997);
      bindTex(0, velocity.read.texture);
      gl!.uniform1i(progs.advect.u.u_velocity, 0);
      bindTex(1, velocity.read.texture);
      gl!.uniform1i(progs.advect.u.u_source, 1);
      blit(velocity.write);
      velocity.swap();

      // 2 — Vorticity
      gl!.useProgram(progs.vort.pg);
      gl!.uniform2fv(progs.vort.u.u_texelSize, ts);
      bindTex(0, velocity.read.texture);
      gl!.uniform1i(progs.vort.u.u_velocity, 0);
      blit(vortFBO);

      // 3 — Forces + vorticity confinement
      gl!.useProgram(progs.force.pg);
      gl!.uniform2fv(progs.force.u.u_texelSize, ts);
      gl!.uniform1f(progs.force.u.u_dt, dt);
      gl!.uniform1f(progs.force.u.u_curl, 25.0);
      gl!.uniform1f(progs.force.u.u_intensity, ci);
      gl!.uniform1f(progs.force.u.u_time, t);
      bindTex(0, velocity.read.texture);
      gl!.uniform1i(progs.force.u.u_velocity, 0);
      bindTex(1, vortFBO.texture);
      gl!.uniform1i(progs.force.u.u_vorticity, 1);
      bindTex(2, density.read.texture);
      gl!.uniform1i(progs.force.u.u_density, 2);
      blit(velocity.write);
      velocity.swap();

      // 4 — Divergence
      gl!.useProgram(progs.div.pg);
      gl!.uniform2fv(progs.div.u.u_texelSize, ts);
      bindTex(0, velocity.read.texture);
      gl!.uniform1i(progs.div.u.u_velocity, 0);
      blit(divFBO);

      // 5 — Pressure solve
      gl!.useProgram(progs.jacobi.pg);
      gl!.uniform2fv(progs.jacobi.u.u_texelSize, ts);
      gl!.uniform1f(progs.jacobi.u.u_alpha, -1.0);
      gl!.uniform1f(progs.jacobi.u.u_rBeta, 0.25);
      bindTex(1, divFBO.texture);
      gl!.uniform1i(progs.jacobi.u.u_b, 1);
      for (let i = 0; i < PRESSURE_ITERS; i++) {
        bindTex(0, pressure.read.texture);
        gl!.uniform1i(progs.jacobi.u.u_x, 0);
        blit(pressure.write);
        pressure.swap();
      }

      // 6 — Gradient subtraction
      gl!.useProgram(progs.grad.pg);
      gl!.uniform2fv(progs.grad.u.u_texelSize, ts);
      bindTex(0, pressure.read.texture);
      gl!.uniform1i(progs.grad.u.u_pressure, 0);
      bindTex(1, velocity.read.texture);
      gl!.uniform1i(progs.grad.u.u_velocity, 1);
      blit(velocity.write);
      velocity.swap();

      // 7 — Advect density
      gl!.useProgram(progs.advect.pg);
      gl!.uniform2fv(progs.advect.u.u_texelSize, ts);
      gl!.uniform1f(progs.advect.u.u_dt, dt);
      gl!.uniform1f(progs.advect.u.u_dissipation, 0.997);
      bindTex(0, velocity.read.texture);
      gl!.uniform1i(progs.advect.u.u_velocity, 0);
      bindTex(1, density.read.texture);
      gl!.uniform1i(progs.advect.u.u_source, 1);
      blit(density.write);
      density.swap();

      // 8 — Emit density
      gl!.useProgram(progs.emit.pg);
      gl!.uniform1f(progs.emit.u.u_intensity, ci);
      gl!.uniform1f(progs.emit.u.u_dt, dt);
      gl!.uniform1f(progs.emit.u.u_time, t);
      bindTex(0, density.read.texture);
      gl!.uniform1i(progs.emit.u.u_density, 0);
      blit(density.write);
      density.swap();

      // 9 — Display
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
      gl!.viewport(0, 0, gl!.drawingBufferWidth, gl!.drawingBufferHeight);
      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.useProgram(progs.display.pg);
      gl!.uniform3fv(progs.display.u.u_colorA, [0.7, 0.12, 0.08]);
      gl!.uniform3fv(progs.display.u.u_colorB, [0.55, 0.52, 0.5]);
      gl!.uniform1f(progs.display.u.u_time, t);
      bindTex(0, density.read.texture);
      gl!.uniform1i(progs.display.u.u_density, 0);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);

      raf = requestAnimationFrame(step);
    }

    raf = requestAnimationFrame(step);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 6 }}
    />
  );
}
