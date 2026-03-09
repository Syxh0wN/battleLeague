"use client";

import { useEffect } from "react";

function RemoveNextJsPortals() {
  const portals = document.querySelectorAll("nextjs-portal");
  portals.forEach((portal) => {
    portal.remove();
  });
}

export function HideNextJsPortal() {
  useEffect(() => {
    RemoveNextJsPortals();
    const observer = new MutationObserver(() => {
      RemoveNextJsPortals();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
}
