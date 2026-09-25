import Link from "next/link";

export type StatusPageAction = {
  href: string;
  label: string;
  variant?: "solid" | "outline";
};

export function StatusPage({
  eyebrow,
  title,
  body,
  details,
  actions,
  shell = "page",
}: {
  eyebrow: string;
  title: string;
  body: string;
  details?: string[];
  actions?: StatusPageAction[];
  /** `delivery` matches gallery shells; `page` matches public page headers. */
  shell?: "page" | "delivery";
}) {
  const inner = (
    <>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className={shell === "delivery" ? "lede" : "section-copy"}>{body}</p>
      {details && details.length > 0 ? (
        <ul className="status-page-details">
          {details.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {actions && actions.length > 0 ? (
        <p className="status-page-actions">
          {actions.map((action) => (
            <Link
              key={action.href + action.label}
              className={`btn btn-${action.variant ?? "outline"}`}
              href={action.href}
            >
              {action.label}
            </Link>
          ))}
        </p>
      ) : null}
    </>
  );

  if (shell === "delivery") {
    return (
      <main className="delivery-shell" id="main">
        <div className="delivery-main">
          <header className="delivery-intro">{inner}</header>
        </div>
      </main>
    );
  }

  return (
    <main className="page-header" id="main">
      <div className="page-header-inner">{inner}</div>
    </main>
  );
}
