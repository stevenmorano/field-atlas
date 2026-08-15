import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

type GuideVisualKind = "discover" | "gps" | "compare" | "account" | "anchor" | "finish";

type GuideStep = Readonly<{
  number: string;
  title: string;
  description: string;
  expectation: string;
  visual: GuideVisualKind;
  caption: string;
}>;

const GUIDE_STEPS: readonly GuideStep[] = [
  {
    number: "01",
    title: "Browse a map",
    description:
      "Start in Discover. Search by place, year, or map name, then open any public map without creating an account.",
    expectation: "Public maps are open to everyone. Unlisted maps work when someone gives you their private link.",
    visual: "discover",
    caption: "Discover keeps the public shelf simple: search, filter, and open.",
  },
  {
    number: "02",
    title: "Turn on your location",
    description:
      "Choose Find me or Location on the map viewer. Your browser supplies a foreground position and an accuracy circle.",
    expectation: "Your location stays on your device. Field Atlas does not save a trail or send GPS coordinates to the app.",
    visual: "gps",
    caption: "The blue marker shows your position; the circle shows the browser's estimated accuracy.",
  },
  {
    number: "03",
    title: "Compare old and new",
    description:
      "Choose Compare with today to see the map warped over a live basemap. Change the basemap, opacity, and fit whenever you need.",
    expectation: "Compare is available without an account and without saving a copy first.",
    visual: "compare",
    caption: "A side-by-side preview helps you recognize the same places across time.",
  },
  {
    number: "04",
    title: "Create an account before making a map",
    description:
      "When you are ready to upload, edit, anchor, or publish your own map, create a free account first. This prevents losing work to a surprise sign-in later.",
    expectation: "Exploring stays open. Accounts are for creator tools and keeping your work available across devices.",
    visual: "account",
    caption: "A clear creator gate appears before upload, anchoring, or map editing begins.",
  },
  {
    number: "05",
    title: "Match landmarks in Anchor Lab",
    description:
      "Pick a recognizable point on your uploaded image, then click or drag to its real position on the basemap. Add several points spread across the sheet.",
    expectation: "Your draft saves locally while you work. You decide when to save a finished checkpoint to the cloud.",
    visual: "anchor",
    caption: "Anchor Lab pairs image pixels with real-world coordinates and previews the result as you work.",
  },
  {
    number: "06",
    title: "Finish, save, and share",
    description:
      "Finish the map with a title and place, then save it to My Maps. Save progress to cloud when you want a cross-device checkpoint, and publish only when you are ready.",
    expectation: "Public sharing creates a separate shared copy. Your private creator map remains yours to update.",
    visual: "finish",
    caption: "My Maps keeps drafts, completed maps, cloud backup, and sharing actions in plain view.",
  },
];

const CHANGELOG_ENTRIES = [
  {
    date: "August 14, 2026",
    label: "Creator workflow",
    title: "A clearer path from first map to shared map",
    bullets: [
      "Creator tools now begin with an account so upload, anchoring, editing, and publishing never interrupt work with a surprise sign-in.",
      "My Maps brings drafts first, then one completed library that includes maps on this device and in your account.",
      "Cloud checkpoints are explicit and paced, while local drafts remain available as you work.",
    ],
  },
  {
    date: "August 12, 2026",
    label: "Public maps",
    title: "Compare is ready for every visitor",
    bullets: [
      "Public and Unlisted viewers can compare a map with today's basemap without an account or an offline download.",
      "GPS, privacy notes, reporting, profiles, and moderation states are explained more clearly around the map viewer.",
      "Physical maps and personal photographs can be shared without forcing an online source link.",
    ],
  },
  {
    date: "August 12, 2026",
    label: "Anchor Lab",
    title: "More room to see and place your landmarks",
    bullets: [
      "Large sheets can zoom out to 50%, and reduced views stay centered below the map controls.",
      "Dragging is more reliable at maximum zoom, with native image ghost-drag behavior blocked.",
      "Hovering either pane now previews the matching point in the other pane.",
    ],
  },
];

function Eyebrow({ children }: Readonly<{ children: ReactNode }>) {
  return <p className="eyebrow">{children}</p>;
}

function InfoPageHeader({
  eyebrow,
  title,
  description,
  children,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}>) {
  return (
    <header className="info-page__header">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1>{title}</h1>
      <p>{description}</p>
      {children ? <div className="info-page__actions">{children}</div> : null}
    </header>
  );
}

