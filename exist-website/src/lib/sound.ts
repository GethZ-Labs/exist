/*
  EXiST sound design. Every sound is synthesised live with the Web Audio API,
  so there are no audio files: a low drone, glass, liquid, whooshes, chimes and
  cinematic hits, all sharing one hall reverb. Audio only starts after a user
  gesture, and the visitor's on/off choice is remembered.
*/

const STORAGE_KEY = "exist-sound";
const MASTER = 0.85;

type ToneOptions = {
  type?: OscillatorType;
  freq: number;
  to?: number;
  glide?: number;
  gain: number;
  attack?: number;
  decay?: number;
  pan?: number;
  send?: number;
  detune?: number;
};

type NoiseOptions = {
  type?: BiquadFilterType;
  freq: number;
  to?: number;
  sweep?: number;
  q?: number;
  gain: number;
  attack?: number;
  decay?: number;
  pan?: number;
  send?: number;
};

type WhooshOptions = {
  from?: number;
  to?: number;
  dur?: number;
  gain?: number;
  q?: number;
  pan?: number;
  panTo?: number;
  delay?: number;
};

type Layer = {
  set: (level: number, x: number) => void;
  stop: (fade: number) => void;
};

type LayerName = "drone" | "water" | "scan";

type DrawVoice = {
  out: GainNode;
  friction: GainNode;
  oscs: OscillatorNode[];
  band: BiquadFilterNode;
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
};

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const ramp = (a: number, b: number, v: number) => clamp((v - a) / (b - a));

/* High A-major pentatonic: the palette for sparkles and data blips. */
const SPARKS = [1760, 1975.53, 2217.46, 2637.02, 2959.96, 3520];

function holdAt(param: AudioParam, t: number) {
  if (typeof param.cancelAndHoldAtTime === "function") {
    param.cancelAndHoldAtTime(t);
  } else {
    const v = param.value;
    param.cancelScheduledValues(t);
    param.setValueAtTime(v, t);
  }
}

