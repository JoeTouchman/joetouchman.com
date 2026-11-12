/* joetouchman.com: shared page behaviour (no dependencies). */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Nav gets a background once the page scrolls
const nav = document.getElementById("nav");
function onScroll() { nav.classList.toggle("is-stuck", window.scrollY > 24); }

// phone menu
const navToggle = nav.querySelector(".nav__toggle");
function setMenu(open) {
  nav.classList.toggle("menu-open", open);
  navToggle.setAttribute("aria-expanded", String(open));
  navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}
navToggle.addEventListener("click", () => setMenu(!nav.classList.contains("menu-open")));
nav.querySelectorAll(".nav__links a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
document.addEventListener("click", (e) => { if (!nav.contains(e.target)) setMenu(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("menu-open")) { setMenu(false); navToggle.focus(); } });
matchMedia("(min-width: 641px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Reveal on scroll
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      revealObserver.unobserve(e.target);
    });
  },
  { rootMargin: "0px 0px -6% 0px", threshold: 0.05 }
);
document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

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

// Home page: the glow follows the pointer
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
    frame.title = "Joebot Hand demo";
    frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    frame.allowFullscreen = true;
    btn.replaceChildren(frame);
    btn.disabled = true;
  }, { once: true });
});

// Drum clip: one small play/pause button, loaded only when pressed
document.querySelectorAll(".player__btn").forEach((btn) => {
  const holder = btn.closest(".player");
  let audio = null;
  const setPlaying = (on) => {
    holder.classList.toggle("is-playing", on);
    btn.setAttribute("aria-label", on ? "Pause drum clip" : "Play drum clip");
  };
  btn.addEventListener("click", () => {
    if (!audio) {
      audio = new Audio(btn.dataset.audio);
      audio.addEventListener("ended", () => setPlaying(false));
      audio.addEventListener("pause", () => setPlaying(false));
      audio.addEventListener("play", () => setPlaying(true));
    }
    if (audio.paused) audio.play().catch(() => setPlaying(false));
    else audio.pause();
  });
});
