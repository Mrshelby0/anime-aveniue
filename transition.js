document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.remove("fade-out");

  document.querySelectorAll("a").forEach(link => {
    if (link.hostname === window.location.hostname) {
      link.addEventListener("click", e => {
        e.preventDefault();
        document.body.classList.add("fade-out");
        setTimeout(() => {
          window.location.href = link.href;
        }, 600); // Match CSS transition duration
      });
    }
  });
});