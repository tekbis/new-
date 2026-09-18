(function () {
  'use strict';

  var config = window.ZANDER_PAGE || {};
  var product = config.product || {};
  var cartKey = 'zander88Cart';
  var wishlistKey = 'zander88Wishlist';
  var cart = readList(cartKey);
  var wishlist = readList(wishlistKey);
  var toastTimer;

  function text(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function hydratePage() {
    if (!product.id) return;
    document.title = config.pageTitle || (product.name + ' | Zander88LLC');
    var descriptionMeta = document.querySelector('meta[name="description"]');
    if (descriptionMeta) descriptionMeta.content = 'Shop ' + product.name + ' from Zander88LLC for ' + money(product.price) + '.';

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
      if (main.getAttribute('src') !== product.images[0].src) {
        main.src = product.images[0].src;
      }
      main.alt = product.images[0].alt;
      main.width = 1000;
      main.height = 1000;
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
        thumb.src = image.src;
        thumb.alt = '';
        thumb.width = 250;
        thumb.height = 250;
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

  function addToCart(item, amount, openAfter) {
    if (!item || item.stock === false || item.price == null) {
      showToast('This product is currently unavailable.');
      return;
    }
    var id = Number(item.id);
    var existing = cart.find(function (entry) { return Number(entry.id) === id; });
    if (existing) {
      existing.qty = Number(existing.qty || 0) + amount;
      existing.name = item.name;
      existing.price = Number(item.price);
      existing.img = item.image || item.img;
      existing.cat = item.category || item.cat;
    } else {
      cart.push({
        id: id,
        name: item.name,
        price: Number(item.price),
        qty: amount,
        img: item.image || item.img,
        cat: item.category || item.cat
      });
    }
    saveList(cartKey, cart);
    updateCartBadges();
    renderCart();
    showToast(item.name + ' added to your cart.');
    if (openAfter) openDrawer();
  }

  function removeFromCart(id) {
    cart = cart.filter(function (entry) { return Number(entry.id) !== Number(id); });
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
      cart.forEach(function (item) {
        var row = document.createElement('article');
        row.className = 'drawer-item';

        var image = document.createElement('img');
        image.src = item.img || 'assets/images/product-placeholder.svg';
        image.alt = '';
        image.loading = 'lazy';

        var copy = document.createElement('div');
        var title = document.createElement('h3');
        title.textContent = item.name;
        var detail = document.createElement('p');
        detail.textContent = Number(item.qty || 0) + ' × ' + money(item.price);
        copy.append(title, detail);

        var remove = document.createElement('button');
        remove.className = 'remove-item';
        remove.type = 'button';
        remove.setAttribute('aria-label', 'Remove ' + item.name);
        remove.textContent = '×';
        remove.addEventListener('click', function () { removeFromCart(item.id); });

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
          main.src = button.dataset.galleryImage;
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
      image.src = item.image;
      image.alt = item.name;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.referrerPolicy = 'no-referrer';
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

  document.querySelectorAll('[data-add-main]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (!product.stock) return;
      addToCart(product, currentQuantity(), false);
      var message = document.getElementById('purchaseMessage');
      if (message) message.textContent = currentQuantity() + (currentQuantity() === 1 ? ' item added' : ' items added') + ' to your cart.';
    });
  });
  document.querySelectorAll('[data-buy-main]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (!product.stock) return;
      addToCart(product, currentQuantity(), true);
    });
  });

  var checkout = document.getElementById('checkoutPreview');
  if (checkout) checkout.addEventListener('click', function () {
    window.location.href = 'checkout.html';
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