function GuideVisual({ kind }: Readonly<{ kind: GuideVisualKind }>) {
  if (kind === "discover") {
    return (
      <div className="guide-visual guide-visual--discover" aria-hidden="true">
        <div className="guide-visual__window-bar"><span /><span /><span /></div>
        <div className="guide-visual__search">⌕&nbsp; Search place, year, or map</div>
        <div className="guide-visual__cards">
          <div><span className="guide-visual__map-swatch guide-visual__map-swatch--historic" /><strong>Rye Brook Port</strong><small>Historic · 1925</small></div>
          <div><span className="guide-visual__map-swatch guide-visual__map-swatch--trail" /><strong>Marshlands</strong><small>Trail · 2023</small></div>
        </div>
      </div>
    );
  }

  if (kind === "gps") {
    return (
      <div className="guide-visual guide-visual--gps" aria-hidden="true">
        <Image className="guide-visual__map-image" src="/demo-park-map.svg" alt="" fill sizes="(max-width: 48rem) 100vw, 42rem" />
        <span className="guide-visual__accuracy" />
        <span className="guide-visual__location-dot" />
        <div className="guide-visual__status"><strong>Location on</strong><small>Live position · accuracy about 20 m</small></div>
      </div>
    );
  }

  if (kind === "compare") {
    return (
      <div className="guide-visual guide-visual--compare" aria-hidden="true">
        <div className="guide-visual__compare-pane guide-visual__compare-pane--historic"><Image src="/demo-park-map.svg" alt="" fill sizes="20rem" /><span>Historic map</span></div>
        <div className="guide-visual__compare-pane guide-visual__compare-pane--live"><span className="guide-visual__road guide-visual__road--one" /><span className="guide-visual__road guide-visual__road--two" /><span>Today’s basemap</span></div>
        <div className="guide-visual__compare-control">Compare · 62%</div>
      </div>
    );
  }

  if (kind === "account") {
    return (
      <div className="guide-visual guide-visual--account" aria-hidden="true">
        <div className="guide-visual__account-icon">✦</div>
        <strong>Create an account to make maps</strong>
        <small>Explore public maps first. Your creator work stays connected across devices.</small>
        <span className="guide-visual__fake-button">Create account</span>
      </div>
    );
  }

  if (kind === "anchor") {
    return (
      <div className="guide-visual guide-visual--anchor" aria-hidden="true">
        <div className="guide-visual__anchor-pane guide-visual__anchor-pane--image"><span className="guide-visual__anchor-grid" /><i /><i /><i /></div>
        <div className="guide-visual__anchor-pane guide-visual__anchor-pane--base"><span /><span /><span /><b /></div>
        <div className="guide-visual__anchor-line" />
        <div className="guide-visual__anchor-label">Anchor 04</div>
      </div>
    );
  }

  return (
    <div className="guide-visual guide-visual--finish" aria-hidden="true">
      <div className="guide-visual__finish-title"><span className="guide-visual__check">✓</span><strong>Map ready</strong><small>24 anchor pairs · original image retained</small></div>
      <div className="guide-visual__finish-actions"><span>Save to My Maps</span><span>Save progress to cloud</span><span>Share</span></div>
    </div>
  );
}

function InfoFooterLinks() {
  return (
    <div className="info-page__footer-links" aria-label="Learn more">
      <span>Keep exploring</span>
      <Link href={"/about" as Route}>About Field Atlas</Link>
      <Link href={"/how-to-use" as Route}>How to use</Link>
      <Link href={"/changelog" as Route}>Changelog</Link>
    </div>
  );
}

export function AboutFieldAtlas() {
  return (
    <main className="info-page" id="main-content">
      <InfoPageHeader
        eyebrow="About Field Atlas"
        title="Maps remember. Field Atlas helps you find your way through them."
        description="Field Atlas puts a live browser location on almost any raster map—from a historic aerial photograph to a trail sign or a hand-drawn park map. It is built for curiosity, preservation, and getting oriented in the places you already know."
      >
        <Link className="button button--signal" href="/">Explore public maps</Link>
        <Link className="button button--quiet" href={"/how-to-use" as Route}>See how it works</Link>
      </InfoPageHeader>

      <section className="info-section info-section--split" aria-labelledby="about-why-title">
        <div>
          <Eyebrow>Why it exists</Eyebrow>
          <h2 id="about-why-title">The map in your hand and the world around you should be able to meet.</h2>
        </div>
        <div className="info-section__copy">
          <p>Modern map apps are excellent at showing today. They are less helpful when the map you care about is printed, historic, illustrated, or made for a place that changed.</p>
          <p>Field Atlas lets people match a few visible landmarks to a real basemap, then use that map with foreground GPS. A good map does not need to be born digital to remain useful.</p>
        </div>
      </section>

      <section className="info-section" aria-labelledby="about-principles-title">
        <div className="info-section__heading">
          <Eyebrow>Three principles</Eyebrow>
          <h2 id="about-principles-title">Useful in the field. Careful with your data.</h2>
        </div>
        <div className="info-card-grid info-card-grid--three">
          <article className="info-card"><span className="info-card__number">01</span><h3>Preserve the original</h3><p>Your uploaded image stays intact. Anchors add location intelligence without rewriting the source map.</p></article>
          <article className="info-card"><span className="info-card__number">02</span><h3>Make the match visible</h3><p>Compare turns a hidden transformation into something you can inspect against Street, Satellite, or Hybrid basemaps.</p></article>
          <article className="info-card"><span className="info-card__number">03</span><h3>Keep location foreground-only</h3><p>GPS is used in the browser while you look. Field Atlas does not build a location trail or store your live coordinates.</p></article>
        </div>
      </section>

      <section className="info-section info-section--creator" aria-labelledby="about-creator-title">
        <div className="info-section__creator-mark">FA</div>
        <div>
          <Eyebrow>About the creator</Eyebrow>
          <h2 id="about-creator-title">A project by [your name]</h2>
          <p className="info-section__lead">[Add your short creator bio here. Share what draws you to maps, places, history, or the outdoors, and what you hope people will do with Field Atlas.]</p>
          <p>This placeholder is intentionally easy to edit in the page source before the public beta. No account or personal profile data is read to render this page.</p>
        </div>
      </section>

      <section className="info-section" aria-labelledby="about-boundaries-title">
        <div className="info-section__heading"><Eyebrow>A clear boundary</Eyebrow><h2 id="about-boundaries-title">Explore first. Create when you are ready.</h2></div>
        <div className="info-boundary-grid">
          <div><strong>No account needed</strong><p>Browse public maps, open an Unlisted link, use GPS, and compare a map with today’s basemap.</p></div>
          <div><strong>Account required</strong><p>Upload, anchor, edit, finish, back up, and publish your own maps. Your work can follow you to another device.</p></div>
        </div>
      </section>

      <InfoFooterLinks />
    </main>
  );
}

