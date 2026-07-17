import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Activity, ShieldAlert, Heart, RefreshCw } from "lucide-react";

interface LiveECGMonitorProps {
  patientId: string;
  heartRate: number;
}

export const LiveECGMonitor: React.FC<LiveECGMonitorProps> = ({ patientId, heartRate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Visibility and window focus state for performance optimization
  const [isVisible, setIsVisible] = useState(true);
  const [isFocused, setIsFocused] = useState(true);
  const [observationIndex, setObservationIndex] = useState(0);

  // Set up intersection observer to pause drawing when scrolled out of view
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Monitor tab focus/blur for pause
  useEffect(() => {
    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => setIsFocused(false);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // Map observations based on patientId
  const getObservations = (id: string) => {
    switch (id) {
      case "ext-1":
        return [
          "ECG: Occasional premature ventricular contractions (PVCs) registered.",
          "Blood Pressure: Elevated arterial tone; monitoring drug titration safety.",
          "O2 Saturation: Stable at 95% on passive recovery.",
          "AI Clinical Guard: Post-angioplasty rehabilitation parameters within bounds.",
          "ECG: Ventricular repolarization intervals stable."
        ];
      case "ext-2":
        return [
          "ECG: Mild sinus tachycardia observed; heart rate stabilized around 76 BPM.",
          "Metabolic Panel: Fasting blood sugar tracking at upper baseline limit.",
          "Lipid Alerter: Total cholesterol at 210 mg/dL; exercise regime active.",
          "AI Clinical Guard: Cardiovascular stress loads remains compensated.",
          "Rhythm Analysis: No acute ST-segment shifts or ischemia flags."
        ];
      case "fam-1":
        return [
          "ECG: Normal sinus rhythm with clean QRS complexes.",
          "Blood Glucose: Fasting glucose level elevated at 140 mg/dL.",
          "Medication Monitor: Metformin 500mg therapeutic peak reached.",
          "AI Clinical Guard: Hypertensive cardiovascular stress levels are compensated.",
          "Rhythm Analysis: Autonomic heart rate variability is normal."
        ];
      case "fam-2":
        return [
          "ECG: Regular cardiac cycle, normal sinus rhythm.",
          "TSH Tracker: Thyroid parameters stabilized via Thyronorm regimen.",
          "Uric Acid: High risk threshold logged (7.2 mg/dL); low-purine guidance loaded.",
          "AI Clinical Guard: All secondary systemic vitals balanced.",
          "Rhythm Analysis: Consistent PR interval timing verified."
        ];
      case "fam-3":
        return [
          "ECG: Athletic bradycardia trace; efficient sinus pacing.",
          "Fitness Core: VO2 Max at 52 ml/kg/min; superior cardiac compliance.",
          "O2 Saturation: Optimal tissue perfusion at 99%.",
          "AI Clinical Guard: Sports clearance profile validated.",
          "Rhythm Analysis: Strong, rapid recovery times post-exertion."
        ];
      default:
        return [
          "ECG: Standard sinus pacing; QRS complex voltage normal.",
          "Metabolic Index: Daily glucose values remain inside target range.",
          "AI Clinical Guard: Autonomic nervous system index stable.",
          "Rhythm Analysis: No bradycardia or premature beats logged.",
          "Telemetry Guard: ABHA secure real-time pipeline synchronized."
        ];
    }
  };

  const observations = getObservations(patientId);

  // Rotate observation banner messages every 4.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setObservationIndex((prev) => (prev + 1) % observations.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [observations.length]);

  // Handle active change of patientId - reset index
  useEffect(() => {
    setObservationIndex(0);
  }, [patientId]);

  // ECG Drawing Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let width = canvas.offsetWidth;
    let height = canvas.offsetHeight;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Resize listener
    const handleResize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };
    window.addEventListener("resize", handleResize);

    // Initialize waveform array corresponding to the pixel width
    const points: number[] = new Array(Math.ceil(width)).fill(height / 2);
    let sweepX = 0;
    const sweepGap = 28; // The erase-head space size ahead of the sweep line

    let lastTime = performance.now();

    const draw = (timestamp: number) => {
      // Pause drawing if tab blurred or scrolled out of view
      if (!isVisible || !isFocused) {
        animationId = requestAnimationFrame(draw);
        return;
      }

      // Calculate elapsed time to control continuous sweeping pace
      const elapsed = timestamp - lastTime;
      lastTime = timestamp;

      // Adjust sweep speed based on frame duration to target constant velocity
      // Normal speed is roughly 2.2 pixels per frame at 60 FPS
      const pixelsToAdvance = Math.min(6, (elapsed / 16.66) * 2.1);
      const nextSweepX = (sweepX + pixelsToAdvance) % width;

      // Compute heart rate parameters
      const bpm = heartRate || 72;
      const beatIntervalMs = 60000 / bpm;
      
      // We will fill in the points between current sweepX and nextSweepX
      let startX = Math.floor(sweepX);
      let endX = Math.floor(nextSweepX);

      // Handle wrapping of the sweep line
      const fillRange = (start: number, end: number) => {
        for (let x = start; x < end; x++) {
          if (x >= width) break;
          
          // Generate realistic ECG shape based on cardiac cycle phase
          const timeMs = timestamp + (x - start) * (16.66 / 2.1);
          const phase = (timeMs % beatIntervalMs) / beatIntervalMs;
          
          let val = 0; // Baseline
          
          if (phase >= 0.1 && phase < 0.18) {
            // P-wave (Atrial depolarization)
            val = Math.sin((phase - 0.1) / 0.08 * Math.PI) * 0.12;
          } else if (phase >= 0.21 && phase < 0.23) {
            // Q-wave (Septal depolarization dip)
            val = -Math.sin((phase - 0.21) / 0.02 * Math.PI) * 0.09;
          } else if (phase >= 0.23 && phase < 0.26) {
            // QRS complex Spike (R) - Ventricular depolarization
            const t = (phase - 0.23) / 0.03;
            if (t < 0.5) {
              val = t * 2 * 0.95;
            } else {
              val = 0.95 - (t - 0.5) * 2 * 1.25; // drop down to S-dip
            }
          } else if (phase >= 0.26 && phase < 0.282) {
            // S-wave recovery to baseline
            const t = (phase - 0.26) / 0.022;
            val = -0.3 + t * 0.3;
          } else if (phase >= 0.32 && phase < 0.44) {
            // T-wave (Ventricular repolarization)
            val = Math.sin((phase - 0.32) / 0.12 * Math.PI) * 0.22;
          } else if (phase >= 0.46 && phase < 0.50) {
            // U-wave (Subtle Purkinje repolarization)
            val = Math.sin((phase - 0.46) / 0.04 * Math.PI) * 0.03;
          }

          // Simulate high-frequency muscular noise
          const highFreqNoise = (Math.random() - 0.5) * 0.012;
          // Add low-frequency breathing baseline wander
          const baselineWander = Math.sin(timeMs / 1800) * 0.04;

          const totalVal = val + highFreqNoise + baselineWander;
          
          // Map to canvas Y coordinate: 0 val is center, up is negative Y
          const targetY = (height / 2) - (totalVal * (height * 0.45));
          points[x] = targetY;
        }
      };

      if (endX < startX) {
        // Wrapped around
        fillRange(startX, width);
        fillRange(0, endX);
      } else {
        fillRange(startX, endX);
      }

      sweepX = nextSweepX;

      // --- CLEAR AND DRAW SCENE ---
      ctx.clearRect(0, 0, width, height);

      // Draw elegant clinical grid paper (Red/Orange subtle grid)
      ctx.strokeStyle = "rgba(16, 185, 129, 0.06)";
      ctx.lineWidth = 0.5;
      
      // Tiny grids (10px)
      for (let x = 0; x < width; x += 10) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 10) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Stronger grids (50px)
      ctx.strokeStyle = "rgba(16, 185, 129, 0.13)";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw the waveform with a glowing neon line
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      // Apply neon glow using standard canvas drop shadow
      ctx.shadowBlur = 4;
      ctx.shadowColor = "rgba(16, 185, 129, 0.8)";

      ctx.beginPath();
      let firstPoint = true;

      for (let x = 0; x < width; x++) {
        // Do not draw points inside the erase-head gap
        const isInGap = endX < startX
          ? (x >= startX || x < endX + sweepGap)
          : (x >= startX && x < startX + sweepGap);

        if (isInGap) {
          firstPoint = true;
          continue;
        }

        const y = points[x];
        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Draw glowing bedside sweep-bar leading indicator dot
      ctx.shadowBlur = 14;
      ctx.shadowColor = "#10b981";
      ctx.fillStyle = "#34d399";
      
      const currentIndicatorY = points[Math.floor(sweepX)] || height / 2;
      ctx.beginPath();
      ctx.arc(sweepX, currentIndicatorY, 4.5, 0, 2 * Math.PI);
      ctx.fill();

      // Reset shadow effects
      ctx.shadowBlur = 0;

      // Draw sweep pacing speed in corner
      ctx.fillStyle = "rgba(16, 185, 129, 0.65)";
      ctx.font = "bold 8px monospace";
      ctx.fillText(`SWEEP SPEED: 25mm/s  |  ${bpm} BPM`, 10, 15);

      animationId = requestAnimationFrame(draw);
    };

    animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
    };
  }, [heartRate, isVisible, isFocused]);

  return (
    <div ref={containerRef} className="w-full flex flex-col gap-3">
      {/* Waveform Stage container */}
      <div className="h-28 bg-slate-950 rounded-2xl border border-slate-800/90 relative overflow-hidden p-1 shadow-inner flex items-center justify-center">
        <canvas ref={canvasRef} className="w-full h-full block" />
        <span className="absolute top-2 right-4 text-[9px] text-emerald-400 font-mono font-bold flex items-center gap-1 bg-slate-900/80 px-2 py-0.5 rounded border border-emerald-500/20 animate-pulse">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
          REAL-TIME GRAPHIC FEED
        </span>
      </div>

      {/* AI Clinical Observation Dynamic Banner */}
      <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 flex items-start gap-2.5 relative overflow-hidden">
        <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0 mt-0.5">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-black tracking-wider uppercase block mb-0.5">
            AI Co-Pilot Live Observation
          </span>
          <div className="h-4 relative w-full overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.p
                key={observationIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="text-[10px] md:text-xs text-slate-600 dark:text-slate-300 font-medium truncate"
              >
                {observations[observationIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 self-center text-[8px] bg-slate-100 dark:bg-slate-900 text-slate-500 font-mono px-1.5 py-0.5 rounded">
          <RefreshCw className="w-2.5 h-2.5 animate-spin text-slate-400" style={{ animationDuration: "3s" }} />
          CONTINUOUS
        </div>
      </div>
    </div>
  );
};
