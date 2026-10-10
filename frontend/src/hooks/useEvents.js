import { useEffect, useState } from "react";
import { normalizeEventsResponse, readEvents } from "../data/events.js";
export function useEvents({ demo, onAuthRequired, filters }) {
  const [state, setState] = useState({
    status: "loading",
    events: [],
    clubs: [],
  });
  const [attempt, setAttempt] = useState(0);
  const clubs = filters.clubs.join(",");
  const sports = filters.sports.join(",");
  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, status: "loading" }));
    async function load() {
      if (demo) {
        const { demoEvents } = await import(
          "../../../public/prototypes/calendar/js/experiment-fixtures.js"
        );
        return normalizeEventsResponse(demoEvents());
      }
      return readEvents(fetch, controller.signal, {
        clubs: clubs ? clubs.split(",") : [],
        sports: sports ? sports.split(",") : [],
      });
    }
    load().then(
      (data) => {
        if (!controller.signal.aborted) setState({ ...data, status: "ready", loaded: true });
      },
      (error) => {
        if (controller.signal.aborted) return;
        if (error.status === 401) {
          onAuthRequired();
          return;
        }
        setState((previous) => ({
          ...previous, status: "error", message: error.message,
          retryAfter: error.retryAfter,
        }));
      },
    );
    return () => controller.abort();
  }, [demo, attempt, onAuthRequired, clubs, sports]);
  return { ...state, retry: () => setAttempt((value) => value + 1) };
}
