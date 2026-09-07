// Efecto "story scroll": cada sección se fija cuando llega al fondo de la ventana y la
// siguiente entra rotando desde la esquina inferior izquierda (GSAP + ScrollTrigger).
// Equivalente vanilla del componente FlowArt/FlowSection en React.
(function () {
  if (!window.gsap || !window.ScrollTrigger) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  gsap.registerPlugin(ScrollTrigger);

  const sections = Array.from(document.querySelectorAll("[data-flow-section]"));
  if (!sections.length) return;

  sections.forEach((section, i) => {
    gsap.set(section, { zIndex: i + 1 });
    const inner = section.querySelector("[data-flow-inner]");
    if (!inner) return;

    if (i > 0) {
      gsap.set(inner, { rotation: 30, transformOrigin: "bottom left" });
      gsap.to(inner, {
        rotation: 0,
        ease: "none",
        scrollTrigger: { trigger: section, start: "top bottom", end: "top 25%", scrub: true },
      });
    }
    // La calculadora (data-no-pin) NO se fija: mientras la llenas, la siguiente sección no se le
    // encima. Ella sí entra rotando sobre el hero, y la sección siguiente entra rotando sobre ella
    // solo cuando ya la pasaste.
    if (i < sections.length - 1 && !section.hasAttribute("data-no-pin")) {
      ScrollTrigger.create({ trigger: section, start: "bottom bottom", end: "bottom top", pin: true, pinSpacing: false });
    }
  });

  // La calculadora cambia de altura al avanzar de paso: recalcular posiciones.
  let raf = 0;
  const refresh = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => ScrollTrigger.refresh()); };
  document.addEventListener("calc-rendered", refresh);
  document.addEventListener("toggle", (e) => { if (e.target.tagName === "DETAILS") refresh(); }, true);
  window.addEventListener("load", refresh);
  document.fonts?.ready.then(refresh);
})();
