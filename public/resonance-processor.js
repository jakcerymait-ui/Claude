// AudioWorklet processor for dynamic resonance suppression
class ResonanceProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.filterCoeffs = [];
    this.channelStates = [];
    this.bypass = false;

    this.port.onmessage = (e) => {
      const { type, data } = e.data;
      if (type === 'set-filters') this._setFilters(data.filters);
      else if (type === 'set-bypass') this.bypass = data.bypass;
    };
  }

  _computePeakingEQ(frequency, gainDB, Q) {
    if (frequency <= 0 || frequency >= sampleRate / 2 || Q <= 0) return null;
    const A = Math.pow(10, gainDB / 40);
    const w0 = 2 * Math.PI * frequency / sampleRate;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const alpha = sinw0 / (2 * Math.max(Q, 0.05));
    const a0inv = 1 / (1 + alpha / A);
    return {
      b0: (1 + alpha * A) * a0inv,
      b1: (-2 * cosw0) * a0inv,
      b2: (1 - alpha * A) * a0inv,
      a1: (-2 * cosw0) * a0inv,
      a2: (1 - alpha / A) * a0inv,
    };
  }

  _setFilters(filters) {
    const newCoeffs = [];
    for (const f of filters) {
      const c = this._computePeakingEQ(f.frequency, f.gain, f.Q);
      if (c) newCoeffs.push(c);
    }
    this.filterCoeffs = newCoeffs;
    // Rebuild channel states preserving existing state where possible
    this.channelStates = this.channelStates.map(chStates => {
      const newStates = newCoeffs.map((_, i) =>
        chStates[i] || { x1: 0, x2: 0, y1: 0, y2: 0 }
      );
      return newStates;
    });
  }

  _ensureChannels(n) {
    while (this.channelStates.length < n) {
      this.channelStates.push(
        this.filterCoeffs.map(() => ({ x1: 0, x2: 0, y1: 0, y2: 0 }))
      );
    }
  }

  process(inputs, outputs) {
    const inp = inputs[0];
    const out = outputs[0];
    if (!inp || !inp.length) return true;

    this._ensureChannels(inp.length);

    for (let ch = 0; ch < inp.length; ch++) {
      const inBuf = inp[ch];
      const outBuf = out[ch];

      if (this.bypass || this.filterCoeffs.length === 0) {
        outBuf.set(inBuf);
        continue;
      }

      outBuf.set(inBuf);

      const states = this.channelStates[ch];
      for (let fi = 0; fi < this.filterCoeffs.length; fi++) {
        const { b0, b1, b2, a1, a2 } = this.filterCoeffs[fi];
        const st = states[fi];
        for (let i = 0; i < outBuf.length; i++) {
          const x = outBuf[i];
          const y = b0 * x + b1 * st.x1 + b2 * st.x2 - a1 * st.y1 - a2 * st.y2;
          st.x2 = st.x1; st.x1 = x;
          st.y2 = st.y1; st.y1 = isFinite(y) ? y : 0;
          outBuf[i] = st.y1;
        }
      }
    }
    return true;
  }
}

registerProcessor('resonance-processor', ResonanceProcessor);
