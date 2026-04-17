import { useState, useCallback, useRef } from 'react';

const CLAUDE_MODEL = 'claude-sonnet-4-5';

function buildPrompt(replacementText) {
  return `You are a professional logo designer and SVG expert. Carefully analyze this logo image and recreate it as valid SVG markup, replacing ONLY the text/lettering with "${replacementText}".

ANALYSIS REQUIREMENTS — extract and replicate exactly:
1. HEX COLORS: Every color used (#rrggbb) — text fill, strokes, backgrounds, gradient stops
2. FONT PROPERTIES: font-weight (100–900), font-style (normal/italic/oblique), approximate font-family or a visually similar generic (serif/sans-serif/monospace/cursive), font-size, letter-spacing, text-transform
3. VISUAL EFFECTS: linear/radial gradients (angle, color stops with positions), drop-shadows (feDropShadow dx/dy/stdDeviation/flood-color), text strokes/outlines (stroke, stroke-width), glow effects (feGaussianBlur)
4. NON-TEXT ELEMENTS: icons, shapes, dividers, backgrounds, decorative marks — preserve them exactly
5. LAYOUT: exact position of text relative to any icon/symbol, alignment, padding

TEXT REPLACEMENT RULES:
- Replace ONLY the brand text with "${replacementText}"
- If "${replacementText}" has more/fewer characters, adjust letter-spacing so the text block stays the same overall width
- Preserve all other text (taglines, URLs, legal text) unchanged

SVG OUTPUT RULES:
- Set viewBox to match the original aspect ratio (e.g. viewBox="0 0 400 200")
- Use <defs> for gradients and filters; reference them with url(#id)
- Use <text> elements with font properties, or <path> for highly stylized letterforms
- The SVG must be fully self-contained — no external font or image references
- Return ONLY the raw SVG: start with <svg and end with </svg>, no markdown, no explanation`;
}

async function convertSVGtoPNG(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 800;
      canvas.height = img.naturalHeight || 400;
      canvas.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve({ base64: canvas.toDataURL('image/png').split(',')[1], mediaType: 'image/png' });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG conversion failed')); };
    img.src = url;
  });
}

