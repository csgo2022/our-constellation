window.App = window.App || {};

(function() {
  'use strict';

  const canvas = document.getElementById('starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let bgStars = [];

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initBgStars();
    if (window.App.drawLines) window.App.drawLines();
  }

  function initBgStars() {
    bgStars = [];
    const count = Math.floor((canvas.width * canvas.height) / 8000);
    for (let i = 0; i < count; i++) {
      bgStars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.5,
        alpha: Math.random(),
        speed: 0.01 + Math.random() * 0.02
      });
    }
  }

  function animateStars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    for (const star of bgStars) {
      star.alpha += star.speed;
      if (star.alpha > 1 || star.alpha < 0.2) star.speed = -star.speed;
      ctx.globalAlpha = Math.max(0.1, star.alpha);
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(animateStars);
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  animateStars();

  window.App.initStarfield = true;
})();
