import { useRef, useState, useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";

interface CollapsibleSectionProps {
  isExpanded: boolean;
  children: ReactNode;
  className?: string;
}

export function CollapsibleSection({ isExpanded, children, className = "" }: CollapsibleSectionProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState(0);

  useEffect(() => {
    if (!contentRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setMeasuredHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(contentRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <motion.div
      initial={false}
      animate={{
        height: isExpanded ? measuredHeight : 0,
        opacity: isExpanded ? 1 : 0,
      }}
      transition={{
        height: {
          type: "spring",
          damping: 28,
          stiffness: 300,
        },
        opacity: {
          duration: 0.2,
          ease: "easeOut",
        },
      }}
      style={{ overflow: "hidden" }}
      className={className}
    >
      <div ref={contentRef}>
        {children}
      </div>
    </motion.div>
  );
}

interface CollapsibleListProps {
  items: ReactNode[];
  visibleCount: number;
  showAll: boolean;
  className?: string;
}

export function CollapsibleList({ items, visibleCount, showAll, className = "" }: CollapsibleListProps) {
  const visibleItems = items.slice(0, visibleCount);
  const hiddenItems = items.slice(visibleCount);

  return (
    <div className={className}>
      {visibleItems}
      <CollapsibleSection isExpanded={showAll}>
        {hiddenItems}
      </CollapsibleSection>
    </div>
  );
}
