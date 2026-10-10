import { useEffect, useRef, useState } from "react";
export function useCardPreview(source) {
  const [active, setActive] = useState(false),
    [preview, setPreview] = useState(null);
  const timer = useRef(null);
  function hide() {
    clearTimeout(timer.current);
    setPreview(null);
    setActive(false);
  }
  function inside(event, rect) {
    return (
      rect &&
      event.clientX >= rect.left &&
      event.clientX <= rect.left + rect.width &&
      event.clientY >= rect.top &&
      event.clientY <= rect.top + 44
    );
  }
  function show() {
    const r = source.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(innerWidth - 16, Math.max(r.width, 560));
    const left = Math.max(
      8,
      Math.min(
        r.left + width <= innerWidth - 8 ? r.left : r.right - width,
        innerWidth - width - 8,
      ),
    );
    setPreview({
      left,
      top: Math.max(8, Math.min(r.top, innerHeight - 52)),
      width,
    });
  }
  function enter(event) {
    if (event.pointerType === "touch") return;
    clearTimeout(timer.current);
    setActive(true);
    timer.current = setTimeout(show, 850);
  }
  function leave(event) {
    if (!inside(event, preview)) hide();
  }
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!active) return;
    function move(event) {
      if (
        preview &&
        !inside(event, preview) &&
        !source.current?.contains(event.target)
      )
        hide();
    }
    document.addEventListener("pointermove", move);
    document.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [active, preview]);
  return { preview, hide, enter, leave };
}
