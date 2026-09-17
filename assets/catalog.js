/* Render the sourced catalog before the existing storefront binds filters/cart. */
(function () {
  'use strict';
  var grid = document.querySelector('.product-grid');
  var catalog = window.ZanderCatalog;
  if (!grid || !Array.isArray(catalog) || !catalog.length) return;

  var fragment = document.createDocumentFragment();
  catalog.forEach(function (product) {
    var article = document.createElement('article');
    article.className = 'product-card';
    article.dataset.cat = product.cat;
    article.dataset.cats = product.cats.join('|');
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
    media.append(tag, image);

    var copy = document.createElement('div');
    copy.className = 'product-copy';
    var category = document.createElement('div');
    category.className = 'eyebrow';
    category.textContent = product.cat;
    var title = document.createElement('h3');
    title.textContent = product.name;
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

  window.z88VisibleLimit = 24;
  var more = document.getElementById('catalogMore');
  if (more) {
    more.addEventListener('click', function () {
      window.z88VisibleLimit += 24;
      var select = document.getElementById('categorySelect');
      if (select && typeof select.onchange === 'function') select.onchange();
    });
  }
}());
