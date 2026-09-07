import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, CameraOff, Maximize2, Minimize2, X } from "lucide-react";

interface TwinAvatarProps {
  avatarUrl?: string;
  twinName?: string;
  isSpeaking?: boolean;
  isTyping?: boolean;
  size?: number;
}

// Normalized landmark coords for a static photo (0–1 range, relative to image)
interface StaticLandmarks {
  leftEyeCenter:  { x: number; y: number };
  rightEyeCenter: { x: number; y: number };
  mouthCenter:    { x: number; y: number };
  eyeRadius:      number; // fraction of image width
  mouthWidth:     number;
}

// ── MediaPipe landmark indices ──────────────────────────────────────────────
const LEFT_EYE  = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
const MOUTH_TOP    = 13;
const MOUTH_BOTTOM = 14;
const LEFT_CHEEK   = 234;
const RIGHT_CHEEK  = 454;
const NOSE_TIP     = 1;

function ear(lm: any[], idx: number[]) {
  if (!lm?.length) return 0.3;
  const p = idx.map(i => lm[i]);
  if (p.some(x => !x)) return 0.3;
  const v1 = Math.hypot(p[1].x - p[5].x, p[1].y - p[5].y);
  const v2 = Math.hypot(p[2].x - p[4].x, p[2].y - p[4].y);
  const h  = Math.hypot(p[0].x - p[3].x, p[0].y - p[3].y);
  return (v1 + v2) / (2 * h);
}

function mouthRatio(lm: any[]) {
  if (!lm?.length) return 0;
  const t = lm[MOUTH_TOP], b = lm[MOUTH_BOTTOM];
  const l = lm[LEFT_CHEEK], r = lm[RIGHT_CHEEK];
  if (!t || !b || !l || !r) return 0;
  return Math.min(Math.abs(b.y - t.y) / (Math.abs(r.x - l.x) * 0.15), 1);
}

function headTilt(lm: any[]) {
  if (!lm?.length) return { rx: 0, ry: 0 };
  const n = lm[NOSE_TIP], l = lm[LEFT_CHEEK], r = lm[RIGHT_CHEEK];
  if (!n || !l || !r) return { rx: 0, ry: 0 };
  const cx = (l.x + r.x) / 2, cy = (l.y + r.y) / 2;
  return {
    rx: Math.max(-15, Math.min(15, (n.x - cx) * 60)),
    ry: Math.max(-10, Math.min(10, (n.y - cy) * 40)),
  };
}