function envelope(param: AudioParam, t: number, peak: number, attack: number, decay: number) {
  param.setValueAtTime(0.0001, t);
  param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

const release = (sources: AudioScheduledSourceNode[], nodes: AudioNode[]) => {
  sources[0].onended = () => [...sources, ...nodes].forEach((node) => node.disconnect());
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private master: GainNode | null = null;
  private verb: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private on = true;
  private loaded = false;
  private starting = false;
  private startTimer = 0;
  private listeners = new Set<() => void>();
  private wanted = new Map<LayerName, { level: number; x: number; fade: number }>();
  private layers = new Map<LayerName, Layer>();
  private drawVoice: DrawVoice | null = null;
  private chatterAcc = 0;
  private lastWhoosh = 0;

  /* ------------------------------------------------------------ */
  /* Preference (works with useSyncExternalStore)                  */
  /* ------------------------------------------------------------ */

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  isEnabled = () => {
    this.load();
    return this.on;
  };

  setEnabled = (value: boolean) => {
    this.load();
    this.on = value;
    try {
      localStorage.setItem(STORAGE_KEY, value ? "on" : "off");
    } catch {}
    this.listeners.forEach((listener) => listener());
    const ctx = this.ctx;
    if (value) {
      this.unlock();
      if (ctx && this.master) this.master.gain.setTargetAtTime(MASTER, ctx.currentTime, 0.12);
      this.sync();
    } else if (ctx && this.master) {
      this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
      window.setTimeout(() => {
        if (!this.on) void ctx.suspend().catch(() => {});
      }, 450);
    }
  };

  private load() {
    if (this.loaded || typeof window === "undefined") return;
    this.loaded = true;
    try {
      this.on = localStorage.getItem(STORAGE_KEY) !== "off";
    } catch {}
  }

  /* ------------------------------------------------------------ */
  /* Context: created and resumed only inside user gestures        */
  /* ------------------------------------------------------------ */

  unlock = () => {
    this.load();
    if (!this.on || typeof window === "undefined") return;
    if (!this.ctx) {
      const activation = (navigator as Navigator & { userActivation?: { isActive: boolean } })
        .userActivation;
      if (activation && !activation.isActive) return;
      this.init();
    }
    this.resume();
  };

  private resume() {
    const ctx = this.ctx;
    if (!ctx || ctx.state === "running" || ctx.state === "closed" || document.hidden) return;
    this.starting = true;
    window.clearTimeout(this.startTimer);
    // never queue sounds on a context the browser refuses to start
    this.startTimer = window.setTimeout(() => (this.starting = false), 250);
    void ctx
      .resume()
      .then(() => {
        this.starting = false;
        this.sync();
      })
      .catch(() => (this.starting = false));
  }

  private init() {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    let ctx: AudioContext;
    try {
      ctx = new Ctor({ latencyHint: "interactive" });
    } catch {
      return;
    }
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.004;
    comp.release.value = 0.3;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.gain.setTargetAtTime(MASTER, ctx.currentTime, 0.08);
    comp.connect(master).connect(ctx.destination);
    this.master = master;

    const bus = ctx.createGain();
    bus.connect(comp);
    this.bus = bus;

    // one shared hall: decaying stereo noise as the impulse response
    const convolver = ctx.createConvolver();
    convolver.buffer = this.impulse(ctx, 3.4, 2.8);
    const verb = ctx.createGain();
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.55;
    verb.connect(convolver).connect(verbOut).connect(comp);
    this.verb = verb;

    const length = ctx.sampleRate * 2;
    const noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = noise;

    ctx.onstatechange = () => {
      if (ctx.state === "running") this.sync();
    };
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) void ctx.suspend().catch(() => {});
      else if (this.on) this.resume();
    });
  }

  private impulse(ctx: AudioContext, seconds: number, decay: number) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }

  private live() {
    const ctx = this.ctx;
    if (!ctx || !this.on) return null;
    return ctx.state === "running" || this.starting ? ctx : null;
  }

  /* ------------------------------------------------------------ */
  /* Building blocks                                               */
  /* ------------------------------------------------------------ */

  private route(node: AudioNode, { pan = 0, send = 0.2 }: { pan?: number; send?: number } = {}) {
    const ctx = this.ctx!;
    let out = node;
    if (pan) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = clamp(pan, -1, 1);
      node.connect(panner);
      out = panner;
    }
    out.connect(this.bus!);
    if (send > 0) {
      const g = ctx.createGain();
      g.gain.value = send;
      out.connect(g).connect(this.verb!);
    }
    return out;
  }

  private noiseSource() {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    return src;
  }

  private toneAt(t: number, o: ToneOptions) {
    const ctx = this.ctx!;
    const attack = o.attack ?? 0.005;
    const decay = o.decay ?? 0.3;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide ?? attack + decay));
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    envelope(g.gain, t, o.gain, attack, decay);
    osc.connect(g);
    const out = this.route(g, { pan: o.pan, send: o.send });
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
    release([osc], [g, out]);
  }

  private noiseAt(t: number, o: NoiseOptions) {
    const ctx = this.ctx!;
    const attack = o.attack ?? 0.005;
    const decay = o.decay ?? 0.3;
    const src = this.noiseSource();
    const filter = ctx.createBiquadFilter();
    filter.type = o.type ?? "bandpass";
    filter.Q.value = o.q ?? 1;
    filter.frequency.setValueAtTime(o.freq, t);
    if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, t + (o.sweep ?? attack + decay));
    const g = ctx.createGain();
    envelope(g.gain, t, o.gain, attack, decay);
    src.connect(filter).connect(g);
    const out = this.route(g, { pan: o.pan, send: o.send });
    src.start(t, Math.random() * 1.5);
    src.stop(t + attack + decay + 0.05);
    release([src], [filter, g, out]);
  }

  /* A water bubble: a sine whose pitch rises as it resonates. */
  private bubbleAt(t: number, freq: number, dur: number, gain: number, pan = 0, send = 0.3) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * rand(1.4, 2.1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    const out = this.route(g, { pan, send });
    osc.start(t);
    osc.stop(t + dur + 0.03);
    release([osc], [g, out]);
  }

  /* An inharmonic struck bell / glass. */
  private bellAt(t: number, freq: number, gain: number, decay = 2.4, pan = 0, send = 0.55) {
    const partials: [number, number, number][] = [
      [1, 1, 1],
      [2, 0.5, 0.55],
      [2.76, 0.3, 0.42],
      [4.07, 0.16, 0.3],
      [5.4, 0.09, 0.2],
    ];
    for (const [ratio, amp, k] of partials) {
      if (freq * ratio > 15000) continue;
      this.toneAt(t, { freq: freq * ratio, gain: gain * amp, attack: 0.002, decay: decay * k, pan, send });
    }
  }

  private boomAt(t: number, gain: number) {
    this.toneAt(t, { freq: 98, to: 34, glide: 0.9, gain: gain * 0.75, attack: 0.006, decay: 1.7, send: 0.25 });
    // body that small speakers can still play
    this.toneAt(t, { type: "triangle", freq: 190, to: 72, glide: 0.25, gain: gain * 0.35, attack: 0.003, decay: 0.45, send: 0.3 });
    this.noiseAt(t, { type: "lowpass", freq: 1000, to: 120, q: 0.7, gain: gain * 0.45, attack: 0.002, decay: 0.55, send: 0.55 });
  }

  private shatterAt(t: number, gain: number) {
    this.noiseAt(t, { type: "highpass", freq: 2400, to: 5600, q: 0.7, gain: 0.15 * gain, attack: 0.002, decay: 0.75, send: 0.6 });
    this.noiseAt(t, { type: "bandpass", freq: 3400, q: 1.4, gain: 0.08 * gain, attack: 0.001, decay: 0.12, send: 0.3 });
    for (let i = 0; i < 34; i++) {
      const dt = Math.pow(Math.random(), 1.8) * 1.3;
      this.toneAt(t + dt, {
        freq: 2000 * Math.pow(4.2, Math.random()),
        gain: rand(0.01, 0.034) * gain * (1 - dt / 1.6),
        attack: 0.001,
        decay: rand(0.05, 0.34),
        pan: rand(-0.85, 0.85),
        send: 0.55,
      });
    }
  }

  private splashAt(t: number, pan: number) {
    this.noiseAt(t, { type: "bandpass", freq: 1900, to: 650, q: 0.8, gain: 0.075, attack: 0.004, decay: 0.3, pan, send: 0.4 });
    this.toneAt(t, { freq: 230, to: 105, glide: 0.12, gain: 0.05, attack: 0.003, decay: 0.16, pan });
    for (let i = 0; i < 6; i++) {
      this.bubbleAt(t + rand(0.02, 0.45), 700 * Math.pow(3, Math.random()), rand(0.03, 0.08), rand(0.008, 0.022), clamp(pan + rand(-0.15, 0.15), -1, 1), 0.4);
    }
  }

  private padAt(
    t: number,
    freqs: number[],
    o: { gain: number; attack: number; hold: number; release: number; cutoff: number; cutoffEnd?: number },
  ) {
    const ctx = this.ctx!;
    const end = t + o.attack + o.hold + o.release;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 0.5;
    lp.frequency.setValueAtTime(o.cutoff, t);
    if (o.cutoffEnd) lp.frequency.exponentialRampToValueAtTime(o.cutoffEnd, end);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1, t + o.attack);
    g.gain.setValueAtTime(1, t + o.attack + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    lp.connect(g);
    const out = this.route(g, { send: 0.6 });
    const sources: OscillatorNode[] = [];
    const nodes: AudioNode[] = [lp, g, out];
    for (const f of freqs) {
      for (const cents of [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = f;
        osc.detune.value = cents + rand(-2, 2);
        const og = ctx.createGain();
        og.gain.value = o.gain;
        osc.connect(og).connect(lp);
        osc.start(t);
        osc.stop(end + 0.05);
        sources.push(osc);
        nodes.push(og);
      }
    }
    release(sources, nodes);
  }

  /* ------------------------------------------------------------ */
  /* Continuous layers: declared by level, started once audio runs */
  /* ------------------------------------------------------------ */

  ambient(level: number, bright = 0, fade = 2) {
    this.want("drone", level, bright, fade);
  }

  water(level: number, fade = 1.5) {
    this.want("water", level, 0, fade);
  }

  scan(level: number, pitch = 0) {
    this.want("scan", level, pitch, 0.4);
  }

  stopLayers(fade = 1.2) {
    this.wanted.clear();
    this.layers.forEach((layer) => layer.stop(fade));
    this.layers.clear();
    this.drawEnd(0.2);
  }

  private want(name: LayerName, level: number, x: number, fade: number) {
    const prev = this.wanted.get(name);
    if (!prev && level <= 0.001) return;
    if (prev && Math.abs(prev.level - level) < 0.01 && Math.abs(prev.x - x) < 0.01) return;
    this.wanted.set(name, { level, x, fade });
    this.sync();
  }

  private sync() {
    if (!this.live()) return;
    for (const [name, w] of this.wanted) {
      let layer = this.layers.get(name);
      if (w.level <= 0.001) {
        layer?.stop(w.fade);
        this.layers.delete(name);
        this.wanted.delete(name);
        continue;
      }
      if (!layer) {
        layer = name === "drone" ? this.droneLayer() : name === "water" ? this.waterLayer() : this.scanLayer();
        this.layers.set(name, layer);
      }
      layer.set(w.level, w.x);
    }
  }

  /* Low open-fifth drone (A1 + E2) with a breathing filter and air on top. */
  private droneLayer(): Layer {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.0001;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 220;
    lp.Q.value = 0.8;
    const sources: AudioScheduledSourceNode[] = [];
    const nodes: AudioNode[] = [out, lp];
    const voices: [OscillatorType, number, number][] = [
      ["sawtooth", 55, 0.3],
      ["sawtooth", 55 * 1.0046, 0.3],
      ["triangle", 109.84, 0.4],
      ["sine", 82.41, 0.5],
      ["sine", 164.81 * 1.003, 0.1],
    ];
    for (const [type, f, gain] of voices) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = gain;
      osc.connect(og).connect(lp);
      sources.push(osc);
      nodes.push(og);
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 80;
    lfo.connect(lfoGain).connect(lp.frequency);
    sources.push(lfo);
    nodes.push(lfoGain);
    lp.connect(out);
    const air = this.noiseSource();
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1300;
    band.Q.value = 0.5;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.0001;
    air.connect(band).connect(airGain);
    sources.push(air);
    nodes.push(band, airGain, this.route(out, { send: 0.5 }), this.route(airGain, { send: 0.6 }));
    sources.forEach((s) => s.start(t));
    return {
      set: (level, bright) => {
        const now = ctx.currentTime;
        out.gain.setTargetAtTime(0.055 * level, now, 0.9);
        lp.frequency.setTargetAtTime(200 + 900 * bright, now, 0.9);
        airGain.gain.setTargetAtTime(0.012 * level * (0.4 + bright), now, 0.9);
      },
      stop: (fade) => {
        const now = ctx.currentTime;
        out.gain.setTargetAtTime(0, now, fade / 4);
        airGain.gain.setTargetAtTime(0, now, fade / 4);
        sources.forEach((s) => s.stop(now + fade + 0.2));
        release(sources, nodes);
      },
    };
  }

  /* Gentle water: filtered noise plus a stream of random bubbles. */
  private waterLayer(): Layer {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = this.noiseSource();
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 180;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 800;
    lp.Q.value = 0.4;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    src.connect(hp).connect(lp).connect(g);
    const out = this.route(g, { send: 0.3 });
    src.start(t, Math.random() * 1.5);
    let level = 0;
    const timer = window.setInterval(() => {
      if (!this.live() || level <= 0) return;
      const now = ctx.currentTime;
      const count = Math.floor(level * 2.4 + Math.random());
      for (let i = 0; i < count; i++) {
        this.bubbleAt(now + Math.random() * 0.12, 260 * Math.pow(5, Math.random()), rand(0.03, 0.09), rand(0.005, 0.016) * level, rand(-0.75, 0.75), 0.35);
      }
    }, 120);
    return {
      set: (next) => {
        level = next;
        g.gain.setTargetAtTime(0.042 * next, ctx.currentTime, 0.5);
      },
      stop: (fade) => {
        window.clearInterval(timer);
        const now = ctx.currentTime;
        g.gain.setTargetAtTime(0, now, fade / 4);
        src.stop(now + fade + 0.2);
        release([src], [hp, lp, g, out]);
      },
    };
  }

  /* Hologram scanner: a soft, fluttering tone that follows the scan line. */
  private scanLayer(): Layer {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 800;
    const trem = ctx.createGain();
    trem.gain.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 13;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.4;
    lfo.connect(lfoGain).connect(trem.gain);
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    osc.connect(trem).connect(g);
    const out = this.route(g, { send: 0.45 });
    osc.start(t);
    lfo.start(t);
    return {
      set: (level, pitch) => {
        const now = ctx.currentTime;
        osc.frequency.setTargetAtTime(620 + pitch * 1100, now, 0.05);
        g.gain.setTargetAtTime(0.016 * level, now, 0.08);
      },
      stop: (fade) => {
        const now = ctx.currentTime;
        g.gain.setTargetAtTime(0, now, fade / 4);
        osc.stop(now + fade + 0.1);
        lfo.stop(now + fade + 0.1);
        release([osc, lfo], [trem, lfoGain, g, out]);
      },
    };
  }

  /* ------------------------------------------------------------ */
  /* Shared cues                                                   */
  /* ------------------------------------------------------------ */

  whoosh(o: WhooshOptions = {}) {
    const ctx = this.live();
    if (!ctx) return;
    const { from = 280, to = 2600, dur = 0.9, gain = 0.08, q = 0.9, pan = 0, panTo, delay = 0 } = o;
    const t = ctx.currentTime + delay;
    if (!delay) {
      if (t - this.lastWhoosh < 0.16) return;
      this.lastWhoosh = t;
    }
    const src = this.noiseSource();
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(clamp(pan, -1, 1), t);
    if (panTo !== undefined) panner.pan.linearRampToValueAtTime(clamp(panTo, -1, 1), t + dur);
    src.connect(filter).connect(g).connect(panner);
    const out = this.route(panner, { send: 0.4 });
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
    release([src], [filter, g, panner, out]);
  }

  boom(gain = 0.4) {
    const ctx = this.live();
    if (ctx) this.boomAt(ctx.currentTime, gain);
  }

  blip(freq = 1318.51, gain = 0.03, pan = 0, delay = 0) {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    this.toneAt(t, { type: "triangle", freq, gain, attack: 0.002, decay: 0.07, pan, send: 0.25 });
    this.toneAt(t + 0.055, { freq: freq * 1.5, gain: gain * 0.45, attack: 0.002, decay: 0.1, pan, send: 0.35 });
  }

  confirm() {
    const ctx = this.live();
    if (!ctx) return;
    this.blip(1318.51, 0.028);
    this.blip(1760, 0.03, 0, 0.11);
    this.bellAt(ctx.currentTime + 0.2, 2637.02, 0.012, 1.4, 0, 0.6);
  }

  ping() {
    const ctx = this.live();
    if (!ctx) return;
    this.bellAt(ctx.currentTime, 1760, 0.02, 1.6, -0.2);
    this.bellAt(ctx.currentTime + 0.13, 2637.02, 0.012, 1.4, 0.2);
  }

  chime(freqs: number[], gain = 0.025) {
    const ctx = this.live();
    if (!ctx) return;
    freqs.forEach((f, i) => this.bellAt(ctx.currentTime + i * 0.07, f, gain, 2.2, (i - (freqs.length - 1) / 2) * 0.4));
  }

  shimmer(dur = 1.4, gain = 1) {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 14; i++) {
      this.toneAt(t + rand(0, dur * 0.7), {
        freq: (SPARKS[i % SPARKS.length] / 2) * (i > 6 ? 2 : 1) * rand(0.997, 1.003),
        gain: rand(0.006, 0.014) * gain,
        attack: rand(0.08, 0.3),
        decay: rand(0.5, 1.2),
        pan: rand(-0.8, 0.8),
        send: 0.7,
      });
    }
  }

  /* The big "landing" hit: low boom, bright A-major bell chord, air. */
  impact(gain = 1) {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.boomAt(t, 0.48 * gain);
    [440, 659.26, 880, 1108.73].forEach((f, i) => this.bellAt(t + i * 0.014, f, 0.028 * gain, 2.8, (i - 1.5) * 0.35, 0.7));
    this.noiseAt(t, { type: "highpass", freq: 6000, q: 0.5, gain: 0.03 * gain, attack: 0.004, decay: 1.8, send: 0.7 });
  }

  /* Computing chatter: blips paced by how fast the visitor scrolls. */
  chatter(amount: number) {
    const ctx = this.live();
    if (!ctx) return;
    this.chatterAcc = Math.min(4, this.chatterAcc + amount);
    for (let n = 0; this.chatterAcc >= 1 && n < 3; n++) {
      this.chatterAcc -= 1;
      this.toneAt(ctx.currentTime + Math.random() * 0.04, {
        freq: SPARKS[Math.floor(Math.random() * SPARKS.length)],
        gain: rand(0.006, 0.014),
        attack: 0.002,
        decay: rand(0.025, 0.07),
        pan: rand(-0.7, 0.7),
        send: 0.3,
      });
    }
  }

  /* ------------------------------------------------------------ */
  /* Intro: gate                                                   */
  /* ------------------------------------------------------------ */

  /* A wet finger on a glass rim: pitch rises as the loop closes. */
  draw(progress: number, speed: number) {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    if (!this.drawVoice) {
      const out = ctx.createGain();
      out.gain.value = 0.0001;
      const oscs = [1, 2.004, 3.01].map(() => ctx.createOscillator());
      const partials = [1, 0.28, 0.07].map((gain) => {
        const g = ctx.createGain();
        g.gain.value = gain;
        return g;
      });
      oscs.forEach((osc, i) => osc.connect(partials[i]).connect(out));
      const vibrato = ctx.createOscillator();
      vibrato.frequency.value = 5.2;
      const vibratoGain = ctx.createGain();
      vibratoGain.gain.value = 3.5;
      vibrato.connect(vibratoGain);
      vibratoGain.connect(oscs[0].frequency);
      vibratoGain.connect(oscs[1].frequency);
      const rub = this.noiseSource();
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.Q.value = 8;
      const friction = ctx.createGain();
      friction.gain.value = 0.0001;
      rub.connect(band).connect(friction);
      const sources = [...oscs, vibrato, rub];
      sources.forEach((s) => s.start(t));
      this.drawVoice = {
        out,
        friction,
        oscs,
        band,
        sources,
        nodes: [out, ...partials, vibratoGain, band, friction, this.route(out, { send: 0.55 }), this.route(friction, { send: 0.3 })],
      };
    }
    const v = this.drawVoice;
    const f = 440 * Math.pow(2, clamp(progress));
    const k = clamp(speed / 900);
    [1, 2.004, 3.01].forEach((ratio, i) => v.oscs[i].frequency.setTargetAtTime(f * ratio, t, 0.04));
    v.band.frequency.setTargetAtTime(f * 2, t, 0.05);
    v.out.gain.setTargetAtTime(0.012 + 0.06 * k, t, 0.07);
    v.friction.gain.setTargetAtTime(0.0001 + 0.03 * k, t, 0.05);
  }

  drawEnd(fade = 0.35) {
    const v = this.drawVoice;
    const ctx = this.ctx;
    this.drawVoice = null;
    if (!v || !ctx) return;
    const t = ctx.currentTime;
    v.out.gain.setTargetAtTime(0, t, fade / 4);
    v.friction.gain.setTargetAtTime(0, t, fade / 5);
    v.sources.forEach((s) => s.stop(t + fade + 0.1));
    release(v.sources, v.nodes);
  }

  retry() {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.toneAt(t, { freq: 659.26, gain: 0.03, attack: 0.004, decay: 0.22, send: 0.4 });
    this.toneAt(t + 0.12, { freq: 523.25, gain: 0.028, attack: 0.004, decay: 0.32, send: 0.4 });
  }

  success() {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    [880, 1318.51, 1975.53].forEach((f, i) => this.bellAt(t + i * 0.06, f, 0.045, 2.6, (i - 1) * 0.4, 0.65));
    this.toneAt(t, { freq: 110, to: 55, glide: 0.4, gain: 0.12, attack: 0.004, decay: 0.5, send: 0.3 });
    // the ring snaps and unrolls into the tube
    this.whoosh({ from: 3200, to: 520, dur: 0.7, gain: 0.05, q: 1.2, pan: -0.25, panTo: 0.25, delay: 0.36 });
  }

  /* Riser while the tube charges; returns a release for the moment it bursts. */
  charge(): () => void {
    const ctx = this.live();
    if (!ctx) return () => {};
    const t = ctx.currentTime;
    const dur = 1.55;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.085, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 5;
    lp.frequency.setValueAtTime(260, t);
    lp.frequency.exponentialRampToValueAtTime(3600, t + dur);
    const trem = ctx.createGain();
    trem.gain.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(5, t);
    lfo.frequency.exponentialRampToValueAtTime(19, t + dur);
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.4;
    lfo.connect(lfoGain).connect(trem.gain);
    const saws = [0, 8].map((cents) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.detune.value = cents;
      osc.frequency.setValueAtTime(110, t);
      osc.frequency.exponentialRampToValueAtTime(440, t + dur);
      osc.connect(lp);
      return osc;
    });
    lp.connect(trem).connect(out);
    const hiss = this.noiseSource();
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(400, t);
    hp.frequency.exponentialRampToValueAtTime(7000, t + dur);
    const hissGain = ctx.createGain();
    hissGain.gain.setValueAtTime(0.0001, t);
    hissGain.gain.exponentialRampToValueAtTime(0.04, t + dur);
    hiss.connect(hp).connect(hissGain);
    const nodes: AudioNode[] = [out, lp, trem, lfoGain, hp, hissGain, this.route(out, { send: 0.35 }), this.route(hissGain, { send: 0.4 })];
    const sources = [...saws, lfo, hiss];
    sources.forEach((s) => s.start(t));
    let done = false;
    const stop = () => {
      if (done) return;
      done = true;
      const now = ctx.currentTime;
      [out.gain, hissGain.gain].forEach((param) => {
        holdAt(param, now);
        param.setTargetAtTime(0, now, 0.03);
      });
      sources.forEach((s) => s.stop(now + 0.3));
      release(sources, nodes);
    };
    window.setTimeout(stop, 7000);
    return stop;
  }

  /* ------------------------------------------------------------ */
  /* Intro: pour, garden, flood                                    */
  /* ------------------------------------------------------------ */

  /* The ring shatters and the charged tube bursts open. */
  burst() {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.boomAt(t, 0.5);
    this.shatterAt(t + 0.1, 1);
    this.noiseAt(t + 0.42, { type: "lowpass", freq: 2600, to: 380, q: 0.8, gain: 0.12, attack: 0.003, decay: 0.45, send: 0.5 });
    this.toneAt(t + 0.42, { freq: 150, to: 52, glide: 0.4, gain: 0.15, attack: 0.004, decay: 0.55 });
  }

  /* Six lime streams fall from the tube and splash into the water. */
  pour(impacts: { at: number; x: number }[]) {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = this.noiseSource();
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 0.9;
    band.frequency.value = 650;
    const wobbles = [
      [3.3, 160],
      [7.9, 90],
    ].map(([rate, depth]) => {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = rate;
      const g = ctx.createGain();
      g.gain.value = depth;
      lfo.connect(g).connect(band.frequency);
      return [lfo, g] as const;
    });
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.setValueAtTime(0.0001, t + 0.45);
    g.gain.exponentialRampToValueAtTime(0.075, t + 1.2);
    g.gain.setValueAtTime(0.075, t + 2.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.8);
    src.connect(band).connect(lp).connect(g);
    const out = this.route(g, { send: 0.35 });
    const sources = [src, ...wobbles.map(([lfo]) => lfo)];
    sources.forEach((s) => {
      s.start(t);
      s.stop(t + 4);
    });
    release(sources, [band, lp, g, out, ...wobbles.map(([, gain]) => gain)]);
    for (let i = 0; i < 120; i++) {
      const at = rand(0.5, 3.5);
      if (Math.random() > ramp(0.5, 1.2, at) * (1 - ramp(2.6, 3.5, at))) continue;
      this.bubbleAt(t + at, 260 * Math.pow(4.5, Math.random()), rand(0.03, 0.1), rand(0.008, 0.026), rand(-0.7, 0.7), 0.3);
    }
    impacts.forEach(({ at, x }) => this.splashAt(t + at, x * 0.85));
  }

  /* Dive into the water gardens: fountains spring up, the lotus blooms. */
  garden() {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.whoosh({ from: 160, to: 1500, dur: 2, gain: 0.07, q: 0.7 });
    this.toneAt(t, { freq: 46, gain: 0.14, attack: 0.9, decay: 2.4, send: 0.2 });
    this.noiseAt(t + 3, { type: "highpass", freq: 3800, q: 0.4, gain: 0.03, attack: 0.9, decay: 2.6, send: 0.5 });
    for (let i = 0; i < 46; i++) {
      this.bubbleAt(t + rand(3, 5.6), 1200 * Math.pow(3, Math.random()), rand(0.02, 0.05), rand(0.004, 0.012), rand(-0.8, 0.8), 0.45);
    }
    this.padAt(t + 3, [220, 329.63, 440, 554.37, 659.26], { gain: 0.011, attack: 2.2, hold: 1.2, release: 3.2, cutoff: 1100, cutoffEnd: 2400 });
  }

  /* Lime floods the screen, rises, and resolves into the site. */
  flood(resolveAt = 5.25) {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    const end = t + resolveAt;
    this.toneAt(t, { freq: 170, to: 56, glide: 0.45, gain: 0.12, attack: 0.005, decay: 0.7 });
    ([
      [0.6, 0],
      [1.15, -0.65],
      [1.35, 0.65],
    ] as const).forEach(([at, pan]) => {
      this.noiseAt(t + at, { type: "bandpass", freq: 380, to: 900, sweep: 2.4, q: 0.9, gain: 0.07, attack: 0.3, decay: 2.4, pan, send: 0.35 });
      for (let i = 0; i < 16; i++) {
        this.bubbleAt(t + at + rand(0, 2.6), 140 * Math.pow(3.4, Math.random()), rand(0.06, 0.15), rand(0.01, 0.024), clamp(pan + rand(-0.25, 0.25), -1, 1), 0.3);
      }
    });
    // the pool rises: a roar and a tonal riser that cut into the resolve
    const roar = this.noiseSource();
    const roarLp = ctx.createBiquadFilter();
    roarLp.type = "lowpass";
    roarLp.Q.value = 0.6;
    roarLp.frequency.setValueAtTime(220, t + 2);
    roarLp.frequency.exponentialRampToValueAtTime(3200, end);
    const roarGain = ctx.createGain();
    roarGain.gain.value = 0.0001;
    roarGain.gain.setValueAtTime(0.0001, t + 1.8);
    roarGain.gain.exponentialRampToValueAtTime(0.1, end);
    roarGain.gain.setTargetAtTime(0, end, 0.08);
    roar.connect(roarLp).connect(roarGain);
    const riseLp = ctx.createBiquadFilter();
    riseLp.type = "lowpass";
    riseLp.Q.value = 2;
    riseLp.frequency.setValueAtTime(200, t + 2);
    riseLp.frequency.exponentialRampToValueAtTime(2200, end);
    const riseGain = ctx.createGain();
    riseGain.gain.value = 0.0001;
    riseGain.gain.setValueAtTime(0.0001, t + 2);
    riseGain.gain.exponentialRampToValueAtTime(0.05, end);
    riseGain.gain.setTargetAtTime(0, end, 0.05);
    const saws = [55, 82.41].map((f) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(f, t + 2);
      osc.frequency.exponentialRampToValueAtTime(f * 2, end);
      osc.connect(riseLp);
      return osc;
    });
    riseLp.connect(riseGain);
    const nodes: AudioNode[] = [roarLp, roarGain, riseLp, riseGain, this.route(roarGain, { send: 0.4 }), this.route(riseGain, { send: 0.4 })];
    const sources = [roar, ...saws];
    sources.forEach((s) => {
      s.start(t + 1.8);
      s.stop(end + 0.6);
    });
    release(sources, nodes);
    this.resolveAt(end);
  }

  private resolveAt(t: number) {
    this.boomAt(t, 0.55);
    this.padAt(t, [110, 164.81, 220, 277.18, 329.63, 415.3, 493.88], {
      gain: 0.016,
      attack: 0.05,
      hold: 0.7,
      release: 4.8,
      cutoff: 3200,
      cutoffEnd: 700,
    });
    [880, 1318.51, 1760].forEach((f, i) => this.bellAt(t + 0.02 + i * 0.05, f, 0.03, 3.4, (i - 1) * 0.5, 0.7));
    this.noiseAt(t, { type: "highpass", freq: 5200, q: 0.5, gain: 0.035, attack: 0.01, decay: 2.2, send: 0.7 });
  }

  /* ------------------------------------------------------------ */
  /* Site interface                                                */
  /* ------------------------------------------------------------ */

  readonly ui = {
    /* the lime liquid rises over the page… */
    transitionOut: () => {
      const ctx = this.live();
      if (!ctx) return;
      this.whoosh({ from: 220, to: 2000, dur: 0.7, gain: 0.055, q: 0.8 });
      for (let i = 0; i < 7; i++) {
        this.bubbleAt(ctx.currentTime + rand(0.15, 0.6), 300 * Math.pow(3.5, Math.random()), rand(0.04, 0.09), rand(0.008, 0.018), rand(-0.6, 0.6), 0.35);
      }
    },
    /* …and drains away from the new one */
    transitionIn: () => {
      this.whoosh({ from: 2200, to: 260, dur: 0.85, gain: 0.04, q: 0.8, delay: 0.02 });
    },
    folderOpen: () => {
      const ctx = this.live();
      if (!ctx) return;
      const t = ctx.currentTime;
      this.whoosh({ from: 260, to: 1500, dur: 0.62, gain: 0.045, q: 0.8 });
      // the lid flaps open
      this.noiseAt(t + 0.52, { type: "lowpass", freq: 1600, to: 500, q: 0.7, gain: 0.05, attack: 0.003, decay: 0.12, send: 0.2 });
      this.toneAt(t + 0.52, { freq: 180, to: 120, glide: 0.1, gain: 0.035, attack: 0.003, decay: 0.1 });
      // papers slide out
      for (let i = 0; i < 4; i++) {
        this.noiseAt(t + 0.82 + i * 0.085, { type: "bandpass", freq: 3400, to: 1800, q: 0.9, gain: 0.026, attack: 0.02, decay: 0.16, pan: i % 2 ? 0.3 : -0.3, send: 0.25 });
      }
      this.bellAt(t + 1.25, 1760, 0.016, 1.4, 0, 0.6);
    },
    folderClose: () => {
      const ctx = this.live();
      if (!ctx) return;
      const t = ctx.currentTime;
      for (let i = 0; i < 4; i++) {
        this.noiseAt(t + i * 0.045, { type: "bandpass", freq: 1800, to: 3200, q: 0.9, gain: 0.022, attack: 0.02, decay: 0.14, pan: i % 2 ? -0.3 : 0.3, send: 0.25 });
      }
      this.noiseAt(t + 0.56, { type: "lowpass", freq: 1400, to: 400, q: 0.7, gain: 0.05, attack: 0.003, decay: 0.1, send: 0.2 });
      this.toneAt(t + 0.56, { freq: 160, to: 100, glide: 0.1, gain: 0.04, attack: 0.003, decay: 0.12 });
      this.whoosh({ from: 1500, to: 260, dur: 0.56, gain: 0.035, q: 0.8, delay: 0.86 });
    },
    pop: () => {
      const ctx = this.live();
      if (!ctx) return;
      this.toneAt(ctx.currentTime, { freq: 520, to: 880, glide: 0.07, gain: 0.035, attack: 0.003, decay: 0.12, send: 0.3 });
    },
    tick: () => {
      const ctx = this.live();
      if (!ctx) return;
      this.toneAt(ctx.currentTime, { type: "triangle", freq: 1400, gain: 0.018, attack: 0.002, decay: 0.045, send: 0.2 });
    },
    bloop: () => {
      const ctx = this.live();
      if (!ctx) return;
      const t = ctx.currentTime;
      this.toneAt(t, { freq: 300, to: 640, glide: 0.08, gain: 0.04, attack: 0.004, decay: 0.16, send: 0.35 });
      this.bubbleAt(t + 0.06, 900, 0.06, 0.012, 0.2, 0.4);
    },
  };
}

export const sound = new SoundEngine();

/* Lets the first click, tap or key press anywhere start the audio. */
export function installSoundUnlock() {
  const events = ["pointerdown", "pointerup", "touchend", "keydown", "click"] as const;
  const handler = () => sound.unlock();
  events.forEach((name) => window.addEventListener(name, handler, { capture: true, passive: true }));
  return () => events.forEach((name) => window.removeEventListener(name, handler, { capture: true }));
}
