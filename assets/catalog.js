/* Render the sourced catalog before the existing storefront binds filters/cart. */
(function () {
  'use strict';
  try {
    var live = JSON.parse(localStorage.getItem('zander88CatalogLive') || 'null');
    if (Array.isArray(live) && live.length) window.ZanderCatalog = live;
  } catch (error) { /* Storage can be unavailable in private browsing. */ }

  var grid = document.querySelector('.product-grid');
  var catalog = window.ZanderCatalog;
  if (!grid || !Array.isArray(catalog) || !catalog.length) return;

  var fragment = document.createDocumentFragment();
  catalog.forEach(function (product) {
    var article = document.createElement('article');
    article.className = 'product-card';
    article.dataset.cat = product.cat;
    article.dataset.cats = Array.isArray(product.cats) ? product.cats.join('|') : String(product.cat || '');
    article.dataset.name = product.name.toLowerCase();
    article.dataset.catalogId = String(product.id);

    var media = document.createElement('div');
    media.className = 'product-media';
    var tag = document.createElement('span');
    tag.className = 'product-tag';
    tag.textContent = product.stock ? product.cat : 'Out of stock';
    var image = document.createElement('img');
    image.src = product.image;
    image.alt = product.name;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    var detailHref = 'product.html?id=' + product.id;
    var mediaLink = document.createElement('a');
    mediaLink.className = 'product-detail-link';
    mediaLink.href = detailHref;
    mediaLink.setAttribute('aria-label', 'View ' + product.name);
    mediaLink.appendChild(image);
    media.append(tag, mediaLink);

    var copy = document.createElement('div');
    copy.className = 'product-copy';
    var category = document.createElement('div');
    category.className = 'eyebrow';
    category.textContent = product.cat;
    var title = document.createElement('h3');
    var titleLink = document.createElement('a');
    titleLink.className = 'product-title-link';
    titleLink.href = detailHref;
    titleLink.textContent = product.name;
    title.appendChild(titleLink);
    var row = document.createElement('div');
    row.className = 'product-row';
    var price = document.createElement('strong');
    price.textContent = product.price === null ? 'Out of stock' : '$' + product.price.toFixed(2);
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'add-btn';
    button.dataset.id = String(product.id);
    button.textContent = product.stock ? 'Add to Cart' : 'Unavailable';
    button.disabled = !product.stock;
    row.append(price, button);
    copy.append(category, title, row);
    article.append(media, copy);
    fragment.appendChild(article);
  });
  grid.replaceChildren(fragment);

  /* Retain existing cart quantities while correcting formerly saved product prices. */
  try {
    var oldCart = JSON.parse(localStorage.getItem('zander88Cart') || '[]');
    if (Array.isArray(oldCart)) {
      var byName = new Map(catalog.map(function (item) {
        return [item.name.trim().toLowerCase(), item];
      }));
      var byId = new Map(catalog.map(function (item) { return [item.id, item]; }));
      var changed = false;
      oldCart.forEach(function (item) {
        var current = byId.get(Number(item.id)) || byName.get(String(item.name || '').trim().toLowerCase());
        if (!current || !current.stock) return;
        if (item.id === current.id && item.name === current.name && item.price === current.price && item.img === current.image && item.cat === current.cat) return;
        item.id = current.id;
        item.name = current.name;
        item.price = current.price;
        item.img = current.image;
        item.cat = current.cat;
        changed = true;
      });
      if (changed) localStorage.setItem('zander88Cart', JSON.stringify(oldCart));
    }
  } catch (error) { /* Storage can be unavailable in private browsing. */ }

  function hasFilter(name) {
    var nodes = document.querySelectorAll('[data-filter]');
    for (var i = 0; i < nodes.length; i += 1) {
      if (nodes[i].getAttribute('data-filter') === name) return true;
    }
    return false;
  }

  function ensureStoreCategories(list, extraCategories) {
    var records = [];
    var seen = {};
    function add(item) {
      var rec = null;
      if (typeof item === 'string') rec = { name: item, image: '' };
      else if (item && item.name) rec = { name: String(item.name), image: String(item.image || '') };
      else if (item && item.cat) rec = { name: String(item.cat), image: '' };
      var name = rec && rec.name ? rec.name.trim() : '';
      if (!name) return;
      if (seen[name]) {
        if (rec.image && !seen[name].image) seen[name].image = rec.image;
        return;
      }
      seen[name] = rec;
      records.push(rec);
    }
    (list || []).forEach(function (item) {
      if (item && item.cat) add(item.cat);
    });
    (extraCategories || []).forEach(add);
    try {
      var extra = JSON.parse(localStorage.getItem('zander88Categories') || 'null');
      if (Array.isArray(extra)) extra.forEach(add);
    } catch (error) {}
    var grid = document.querySelector('.cat-grid');
    var row = document.querySelector('.dept-row');
    var sampleCat = document.querySelector('.cat');
    var sampleChip = document.querySelector('.dept-chip:not(.active)');
    records.forEach(function (rec) {
      if (hasFilter(rec.name)) return;
      if (grid && sampleCat) {
        var button = sampleCat.cloneNode(true);
        button.classList.remove('selected');
        button.setAttribute('data-filter', rec.name);
        var label = button.querySelector('.cat-name');
        if (label) label.textContent = rec.name;
        var photo = button.querySelector('.cat-photo');
        if (photo && rec.image) {
          photo.src = rec.image;
          photo.removeAttribute('srcset');
        }
        if (rec.image) button.style.setProperty('--cat-image', 'url("' + String(rec.image).replace(/"/g, '\\"') + '")');
        grid.appendChild(button);
      }
      if (row && sampleChip) {
        var chip = sampleChip.cloneNode(true);
        chip.className = 'dept-chip';
        chip.setAttribute('data-filter', rec.name);
        chip.textContent = rec.name;
        row.appendChild(chip);
      }
    });
  }

  ensureStoreCategories(catalog);
  window.z88VisibleLimit = 24;
  var more = document.getElementById('catalogMore');
  if (more) {
    more.addEventListener('click', function () {
      window.z88VisibleLimit += 24;
      var select = document.getElementById('categorySelect');
      if (select && typeof select.onchange === 'function') select.onchange();
    });
  }

  fetch('/api/catalog', { cache: 'no-store' }).then(function (res) {
    return res.ok ? res.json() : null;
  }).then(function (data) {
    if (!data || !Array.isArray(data.products) || !data.products.length) return;
    try { localStorage.setItem('zander88CatalogLive', JSON.stringify(data.products)); } catch (error) {}
    if (Array.isArray(data.categories)) {
      try { localStorage.setItem('zander88Categories', JSON.stringify(data.categories)); } catch (error) {}
    }
    window.ZanderCatalog = data.products;
    ensureStoreCategories(data.products, data.categories);
  }).catch(function () { /* Keep the bundled catalog if the live API is offline. */ });
}());
