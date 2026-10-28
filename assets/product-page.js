(function () {
  'use strict';

  var config = window.ZANDER_PAGE || {};
  var product = config.product || {};
  var cartKey = 'zander88Cart';
  var wishlistKey = 'zander88Wishlist';
  var cart = readList(cartKey);
  var wishlist = readList(wishlistKey);
  var toastTimer;
  var selectedSize = '';
  var productSizes = Array.isArray(product.sizes) ? product.sizes : [];
  var soldOutSizes = Array.isArray(product.soldOutSizes) ? product.soldOutSizes : [];
  var sizePrices = product.sizePrices || {};

  function priceForSize(size) {
    var special = size ? sizePrices[size] : null;
    return special != null && isFinite(Number(special)) ? Number(special) : product.price;
  }

  function cleanWixUrl(value, size) {
    var s = String(value || '').trim();
    var dim = size || 800;
    if (/^\/\//.test(s)) s = 'https:' + s;
    if (!/static\.wixstatic\.com/i.test(s)) return s;
    var base = s.match(/^(https?:\/\/static\.wixstatic\.com\/media\/[^/?#]+)/i);
    if (base) {
      var file = base[1];
      var name = file.split('/').pop();
      return file + '/v1/fill/w_' + dim + ',h_' + dim + ',al_c,q_85/' + name;
    }
    return s.replace(/,enc_avif(?:,quality_auto)?/gi, '').replace(/w_\d+,h_\d+/g, 'w_' + dim + ',h_' + dim);
  }

  function proxyMediaUrl(value, size) {
    var direct = cleanWixUrl(value, size);
    if (!/static\.wixstatic\.com/i.test(direct)) return direct;
    var dim = size || 800;
    return 'https://wsrv.nl/?url=' + encodeURIComponent(direct) + '&w=' + dim + '&h=' + dim + '&fit=contain';
  }

  function safeMediaUrl(value) {
    var src = String(value || '').trim();
    if (/^\/\//.test(src)) src = 'https:' + src;
    if (/^https?:\/\/(wsrv\.nl|images\.weserv\.nl)\//i.test(src)) return src;
    if (/^assets\//i.test(src) && !/[\s<>'"\\]/.test(src) && src.indexOf('..') === -1) return src;
    if (/static\.wixstatic\.com/i.test(src)) return proxyMediaUrl(src, 800);
    if (/^https?:\/\//i.test(src) && !/[\s<>'"\\]/.test(src) && src.indexOf('..') === -1) return src;
    return 'assets/images/product-placeholder.svg';
  }

  // Prefer the image proxy first so we do not wait on a slow Wix DNS timeout.
  // If the proxy fails (some mobile networks), fall back to direct Wix, then placeholder.
  function bindProductImage(el, rawSrc, size) {
    if (!el) return;
    var src = String(rawSrc || '').trim();
    var dim = size || 720;
    if (!src) {
      el.src = 'assets/images/product-placeholder.svg';
      return;
    }
    if (/^assets\//i.test(src)) {
      el.referrerPolicy = 'no-referrer';
      el.decoding = 'async';
      el.src = src;
      return;
    }
    if (/^https?:\/\/(wsrv\.nl|images\.weserv\.nl)\//i.test(src)) {
      el.referrerPolicy = 'no-referrer';
      el.decoding = 'async';
      el.src = src;
      return;
    }
    var direct = cleanWixUrl(src, dim);
    var proxied = proxyMediaUrl(src, dim);
    var stage = 0;
    el.referrerPolicy = 'no-referrer';
    el.decoding = 'async';
    el.onerror = function () {
      stage += 1;
      if (stage === 1 && direct && el.src !== direct) {
        el.src = direct;
        return;
      }
      el.onerror = null;
      el.src = 'assets/images/product-placeholder.svg';
    };
    el.src = /static\.wixstatic\.com/i.test(src) ? proxied : safeMediaUrl(src);
  }

  function preloadMainImage(src) {
    if (!src || !document.head) return;
    var href = /^assets\//i.test(src) ? src : proxyMediaUrl(src, 720);
    if (!href || href.indexOf('placeholder') !== -1) return;
    if (document.querySelector('link[data-z88-preload="main"]')) return;
    var link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = href;
    link.setAttribute('fetchpriority', 'high');
    link.setAttribute('data-z88-preload', 'main');
    document.head.appendChild(link);
  }

  function text(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function hydratePage() {
    if (!product.id) return;
    document.title = config.pageTitle || (product.name + ' | Zander88LLC');
    var descriptionMeta = document.querySelector('meta[name="description"]');
    var shareDesc = 'Shop ' + product.name + ' from Zander88LLC for ' + money(product.price) + '.';
    if (descriptionMeta) descriptionMeta.content = shareDesc;

    var shareUrl = 'https://www.zander88llc.net/product.html?id=' + product.id;
    var shareImage = (product.images && product.images[0] && product.images[0].src) || product.image || '';
    if (/^https?:\/\//i.test(shareImage)) {
      shareImage = shareImage.replace(/w_\d+,h_\d+/g, 'w_1200,h_1200').replace(/,enc_avif/g, '');
    } else if (/^assets\//i.test(shareImage)) {
      shareImage = 'https://www.zander88llc.net/' + shareImage.replace(/^\/+/, '');
    } else {
      shareImage = 'https://www.zander88llc.net/og.jpg?v=3';
    }
    function setShare(key, content, isName) {
      var attr = isName ? 'name' : 'property';
      var node = document.querySelector('meta[' + attr + '="' + key + '"]');
      if (!node) {
        node = document.createElement('meta');
        node.setAttribute(attr, key);
        document.head.appendChild(node);
      }
      node.setAttribute('content', content);
    }
    setShare('og:title', document.title);
    setShare('og:description', shareDesc);
    setShare('og:url', shareUrl);
    setShare('og:image', shareImage);
    setShare('og:image:secure_url', shareImage);
    setShare('twitter:title', document.title, true);
    setShare('twitter:description', shareDesc, true);
    setShare('twitter:image', shareImage, true);
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', shareUrl);
    var imageSrc = document.querySelector('link[rel="image_src"]');
    if (imageSrc) imageSrc.setAttribute('href', shareImage);

    text('breadcrumbCategory', product.category);
    text('breadcrumbName', product.shortName || product.name);
    text('imageBadge', product.collection);
    text('productCategory', product.category);
    text('productTitle', product.name);
    text('ratingValue', product.rating);
    text('reviewCount', product.reviews + ' reviews');
    text('productSku', product.itemCode);
    text('productPrice', product.price == null ? 'Out of stock' : money(product.price));
    text('installmentAmount', product.price == null ? '$0.00' : money(Number(product.price) / 4));
    var stockNode = document.querySelector('.status-item .in-stock');
    if (stockNode) stockNode.textContent = product.stock ? '● In stock' : '● Out of stock';
    document.querySelectorAll('[data-add-main], [data-buy-main]').forEach(function (button) {
      button.disabled = !product.stock;
      if (!product.stock) button.textContent = 'Unavailable';
    });
    text('productIntro', product.intro);
    text('descriptionCopy', product.description);
    text('reviewScore', product.rating);
    text('reviewSentence', 'Based on ' + product.reviews + ' product reviews in this design preview.');
    text('trendingTitle', config.trendingTitle || 'Trending products');

    var main = document.getElementById('mainImage');
    if (main && product.images && product.images.length) {
      main.alt = product.images[0].alt || product.name || '';
      main.width = 720;
      main.height = 720;
      main.fetchPriority = 'high';
      preloadMainImage(product.images[0].src);
      bindProductImage(main, product.images[0].src, 720);
    }

    var thumbnails = document.getElementById('thumbnailRow');
    if (thumbnails) {
      thumbnails.innerHTML = '';
      (product.images || []).forEach(function (image, index) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'thumbnail' + (index === 0 ? ' is-active' : '');
        button.dataset.galleryImage = image.src;
        button.dataset.galleryAlt = image.alt;
        button.setAttribute('aria-pressed', String(index === 0));
        button.setAttribute('aria-label', 'Show image ' + (index + 1) + ' of ' + product.name);
        var thumb = document.createElement('img');
        thumb.alt = '';
        thumb.width = 240;
        thumb.height = 240;
        thumb.loading = index === 0 ? 'eager' : 'lazy';
        bindProductImage(thumb, image.src, 240);
        button.appendChild(thumb);
        thumbnails.appendChild(button);
      });
    }

    var highlights = document.getElementById('productHighlights');
    if (highlights) {
      highlights.innerHTML = '';
      (product.highlights || []).forEach(function (highlight) {
        var item = document.createElement('li');
        item.textContent = highlight;
        highlights.appendChild(item);
      });
    }

    var specs = document.getElementById('specGrid');
    if (specs) {
      specs.innerHTML = '';
      (product.specs || []).forEach(function (pair) {
        var row = document.createElement('div');
        var term = document.createElement('dt');
        var definition = document.createElement('dd');
        term.textContent = pair[0];
        definition.textContent = pair[1];
        row.append(term, definition);
        specs.appendChild(row);
      });
    }
  }

  function readList(key) {
    try {
      var value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function saveList(key, list) {
    try { localStorage.setItem(key, JSON.stringify(list)); } catch (error) {}
  }

  function money(value) {
    return '$' + Number(value || 0).toFixed(2);
  }

  function clampQuantity(value) {
    return Math.max(1, Math.min(20, Number(value) || 1));
  }

  function showToast(message) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toast.classList.remove('is-visible'); }, 2200);
  }

  function cartCount() {
    return cart.reduce(function (total, item) { return total + Number(item.qty || 0); }, 0);
  }

  function cartSubtotal() {
    return cart.reduce(function (total, item) { return total + Number(item.price || 0) * Number(item.qty || 0); }, 0);
  }

  function updateCartBadges() {
    document.querySelectorAll('[data-cart-count]').forEach(function (node) {
      node.textContent = String(cartCount());
    });
  }

  function addToCart(item, amount, openAfter, size) {
    if (!item || item.stock === false || item.price == null) {
      showToast('This product is currently unavailable.');
      return;
    }
    var id = Number(item.id);
    var lineSize = size ? String(size) : '';
    var linePrice = lineSize && item === product ? priceForSize(lineSize) : Number(item.price);
    var existing = cart.find(function (entry) { return Number(entry.id) === id && String(entry.size || '') === lineSize; });
    if (existing) {
      existing.qty = Math.min(20, Number(existing.qty || 0) + amount);
      existing.name = item.name;
      existing.price = Number(linePrice);
      existing.img = item.image || item.img;
      existing.cat = item.category || item.cat;
    } else {
      var line = {
        id: id,
        name: item.name,
        price: Number(linePrice),
        qty: amount,
        img: item.image || item.img,
        cat: item.category || item.cat
      };
      if (lineSize) line.size = lineSize;
      cart.push(line);
    }
    saveList(cartKey, cart);
    updateCartBadges();
    renderCart();
    showToast(item.name + (lineSize ? ' (Size ' + lineSize + ')' : '') + ' added to your cart.');
    if (openAfter) openDrawer();
  }

  function removeFromCart(index) {
    cart = cart.filter(function (entry, at) { return at !== index; });
    saveList(cartKey, cart);
    updateCartBadges();
    renderCart();
  }

  function renderCart() {
    var items = document.getElementById('drawerItems');
    var subtotal = document.getElementById('drawerSubtotal');
    if (!items || !subtotal) return;
    items.innerHTML = '';
    if (!cart.length) {
      items.innerHTML = '<p class="drawer-empty">Your cart is waiting for a great find.</p>';
    } else {
      cart.forEach(function (item, index) {
        var row = document.createElement('article');
        row.className = 'drawer-item';

        var image = document.createElement('img');
        image.src = safeMediaUrl(item.img || 'assets/images/product-placeholder.svg');
        image.alt = '';
        image.loading = 'lazy';

        var copy = document.createElement('div');
        var title = document.createElement('h3');
        title.textContent = item.name;
        var detail = document.createElement('p');
        detail.textContent = Number(item.qty || 0) + ' × ' + money(item.price);
        copy.appendChild(title);
        if (item.size) {
          var sizeLine = document.createElement('p');
          sizeLine.className = 'item-size';
          sizeLine.textContent = 'Size: ' + item.size;
          copy.appendChild(sizeLine);
        }
        copy.appendChild(detail);

        var remove = document.createElement('button');
        remove.className = 'remove-item';
        remove.type = 'button';
        remove.setAttribute('aria-label', 'Remove ' + item.name + (item.size ? ' size ' + item.size : ''));
        remove.textContent = '×';
        remove.addEventListener('click', function () { removeFromCart(index); });

        row.append(image, copy, remove);
        items.appendChild(row);
      });
    }
    subtotal.textContent = money(cartSubtotal());
  }

  function openDrawer() {
    document.body.classList.add('drawer-open');
    document.getElementById('cartDrawer').classList.add('is-open');
    document.getElementById('drawerBackdrop').classList.add('is-open');
    document.getElementById('cartDrawer').setAttribute('aria-hidden', 'false');
  }

  function closeDrawer() {
    document.body.classList.remove('drawer-open');
    document.getElementById('cartDrawer').classList.remove('is-open');
    document.getElementById('drawerBackdrop').classList.remove('is-open');
    document.getElementById('cartDrawer').setAttribute('aria-hidden', 'true');
  }

  function currentQuantity() {
    var input = document.getElementById('quantity');
    var amount = clampQuantity(input.value);
    input.value = String(amount);
    return amount;
  }

  function setupGallery() {
    var main = document.getElementById('mainImage');
    if (!main) return;
    document.querySelectorAll('[data-gallery-image]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (button.classList.contains('is-active')) return;
        main.classList.add('is-switching');
        document.querySelectorAll('[data-gallery-image]').forEach(function (item) {
          var active = item === button;
          item.classList.toggle('is-active', active);
          item.setAttribute('aria-pressed', String(active));
        });
        window.setTimeout(function () {
          bindProductImage(main, button.dataset.galleryImage || product.image, 720);
          main.alt = button.dataset.galleryAlt || product.name;
          main.classList.remove('is-switching');
        }, 100);
      });
    });
  }

  function setupWishlist() {
    var button = document.getElementById('wishlistButton');
    if (!button) return;
    var id = Number(product.id);
    function paint() {
      var active = wishlist.some(function (item) { return Number(item) === id; });
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', (active ? 'Remove ' : 'Add ') + product.name + (active ? ' from' : ' to') + ' wishlist');
    }
    paint();
    button.addEventListener('click', function () {
      if (wishlist.some(function (item) { return Number(item) === id; })) {
        wishlist = wishlist.filter(function (item) { return Number(item) !== id; });
        showToast('Removed from your wishlist.');
      } else {
        wishlist.push(id);
        showToast('Saved to your wishlist.');
      }
      saveList(wishlistKey, wishlist);
      paint();
    });
  }

  function setupTabs() {
    var buttons = Array.from(document.querySelectorAll('[role="tab"]'));
    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        buttons.forEach(function (item) {
          var active = item === button;
          item.classList.toggle('is-active', active);
          item.setAttribute('aria-selected', String(active));
          var panel = document.getElementById(item.getAttribute('aria-controls'));
          if (panel) panel.classList.toggle('is-active', active);
        });
      });
    });
  }

  function renderTrending() {
    var slider = document.getElementById('productSlider');
    if (!slider) return;
    (config.trending || []).forEach(function (item) {
      var card = document.createElement('article');
      card.className = 'trending-card';

      var media = document.createElement('div');
      media.className = 'trending-media';
      var image = document.createElement('img');
      image.alt = item.name;
      image.loading = 'lazy';
      image.decoding = 'async';
      bindProductImage(image, item.image, 400);
      var badge = document.createElement('span');
      badge.className = 'card-badge';
      badge.textContent = 'Trending';
      var add = document.createElement('button');
      add.type = 'button';
      add.className = 'quick-add';
      add.setAttribute('aria-label', 'Add ' + item.name + ' to cart');
      add.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h2l2.2 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L20 7H6"/><path d="M12 9v6M9 12h6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>';
      add.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (item.hasSizes && item.page) {
          window.location.href = item.page;
          return;
        }
        addToCart(item, 1, false);
      });
      if (item.page) {
        var mediaLink = document.createElement('a');
        mediaLink.href = item.page;
        mediaLink.setAttribute('aria-label', 'View ' + item.name);
        mediaLink.appendChild(image);
        media.append(mediaLink, badge, add);
      } else {
        media.append(image, badge, add);
      }

      var copy = document.createElement('div');
      copy.className = 'trending-copy';
      var category = document.createElement('span');
      category.className = 'trending-category';
      category.textContent = item.category;
      var title = document.createElement('h3');
      if (item.page) {
        var link = document.createElement('a');
        link.href = item.page;
        link.textContent = item.name;
        title.appendChild(link);
      } else {
        title.textContent = item.name;
      }
      var price = document.createElement('strong');
      price.textContent = money(item.price);
      copy.append(category, title, price);
      card.append(media, copy);
      slider.appendChild(card);
    });
  }

  function setupSlider() {
    var slider = document.getElementById('productSlider');
    document.querySelectorAll('[data-slide]').forEach(function (button) {
      button.addEventListener('click', function () {
        slider.scrollBy({ left: Number(button.dataset.slide) * Math.min(580, slider.clientWidth * .82), behavior: 'smooth' });
      });
    });
  }

  function setupSearch() {
    var form = document.getElementById('siteSearch');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var q = String(document.getElementById('searchInput').value || '').toLowerCase().trim();
      if (!q) {
        showToast('Enter a product name to search.');
        return;
      }
      var catalog = Array.isArray(window.ZanderCatalog) ? window.ZanderCatalog : [];
      var exact = catalog.find(function (item) {
        return String(item.name || '').toLowerCase() === q;
      });
      var match = exact || catalog.find(function (item) {
        return String(item.name || '').toLowerCase().indexOf(q) !== -1;
      });
      if (match) window.location.href = 'product.html?id=' + match.id;
      else showToast('No matching product found.');
    });
  }

  function setupMenu() {
    var button = document.getElementById('menuToggle');
    var menu = document.getElementById('mobileMenu');
    if (!button || !menu) return;
    button.addEventListener('click', function () {
      var open = menu.classList.toggle('is-open');
      button.setAttribute('aria-expanded', String(open));
    });
  }

  hydratePage();

  document.querySelectorAll('[data-cart-open]').forEach(function (button) { button.addEventListener('click', openDrawer); });
  document.querySelectorAll('[data-cart-close]').forEach(function (button) { button.addEventListener('click', closeDrawer); });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape') closeDrawer(); });

  document.querySelectorAll('[data-qty]').forEach(function (button) {
    button.addEventListener('click', function () {
      var input = document.getElementById('quantity');
      input.value = String(clampQuantity(currentQuantity() + Number(button.dataset.qty)));
    });
  });
  var quantityInput = document.getElementById('quantity');
  if (quantityInput) quantityInput.addEventListener('change', currentQuantity);

  function showSizePrice() {
    var price = priceForSize(selectedSize);
    text('productPrice', price == null ? 'Out of stock' : money(price));
    text('installmentAmount', price == null ? '$0.00' : money(Number(price) / 4));
  }

  function setSizeError(message) {
    var picker = document.getElementById('sizePicker');
    var error = document.getElementById('sizeError');
    if (error) error.textContent = message || '';
    if (picker) picker.classList.toggle('has-error', Boolean(message));
  }

  function setupSizes() {
    var picker = document.getElementById('sizePicker');
    var options = document.getElementById('sizeOptions');
    if (!picker || !options || !productSizes.length) return;
    picker.hidden = false;
    options.innerHTML = '';
    options.setAttribute('role', 'radiogroup');
    var longest = productSizes.reduce(function (max, size) { return Math.max(max, String(size).length); }, 0);
    options.classList.toggle('is-compact', longest > 5);
    options.setAttribute('aria-label', 'Choose a size');
    productSizes.forEach(function (size) {
      var soldOut = soldOutSizes.indexOf(size) !== -1;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'size-option';
      button.textContent = size;
      if (String(size).length > 9) button.classList.add('is-long');
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', 'false');
      button.disabled = soldOut;
      if (soldOut) {
        button.title = 'Sold out';
        button.setAttribute('aria-label', size + ', sold out');
      }
      button.addEventListener('click', function () {
        selectedSize = size;
        options.querySelectorAll('.size-option').forEach(function (node) {
          var active = node === button;
          node.classList.toggle('is-selected', active);
          node.setAttribute('aria-checked', String(active));
        });
        var special = sizePrices[size];
        text('sizeSelected', 'Selected: ' + size + (special != null && Number(special) !== Number(product.price) ? ' · ' + money(special) : ''));
        setSizeError('');
        showSizePrice();
      });
      options.appendChild(button);
    });
    var available = productSizes.filter(function (size) { return soldOutSizes.indexOf(size) === -1; });
    if (available.length === 1) {
      var only = options.querySelector('.size-option:not(:disabled)');
      if (only) only.click();
    }
  }

  /* ---------- Size guide ---------- */
  // Measurements in inches as [min, max]; converted to cm on request.
  var GUIDES = {
    tops: {
      title: 'Clothing size guide', sub: 'Unisex and men\'s tops, hoodies and shirts. Measured on the body.',
      cols: ['Chest', 'Waist'],
      rows: { XS: [[31, 34], [26, 28]], S: [[34, 37], [28, 30]], M: [[38, 41], [31, 33]], L: [[42, 45], [34, 36]], XL: [[46, 49], [37, 40]], '2XL': [[50, 53], [41, 44]], '3XL': [[54, 57], [45, 48]], '4XL': [[58, 61], [49, 52]], '5XL': [[62, 65], [53, 56]], '6XL': [[66, 69], [57, 60]], '7XL': [[70, 73], [61, 64]] },
      tips: [['Chest', 'Measure around the fullest part of your chest, under the arms.'], ['Waist', 'Measure around your natural waistline, keeping the tape comfortably loose.']]
    },
    women: {
      title: 'Women\'s size guide', sub: 'Dresses, tops, leggings and sets. Measured on the body.',
      cols: ['Bust', 'Waist', 'Hips'],
      rows: { XXS: [[30, 31], [23, 24], [33, 34]], XS: [[32, 33], [25, 26], [35, 36]], S: [[34, 35], [27, 28], [37, 38]], M: [[36, 37], [29, 30], [39, 40]], L: [[38, 40], [31, 33], [41, 43]], XL: [[41, 43], [34, 36], [44, 46]], '2XL': [[44, 46], [37, 39], [47, 49]],
        '2': [[32, 33], [24, 25], [34, 35]], '3': [[33, 33], [25, 25], [35, 35]], '4': [[33, 34], [25, 26], [35, 36]], '5': [[34, 34], [26, 26], [36, 36]], '6': [[34, 35], [26, 27], [36, 37]], '7': [[35, 35], [27, 27], [37, 37]], '8': [[35, 36], [27, 28], [37, 38]] },
      tips: [['Bust', 'Measure around the fullest part of your bust.'], ['Waist', 'Measure around the narrowest part of your waist.'], ['Hips', 'Stand with feet together and measure around the fullest part of your hips.']]
    },
    waist: {
      title: 'Men\'s bottoms size guide', sub: 'Shorts and pants are sized by waist measurement.',
      cols: ['Waist', 'Hips'],
      rows: { '30': [[30, 30.5], [37, 38]], '31': [[31, 31.5], [38, 39]], '32': [[32, 32.5], [39, 40]], '33': [[33, 33.5], [40, 41]], '34': [[34, 34.5], [41, 42]], '36': [[36, 36.5], [43, 44]], '38': [[38, 38.5], [45, 46]] },
      tips: [['Waist', 'Measure around where you normally wear your pants, just above the hip bones.'], ['Hips', 'Measure around the fullest part of your seat.']]
    },
    shoes: {
      title: 'Shoe size guide', sub: 'Men\'s U.S. shoe sizes by foot length.',
      cols: ['Foot length', 'EU size'],
      rows: { '7.5': [[9.6, 9.6], 'eu:40.5'], '8': [[9.75, 9.75], 'eu:41'], '8.5': [[9.9, 9.9], 'eu:41.5'], '9': [[10.1, 10.1], 'eu:42'], '9.5': [[10.25, 10.25], 'eu:42.5'], '10': [[10.4, 10.4], 'eu:43'], '10.5': [[10.6, 10.6], 'eu:43.5'], '11': [[10.75, 10.75], 'eu:44'], '11.5': [[10.9, 10.9], 'eu:44.5'], '12': [[11.1, 11.1], 'eu:45'], '13': [[11.4, 11.4], 'eu:46'] },
      tips: [['Foot length', 'Stand on a sheet of paper, mark your heel and longest toe, and measure the distance. Measure both feet and use the longer one.']]
    },
    kidsShoes: {
      title: 'Kids\' shoe size guide', sub: 'U.S. kids\' sizes by foot length.',
      cols: ['Foot length', 'EU size'],
      rows: { 'KID 11.5': [[6.9, 6.9], 'eu:29'], 'KID 12': [[7.1, 7.1], 'eu:30'], 'KID 12.5': [[7.25, 7.25], 'eu:30.5'], 'KID 13': [[7.4, 7.4], 'eu:31'], 'KID 1.5': [[7.9, 7.9], 'eu:33'], 'KID 2': [[8.1, 8.1], 'eu:33.5'], 'KID 2.5': [[8.25, 8.25], 'eu:34'], 'KID 3': [[8.4, 8.4], 'eu:34.5'], 'KID 3.5': [[8.6, 8.6], 'eu:35'], 'KID 4': [[8.75, 8.75], 'eu:36'], 'KID 4.5': [[8.9, 8.9], 'eu:36.5'], 'KID 5': [[9.1, 9.1], 'eu:37'], 'KID 5.5': [[9.25, 9.25], 'eu:37.5'], 'KID 6': [[9.4, 9.4], 'eu:38'], 'KID 6.5': [[9.6, 9.6], 'eu:38.5'], 'KID 7': [[9.75, 9.75], 'eu:39'] },
      tips: [['Foot length', 'Have your child stand on paper with their heel against a wall. Mark the longest toe and measure. Add about 0.5 in (1.3 cm) for growing room.']]
    },
    baby: {
      title: 'Baby & toddler size guide', sub: 'Sizes by your child\'s weight and height.',
      cols: ['Weight (lb)', 'Height'],
      rows: { Newborn: ['w:5–8', [18, 21.5]], '0-3 months': ['w:8–12', [21.5, 24]], '3-6 months': ['w:12–16', [24, 26.5]], '6m': ['w:12–17', [24, 27]], '6-9 months': ['w:16–20', [26.5, 28.5]], '0-6 months': ['w:8–16', [21.5, 26.5]], '6-12 months': ['w:16–22', [26.5, 29.5]], '12m': ['w:17–22', [27, 29.5]], '12-18 months': ['w:22–27', [29.5, 31.5]], '18m': ['w:22–27', [29.5, 32]], '18mT': ['w:24–27', [30.5, 32.5]], '18-24 months': ['w:27–30', [31.5, 33.5]], '2T': ['w:29–32', [33.5, 35]], '3T': ['w:32–35', [35.5, 38]], '4T': ['w:35–39', [38.5, 41]], '5/6T': ['w:39–46', [41.5, 45]], 'Youth Small': ['w:46–56', [45, 50]], 'Youth Medium': ['w:56–70', [50, 54]] },
      tips: [['Height', 'Measure from the top of the head to the heels while your child stands or lies straight.'], ['Tip', 'If your child is between sizes, or growing fast, choose the larger size.']]
    },
    kids: {
      title: 'Kids\' size guide', sub: 'Sizes by your child\'s height and chest.',
      cols: ['Height', 'Chest'],
      rows: { '8 (Ages 7-8)': [[50, 52], [26, 27]], '10 (Ages 9-10)': [[53, 55], [27.5, 28.5]], '12 (Ages 11-12)': [[56, 58], [29, 30.5]], '14 (Ages 13-14)': [[59, 61], [31, 32.5]],
        'Tot 3/4': [[37, 41], [21, 22]], 'Youth 5/6': [[42, 47], [23, 24]], 'Youth 7/8': [[48, 52], [25, 26.5]], 'Youth 9/10': [[53, 55], [27, 28.5]], 'Youth 11/12': [[56, 58], [29, 30.5]], 'Youth 14/Adult XS': [[59, 62], [31, 33]],
        S: [[35, 41], [20, 22]], M: [[41, 47], [22, 24]], L: [[47, 52], [24, 26]] },
      tips: [['Height', 'Measure standing straight, without shoes, from head to heels.'], ['Chest', 'Measure around the fullest part of the chest, under the arms.']]
    }
  };

  function guideKey() {
    var cat = String(product.category || '').toLowerCase();
    var name = String(product.name || '').toLowerCase();
    var sizes = productSizes.map(function (s) { return String(s); });
    var has = function (re) { return sizes.some(function (s) { return re.test(s); }); };
    if (has(/^KID \d/)) return 'kidsShoes';
    if (/shoe/.test(cat) || /sneaker|shoe|boot|loafer|\bthe cooper\b/.test(name)) return 'shoes';
    if (has(/month|^newborn$|^\d+m$|^\d+mT$|^\d+T$|^5\/6T$/i)) return 'baby';
    if (has(/\(ages|^youth|^tot /i)) return 'kids';
    if (/kid|bab/.test(cat)) return 'kids';
    if (has(/waist$/i) || (/men/.test(cat) && !/women/.test(cat) && has(/^\d{2}$/))) return 'waist';
    if (/women/.test(cat)) return 'women';
    return 'tops';
  }

  function guideRowKey(size) {
    return String(size).replace(/\s*waist$/i, '').trim();
  }

  var guideUnit = 'in';
  function fmtMeasure(value) {
    if (typeof value === 'string') {
      if (value.indexOf('eu:') === 0) return value.slice(3);
      if (value.indexOf('w:') === 0) return value.slice(2);
      return value;
    }
    var precise = value[0] % 1 !== 0 && value[0] === value[1];
    var conv = function (n) { return guideUnit === 'cm' ? (precise ? Math.round(n * 25.4) / 10 : Math.round(n * 2.54)) : n; };
    var unit = guideUnit === 'cm' ? ' cm' : '"';
    var a = conv(value[0]), b = conv(value[1]);
    return (a === b ? String(a) : a + '–' + b) + unit;
  }

  function renderGuide() {
    var guide = GUIDES[guideKey()];
    var wrap = document.getElementById('sizeGuideTable');
    if (!guide || !wrap) return;
    text('sizeGuideTitle', guide.title);
    text('sizeGuideSub', guide.sub);
    var rows = productSizes.map(function (size) { return [size, guide.rows[guideRowKey(size)]]; });
    var known = rows.filter(function (row) { return row[1]; });
    var table = document.createElement('table');
    table.className = 'size-guide-table';
    var head = document.createElement('thead');
    var headRow = document.createElement('tr');
    ['Size'].concat(guide.cols).forEach(function (label) {
      var th = document.createElement('th');
      th.scope = 'col';
      th.textContent = label;
      headRow.appendChild(th);
    });
    head.appendChild(headRow);
    var body = document.createElement('tbody');
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      if (row[0] === selectedSize) tr.className = 'is-selected';
      var th = document.createElement('th');
      th.scope = 'row';
      th.textContent = row[0];
      tr.appendChild(th);
      guide.cols.forEach(function (col, i) {
        var td = document.createElement('td');
        td.textContent = row[1] ? fmtMeasure(row[1][i]) : '—';
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    table.append(head, body);
    wrap.replaceChildren(table);
    var tips = document.getElementById('sizeGuideTips');
    if (tips) {
      var list = document.createElement('dl');
      guide.tips.forEach(function (tip) {
        var dt = document.createElement('dt');
        var dd = document.createElement('dd');
        dt.textContent = tip[0];
        dd.textContent = tip[1];
        list.append(dt, dd);
      });
      var heading = document.createElement('h3');
      heading.textContent = 'How to measure';
      tips.replaceChildren(heading, list);
    }
  }

  function setupSizeGuide() {
    var dialog = document.getElementById('sizeGuide');
    var open = document.getElementById('sizeGuideOpen');
    var guide = GUIDES[guideKey()];
    var matches = guide ? productSizes.filter(function (size) { return guide.rows[guideRowKey(size)]; }).length : 0;
    // Only offer the guide when the chart covers this product's sizes.
    if (!dialog || !open || !productSizes.length || !matches) {
      if (open) open.hidden = true;
      return;
    }
    function close() {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      dialog.removeAttribute('open');
      document.body.classList.remove('guide-open');
      open.focus({ preventScroll: true });
    }
    open.addEventListener('click', function () {
      renderGuide();
      document.body.classList.add('guide-open');
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    });
    document.getElementById('sizeGuideClose').addEventListener('click', close);
    dialog.addEventListener('click', function (event) { if (event.target === dialog) close(); });
    dialog.addEventListener('close', function () { document.body.classList.remove('guide-open'); });
    dialog.querySelectorAll('[data-unit]').forEach(function (button) {
      button.addEventListener('click', function () {
        guideUnit = button.dataset.unit;
        dialog.querySelectorAll('[data-unit]').forEach(function (node) {
          var active = node === button;
          node.classList.toggle('is-active', active);
          node.setAttribute('aria-pressed', String(active));
        });
        renderGuide();
      });
    });
  }

  function requireSize() {
    if (!productSizes.length || selectedSize) return true;
    setSizeError('Please choose a size before adding to cart.');
    var picker = document.getElementById('sizePicker');
    var first = picker && picker.querySelector('.size-option:not(:disabled)');
    if (picker) picker.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (first) first.focus({ preventScroll: true });
    return false;
  }

  setupSizes();
  setupSizeGuide();

  document.querySelectorAll('[data-add-main]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (!product.stock) return;
      if (!requireSize()) return;
      addToCart(product, currentQuantity(), false, selectedSize);
      var message = document.getElementById('purchaseMessage');
      if (message) message.textContent = currentQuantity() + (currentQuantity() === 1 ? ' item added' : ' items added') + ' to your cart.';
    });
  });
  document.querySelectorAll('[data-buy-main]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (!product.stock) return;
      if (!requireSize()) return;
      addToCart(product, currentQuantity(), true, selectedSize);
    });
  });

  var checkout = document.getElementById('checkoutPreview');
  if (checkout) checkout.addEventListener('click', function () {
    window.location.href = '/checkout';
  });

  setupGallery();
  setupWishlist();
  setupTabs();
  renderTrending();
  setupSlider();
  setupSearch();
  setupMenu();
  renderCart();
  updateCartBadges();
}());
