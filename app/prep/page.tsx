import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getTenant } from "@/lib/tenants";

const tenant = getTenant();

export const metadata: Metadata = {
  title: "Before your shoot",
  description:
    "A short checklist to get a home camera-ready before real estate photos. Share it with your seller to keep the shoot on schedule.",
  alternates: { canonical: "/prep" },
};

const checklists = [
  {
    title: "Every room",
    items: [
      "Turn on every light, including lamps and under-cabinet strips",
      "Open all blinds and curtains to match height",
      "Turn off ceiling fans and TVs",
      "Remove cords, chargers, remotes, and visible cables",
      "Clear surfaces down to one or two decorative items",
      "Tuck away pet bowls, beds, litter boxes, and toys",
    ],
  },
  {
    title: "Kitchen and baths",
    items: [
      "Clear the counters completely — small appliances away",
      "Remove magnets, notes, and photos from the fridge",
      "Hide dish soap, sponges, and drying racks",
      "Fresh, matching towels; hide toothbrushes and toiletries",
      "Close toilet lids",
      "Remove floor mats and bath mats",
    ],
  },
  {
    title: "Living and bedrooms",
    items: [
      "Make every bed with clean, wrinkle-free bedding",
      "Straighten cushions and fold throws",
      "Remove laundry baskets and drying racks",
      "Clear the floor of shoes, bags, and boxes",
      "Empty and hide waste baskets",
    ],
  },
  {
    title: "Outside",
    items: [
      "Move cars off the driveway and away from the front of the house",
      "Roll trash and recycling bins out of sight",
      "Mow, edge, and clear leaves the day before",
      "Coil and hide hoses",
      "Uncover the pool and tidy patio furniture",
      "Take down seasonal decorations",
    ],
  },
];

export default function PrepPage() {
  return (
    <>
      <SiteHeader tenant={tenant} solid />

      <main id="main">
        <header className="page-header">
          <div className="page-header-inner">
            <p className="eyebrow">Before your shoot</p>
            <h1>Fifteen minutes of prep is worth two hours of editing.</h1>
            <p className="section-copy">
              Send this to your seller a day or two ahead. A home that is ready
              when I arrive photographs better and shoots faster — and nothing
              here takes long.
            </p>
          </div>
        </header>

        <section className="page-section" style={{ paddingTop: 0 }}>
          <div className="page-inner">
            <div className="checklist-grid">
              {checklists.map((group) => (
                <div className="checklist-group" key={group.title}>
                  <h3>{group.title}</h3>
                  <ul className="checklist">
                    {group.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="page-section" style={{ paddingTop: 0 }}>
          <div className="page-inner">
            <div className="prose">
              <h2>On the day</h2>
              <p>
                Plan for pets to be out of the house or crated somewhere I am not
                shooting. If the home is occupied, it helps if everyone can step
                outside or into a room I have already finished — empty rooms
                photograph much faster.
              </p>
              <p>
                I shoot exteriors first when the light is good, so if the front of
                the house faces the sun in the morning, an earlier slot is worth
                asking for.
              </p>
              <h2>What I will and will not do</h2>
              <p>
                I will handle light tidying: straightening a cushion, hiding a
                cord, closing a toilet lid, moving a trash bin. I do not stage,
                deep clean, or move furniture, and I cannot photograph around
                clutter without it showing.
              </p>
              <p>
                Questions before the shoot? Email{" "}
                <a href={`mailto:${tenant.email}`}>{tenant.email}</a>.
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter tenant={tenant} />
    </>
  );
}
