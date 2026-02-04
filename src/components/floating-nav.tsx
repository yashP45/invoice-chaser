"use client";

import { useEffect, useState } from "react";

export function FloatingNav({ children }: { children: React.ReactNode }) {
  const [faded, setFaded] = useState(false);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        setFaded(window.scrollY > 180);
        ticking = false;
      });
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className={`floating-nav ${faded ? "is-faded" : ""}`}>{children}</div>
  );
}
