/* joetouchman.com: page behaviour (no dependencies). */

// ---------------------------------------------------------------------------
// TODO(Joe): fill these in. A button only appears once its link is set.
//   email:    the address you want shown publicly, e.g. "you@ucsc.edu"
//   linkedin: full profile URL
//   resume:   path to the PDF once it's in the repo, e.g. "assets/Joe-Touchman-Resume.pdf"
// ---------------------------------------------------------------------------
const LINKS = {
  email: "",
  linkedin: "",
  resume: "",
};

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Optional links
document.querySelectorAll("[data-link]").forEach((a) => {
  const value = LINKS[a.dataset.link];
  if (!value) return;
  a.href = a.dataset.link === "email" ? `mailto:${value}` : value;
  a.hidden = false;
});

// Nav background + scroll progress
const nav = document.getElementById("nav");
const bar = document.getElementById("progressBar");
function onScroll() {
  const y = window.scrollY;
  nav.classList.toggle("is-stuck", y > 24);
  const max = document.documentElement.scrollHeight - window.innerHeight;
  bar.style.width = (max > 0 ? (y / max) * 100 : 0) + "%";
}
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Highlight the current section in the nav
const navLinks = [...document.querySelectorAll(".nav__links a")];
const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + e.target.id));
    });
  },
  { rootMargin: "-45% 0px -50% 0px" }
);
document.querySelectorAll("main section[id]").forEach((s) => sectionObserver.observe(s));

// Reveal on scroll
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      revealObserver.unobserve(e.target);
    });
  },
  { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
);
document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

// Count-up numbers
const countObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      countObserver.unobserve(e.target);
      const el = e.target;
      const target = Number(el.dataset.count);
      const prefix = el.dataset.prefix || "";
      const suffix = el.dataset.suffix || "";
      if (reduceMotion) return;
      const start = performance.now();
      const duration = 900;
      (function tick(now) {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = prefix + Math.round(target * eased) + suffix;
        if (t < 1) requestAnimationFrame(tick);
      })(start);
    });
  },
  { threshold: 0.6 }
);
document.querySelectorAll("[data-count]").forEach((el) => countObserver.observe(el));

// Looping clips: play only while on screen
const loops = document.querySelectorAll("video.loop");
if (reduceMotion) {
  loops.forEach((v) => { v.removeAttribute("autoplay"); v.pause(); v.controls = true; });
} else {
  const videoObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.play().catch(() => {});
        else e.target.pause();
      });
    },
    { threshold: 0.25 }
  );
  loops.forEach((v) => videoObserver.observe(v));
}

// Hero glow follows the pointer
const hero = document.querySelector(".hero");
const glow = document.querySelector(".hero__glow");
if (hero && glow && !reduceMotion && window.matchMedia("(pointer: fine)").matches) {
  hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    glow.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
    glow.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
  });
}

// YouTube: load the player only when asked
document.querySelectorAll(".yt").forEach((btn) => {
  const img = btn.querySelector("img");
  // Fall back to the smaller thumbnail if the large one doesn't exist.
  img.addEventListener("load", () => {
    if (img.naturalWidth <= 120) img.src = `https://i.ytimg.com/vi/${btn.dataset.yt}/hqdefault.jpg`;
  });
  btn.addEventListener("click", () => {
    const frame = document.createElement("iframe");
    frame.src = `https://www.youtube-nocookie.com/embed/${btn.dataset.yt}?autoplay=1&rel=0`;
    frame.title = "JoebotHand demo";
    frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    frame.allowFullscreen = true;
    btn.replaceChildren(frame);
    btn.disabled = true;
  }, { once: true });
});
