"use client";

import { useEffect, useState } from "react";

type ChecklistGroup = {
  title: string;
  items: string[];
};

export function PrepChecklist({
  groups,
  storageKey,
}: {
  groups: ChecklistGroup[];
  storageKey: string;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        if (parsed && typeof parsed === "object") setChecked(parsed);
      }
    } catch {
      // Ignore bad localStorage.
    }
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(storageKey, JSON.stringify(checked));
  }, [checked, ready, storageKey]);

  function toggle(id: string) {
    setChecked((current) => ({ ...current, [id]: !current[id] }));
  }

  function clearAll() {
    setChecked({});
  }

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const done = Object.values(checked).filter(Boolean).length;

  return (
    <div className="prep-checklist">
      <div className="prep-progress">
        <p>
          {done} of {total} done
          {done === total && total > 0 ? " — home is ready." : ""}
        </p>
        {done > 0 ? (
          <button type="button" className="btn btn-outline" onClick={clearAll}>
            Clear checks
          </button>
        ) : null}
      </div>

      <div className="checklist-grid">
        {groups.map((group) => (
          <div className="checklist-group" key={group.title}>
            <h3>{group.title}</h3>
            <ul className="checklist checklist-interactive">
              {group.items.map((item) => {
                const id = `${group.title}::${item}`;
                const isChecked = Boolean(checked[id]);
                return (
                  <li key={id}>
                    <label className={`checklist-item${isChecked ? " is-checked" : ""}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(id)}
                      />
                      <span>{item}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
