import { useEffect, useLayoutEffect, useRef, useState } from "react";

export function useCardPreview(source) {
  const [active, setActive] = useState(false);
  const [preview, setPreview] = useState(null);
  const timer = useRef(null);
  const panel = useRef(null);

  function hide() {
    clearTimeout(timer.current);
    setPreview(null);
    setActive(false);
  }

  function inside(event, rect) {
    return rect && event.clientX >= rect.left && event.clientX <= rect.right &&
      event.clientY >= rect.top && event.clientY <= rect.bottom;
  }

  function show() {
    const rect = source.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(innerWidth - 16, Math.max(rect.width, 360));
    const left = Math.max(8, rect.left + width <= innerWidth - 8 ? rect.left : rect.right - width);
    setPreview({ left, top: Math.max(8, rect.top), width });
  }

  function enter(event) {
    if (event.pointerType === "touch" || preview) return;
    clearTimeout(timer.current);
    setActive(true);
    timer.current = setTimeout(show, 850);
  }

  function leave(event) {
    if (!inside(event, panel.current?.getBoundingClientRect()) &&
        !inside(event, source.current?.getBoundingClientRect())) hide();
  }

  useLayoutEffect(() => {
    if (!preview || !panel.current) return;
    const height = panel.current.offsetHeight;
    panel.current.style.top = `${Math.max(8, Math.min(preview.top, innerHeight - height - 8))}px`;
  }, [preview]);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!active) return;
    function escape(event) {
      if (event.key === "Escape") hide();
    }
    document.addEventListener("keydown", escape);
    document.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [active]);

  return { preview, panel, hide, enter, leave };
}