export default function TwinAvatar({
  avatarUrl, twinName, isSpeaking = false, isTyping = false, size = 120,
}: TwinAvatarProps) {
  // ── refs ──────────────────────────────────────────────────────────────────
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const videoRef       = useRef<HTMLVideoElement>(null);
  const imgRef         = useRef<HTMLImageElement | null>(null);
  const rafRef         = useRef<number>(0);
  const faceMeshRef    = useRef<any>(null);
  const cameraRef      = useRef<any>(null);
  const landmarksRef   = useRef<any[]>([]);

  // animated values — all driven inside the RAF, never cause re-renders
  const blinkRef       = useRef(0);          // 0–1 blink amount
  const autoBlinkTimer = useRef(0);          // ms until next auto-blink
  const speakPhaseRef  = useRef(0);          // oscillator for speaking mouth
  const breathRef      = useRef(0);          // breathing scale oscillator

  // prop mirrors as refs so the RAF closure never goes stale
  const isSpeakingRef  = useRef(isSpeaking);
  const isTypingRef    = useRef(isTyping);
  const imgLoadedRef   = useRef(false);

  // static photo landmark positions detected once via MediaPipe
  const staticLMRef = useRef<StaticLandmarks | null>(null);

  // ── state (only for UI re-renders) ───────────────────────────────────────
  const [camEnabled,    setCamEnabled]    = useState(false);
  const [camError,      setCamError]      = useState<string | null>(null);
  const [expanded,      setExpanded]      = useState(false);
  const [showCamPrompt, setShowCamPrompt] = useState(false);
  const [imgLoaded,     setImgLoaded]     = useState(false);   // drives UI only

  // keep prop refs in sync
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { isTypingRef.current   = isTyping;   }, [isTyping]);

  // ── load avatar image ─────────────────────────────────────────────────────
  useEffect(() => {
    imgRef.current    = null;
    imgLoadedRef.current = false;
    setImgLoaded(false);
    if (!avatarUrl) return;

    const img = new Image();
    if (!avatarUrl.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current       = img;
      imgLoadedRef.current = true;
      setImgLoaded(true);
      // Run MediaPipe once on the static image to get real eye/mouth positions
      detectStaticLandmarks(img);
    };
    img.onerror = () => { imgRef.current = null; imgLoadedRef.current = false; };
    img.src = avatarUrl;
  }, [avatarUrl]);

  // ── detect landmarks on a static image once ───────────────────────────────
  const detectStaticLandmarks = useCallback(async (img: HTMLImageElement) => {
    try {
      staticLMRef.current = null;
      const { FaceMesh } = await import("@mediapipe/face_mesh");
      const fm = new FaceMesh({
        locateFile: (f: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
      });
      fm.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      fm.onResults((r: any) => {
        const lm: any[] = r.multiFaceLandmarks?.[0] ?? [];
        if (!lm.length) return;

        // Average left eye center from landmarks
        const leftIdxs  = [33, 160, 158, 133, 153, 144];
        const rightIdxs = [362, 385, 387, 263, 373, 380];
        const avg = (idxs: number[], axis: 'x' | 'y') =>
          idxs.reduce((s, i) => s + lm[i][axis], 0) / idxs.length;

        const lx = avg(leftIdxs, 'x'),  ly = avg(leftIdxs, 'y');
        const rx = avg(rightIdxs, 'x'), ry = avg(rightIdxs, 'y');
        // eye radius ≈ half the inter-eye distance / 3
        const eyeRadius = Math.hypot(rx - lx, ry - ly) / 6;

        const mx = (lm[13].x + lm[14].x) / 2;
        const my = (lm[13].y + lm[14].y) / 2;
        const mouthWidth = Math.abs(lm[454].x - lm[234].x) * 0.35;

        staticLMRef.current = {
          leftEyeCenter:  { x: lx, y: ly },
          rightEyeCenter: { x: rx, y: ry },
          mouthCenter:    { x: mx, y: my },
          eyeRadius,
          mouthWidth,
        };
        fm.close();
      });
      await fm.initialize();

      // Draw image onto an offscreen canvas and send to FaceMesh
      const off = document.createElement('canvas');
      off.width  = img.naturalWidth  || img.width;
      off.height = img.naturalHeight || img.height;
      const octx = off.getContext('2d')!;
      octx.drawImage(img, 0, 0);
      await fm.send({ image: off });
    } catch {
      // silently ignore — fallback positions used
    }
  }, []);

  // ── RAF draw loop — reads refs, never stale ───────────────────────────────
  const draw = useCallback((ts: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const speaking = isSpeakingRef.current;
    const typing   = isTypingRef.current;
    const lm       = landmarksRef.current;
    const hasPhoto = imgLoadedRef.current && imgRef.current;

    // ── auto-blink (every 3–5 s) ──────────────────────────────────────────
    autoBlinkTimer.current -= 16;
    if (autoBlinkTimer.current <= 0) {
      blinkRef.current = 1;
      autoBlinkTimer.current = 3000 + Math.random() * 2000;
    }

    // ── blink from face tracking ──────────────────────────────────────────
    if (lm.length > 0) {
      const avgEAR = (ear(lm, LEFT_EYE) + ear(lm, RIGHT_EYE)) / 2;
      if (avgEAR < 0.22) blinkRef.current = Math.min(blinkRef.current + 0.3, 1);
      else               blinkRef.current = Math.max(blinkRef.current - 0.18, 0);
    } else {
      // decay auto-blink
      blinkRef.current = Math.max(blinkRef.current - 0.08, 0);
    }

    // ── speaking mouth oscillator ─────────────────────────────────────────
    if (speaking) speakPhaseRef.current += 0.18;
    const speakAmount = speaking
      ? (lm.length > 0 ? mouthRatio(lm) : Math.abs(Math.sin(speakPhaseRef.current)) * 0.75)
      : (lm.length > 0 ? mouthRatio(lm) : 0);

    // ── breathing / idle float ────────────────────────────────────────────
    breathRef.current += 0.012;
    const breathScale = 1 + Math.sin(breathRef.current) * 0.012;
    const floatY      = Math.sin(ts / 1800) * 4;

    // ── head tilt from face tracking ──────────────────────────────────────
    const tilt = headTilt(lm);

    const radius = Math.min(W, H) * 0.42;

    ctx.save();
    ctx.translate(W / 2, H / 2 + floatY);
    if (lm.length > 0) {
      ctx.rotate((tilt.rx * Math.PI) / 180);
      ctx.translate(tilt.ry * 0.5, 0);
    }
    ctx.scale(breathScale, breathScale);

    if (hasPhoto) {
      // ── draw circular photo ─────────────────────────────────────────────
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(imgRef.current!, -radius, -radius, radius * 2, radius * 2);
      ctx.restore();

      // glow ring
      const ringColor = speaking
        ? "rgba(99,102,241,1)"
        : typing
        ? "rgba(34,197,94,0.8)"
        : "rgba(99,102,241,0.45)";
      ctx.beginPath();
      ctx.arc(0, 0, radius + 2, 0, Math.PI * 2);
      ctx.strokeStyle = ringColor;
      ctx.lineWidth   = speaking ? 3.5 : 2;
      ctx.shadowColor = ringColor;
      ctx.shadowBlur  = speaking ? 24 : 10;
      ctx.stroke();
      ctx.shadowBlur  = 0;

      // ── blink overlay — use detected or fallback positions ─────────────
      if (blinkRef.current > 0.05) {
        const b  = blinkRef.current;
        const slm = staticLMRef.current;
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = `rgba(10,10,20,${b * 0.92})`;

        if (slm) {
          // Convert normalised (0–1) coords to canvas space centred at 0,0
          const toX = (nx: number) => (nx - 0.5) * radius * 2;
          const toY = (ny: number) => (ny - 0.5) * radius * 2;
          const er  = Math.max(slm.eyeRadius * radius * 2, radius * 0.06);

          ctx.beginPath();
          ctx.ellipse(toX(slm.leftEyeCenter.x),  toY(slm.leftEyeCenter.y),  er * 1.4, er * b, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(toX(slm.rightEyeCenter.x), toY(slm.rightEyeCenter.y), er * 1.4, er * b, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // fallback guesses
          ctx.beginPath();
          ctx.ellipse(-radius * 0.27, -radius * 0.07, radius * 0.17, radius * 0.07 * b, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse( radius * 0.27, -radius * 0.07, radius * 0.17, radius * 0.07 * b, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // ── speaking mouth overlay ──────────────────────────────────────────
      if (speakAmount > 0.04) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.clip();

        const slm = staticLMRef.current;
        const toX  = (nx: number) => (nx - 0.5) * radius * 2;
        const toY  = (ny: number) => (ny - 0.5) * radius * 2;
        const mCX  = slm ? toX(slm.mouthCenter.x) : 0;
        const mCY  = slm ? toY(slm.mouthCenter.y) : radius * 0.30;
        const mW   = slm ? slm.mouthWidth * radius * 2 : radius * 0.16;

        // dark mouth opening
        ctx.fillStyle = `rgba(10,10,20,${Math.min(speakAmount * 0.85, 0.75)})`;
        ctx.beginPath();
        ctx.ellipse(mCX, mCY, mW, mW * 0.55 * speakAmount, 0, 0, Math.PI * 2);
        ctx.fill();

        // subtle teeth highlight
        if (speakAmount > 0.25) {
          ctx.fillStyle = `rgba(255,255,255,${(speakAmount - 0.25) * 0.4})`;
          ctx.beginPath();
          ctx.ellipse(mCX, mCY - mW * 0.15, mW * 0.65, mW * 0.12, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

    } else {
      // ── fallback animated orb ───────────────────────────────────────────
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      grad.addColorStop(0,   "rgba(99,102,241,0.55)");
      grad.addColorStop(0.6, "rgba(99,102,241,0.22)");
      grad.addColorStop(1,   "rgba(99,102,241,0.04)");
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      const orbColor = speaking ? "rgba(99,102,241,1)" : "rgba(99,102,241,0.4)";
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.strokeStyle = orbColor;
      ctx.lineWidth   = 2;
      ctx.shadowColor = orbColor;
      ctx.shadowBlur  = speaking ? 20 : 8;
      ctx.stroke();
      ctx.shadowBlur  = 0;

      // pulsing inner ring
      const pulse = 0.68 + Math.sin(ts / 600) * 0.14;
      ctx.beginPath();
      ctx.arc(0, 0, radius * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(99,102,241,0.18)";
      ctx.lineWidth   = 1;
      ctx.stroke();

      ctx.font         = `${radius * 0.52}px serif`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha  = 0.88;
      ctx.fillText("🧠", 0, 0);
      ctx.globalAlpha  = 1;
    }

    ctx.restore();

    // ── speaking wave bars (below avatar) ──────────────────────────────────
    if (speaking) {
      const bars = 5, bW = 3, gap = 5;
      const totalW = bars * (bW + gap) - gap;
      const sx = W / 2 - totalW / 2;
      const by = H - 8;
      for (let i = 0; i < bars; i++) {
        const bh = 3 + Math.abs(Math.sin(ts / 140 + i * 0.9)) * 11;
        ctx.fillStyle = "rgba(99,102,241,0.9)";
        ctx.beginPath();
        ctx.roundRect(sx + i * (bW + gap), by - bh, bW, bh, 2);
        ctx.fill();
      }
    }

    // ── typing pulse dots ──────────────────────────────────────────────────
    if (typing && !speaking) {
      const dots = 3, dR = 3, dGap = 8;
      const totalW = dots * dR * 2 + (dots - 1) * dGap;
      const sx = W / 2 - totalW / 2;
      const by = H - 10;
      for (let i = 0; i < dots; i++) {
        const scale = 0.6 + Math.abs(Math.sin(ts / 300 + i * 1.1)) * 0.4;
        ctx.fillStyle = `rgba(34,197,94,${0.5 + scale * 0.5})`;
        ctx.beginPath();
        ctx.arc(sx + i * (dR * 2 + dGap) + dR, by, dR * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    rafRef.current = requestAnimationFrame(draw);
  }, []); // ← empty deps: refs keep it current, no stale closure

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // ── MediaPipe face tracking ───────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      setCamError(null);
      const { FaceMesh } = await import("@mediapipe/face_mesh");
      const { Camera }   = await import("@mediapipe/camera_utils");

      const fm = new FaceMesh({
        locateFile: (f: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
      });
      fm.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      fm.onResults((r: any) => {
        landmarksRef.current = r.multiFaceLandmarks?.[0] ?? [];
      });
      await fm.initialize();
      faceMeshRef.current = fm;

      if (!videoRef.current) return;
      const cam = new Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current && faceMeshRef.current)
            await faceMeshRef.current.send({ image: videoRef.current });
        },
        width: 320, height: 240,
      });
      await cam.start();
      cameraRef.current = cam;
      setCamEnabled(true);
    } catch (err: any) {
      setCamError(
        err?.message?.includes("Permission")
          ? "Camera permission denied."
          : "Could not start camera."
      );
    }
  }, []);

  const stopCamera = useCallback(() => {
    cameraRef.current?.stop();
    faceMeshRef.current?.close();
    cameraRef.current  = null;
    faceMeshRef.current = null;
    landmarksRef.current = [];
    setCamEnabled(false);
  }, []);

  useEffect(() => () => { stopCamera(); cancelAnimationFrame(rafRef.current); }, [stopCamera]);

  const canvasSize = expanded ? Math.round(size * 1.75) : size;

  return (
    <div className="relative flex flex-col items-center gap-2">
      {/* ── canvas ── */}
      <div className="relative group">
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          className="rounded-full"
          style={{ width: canvasSize, height: canvasSize, display: "block" }}
        />
        <video ref={videoRef} className="hidden" playsInline muted />

        {/* hover controls */}
        <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 cursor-pointer">
          <div className="flex gap-2">
            <button
              onClick={() => camEnabled ? stopCamera() : setShowCamPrompt(true)}
              className={`p-2 rounded-full text-white transition-all ${
                camEnabled
                  ? "bg-red-500/80 hover:bg-red-500"
                  : "bg-primary/80 hover:bg-primary"
              }`}
              title={camEnabled ? "Stop face tracking" : "Enable face tracking"}
            >
              {camEnabled ? <CameraOff size={13} /> : <Camera size={13} />}
            </button>
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all"
              title={expanded ? "Shrink" : "Expand"}
            >
              {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>
        </div>

        {camEnabled && (
          <div className="absolute top-1 right-1 flex items-center gap-1 bg-black/60 rounded-full px-1.5 py-0.5 pointer-events-none">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[9px] text-white font-bold">LIVE</span>
          </div>
        )}
      </div>

      {/* name + status */}
      <div className="text-center leading-tight">
        <p className="text-xs font-bold text-white/80">{twinName || "Twin"}</p>
        <p className="text-[10px] text-primary/70">
          {isSpeaking ? "Speaking…" : isTyping ? "Thinking…" : camEnabled ? "Tracking face" : "Online"}
        </p>
      </div>

      {camError && (
        <div className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 px-2 py-1 rounded-lg max-w-[160px] text-center">
          <X size={10} className="shrink-0" />
          {camError}
        </div>
      )}

      {/* camera permission prompt — fixed overlay, always on top */}
      <AnimatePresence>
        {showCamPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowCamPrompt(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-72 bg-card border border-white/10 rounded-2xl p-6 shadow-2xl text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Camera size={24} className="text-primary" />
              </div>
              <p className="text-sm font-bold mb-1">Enable Face Tracking?</p>
              <p className="text-[11px] text-white/40 mb-4 leading-relaxed">
                Your webcam animates the avatar in real-time. Video never leaves your browser.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowCamPrompt(false); startCamera(); }}
                  className="flex-1 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all"
                >
                  Enable
                </button>
                <button
                  onClick={() => setShowCamPrompt(false)}
                  className="flex-1 py-2.5 bg-white/5 text-white/60 rounded-xl text-xs font-bold hover:bg-white/10 transition-all"
                >
                  Skip
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