function UploadZone({ imageUrl, isDragging, onDrop, onDragOver, onDragLeave, onClick, fileInputRef, onFileChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-2">Upload Logo</label>
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors min-h-[160px] flex items-center justify-center ${
          isDragging ? 'border-violet-400 bg-violet-500/10' : imageUrl ? 'border-gray-600 bg-gray-900' : 'border-gray-700 bg-gray-900 hover:border-gray-500'
        }`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={onClick}
      >
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp" onChange={onFileChange} className="hidden" />
        {imageUrl ? (
          <img src={imageUrl} alt="Uploaded logo" className="max-h-36 max-w-full object-contain" />
        ) : (
          <div className="text-gray-500">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">Drag & drop or click to upload</p>
            <p className="text-xs mt-1 text-gray-600">PNG · JPG · SVG · WebP</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewPanel({ label, children, actions }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
        <span className="text-xs text-gray-500">{label}</span>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      <div className="p-6 flex items-center justify-center min-h-[192px]">{children}</div>
    </div>
  );
}

function DownloadButton({ onClick, label }) {
  return (
    <button onClick={onClick} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded-lg transition-colors font-medium">
      ↓ {label}
    </button>
  );
}

export default function App() {
  const [imageUrl, setImageUrl] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [imageMediaType, setImageMediaType] = useState(null);
  const [replacementText, setReplacementText] = useState('');
  const [generatedSVG, setGeneratedSVG] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const processFile = useCallback(async (file) => {
    if (!file) return;
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Unsupported file type. Please upload PNG, JPG, SVG, or WebP.');
      return;
    }
    setError('');
    setGeneratedSVG('');
    setImageUrl(URL.createObjectURL(file));

    if (file.type === 'image/svg+xml') {
      try {
        const { base64, mediaType } = await convertSVGtoPNG(file);
        setImageBase64(base64);
        setImageMediaType(mediaType);
      } catch {
        setError('Could not process SVG. Try converting it to PNG first.');
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageBase64(e.target.result.split(',')[1]);
        setImageMediaType(file.type === 'image/jpg' ? 'image/jpeg' : file.type);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleDrop = useCallback((e) => { e.preventDefault(); setIsDragging(false); processFile(e.dataTransfer.files[0]); }, [processFile]);
  const handleDragOver = useCallback((e) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);
  const handleFileChange = useCallback((e) => processFile(e.target.files[0]), [processFile]);

  const handleGenerate = async () => {
    if (!imageBase64 || !replacementText.trim() || isLoading) return;
    setIsLoading(true);
    setError('');
    setGeneratedSVG('');

    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: imageMediaType, data: imageBase64 } },
              { type: 'text', text: buildPrompt(replacementText.trim()) },
            ],
          }],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `API error ${res.status}`);

      let svg = data.content?.[0]?.text?.trim() ?? '';
      svg = svg.replace(/^```(?:svg|xml|html)?\s*/i, '').replace(/\s*```$/i, '').trim();

      const match = svg.match(/<svg[\s\S]*<\/svg>/i);
      if (match) svg = match[0];
      if (!svg.startsWith('<svg')) throw new Error('Claude did not return valid SVG. Try a clearer logo image.');

      setGeneratedSVG(svg);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadSVG = () => {
    if (!generatedSVG) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([generatedSVG], { type: 'image/svg+xml' }));
    a.download = `${replacementText.trim().toLowerCase().replace(/\s+/g, '-')}-logo.svg`;
    a.click();
  };

  const downloadPNG = () => {
    if (!generatedSVG) return;
    const img = new Image();
    const url = URL.createObjectURL(new Blob([generatedSVG], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 800;
      canvas.height = img.naturalHeight || 400;
      canvas.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${replacementText.trim().toLowerCase().replace(/\s+/g, '-')}-logo.png`;
      a.click();
    };
    img.src = url;
  };

  const canGenerate = imageBase64 && replacementText.trim() && !isLoading;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 7 4 4 20 4 20 7" />
              <line x1="9" y1="20" x2="15" y2="20" />
              <line x1="12" y1="4" x2="12" y2="20" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-semibold leading-none">Logo Text Replacer</h1>
            <p className="text-xs text-gray-500 mt-0.5">powered by Claude vision</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <UploadZone
            imageUrl={imageUrl}
            isDragging={isDragging}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            fileInputRef={fileInputRef}
            onFileChange={handleFileChange}
          />

          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Replacement Brand Name</label>
              <input
                type="text"
                value={replacementText}
                onChange={(e) => setReplacementText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                placeholder="e.g. Sonnet"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors text-lg"
              />
              <p className="text-xs text-gray-600 mt-2">Claude will preserve all visual style, colors, and effects — only the text changes.</p>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="mt-auto w-full bg-violet-600 hover:bg-violet-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing & generating…
                </>
              ) : (
                <>
                  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate Logo
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-950/60 border border-red-800/70 rounded-xl px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Side-by-side preview */}
        {(imageUrl || generatedSVG || isLoading) && (
          <div>
            <h2 className="text-sm font-medium text-gray-400 mb-4">Preview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {imageUrl && (
                <PreviewPanel label="Original">
                  <img src={imageUrl} alt="Original logo" className="max-h-48 max-w-full object-contain" />
                </PreviewPanel>
              )}

              {isLoading && !generatedSVG && (
                <PreviewPanel label="Generating…">
                  <div className="text-center text-gray-600">
                    <svg className="animate-spin w-8 h-8 mx-auto mb-3 text-violet-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <p className="text-sm">Claude is analyzing your logo…</p>
                  </div>
                </PreviewPanel>
              )}

              {generatedSVG && (
                <PreviewPanel
                  label={`Generated — "${replacementText}"`}
                  actions={[
                    <DownloadButton key="svg" onClick={downloadSVG} label="SVG" />,
                    <DownloadButton key="png" onClick={downloadPNG} label="PNG" />,
                  ]}
                >
                  <div
                    className="max-h-48 max-w-full flex items-center justify-center [&>svg]:max-h-48 [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:w-auto"
                    dangerouslySetInnerHTML={{ __html: generatedSVG }}
                  />
                </PreviewPanel>
              )}
            </div>
          </div>
        )}

        {/* Instructions */}
        {!imageUrl && (
          <div className="border border-gray-800 rounded-xl p-6 text-sm text-gray-500 space-y-3">
            <p className="font-medium text-gray-400">How it works</p>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Upload your logo (PNG, JPG, SVG, or WebP)</li>
              <li>Type the replacement brand name</li>
              <li>Click <strong className="text-gray-300">Generate Logo</strong> — Claude analyzes colors, fonts, effects, and layout</li>
              <li>Download the result as SVG or PNG</li>
            </ol>
          </div>
        )}
      </main>
    </div>
  );
}
