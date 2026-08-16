"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { choirConfig } from "./site-config";

export default function Home() {
  const [adminOpen, setAdminOpen] = useState(false);
  const [heroExpanded, setHeroExpanded] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);

  useEffect(() => {
    const heroScene = document.querySelector<HTMLElement>(".hero-scene");
    const headline = heroScene?.querySelector<HTMLElement>(".hero-headline");
    const headlineParts = Array.from(heroScene?.querySelectorAll<HTMLElement>(".hero-headline > span") ?? []);
    const heroActions = heroScene?.querySelector<HTMLElement>(".hero-actions");
    const heroCopy = heroScene?.querySelector<HTMLElement>(".hero-copy");
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    // Measured at rest so the stacked photo can sit below the copy instead of
    // under it. Re-measured whenever the hero is back at its starting state.
    let restingCopyHeight = 0;

    const update = () => {
      frame = 0;
      if (!heroScene) return;
      const mobile = window.innerWidth <= 760;
      const stackedHero = mobile || (window.innerWidth <= 1000 && window.innerHeight > window.innerWidth);
      const sceneRect = heroScene.getBoundingClientRect();
      const sceneTravel = Math.max(1, heroScene.offsetHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -sceneRect.top / sceneTravel));
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const setHeroPixels = (name: string, value: number) => heroScene.style.setProperty(name, `${value}px`);
      const setHeroNumber = (name: string, value: number) => heroScene.style.setProperty(name, value.toFixed(4));
      const smoothstep = (start: number, end: number, value: number) => {
        const amount = Math.min(1, Math.max(0, (value - start) / (end - start)));
        return amount * amount * (3 - 2 * amount);
      };
      const mix = (start: number, end: number, amount: number) => start + (end - start) * amount;

      if (motionPreference.matches) {
        headlineParts.forEach((part) => { part.style.transform = "none"; });
      } else {
        const copyMorph = smoothstep(0.02, 0.22, progress);
        const copyExit = smoothstep(0.3, 0.46, progress);
        const photoExpand = smoothstep(0.18, 0.46, progress);
        const photoDrift = smoothstep(0.46, 1, progress);
        const panelTravel = smoothstep(0.44, 0.95, progress);
        const panelFadeIn = smoothstep(0.42, 0.52, progress);
        const panelFadeOut = smoothstep(0.9, 1, progress);
        const pageInset = stackedHero ? 15 : Math.max(viewportWidth * 0.03, (viewportWidth - 1420) / 2);

        const startCopyLeft = pageInset;
        const startCopyTop = stackedHero ? 80 : Math.max(118, viewportHeight * 0.22);
        const startCopyWidth = stackedHero ? viewportWidth - pageInset * 2 : Math.max(350, viewportWidth * (viewportWidth <= 1000 ? 0.39 : 0.37));
        const finalCopyLeft = pageInset;
        const finalCopyTop = stackedHero ? 78 : Math.max(92, viewportHeight * 0.1);
        const finalCopyWidth = viewportWidth - pageInset * 2;

        setHeroPixels("--hero-copy-left", mix(startCopyLeft, finalCopyLeft, copyMorph));
        setHeroPixels("--hero-copy-top", mix(startCopyTop, finalCopyTop, copyMorph));
        setHeroPixels("--hero-copy-width", mix(startCopyWidth, finalCopyWidth, copyMorph));
        setHeroPixels("--hero-copy-y", copyExit * (stackedHero ? -190 : -245));
        setHeroNumber("--hero-copy-opacity", 1 - copyExit);

        const initialHeadlineSize = stackedHero
          ? Math.min(64, Math.max(44, viewportWidth * 0.132))
          : Math.min(110, Math.max(69, viewportWidth * 0.062));
        const finalHeadlineSize = stackedHero
          ? Math.max(20, viewportWidth * 0.058)
          : Math.min(86, Math.max(48, viewportWidth * 0.055));
        setHeroPixels("--hero-headline-size", mix(initialHeadlineSize, finalHeadlineSize, copyMorph));

        if (headline && headlineParts.length) {
          const lineHeight = Number.parseFloat(window.getComputedStyle(headline).lineHeight) || initialHeadlineSize * 0.86;
          headlineParts.forEach((part, index) => {
            const stackedX = -part.offsetLeft * (1 - copyMorph);
            const stackedY = index * lineHeight * (1 - copyMorph);
            part.style.transform = `translate3d(${stackedX}px, ${stackedY}px, 0)`;
          });
          setHeroPixels("--hero-headline-height", mix(lineHeight * 3, lineHeight, copyMorph));
        }

        const compactMobile = viewportWidth <= 350;
        const actionWidth = heroActions?.offsetWidth ?? (stackedHero ? 285 : 390);
        setHeroPixels("--hero-proof-x", stackedHero ? 0 : copyMorph * (actionWidth + 34));
        setHeroPixels("--hero-proof-y", stackedHero ? (compactMobile ? 104 : 58) : (1 - copyMorph) * 76);
        setHeroPixels("--hero-meta-height", stackedHero ? (compactMobile ? 148 : 104) : mix(122, 55, copyMorph));

        // The stacked layout positions the photo from the copy's real height, so
        // the headline, buttons and proof line can never sit on top of the photo.
        if (stackedHero && heroCopy && progress < 0.04) restingCopyHeight = heroCopy.offsetHeight;
        const stackedPhotoTop = startCopyTop + (restingCopyHeight || 400) + 18;
        const stackedPhotoRoom = viewportHeight - stackedPhotoTop - 16;

        const startPhotoLeft = stackedHero
          ? 15
          : Math.max(viewportWidth * (viewportWidth <= 1000 ? 0.45 : 0.43), startCopyLeft + startCopyWidth + 28);
        const startPhotoWidth = stackedHero ? viewportWidth - 30 : viewportWidth - startPhotoLeft - pageInset;
        const startPhotoHeight = stackedHero
          ? Math.min(385, Math.max(190, stackedPhotoRoom))
          : Math.min(startPhotoWidth * 0.75, viewportHeight * 0.76);
        const startPhotoTop = stackedHero
          ? stackedPhotoTop
          : (viewportHeight - startPhotoHeight) / 2 + 24;
        const finalPhotoInsetX = stackedHero ? 8 : Math.max(viewportWidth * 0.025, (viewportWidth - 1500) / 2);
        const finalPhotoTop = stackedHero ? 10 : viewportHeight * 0.03;
        const finalPhotoWidth = viewportWidth - finalPhotoInsetX * 2;
        const finalPhotoHeight = viewportHeight - finalPhotoTop * 2;

        setHeroPixels("--hero-photo-left", mix(startPhotoLeft, finalPhotoInsetX, photoExpand));
        setHeroPixels("--hero-photo-top", mix(startPhotoTop, finalPhotoTop, photoExpand) + photoDrift * (stackedHero ? 105 : 175));
        setHeroPixels("--hero-photo-width", mix(startPhotoWidth, finalPhotoWidth, photoExpand));
        setHeroPixels("--hero-photo-height", mix(startPhotoHeight, finalPhotoHeight, photoExpand));
        setHeroPixels("--hero-photo-radius", mix(stackedHero ? 28 : 48, stackedHero ? 24 : 40, photoExpand));
        setHeroPixels("--hero-photo-border", mix(stackedHero ? 5 : 8, stackedHero ? 6 : 11, photoExpand));
        setHeroNumber("--hero-decor-opacity", 1 - smoothstep(0.13, 0.27, progress));

        setHeroPixels("--hero-panel-y", mix(viewportHeight * 1.04, viewportHeight * -0.36, panelTravel));
        setHeroNumber("--hero-panel-opacity", panelFadeIn * (1 - panelFadeOut));
        setHeroPixels("--hero-ribbon-slow-y", progress * (mobile ? 110 : 190));
        setHeroPixels("--hero-ribbon-fast-y", progress * (mobile ? 210 : 360));
        setHeroPixels("--hero-accent-y", progress * (mobile ? -245 : -430));
      }

    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    motionPreference.addEventListener("change", onScroll);

    const revealItems = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("is-visible")),
      { threshold: 0.18, rootMargin: "0px 0px -7%" },
    );
    revealItems.forEach((item) => observer.observe(item));

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      motionPreference.removeEventListener("change", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHeroExpanded(false);
        setAdminOpen(false);
      }
    };
    document.body.style.overflow = heroExpanded ? "hidden" : "";
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", close);
    };
  }, [heroExpanded]);

  async function openAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adminBusy) return;
    setAdminBusy(true);
    setPasscodeError("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Administrator sign-in failed.");
      window.location.href = "/admin";
    } catch (error) {
      setPasscodeError(error instanceof Error ? error.message : "Administrator sign-in failed.");
      setAdminBusy(false);
    }
  }

  return (
    <main className="site-shell">
      <header className="public-nav">
        <Link className="nav-brand" href="#top" aria-label="The Choir Chug home">
          <img src={choirConfig.brand.logo} alt="The Choir Chug" />
        </Link>
        <nav aria-label="Main navigation">
          <Link href="#experience">Experience</Link>
          <Link href="#program">Program</Link>
          <Link href="#contact">Contact</Link>
          <Link className="nav-register" href="/register">Register now</Link>
        </nav>
        <button className="admin-hotspot" aria-label="Open administrator access" onClick={() => setAdminOpen(true)} />
      </header>

      <section className="hero-scene" id="top">
        <div className="hero">
          <div className="hero-glow parallax-slow" aria-hidden="true" />
          <div className="hero-ribbon hero-ribbon-one parallax-medium" aria-hidden="true" />
          <div className="hero-ribbon hero-ribbon-two parallax-slow" aria-hidden="true" />

          <div className="hero-copy parallax-copy">
            <p className="eyebrow">{choirConfig.landing.eyebrow}</p>
            <h1 className="hero-headline" aria-label={choirConfig.landing.headline}>
              <span>A place for</span><span>her voice to</span><span>grow.</span>
            </h1>
            <p className="hero-intro">{choirConfig.landing.intro}</p>
            <div className="hero-meta-row">
              <div className="hero-actions">
                <Link className="button" href="/register">
                  Register for {choirConfig.currentYear.label}<span aria-hidden="true">→</span>
                </Link>
                <Link className="text-link" href="#experience">See the experience</Link>
              </div>
              <div className="hero-proof"><strong>Technique. Recording. Confidence.</strong></div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-photo-aura" aria-hidden="true" />
            <div className="hero-photo-wrap">
              <img src={choirConfig.photos.hero} alt="Choir students with their instructor" />
              <button className="photo-expand" type="button" onClick={() => setHeroExpanded(true)} aria-label="Expand the group photograph">
                <span aria-hidden="true">↗</span> View full photo
              </button>
            </div>
            <div className="hero-motion-badge parallax-accent" aria-hidden="true">♪</div>
            <div className="sparkle sparkle-a parallax-accent" aria-hidden="true">✦</div>
            <div className="sparkle sparkle-b parallax-medium" aria-hidden="true">✧</div>
          </div>

          <div className="hero-experience-overlay">
            <div>
              <p className="eyebrow">More than singing</p>
              <h2>A full experience built around her voice.</h2>
            </div>
            <p>Every part of the year helps each girl improve, participate and feel proud of what she can do.</p>
          </div>
        </div>
      </section>

      <section className="experience section" id="experience" aria-label="Choir experience benefits" data-reveal>
        <div className="benefit-grid">
          {choirConfig.landing.benefits.map((benefit) => (
            <article className="benefit-card" key={benefit.number}>
              <div className="benefit-photo"><img src={benefit.photo} alt="" /></div>
              <div className="benefit-body"><span>{benefit.number}</span><h3>{benefit.title}</h3><p>{benefit.body}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="program section" id="program" data-reveal>
        <div className="program-card">
          <div className="program-intro">
            <p className="eyebrow">The {choirConfig.currentYear.label} year</p>
            <h2>A consistent weekly program.</h2>
            <p>Final group times will be shared once registration is complete and the groups are arranged by age.</p>
          </div>
          <dl className="fact-grid">
            <div><dt>Day</dt><dd>{choirConfig.currentYear.day}</dd></div>
            <div><dt>Session</dt><dd>{choirConfig.currentYear.sessionLength}</dd></div>
            <div><dt>Time window</dt><dd>{choirConfig.currentYear.timeWindow}</dd></div>
            <div><dt>Choir year</dt><dd>{choirConfig.currentYear.dates}</dd></div>
            <div><dt>Location</dt><dd>{choirConfig.currentYear.location}</dd></div>
            <div><dt>Monthly fee</dt><dd>{choirConfig.currentYear.monthlyFee}</dd></div>
          </dl>
        </div>
      </section>

      <section className="moments section-wide" aria-label="Studio moments" data-reveal>
        <div className="moments-copy"><p className="eyebrow">Moments that build confidence</p><h2>Learning to step up to the microphone.</h2></div>
        <div className="photo-strip">
          <figure className="photo-card" data-reveal><img src={choirConfig.photos.studioSoloPink} alt="Student recording a song" /><figcaption>Focus</figcaption></figure>
          <figure className="photo-card" data-reveal><img src={choirConfig.photos.studioKeyboard} alt="Student singing beside a studio keyboard" /><figcaption>Technique</figcaption></figure>
          <figure className="photo-card" data-reveal><img src={choirConfig.photos.studioLyrics} alt="Student reading lyrics at the microphone" /><figcaption>Preparation</figcaption></figure>
        </div>
      </section>

      <section className="closing-cta section" id="contact" data-reveal>
        <div className="closing-photo"><img src={choirConfig.photos.studioFriends} alt="Choir students singing together around a studio microphone" /></div>
        <div className="closing-copy">
          <img className="closing-logo" src={choirConfig.brand.logo} alt="The Choir Chug" />
          <h2>Give her voice a place to shine.</h2>
          <p>Registration for {choirConfig.currentYear.label} is open. Places will be arranged into groups after sign-up.</p>
          <Link className="button" href="/register">Begin registration <span>→</span></Link>
          <a className="phone-link" href="tel:+972535906149">Questions? Call Nechama: {choirConfig.brand.phone}</a>
        </div>
      </section>

      <footer className="public-footer">
        <div className="footer-brand"><img src={choirConfig.brand.logo} alt="The Choir Chug" /><p>Professional girls’ choir · Beit Shemesh</p></div>
        <nav className="footer-links" aria-label="Legal information">
          <Link href="/terms">Terms of use</Link>
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/accessibility">Accessibility</Link>
        </nav>
        <div className="footer-contact"><a href="tel:+972535906149">{choirConfig.brand.phone}</a><small>© 2026 The Choir Chug. All rights reserved.</small></div>
      </footer>

      {heroExpanded && (
        <div className="photo-lightbox" role="presentation" onMouseDown={() => setHeroExpanded(false)}>
          <section role="dialog" aria-modal="true" aria-label="Full group photograph" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setHeroExpanded(false)} aria-label="Close full photograph">×</button>
            <img src={choirConfig.photos.hero} alt="All Choir Chug students with their instructor" />
          </section>
        </div>
      )}

      {adminOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setAdminOpen(false)}>
          <section className="access-modal" role="dialog" aria-modal="true" aria-labelledby="admin-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setAdminOpen(false)} aria-label="Close">×</button>
            <p className="eyebrow">Administrator access</p>
            <h2 id="admin-title">Enter passcode</h2>
            <form onSubmit={openAdmin}>
              <label htmlFor="admin-code">Passcode</label>
              <input autoFocus id="admin-code" type="password" inputMode="numeric" maxLength={128} value={passcode} onChange={(event) => { setPasscode(event.target.value); setPasscodeError(""); }} aria-invalid={Boolean(passcodeError)} aria-describedby={passcodeError ? "admin-code-error" : undefined} />
              {passcodeError && <p className="field-error" id="admin-code-error">{passcodeError}</p>}
              <button className="button button-full" type="submit" disabled={adminBusy}>{adminBusy ? "Checking…" : "Continue"}</button>
              <Link className="admin-recovery-link" href="/admin/recover">Forgot or reset the passcode</Link>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
