(function () {
  'use strict';

  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function makeButton(className, label, text) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.setAttribute('aria-label', label);
    button.textContent = text;
    return button;
  }

  function setupScrollProgress() {
    if (document.querySelector('.z88-scroll-progress')) return;
    var progress = document.createElement('div');
    progress.className = 'z88-scroll-progress';
    progress.setAttribute('aria-hidden', 'true');
    document.body.appendChild(progress);
    var update = function () {
      var scrollable = document.documentElement.scrollHeight - window.innerHeight;
      var amount = scrollable > 0 ? window.scrollY / scrollable : 0;
      progress.style.transform = 'scaleX(' + Math.min(1, Math.max(0, amount)) + ')';
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
  }

  function setupPointerGlow() {
    if (window.matchMedia('(hover: none)').matches || document.querySelector('.z88-pointer-glow')) return;
    var glow = document.createElement('div');
    glow.className = 'z88-pointer-glow';
    glow.setAttribute('aria-hidden', 'true');
    document.body.appendChild(glow);
    window.addEventListener('pointermove', function (event) {
      glow.style.left = event.clientX + 'px';
      glow.style.top = event.clientY + 'px';
      glow.style.opacity = '.9';
    }, { passive: true });
    window.addEventListener('pointerleave', function () {
      glow.style.opacity = '0';
    }, { passive: true });
  }

  function setupTilt() {
    if (window.matchMedia('(hover: none)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var targets = document.querySelectorAll('.product-card, .cat, .footer-logo-wrap');
    Array.prototype.forEach.call(targets, function (element) {
      element.addEventListener('pointermove', function (event) {
        var rect = element.getBoundingClientRect();
        var x = (event.clientX - rect.left) / rect.width - .5;
        var y = (event.clientY - rect.top) / rect.height - .5;
        element.style.setProperty('--z88-rx', (y * -3.8).toFixed(2) + 'deg');
        element.style.setProperty('--z88-ry', (x * 4.2).toFixed(2) + 'deg');
        element.classList.add('z88-tilt-active');
      }, { passive: true });
      element.addEventListener('pointerleave', function () {
        element.classList.remove('z88-tilt-active');
        element.style.removeProperty('--z88-rx');
        element.style.removeProperty('--z88-ry');
      }, { passive: true });
    });
  }

  function setupRipples() {
    if (document.body.dataset.z88Ripples === 'true') return;
    document.body.dataset.z88Ripples = 'true';
    document.addEventListener('pointerdown', function (event) {
      var source = event.target instanceof Element ? event.target.closest('button, .btn') : null;
      if (!source || source.disabled || source.classList.contains('z88-slide-hit')) return;
      source.classList.add('z88-ripple-host');
      var rect = source.getBoundingClientRect();
      var ripple = document.createElement('span');
      ripple.className = 'z88-ripple';
      ripple.style.left = (event.clientX - rect.left) + 'px';
      ripple.style.top = (event.clientY - rect.top) + 'px';
      source.appendChild(ripple);
      window.setTimeout(function () { ripple.remove(); }, 700);
    }, { passive: true });
  }

  function setupToast() {
    var toast = document.querySelector('.z88-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'z88-toast';
      toast.setAttribute('role', 'status');
      toast.innerHTML = '<span class="z88-toast-mark" aria-hidden="true">✓</span><span class="z88-toast-copy"></span>';
      document.body.appendChild(toast);
    }
    var copy = toast.querySelector('.z88-toast-copy');
    var timer;
    var show = function (message) {
      copy.textContent = message;
      toast.classList.add('is-visible');
      window.clearTimeout(timer);
      timer = window.setTimeout(function () { toast.classList.remove('is-visible'); }, 2400);
    };
    document.addEventListener('click', function (event) {
      var button = event.target instanceof Element ? event.target.closest('.add-btn') : null;
      if (!button) return;
      var card = button.closest('.product-card');
      var name = card && card.querySelector('h3') ? card.querySelector('h3').textContent.trim() : 'Item';
      window.setTimeout(function () { show(name + ' added to your cart'); }, 70);
    });
  }

  function rebuildHeader() {
    var headerMain = document.querySelector('.header-main');
    if (!headerMain || headerMain.classList.contains('z88-header-rebuilt')) return;
    var brand = headerMain.querySelector('.brand');
    var search = headerMain.querySelector('.search');
    var actions = headerMain.querySelector('.actions');
    var logo = brand && brand.querySelector('.logo');
    headerMain.classList.add('z88-header-rebuilt');

    var oldHeaderAll = headerMain.querySelector('.z88-header-all');
    if (oldHeaderAll) oldHeaderAll.remove();

    if (logo) {
      var centered = document.createElement('a');
      centered.className = 'z88-centered-logo';
      centered.href = '#top';
      centered.setAttribute('aria-label', 'Zander88LLC home');
      logo.classList.add('z88-clear-logo');
      logo.remove();
      centered.appendChild(logo);
      headerMain.appendChild(centered);
    }

    if (brand && search && !brand.contains(search)) brand.appendChild(search);

    var nav = document.getElementById('primaryNav');
    if (nav) {
      var navLinks = nav.querySelectorAll('a');
      Array.prototype.forEach.call(navLinks, function (link) {
        if (link.getAttribute('href') === '#categories') link.textContent = 'Shop Categories';
      });
      var oldNavAll = nav.querySelector('a[data-z88-all-products]');
      if (oldNavAll) oldNavAll.remove();
      Array.prototype.forEach.call(nav.querySelectorAll('a'), function (link) {
        link.addEventListener('click', function () {
          nav.classList.remove('open');
          var menu = document.getElementById('menuButton');
          if (menu) menu.setAttribute('aria-expanded', 'false');
        });
      });
    }
  }

  function setupSearchAndFilter() {
    var search = document.querySelector('.search');
    var input = document.getElementById('searchInput');
    var select = document.getElementById('categorySelect');
    var actions = document.querySelector('.header-main .actions');
    var header = document.querySelector('.header');
    if (!search || !header) return;

    search.classList.add('z88-search-simple');
    if (input) {
      input.placeholder = 'Search products';
      input.setAttribute('aria-label', 'Search products');
    }
    if (select) {
      select.classList.add('z88-search-category');
      select.setAttribute('aria-hidden', 'true');
      select.tabIndex = -1;
    }

    var filterButton = document.querySelector('.z88-filter-button');
    if (!filterButton) {
      filterButton = makeButton('z88-filter-button', 'Open product filters', 'Filter');
      filterButton.setAttribute('aria-expanded', 'false');
      if (actions) {
        search.parentNode.insertBefore(filterButton, search.nextSibling);
      } else {
        header.appendChild(filterButton);
      }
    }

    var panel = document.querySelector('.z88-filter-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'z88-filter-panel';
      panel.hidden = true;
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'Filter products by category');
      panel.innerHTML = '<div class="z88-filter-panel-head"><strong>Filter by category</strong><button type="button" class="z88-filter-close" aria-label="Close filters">×</button></div><div class="z88-filter-options"></div><button type="button" class="z88-filter-clear">Clear filter</button>';
      header.appendChild(panel);
    }

    var optionWrap = panel.querySelector('.z88-filter-options');
    if (optionWrap && !optionWrap.children.length) {
      var seen = {};
      Array.prototype.forEach.call(document.querySelectorAll('.cat'), function (category) {
        var filter = category.dataset.filter;
        var name = category.querySelector('.cat-name');
        if (!filter || filter === 'All Products' || seen[filter]) return;
        seen[filter] = true;
        var option = document.createElement('button');
        option.type = 'button';
        option.className = 'z88-filter-option';
        option.dataset.filter = filter;
        option.textContent = name ? name.textContent.trim() : filter;
        optionWrap.appendChild(option);
      });
    }

    var close = function () {
      panel.hidden = true;
      filterButton.setAttribute('aria-expanded', 'false');
    };
    var open = function () {
      panel.hidden = false;
      filterButton.setAttribute('aria-expanded', 'true');
    };
    if (filterButton.dataset.z88Bound !== 'true') {
      filterButton.dataset.z88Bound = 'true';
      filterButton.addEventListener('click', function () {
        if (panel.hidden) open(); else close();
      });
      var closeButton = panel.querySelector('.z88-filter-close');
      if (closeButton) closeButton.addEventListener('click', close);
      Array.prototype.forEach.call(panel.querySelectorAll('.z88-filter-option'), function (option) {
        option.addEventListener('click', function () {
          var category = Array.prototype.find.call(document.querySelectorAll('.dept-chip'), function (chip) {
            return chip.dataset.filter === option.dataset.filter;
          });
          if (select) select.value = option.dataset.filter;
          if (category) category.click();
          close();
        });
      });
      var clearButton = panel.querySelector('.z88-filter-clear');
      if (clearButton) clearButton.addEventListener('click', function () {
        if (input) input.value = '';
        if (select) select.value = 'All Products';
        var allChip = Array.prototype.find.call(document.querySelectorAll('.dept-chip'), function (chip) {
          return chip.dataset.filter === 'All Products';
        });
        if (allChip) allChip.click();
        close();
      });
      document.addEventListener('click', function (event) {
        var target = event.target;
        if (target instanceof Element && (target.closest('.z88-filter-button') || target.closest('.z88-filter-panel'))) return;
        if (!panel.hidden) close();
      });
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && !panel.hidden) {
          close();
          filterButton.focus();
        }
      });
    }
  }

  function setupCategoryCarousel() {
    var track = document.querySelector('.cat-grid');
    var shell = track && track.closest('.category-shell');
    var heading = shell && shell.querySelector('.category-heading');
    if (!track || !shell || track.dataset.z88Carousel === 'true') return;
    track.dataset.z88Carousel = 'true';

    var allProducts = track.querySelector('.cat[data-filter="All Products"]');
    if (allProducts) allProducts.remove();
    track.classList.add('z88-category-track');
    track.setAttribute('role', 'list');
    track.setAttribute('aria-label', 'Browse shop categories');
    track.tabIndex = 0;
    Array.prototype.forEach.call(track.querySelectorAll('.cat'), function (category) {
      category.setAttribute('aria-label', 'Shop ' + (category.querySelector('.cat-name') ? category.querySelector('.cat-name').textContent.trim() : 'category'));
    });

    if (!heading || heading.querySelector('.z88-category-controls')) return;
    var controls = document.createElement('div');
    controls.className = 'z88-category-controls';
    var previous = makeButton('z88-category-control', 'Previous categories', '‹');
    var next = makeButton('z88-category-control', 'Next categories', '›');
    controls.appendChild(previous);
    controls.appendChild(next);
    heading.appendChild(controls);

    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var timer;
    var paused = false;
    function stop() {
      window.clearInterval(timer);
      timer = null;
    }
    function start() {
      stop();
      if (reducedMotion || paused || track.contains(document.activeElement) || track.scrollWidth <= track.clientWidth + 2) return;
      timer = window.setInterval(function () { move(1); }, 5200);
    }
    function move(direction) {
      var card = track.querySelector('.cat');
      var gap = parseFloat(window.getComputedStyle(track).gap) || 14;
      var step = card ? (card.getBoundingClientRect().width + gap) * 2 : track.clientWidth * .72;
      var max = Math.max(0, track.scrollWidth - track.clientWidth);
      var behavior = reducedMotion ? 'auto' : 'smooth';
      if (direction > 0 && track.scrollLeft >= max - 8) {
        track.scrollTo({ left: 0, behavior: behavior });
      } else if (direction < 0 && track.scrollLeft <= 8) {
        track.scrollTo({ left: max, behavior: behavior });
      } else {
        track.scrollBy({ left: direction * step, behavior: behavior });
      }
    }
    function updateControls() {
      var disabled = track.scrollWidth <= track.clientWidth + 2;
      previous.disabled = disabled;
      next.disabled = disabled;
    }
    previous.addEventListener('click', function () { move(-1); paused = false; start(); });
    next.addEventListener('click', function () { move(1); paused = false; start(); });
    track.addEventListener('mouseenter', function () { paused = true; stop(); });
    track.addEventListener('mouseleave', function () { paused = false; start(); });
    track.addEventListener('focusin', function () { paused = true; stop(); });
    track.addEventListener('focusout', function (event) {
      if (!track.contains(event.relatedTarget)) { paused = false; start(); }
    });
    track.addEventListener('pointerdown', function () { paused = true; stop(); }, { passive: true });
    track.addEventListener('pointerup', function () {
      paused = false;
      window.setTimeout(start, 2200);
    }, { passive: true });
    track.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
    });
    window.addEventListener('resize', updateControls, { passive: true });
    updateControls();
    start();
  }

  function filterTo(filter) {
    var category = Array.prototype.find.call(document.querySelectorAll('.cat'), function (element) {
      return element.dataset.filter === filter;
    });
    if (category) category.click();
  }

  function buildHeroSlider() {
    var shell = document.querySelector('.hero-shell');
    if (!shell || shell.querySelector('.z88-hero-slider')) return;
    var oldLayout = shell.querySelector('.hero-layout');
    var slideData = [
      { image: 'assets/hero-fashion.png', label: 'Fashion Refined', filter: 'Clothing', alt: 'Fashion collection with folded knitwear, coat, denim, beanie and sneakers' },
      { image: 'assets/hero-body-care.png', label: 'Body Care Elevated', filter: 'HOUSEHOLD', alt: 'Body care collection with lotion, body wash, scrub, candle and hand cream' },
      { image: 'assets/hero-accessories.png', label: 'Accessories Curated', filter: 'HANDBAG/PURSES', alt: 'Accessories collection with handbag, sunglasses, watch, wallet and jewelry' },
      { image: 'assets/hero-toys.png', label: 'Playful Toys', filter: 'TOYS', alt: 'Playful toys collection with teddy bear, stacking rings, blocks and wooden car' }
    ];
    var slider = document.createElement('div');
    slider.className = 'z88-hero-slider';
    slider.tabIndex = 0;
    slider.setAttribute('role', 'region');
    slider.setAttribute('aria-roledescription', 'carousel');
    slider.setAttribute('aria-label', 'Featured Zander88LLC collections');

    var slides = [];
    slideData.forEach(function (item, index) {
      var slide = document.createElement('figure');
      slide.className = 'z88-slide' + (index === 0 ? ' is-active' : '');
      slide.dataset.filter = item.filter;
      slide.setAttribute('aria-roledescription', 'slide');
      slide.setAttribute('aria-label', (index + 1) + ' of ' + slideData.length + ': ' + item.label);
      slide.setAttribute('aria-hidden', index === 0 ? 'false' : 'true');
      var image = document.createElement('img');
      image.src = item.image;
      image.alt = item.alt;
      image.decoding = 'async';
      image.loading = index === 0 ? 'eager' : 'lazy';
      if (index === 0) image.fetchPriority = 'high';
      var hit = document.createElement('button');
      hit.type = 'button';
      hit.className = 'z88-slide-hit';
      hit.tabIndex = index === 0 ? 0 : -1;
      hit.setAttribute('aria-label', 'Shop ' + item.label);
      hit.addEventListener('click', function () { filterTo(item.filter); });
      slide.appendChild(image);
      slide.appendChild(hit);
      slider.appendChild(slide);
      slides.push(slide);
    });

    var bar = document.createElement('div');
    bar.className = 'z88-slider-bar';
    var previous = makeButton('z88-slider-control', 'Previous collection', '‹');
    var next = makeButton('z88-slider-control', 'Next collection', '›');
    bar.appendChild(previous);
    bar.appendChild(next);
    slider.appendChild(bar);

    var activeIndex = 0;
    var timer;
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function setActive(index) {
      activeIndex = (index + slideData.length) % slideData.length;
      slides.forEach(function (slide, slideIndex) {
        var active = slideIndex === activeIndex;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', active ? 'false' : 'true');
        var hit = slide.querySelector('.z88-slide-hit');
        if (hit) hit.tabIndex = active ? 0 : -1;
      });
    }
    function stop() {
      window.clearInterval(timer);
      timer = null;
    }
    function start() {
      stop();
      if (reducedMotion || document.hidden) return;
      timer = window.setInterval(function () { setActive(activeIndex + 1); }, 4500);
    }
    function userGo(index) {
      setActive(index);
      stop();
      window.setTimeout(start, 4500);
    }
    previous.addEventListener('click', function () { userGo(activeIndex - 1); });
    next.addEventListener('click', function () { userGo(activeIndex + 1); });
    slider.addEventListener('focusin', stop);
    slider.addEventListener('focusout', function (event) {
      if (!slider.contains(event.relatedTarget)) start();
    });
    slider.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') { event.preventDefault(); userGo(activeIndex - 1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); userGo(activeIndex + 1); }
    });
    var pointerStart = null;
    slider.addEventListener('pointerdown', function (event) { pointerStart = event.clientX; }, { passive: true });
    slider.addEventListener('pointerup', function (event) {
      if (pointerStart === null) return;
      var distance = event.clientX - pointerStart;
      pointerStart = null;
      if (Math.abs(distance) > 42) userGo(distance < 0 ? activeIndex + 1 : activeIndex - 1);
    }, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });
    setActive(0);
    if (oldLayout) oldLayout.remove();
    var firstImage = shell.querySelector('.z88-hero-first');
    if (firstImage) firstImage.remove();
    shell.classList.add('z88-hero-ready');
    shell.appendChild(slider);
    start();
  }

  function initStore() {
    document.body.classList.add('z88-enhanced');
    setupScrollProgress();
    setupPointerGlow();
    rebuildHeader();
    buildHeroSlider();
    setupCategoryCarousel();
    setupSearchAndFilter();
    setupTilt();
    setupRipples();
    setupToast();
  }

  function initCheckout() {
    document.body.classList.add('z88-checkout-enhanced');
    setupScrollProgress();
    setupRipples();
    var progress = document.querySelector('.progress-rail');
    if (progress) progress.remove();
    var form = document.getElementById('checkoutForm');
    if (!form) return;
    form.classList.add('z88-single-checkout');
    form.setAttribute('aria-label', 'Complete your Zander88LLC order');
    if (!form.querySelector('.z88-checkout-heading')) {
      var heading = document.createElement('div');
      heading.className = 'z88-checkout-heading';
      heading.innerHTML = '<span>Checkout</span><h2>Complete your order</h2><p>Enter your details, delivery address, and payment method in one continuous checkout.</p>';
      form.insertBefore(heading, form.firstElementChild);
    }
    var pageDescription = document.querySelector('.page-heading p');
    if (pageDescription) pageDescription.textContent = 'Enter your details and choose a payment method to place your order.';
    var headerLogo = document.querySelector('.header-logo');
    var footerLogo = document.querySelector('.footer-logo');
    if (headerLogo) headerLogo.classList.add('z88-clear-logo');
    if (footerLogo) footerLogo.classList.add('z88-clear-logo');
  }

  ready(function () {
    if (document.getElementById('checkoutForm')) {
      initCheckout();
    } else {
      initStore();
    }
  });
}());
