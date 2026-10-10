import { useEffect, useState } from "react";
import { normalizeEventsResponse, readEvents } from "../data/events.js";
export function useEvents({ demo, onAuthRequired }) {
  const [state, setState] = useState({
    status: "loading",
    events: [],
    clubs: [],
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading", events: [], clubs: [] });
    async function load() {
      if (demo) {
        const { demoEvents } = await import(
          "../../../public/prototypes/calendar/js/experiment-fixtures.js"
        );
        return normalizeEventsResponse(demoEvents());
      }
      return readEvents(fetch, controller.signal);
    }
    load().then(
      (data) => {
        if (!controller.signal.aborted) setState({ ...data, status: "ready" });
      },
      (error) => {
        if (controller.signal.aborted) return;
        if (error.status === 401) {
          onAuthRequired();
          return;
        }
        setState({
          status: "error",
          events: [],
          clubs: [],
          message: error.message,
        });
      },
    );
    return () => controller.abort();
  }, [demo, attempt, onAuthRequired]);
  return { ...state, retry: () => setAttempt((value) => value + 1) };
}
