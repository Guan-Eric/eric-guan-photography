(() => {
  const header = document.querySelector("[data-header]");
  const year = document.querySelector("[data-year]");
  const reveals = document.querySelectorAll("[data-reveal]");
  const lightbox = document.querySelector("[data-lightbox]");
  const lightboxImage = document.querySelector("[data-lightbox-image]");
  const openButtons = document.querySelectorAll("[data-lightbox-open]");
  const closeButton = document.querySelector("[data-lightbox-close]");

  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  };

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );

    reveals.forEach((el, index) => {
      el.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
      observer.observe(el);
    });
  } else {
    reveals.forEach((el) => el.classList.add("is-visible"));
  }

  const openLightbox = (img) => {
    if (!lightbox || !lightboxImage || !img) return;
    lightboxImage.src = img.currentSrc || img.src;
    lightboxImage.alt = img.alt || "";
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
  };

  const closeLightbox = () => {
    if (!lightbox || !lightboxImage) return;
    lightbox.hidden = true;
    lightboxImage.removeAttribute("src");
    lightboxImage.alt = "";
    document.body.style.overflow = "";
  };

  openButtons.forEach((button) => {
    button.addEventListener("click", () => {
      openLightbox(button.querySelector("img"));
    });
  });

  closeButton?.addEventListener("click", closeLightbox);

  lightbox?.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeLightbox();
  });
})();
