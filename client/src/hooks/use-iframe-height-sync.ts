import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    sendIframeHeight?: (height: number) => void;
    CONNEQT_LAST_HEIGHT?: number;
  }
}

export function useIframeHeightSync(dependencies: unknown[] = []) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const measureAndSend = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      requestAnimationFrame(() => {
        const root = document.getElementById("root");
        if (root && window.sendIframeHeight) {
          const height = Math.ceil(root.scrollHeight);
          window.sendIframeHeight(height);
        }
      });
    }, 150);
  }, []);

  useEffect(() => {
    measureAndSend();
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [measureAndSend, ...dependencies]);

  useEffect(() => {
    const handleLoad = () => measureAndSend();
    window.addEventListener("load", handleLoad);
    
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measureAndSend).catch(() => {});
    }

    return () => {
      window.removeEventListener("load", handleLoad);
    };
  }, [measureAndSend]);

  return measureAndSend;
}
