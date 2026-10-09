fetch('/limits')
      .then(r => r.json())
      .then(limits => {
        const set = (id, val) => {
          const el = document.getElementById(id);
          if (el) el.textContent = val;
        };
        set('limit-clubs-fetch', limits.clubs_fetch);
        set('limit-clubs',       limits.clubs);
        set('limit-clubs-2',     limits.clubs);
        set('limit-events',      limits.events_per_club);
        set('limit-events-2',    limits.events_per_club);
        set('limit-events-3',    limits.events_per_club);
        set('limit-routes',      limits.routes);
      })
      .catch(() => {
        // Leave the "…" placeholders if the fetch fails
      });
