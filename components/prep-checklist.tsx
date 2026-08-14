"use client";

import { useEffect, useState } from "react";

type ChecklistGroup = {
  title: string;
  items: string[];
};

const STORAGE_KEY = "eg-prep-checklist-v1";

export function PrepChecklist({ groups }: { groups: ChecklistGroup[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        if (parsed && typeof parsed === "object") setChecked(parsed);
      }
    } catch {
      // Ignore bad localStorage.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
  }, [checked, ready]);

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
