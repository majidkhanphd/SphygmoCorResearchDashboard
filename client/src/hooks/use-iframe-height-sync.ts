import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    sendIframeHeight?: (height: number, force?: boolean) => void;
    CONNEQT_LAST_HEIGHT?: number;
  }
}

export function useIframeHeightSync(dependencies: unknown[] = []) {
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  
  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(t => clearTimeout(t));
    timeoutsRef.current = [];
  }, []);
  
  const measureAndSend = useCallback((force: boolean = false) => {
    const root = document.getElementById("root");
    if (root && window.sendIframeHeight) {
      const height = Math.ceil(root.scrollHeight);
      window.sendIframeHeight(height, force);
    }
  }, []);

  const scheduleMultipleMeasurements = useCallback(() => {
    clearAllTimeouts();
    
    const delays = [100, 250, 500];
    delays.forEach((delay, index) => {
      const timeout = setTimeout(() => {
        requestAnimationFrame(() => {
          measureAndSend(index === delays.length - 1);
        });
      }, delay);
      timeoutsRef.current.push(timeout);
    });
  }, [clearAllTimeouts, measureAndSend]);

  useEffect(() => {
    scheduleMultipleMeasurements();
    
    return () => {
      clearAllTimeouts();
    };
  }, [scheduleMultipleMeasurements, clearAllTimeouts, ...dependencies]);

  useEffect(() => {
    const handleLoad = () => scheduleMultipleMeasurements();
    window.addEventListener("load", handleLoad);
    
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(scheduleMultipleMeasurements).catch(() => {});
    }

    return () => {
      window.removeEventListener("load", handleLoad);
    };
  }, [scheduleMultipleMeasurements]);

  return scheduleMultipleMeasurements;
}
