import { useState, useRef, useEffect, useCallback } from 'react';
import Knob from '../components/Knob';

// ─── helpers ─────────────────────────────────────────────────────────────────

function lerp(a, b, t) { return a + (b - a) * t; }

function getFreqBounds(freqRange) {
  if (freqRange === 'highs') return [2000, 20000];
  if (freqRange === 'mids')  return [200, 8000];
  return [20, 20000];
}

function freqToX(freq, W, lo = 20, hi = 20000) {
  return (Math.log10(freq / lo) / Math.log10(hi / lo)) * W;
}

function dbToY(db, H, minDB = -96, maxDB = 6) {
  return H - ((db - minDB) / (maxDB - minDB)) * H;
}

function smoothSpectrum(data, halfWin) {
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    let sum = 0, n = 0;
    for (let j = Math.max(0, i - halfWin); j <= Math.min(data.length - 1, i + halfWin); j++) {
      if (data[j] > -150) { sum += data[j]; n++; }
    }
    out[i] = n ? sum / n : -100;
  }
  return out;
}

function encodeWAV(audioBuffer) {
  const nCh = audioBuffer.numberOfChannels;
  const sr  = audioBuffer.sampleRate;
  const len = audioBuffer.length;
  const bps = 2;
  const dataSize = len * nCh * bps;
  const buf = new ArrayBuffer(44 + dataSize);
  const v   = new DataView(buf);
  const ws  = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, 36 + dataSize, true); ws(8, 'WAVE');
  ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, nCh, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * nCh * bps, true); v.setUint16(32, nCh * bps, true);
  v.setUint16(34, 16, true); ws(36, 'data'); v.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < nCh; ch++) {
      const s = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      off += 2;
    }
  }
  return buf;
}

// ─── colours ─────────────────────────────────────────────────────────────────
const COL_BEFORE = '#29b6f6';
const COL_AFTER  = '#f97316';
const MIN_DB = -96, MAX_DB = 6;
const FREQ_TICKS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const DB_TICKS   = [0, -12, -24, -36, -48, -60, -72, -84];

// ─── component ───────────────────────────────────────────────────────────────