export function HowToUseFieldAtlas() {
  return (
    <main className="info-page info-page--guide" id="main-content">
      <InfoPageHeader
        eyebrow="How to use Field Atlas"
        title="Use any map like it belongs in your pocket."
        description="This quick guide covers the whole journey: finding a map, seeing yourself on it, comparing it with today, and creating your own map when you are ready."
      >
        <Link className="button button--signal" href="/">Start with Discover</Link>
        <Link className="button button--quiet" href={"/about" as Route}>Why Field Atlas exists</Link>
      </InfoPageHeader>

      <div className="guide-intro-note"><strong>New here?</strong><span>You can explore and use public maps without an account. An account is only required when you want to create or change a map.</span></div>

      <section className="guide-steps" aria-label="Field Atlas walkthrough">
        {GUIDE_STEPS.map((step) => (
          <article className="guide-step" key={step.number}>
            <div className="guide-step__content">
              <span className="guide-step__number">{step.number}</span>
              <Eyebrow>Step {step.number}</Eyebrow>
              <h2>{step.title}</h2>
              <p>{step.description}</p>
              <div className="guide-step__expectation"><strong>What to expect</strong><span>{step.expectation}</span></div>
            </div>
            <figure className="guide-step__figure"><GuideVisual kind={step.visual} /><figcaption>{step.caption}</figcaption></figure>
          </article>
        ))}
      </section>

      <section className="info-section info-section--guide-help" aria-labelledby="guide-help-title">
        <Eyebrow>A useful rule of thumb</Eyebrow>
        <h2 id="guide-help-title">Save locally while you think. Save to cloud when you want the checkpoint elsewhere.</h2>
        <p>Field Atlas keeps local drafts available as you work and does not upload every anchor. When a finished map or meaningful checkpoint is ready, use the cloud save action. Offline downloads are optional; they are only for using a map without a connection.</p>
      </section>

      <InfoFooterLinks />
    </main>
  );
}

export function PublicChangelog() {
  return (
    <main className="info-page info-page--changelog" id="main-content">
      <InfoPageHeader
        eyebrow="Field Atlas changelog"
        title="Small improvements that make maps easier to use."
        description="A plain-language record of the features and fixes that matter to people using Field Atlas—not an engineering commit log."
      >
        <Link className="button button--quiet" href={"/how-to-use" as Route}>Read the guide</Link>
      </InfoPageHeader>

      <section className="changelog-list" aria-label="Feature updates">
        {CHANGELOG_ENTRIES.map((entry) => (
          <article className="changelog-entry" key={`${entry.date}-${entry.title}`}>
            <div className="changelog-entry__date"><span>{entry.date}</span><strong>{entry.label}</strong></div>
            <div>
              <h2>{entry.title}</h2>
              <ul>{entry.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
            </div>
          </article>
        ))}
      </section>

      <section className="info-section info-section--next" aria-labelledby="changelog-next-title">
        <Eyebrow>On the horizon</Eyebrow>
        <h2 id="changelog-next-title">More ways to make your maps yours.</h2>
        <p>Next up are deeper mobile touch testing, viewer rotation, and durable account favorites. The current beta keeps the core promise focused: your map, your position, your choice about sharing.</p>
      </section>

      <InfoFooterLinks />
    </main>
  );
}