export default function ResonanceSuppressor() {
  const [audioBuffer,    setAudioBuffer]    = useState(null);
  const [isPlaying,      setIsPlaying]      = useState(false);
  const [isBypassed,     setIsBypassed]     = useState(false);
  const [isLoading,      setIsLoading]      = useState(false);
  const [isExporting,    setIsExporting]    = useState(false);
  const [fileName,       setFileName]       = useState('');
  const [peakCount,      setPeakCount]      = useState(0);
  const [workletReady,   setWorkletReady]   = useState(false);
  const [controls, setControls] = useState({ depth: 60, sharpness: 55, sensitivity: 50, freqRange: 'full' });

  const audioCtxRef       = useRef(null);
  const audioBufferRef    = useRef(null);
  const sourceNodeRef     = useRef(null);
  const workletNodeRef    = useRef(null);
  const analyserBefRef    = useRef(null);
  const analyserAftRef    = useRef(null);
  const wetGainRef        = useRef(null);
  const dryGainRef        = useRef(null);
  const canvasRef         = useRef(null);
  const animRef           = useRef(null);
  const startTimeRef      = useRef(0);
  const offsetRef         = useRef(0);
  const controlsRef       = useRef(controls);
  const isBypassedRef     = useRef(false);
  const isPlayingRef      = useRef(false);
  const currentFiltersRef = useRef([]);
  const frameRef          = useRef(0);

  useEffect(() => { controlsRef.current = controls; }, [controls]);
  useEffect(() => { isBypassedRef.current = isBypassed; }, [isBypassed]);
  useEffect(() => { isPlayingRef.current = isPlaying;   }, [isPlaying]);

  // ── audio graph setup ──────────────────────────────────────────────────────

  const setupGraph = useCallback(async () => {
    if (audioCtxRef.current) return;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    await ctx.audioWorklet.addModule('/resonance-processor.js');

    const aBef = ctx.createAnalyser();
    aBef.fftSize = 4096;
    aBef.smoothingTimeConstant = 0.8;
    analyserBefRef.current = aBef;

    const aAft = ctx.createAnalyser();
    aAft.fftSize = 4096;
    aAft.smoothingTimeConstant = 0.8;
    analyserAftRef.current = aAft;

    const worklet = new AudioWorkletNode(ctx, 'resonance-processor');
    workletNodeRef.current = worklet;

    const wet = ctx.createGain(); wet.gain.value = 1;
    const dry = ctx.createGain(); dry.gain.value = 0;
    wetGainRef.current = wet;
    dryGainRef.current = dry;

    // Graph: source → aBef → wet → worklet → aAft → dest
    //                      → dry ────────────↗
    aBef.connect(wet); wet.connect(worklet); worklet.connect(aAft);
    aBef.connect(dry); dry.connect(aAft);
    aAft.connect(ctx.destination);

    setWorkletReady(true);
  }, []);

  // ── file upload ────────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setIsLoading(true);
    setFileName(file.name);
    stopPlayback();

    try {
      await setupGraph();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const arrayBuf = await file.arrayBuffer();
      // decodeAudioData can take a callback or return a Promise depending on browser;
      // wrap in explicit Promise to normalise error handling.
      const decoded = await new Promise((resolve, reject) => {
        ctx.decodeAudioData(arrayBuf, resolve, reject);
      });
      audioBufferRef.current = decoded;
      setAudioBuffer(decoded);
      offsetRef.current = 0;
    } catch (err) {
      console.error('Failed to decode audio:', err);
      setFileName(`Error: could not decode "${file.name}"`);
    } finally {
      setIsLoading(false);
    }
  }, [setupGraph]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFileInput = useCallback((e) => {
    const f = e.target.files[0];
    if (f) handleFile(f);
    e.target.value = '';   // allow re-selecting the same file
  }, [handleFile]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  // ── playback ───────────────────────────────────────────────────────────────

  function stopPlayback() {
    try { sourceNodeRef.current?.stop(); } catch {}
    sourceNodeRef.current = null;
  }

  const play = useCallback(() => {
    const ctx = audioCtxRef.current;
    const buf = audioBufferRef.current;
    if (!ctx || !buf) return;
    if (ctx.state === 'suspended') ctx.resume();
    stopPlayback();

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(analyserBefRef.current);
    src.onended = () => {
      if (isPlayingRef.current) {
        setIsPlaying(false);
        offsetRef.current = 0;
      }
    };

    const off = Math.min(offsetRef.current, buf.duration - 0.01);
    src.start(0, off);
    startTimeRef.current  = ctx.currentTime - off;
    sourceNodeRef.current = src;
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (ctx) offsetRef.current = ctx.currentTime - startTimeRef.current;
    stopPlayback();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlayingRef.current) pause(); else play();
  }, [play, pause]);

  // ── bypass ─────────────────────────────────────────────────────────────────

  const toggleBypass = useCallback(() => {
    setIsBypassed(prev => {
      const next = !prev;
      if (wetGainRef.current) wetGainRef.current.gain.value = next ? 0 : 1;
      if (dryGainRef.current) dryGainRef.current.gain.value = next ? 1 : 0;
      workletNodeRef.current?.port.postMessage({ type: 'set-bypass', data: { bypass: next } });
      return next;
    });
  }, []);

  // ── peak detection ─────────────────────────────────────────────────────────

  const detectAndUpdate = useCallback(() => {
    const analyser = analyserBefRef.current;
    const worklet  = workletNodeRef.current;
    if (!analyser || !worklet) return;

    const binCount = analyser.frequencyBinCount;
    const data     = new Float32Array(binCount);
    analyser.getFloatFrequencyData(data);

    const { depth, sharpness, sensitivity, freqRange } = controlsRef.current;
    const [loHz, hiHz] = getFreqBounds(freqRange);
    const sr      = audioCtxRef.current.sampleRate;
    const nyquist = sr / 2;
    const loBin   = Math.max(2, Math.floor((loHz / nyquist) * binCount));
    const hiBin   = Math.min(binCount - 3, Math.ceil((hiHz / nyquist) * binCount));

    const halfWin = Math.max(4, Math.floor(binCount * 0.04));
    const env     = smoothSpectrum(data, halfWin);

    const threshDB = lerp(14, 2.5, sensitivity / 100);
    const peaks    = [];

    for (let i = loBin + 2; i < hiBin - 2; i++) {
      if (data[i] < -85) continue;
      const excess = data[i] - env[i];
      if (
        excess > threshDB &&
        data[i] >= data[i - 1] && data[i] >= data[i + 1] &&
        data[i] >= data[i - 2] && data[i] >= data[i + 2]
      ) {
        peaks.push({ freq: (i / binCount) * nyquist, excess });
      }
    }

    peaks.sort((a, b) => b.excess - a.excess);
    const top = peaks.slice(0, 20);
    setPeakCount(top.length);

    const maxCut = lerp(-2, -22, depth / 100);
    const Q      = lerp(0.8, 18, sharpness / 100);
    const filters = top.map(p => ({
      frequency: p.freq,
      gain: Math.max(maxCut, -(p.excess * depth / 100) * 0.5),
      Q,
    }));

    currentFiltersRef.current = filters;
    worklet.port.postMessage({ type: 'set-filters', data: { filters } });
  }, []);

  // ── spectrum draw ──────────────────────────────────────────────────────────

  const drawSpectrum = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W   = canvas.width;
    const H   = canvas.height;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0b0b14';
    ctx.fillRect(0, 0, W, H);

    // Grid — dB
    ctx.strokeStyle = '#1e1e30';
    ctx.lineWidth = 1;
    for (const db of DB_TICKS) {
      const y = dbToY(db, H, MIN_DB, MAX_DB);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.fillStyle = '#44445a';
      ctx.font = '10px monospace';
      ctx.fillText(`${db}`, 4, y - 3);
    }

    // Grid — freq
    for (const f of FREQ_TICKS) {
      const x = freqToX(f, W);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      ctx.fillStyle = '#44445a';
      ctx.font = '10px monospace';
      const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
      ctx.fillText(label, x + 2, H - 4);
    }

    const aBef = analyserBefRef.current;
    const aAft = analyserAftRef.current;
    if (!aBef || !aAft) return;

    const n    = aBef.frequencyBinCount;
    const bef  = new Float32Array(n);
    const aft  = new Float32Array(n);
    aBef.getFloatFrequencyData(bef);
    aAft.getFloatFrequencyData(aft);
    const sr  = audioCtxRef.current?.sampleRate || 48000;
    const nyq = sr / 2;

    function drawLine(data, color, fillAlpha) {
      ctx.beginPath();
      let first = true;
      for (let i = 1; i < n; i++) {
        const freq = (i / n) * nyq;
        if (freq < 20 || freq > 20000) continue;
        const x = freqToX(freq, W);
        const y = dbToY(Math.max(data[i], MIN_DB), H, MIN_DB, MAX_DB);
        if (first) { ctx.moveTo(x, y); first = false; }
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Fill
      ctx.lineTo(W, H); ctx.lineTo(freqToX(20, W), H); ctx.closePath();
      ctx.fillStyle = color.replace(')', `, ${fillAlpha})`).replace('rgb', 'rgba');
      ctx.fill();
    }

    drawLine(bef, COL_BEFORE, 0.12);
    drawLine(aft, COL_AFTER,  0.12);
  }, []);

  // ── animation loop ─────────────────────────────────────────────────────────

  const loop = useCallback(() => {
    frameRef.current++;
    if (frameRef.current % 3 === 0) detectAndUpdate();
    drawSpectrum();
    animRef.current = requestAnimationFrame(loop);
  }, [detectAndUpdate, drawSpectrum]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [loop]);

  // ── canvas resize ──────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    ro.observe(canvas);
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    return () => ro.disconnect();
  }, []);

  // ── export ─────────────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    const buf = audioBufferRef.current;
    if (!buf || isExporting) return;
    setIsExporting(true);

    try {
      const offCtx = new OfflineAudioContext(
        buf.numberOfChannels, buf.length, buf.sampleRate
      );
      await offCtx.audioWorklet.addModule('/resonance-processor.js');

      const src     = offCtx.createBufferSource();
      src.buffer    = buf;
      const worklet = new AudioWorkletNode(offCtx, 'resonance-processor');

      if (!isBypassedRef.current) {
        worklet.port.postMessage({ type: 'set-filters', data: { filters: currentFiltersRef.current } });
      }

      src.connect(worklet); worklet.connect(offCtx.destination);
      src.start();

      const rendered = await offCtx.startRendering();
      const wav      = encodeWAV(rendered);
      const blob     = new Blob([wav], { type: 'audio/wav' });
      const url      = URL.createObjectURL(blob);
      const a        = document.createElement('a');
      a.href         = url;
      a.download     = `rs_${fileName.replace(/\.[^.]+$/, '')}.wav`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      console.error('Export failed:', err);
    }
    setIsExporting(false);
  }, [fileName, isExporting]);

  // ── cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => () => {
    cancelAnimationFrame(animRef.current);
    stopPlayback();
    audioCtxRef.current?.close();
  }, []);

  // ── UI helpers ─────────────────────────────────────────────────────────────

  const setCtrl = (key) => (val) => setControls(c => ({ ...c, [key]: val }));

  const formatDuration = (s) => {
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #0c0c18 0%, #0e0e1e 50%, #0a0a14 100%)',
        fontFamily: "'Inter', system-ui, sans-serif",
        color: '#e2e8f0',
        padding: '24px 16px',
      }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#f1f5f9', margin: 0 }}>
              RESONANCE SUPPRESSOR
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6366f1', letterSpacing: '0.12em', fontWeight: 600 }}>
              DYNAMIC SPECTRAL PROCESSING
            </p>
          </div>

          {/* Bypass toggle */}
          <button
            onClick={toggleBypass}
            style={{
              padding: '7px 20px',
              borderRadius: 6,
              border: `1px solid ${isBypassed ? '#6366f1' : '#3a3a56'}`,
              background: isBypassed ? '#6366f118' : 'transparent',
              color: isBypassed ? '#818cf8' : '#64748b',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {isBypassed ? '⏭  BYPASS ON' : '⚡ BYPASS OFF'}
          </button>
        </div>

        {/* ── Drop zone ──────────────────────────────────────────────────── */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          style={{
            border: '1.5px dashed #2d2d46',
            borderRadius: 10,
            padding: '16px 20px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: '#10101c',
            transition: 'border-color 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <label
              htmlFor="audio-upload"
              style={{
                padding: '8px 18px',
                background: '#1e1e34',
                border: '1px solid #3a3a58',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                color: '#a5b4fc',
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
              }}
            >
              LOAD FILE
            </label>
            <input id="audio-upload" type="file" accept="audio/*,.wav,.mp3,.flac,.ogg,.aac,.m4a,.aiff,.aif" onChange={onFileInput} style={{ display: 'none' }} />
            <span style={{ fontSize: 13, color: fileName ? '#e2e8f0' : '#44445a' }}>
              {isLoading ? 'Decoding…' : (fileName || 'Drop audio file here or click LOAD FILE')}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
            {audioBuffer && (
              <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                {formatDuration(audioBuffer.duration)} · {Math.round(audioBuffer.sampleRate / 1000)}kHz
              </span>
            )}
            {peakCount > 0 && (
              <span style={{
                fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
                color: '#f97316', background: '#f9731618', borderRadius: 4,
                padding: '2px 8px', border: '1px solid #f9731630',
              }}>
                {peakCount} PEAKS
              </span>
            )}
          </div>
        </div>

        {/* ── Spectrum canvas ─────────────────────────────────────────────── */}
        <div style={{
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid #1e1e30',
          marginBottom: 20,
          position: 'relative',
          background: '#0b0b14',
        }}>
          <div style={{
            position: 'absolute', top: 10, left: 14, display: 'flex', gap: 16, zIndex: 1, pointerEvents: 'none',
          }}>
            <span style={{ fontSize: 11, color: COL_BEFORE, fontWeight: 600, letterSpacing: '0.06em' }}>
              ● INPUT
            </span>
            <span style={{ fontSize: 11, color: COL_AFTER, fontWeight: 600, letterSpacing: '0.06em' }}>
              ● OUTPUT
            </span>
          </div>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: 220, display: 'block' }}
          />
        </div>

        {/* ── Controls ────────────────────────────────────────────────────── */}
        <div style={{
          background: '#10101e',
          border: '1px solid #1e1e30',
          borderRadius: 10,
          padding: '20px 24px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          justifyContent: 'space-between',
        }}>
          {/* Knobs */}
          <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
            <Knob label="Depth"       value={controls.depth}       min={0} max={100} onChange={setCtrl('depth')}       color="#f97316" />
            <Knob label="Sharpness"   value={controls.sharpness}   min={0} max={100} onChange={setCtrl('sharpness')}   color="#a78bfa" />
            <Knob label="Sensitivity" value={controls.sensitivity} min={0} max={100} onChange={setCtrl('sensitivity')} color="#34d399" />
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 64, background: '#1e1e30', margin: '0 24px' }} />

          {/* Freq range selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 10, color: '#8888aa', letterSpacing: '0.1em', fontFamily: 'monospace', textTransform: 'uppercase' }}>Freq Range</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {['full', 'mids', 'highs'].map(r => (
                <button
                  key={r}
                  onClick={() => setControls(c => ({ ...c, freqRange: r }))}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 5,
                    border: `1px solid ${controls.freqRange === r ? '#f97316' : '#2e2e46'}`,
                    background: controls.freqRange === r ? '#f9731618' : 'transparent',
                    color: controls.freqRange === r ? '#f97316' : '#64748b',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    transition: 'all 0.12s',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Transport ───────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#10101e', border: '1px solid #1e1e30',
          borderRadius: 10, padding: '14px 24px',
        }}>
          <button
            onClick={togglePlay}
            disabled={!audioBuffer}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 28px',
              borderRadius: 7,
              border: 'none',
              background: audioBuffer
                ? (isPlaying ? '#ef4444' : 'linear-gradient(135deg, #f97316, #ea580c)')
                : '#1e1e30',
              color: audioBuffer ? '#fff' : '#44445a',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.08em',
              cursor: audioBuffer ? 'pointer' : 'default',
              boxShadow: audioBuffer && !isPlaying ? '0 0 16px #f9731640' : 'none',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 16 }}>{isPlaying ? '⏸' : '▶'}</span>
            {isPlaying ? 'PAUSE' : 'PLAY'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#44445a', fontFamily: 'monospace' }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: workletReady ? '#34d399' : '#374151',
              boxShadow: workletReady ? '0 0 6px #34d39980' : 'none',
            }} />
            {workletReady ? 'WORKLET ACTIVE' : 'LOAD A FILE TO INITIALISE'}
          </div>

          <button
            onClick={handleExport}
            disabled={!audioBuffer || isExporting}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 22px',
              borderRadius: 7,
              border: `1px solid ${audioBuffer ? '#2e2e46' : '#1e1e30'}`,
              background: 'transparent',
              color: audioBuffer ? '#94a3b8' : '#44445a',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.08em',
              cursor: audioBuffer && !isExporting ? 'pointer' : 'default',
              transition: 'all 0.15s',
            }}
          >
            {isExporting ? '⏳ EXPORTING…' : '⬇ EXPORT WAV'}
          </button>
        </div>

        {/* ── Legend ──────────────────────────────────────────────────────── */}
        <div style={{ marginTop: 16, display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { label: 'DEPTH', desc: 'Gain reduction amount' },
            { label: 'SHARPNESS', desc: 'Suppression band Q / narrowness' },
            { label: 'SENSITIVITY', desc: 'Peak detection threshold' },
          ].map(({ label, desc }) => (
            <span key={label} style={{ fontSize: 11, color: '#374151' }}>
              <span style={{ color: '#4b5563', fontWeight: 600 }}>{label}</span> — {desc}
            </span>
          ))}
        </div>

      </div>
    </div>
  );
}
