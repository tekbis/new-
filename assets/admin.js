(function () {
  'use strict';

  var state = {
    products: [],
    stats: null,
    categories: []
  };
  var gallery = [];
  var categoryFile = null;
  var categoryPreviewUrl = '';
  var toastTimer;
  var viewNames = {
    overview: ['Today', 'Overview'],
    products: ['Catalog', 'Products'],
    categories: ['Catalog', 'Categories']
  };

  function $(id) {
    return document.getElementById(id);
  }

  function money(value) {
    return '$' + Number(value || 0).toFixed(2);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function catName(cat) {
    return typeof cat === 'string' ? String(cat || '') : String((cat && cat.name) || '');
  }

  function catImage(cat) {
    return typeof cat === 'string' ? '' : String((cat && cat.image) || '');
  }

  function renderGallery() {
    $('imagePicker').innerHTML = gallery.map(function (item, index) {
      return '<div class="image-tile"><img src="' + escapeHtml(item.preview || item.src) + '" alt="">' +
        (index === 0 ? '<span class="main-tag">Main</span>' : '') +
        '<button type="button" data-remove-image="' + index + '" aria-label="Remove image">×</button></div>';
    }).join('');
  }

  function addGalleryFiles(fileList) {
    Array.prototype.forEach.call(fileList || [], function (file) {
      if (!file || !file.type || file.type.indexOf('image/') !== 0) return;
      if (gallery.length >= 8) return;
      gallery.push({
        file: file,
        preview: URL.createObjectURL(file),
        alt: $('productName').value.trim() || file.name
      });
    });
    renderGallery();
  }

  function clearCategoryImage() {
    if (categoryPreviewUrl) URL.revokeObjectURL(categoryPreviewUrl);
    categoryFile = null;
    categoryPreviewUrl = '';
    $('categoryPicker').innerHTML = '';
  }

  function renderCategoryPreview() {
    if (!categoryFile) {
      $('categoryPicker').innerHTML = '';
      return;
    }
    $('categoryPicker').innerHTML = '<div class="image-tile"><img src="' + escapeHtml(categoryPreviewUrl) + '" alt="">' +
      '<button type="button" data-clear-category-image aria-label="Remove image">×</button></div>';
  }

  function uploadImage(file) {
    return fetch('/api/admin-upload', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Filename': file.name || 'image' },
      body: file
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) throw new Error((body && body.error) || 'Image upload failed.');
        return body.src;
      });
    });
  }

  function uploadGallery() {
    var uploads = gallery.map(function (item) {
      if (item.src) return Promise.resolve(item);
      return uploadImage(item.file).then(function (src) {
        return { src: src, alt: item.alt || $('productName').value.trim() };
      });
    });
    return Promise.all(uploads);
  }

  function showToast(message) {
    var toast = $('toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 2400);
  }

  function rememberCatalog(products, categories) {
    try { localStorage.setItem('zander88CatalogLive', JSON.stringify(products)); } catch (error) {}
    try { localStorage.setItem('zander88Categories', JSON.stringify(categories || [])); } catch (error) {}
  }

  function request(url, options) {
    return fetch(url, Object.assign({
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }
    }, options || {})).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) {
          var error = new Error((body && body.error) || 'Request failed.');
          error.status = res.status;
          error.body = body;
          throw error;
        }
        return body;
      });
    });
  }

  function setView(name) {
    $('overviewSection').classList.toggle('hidden', name !== 'overview');
    $('productsSection').classList.toggle('hidden', name !== 'products');
    $('categoriesSection').classList.toggle('hidden', name !== 'categories');
    $('pageEyebrow').textContent = viewNames[name][0];
    $('pageTitle').textContent = viewNames[name][1];
    $('addProductButton').classList.toggle('hidden', name === 'categories');
    $('addCategoryButton').classList.toggle('hidden', name !== 'categories');
    document.querySelectorAll('.nav-btn').forEach(function (button) {
      button.classList.toggle('is-active', button.dataset.view === name);
    });
    if (name !== 'categories') closeCategoryForm();
  }

  function openCategoryForm() {
    $('categoryForm').classList.remove('hidden');
    $('categoryMessage').classList.remove('hidden');
    $('categoryMessage').textContent = '';
    $('newCategoryName').focus();
  }

  function closeCategoryForm() {
    $('categoryForm').classList.add('hidden');
    $('categoryMessage').classList.add('hidden');
    $('categoryMessage').textContent = '';
    $('newCategoryName').value = '';
    clearCategoryImage();
  }

  function categoryCounts(name) {
    var items = state.products.filter(function (item) { return item.cat === name; });
    var inStock = items.filter(function (item) { return item.stock && item.price != null; }).length;
    return { total: items.length, inStock: inStock };
  }

  function fillCategorySelects(selected) {
    var options = (state.categories || []).map(function (cat) {
      var name = catName(cat);
      return '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + '</option>';
    }).join('');
    var filter = $('categoryFilter');
    var current = filter.value;
    filter.innerHTML = '<option value="">All categories</option>' + options;
    filter.value = current;
    var select = $('productCategory');
    select.innerHTML = '<option value="">Select category</option>' + options;
    if (selected) select.value = selected;
  }

  function isAvailable(item) {
    return Boolean(item && item.stock && item.price != null);
  }

  function renderStats() {
    var stats = state.stats || {};
    $('statGrid').innerHTML = [
      [stats.total || 0, 'Total products', 'Live catalog listings', ''],
      [stats.inStock || 0, 'In stock', 'Ready for checkout', ''],
      [stats.outOfStock || 0, 'Out of stock', 'Tap to view products', 'oos'],
      [money(stats.inventoryValue), 'Catalog value', 'In-stock retail total', '']
    ].map(function (item) {
      var tag = item[3] === 'oos' ? 'button type="button" class="stat is-link" data-jump-oos' : 'article class="stat"';
      var close = item[3] === 'oos' ? 'button' : 'article';
      return '<' + tag + '><small>' + item[1] + '</small><b>' + item[0] + '</b><em>' + item[2] + '</em></' + close + '>';
    }).join('');

    $('snapshotList').innerHTML = [
      ['Next product ID', stats.nextId || '—'],
      ['Categories', (state.categories || []).length],
      ['Store checkout', 'Uses this catalog']
    ].map(function (item) {
      return '<div class="snapshot-row"><span>' + item[0] + '</span><strong>' + item[1] + '</strong></div>';
    }).join('');

    var max = Math.max.apply(null, (state.categories || []).map(function (cat) {
      return categoryCounts(catName(cat)).total;
    }).concat([1]));
    $('categoryMix').innerHTML = (state.categories || []).slice(0, 8).map(function (cat) {
      var name = catName(cat);
      var count = categoryCounts(name).total;
      var width = Math.max(8, Math.round((count / max) * 100));
      return '<div class="mix-row"><div><strong>' + escapeHtml(name) + '</strong><span class="mix-bar"><span style="width:' + width + '%"></span></span></div><strong>' + count + '</strong></div>';
    }).join('') || '<div class="mix-row">No categories yet</div>';

    fillCategorySelects();
    renderOutOfStock();
  }

  function renderOutOfStock() {
    var items = state.products.filter(function (item) { return !isAvailable(item); });
    var box = $('outOfStockList');
    if (!box) return;
    if (!items.length) {
      box.innerHTML = '<p class="empty-note">No products are out of stock.</p>';
      return;
    }
    box.innerHTML = '<div class="table-wrap"><table class="product-table"><thead><tr>' +
      '<th>Product</th><th>Category</th><th>Price</th><th>Stock</th></tr></thead><tbody>' +
      items.map(function (item) {
        var reason = item.price == null ? 'Add a price before restocking' : 'Unavailable for checkout';
        var action = item.price == null
          ? '<button class="ghost" type="button" data-edit="' + item.id + '">Set price</button>'
          : '<button class="primary" type="button" data-stock="' + item.id + '" data-stock-on="1">Mark in stock</button>';
        return '<tr>' +
          '<td><div class="product-cell"><img src="' + escapeHtml(item.image) + '" alt="">' +
          '<div><strong>' + escapeHtml(item.name) + '</strong><span class="stock-reason">' + reason + '</span></div></div></td>' +
          '<td>' + escapeHtml(item.cat) + '</td>' +
          '<td>' + (item.price == null ? '—' : money(item.price)) + '</td>' +
          '<td><div class="row-actions">' + action + '</div></td></tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  function updateStock(id, stock) {
    var current = state.products.filter(function (item) { return Number(item.id) === Number(id); })[0];
    if (!current) return;
    if (stock && current.price == null) {
      showToast('Set a price before marking this in stock.');
      openModal(current);
      return;
    }
    request('/api/admin-products?id=' + id, {
      method: 'PUT',
      body: JSON.stringify({ stock: stock })
    }).then(function (payload) {
      applyPayload(payload);
      showToast(stock ? 'Marked in stock.' : 'Marked out of stock.');
    }).catch(function (error) {
      showToast(error.message);
    });
  }

  function filteredProducts() {
    var query = String($('productSearch').value || '').toLowerCase().trim();
    var category = $('categoryFilter').value;
    var stock = $('stockFilter').value;
    return state.products.filter(function (item) {
      if (category && item.cat !== category) return false;
      if (stock === 'in' && !(item.stock && item.price != null)) return false;
      if (stock === 'out' && item.stock && item.price != null) return false;
      if (!query) return true;
      return String(item.name).toLowerCase().indexOf(query) !== -1 ||
        String(item.id).indexOf(query) !== -1 ||
        String(item.cat).toLowerCase().indexOf(query) !== -1;
    });
  }

  function renderTable() {
    var rows = filteredProducts();
    $('productTable').innerHTML = rows.map(function (item) {
      var available = item.stock && item.price != null;
      return '<tr>' +
        '<td><div class="product-cell"><img src="' + escapeHtml(item.image) + '" alt="">' +
        '<div><strong>' + escapeHtml(item.name) + '</strong></div></div></td>' +
        '<td>' + escapeHtml(item.cat) + '</td>' +
        '<td>' + (item.price == null ? '—' : money(item.price)) + '</td>' +
        '<td><span class="pill ' + (available ? 'pill-ok' : 'pill-out') + '">' + (available ? 'In stock' : 'Out of stock') + '</span></td>' +
        '<td>' + item.id + '</td>' +
        '<td><div class="row-actions">' +
        (available
          ? '<button class="ghost" type="button" data-stock="' + item.id + '" data-stock-on="0">Mark out of stock</button>'
          : '<button class="primary" type="button" data-stock="' + item.id + '" data-stock-on="1">Mark in stock</button>') +
        '<button class="ghost" type="button" data-edit="' + item.id + '">Edit</button>' +
        '<button class="danger" type="button" data-delete="' + item.id + '">Delete</button>' +
        '</div></td></tr>';
    }).join('');
    $('tableNote').textContent = rows.length + ' of ' + state.products.length + ' products';
  }

  function renderCategories() {
    $('categoryTable').innerHTML = (state.categories || []).map(function (cat) {
      var name = catName(cat);
      var image = catImage(cat);
      var counts = categoryCounts(name);
      var deleteBtn = counts.total
        ? '<span class="table-note">In use</span>'
        : '<button class="danger" type="button" data-delete-cat="' + escapeHtml(name) + '">Delete</button>';
      var photo = image ? '<img src="' + escapeHtml(image) + '" alt="">' : '';
      return '<tr><td><div class="product-cell">' + photo + '<div><strong>' + escapeHtml(name) + '</strong></div></div></td><td>' + counts.total + '</td><td>' + counts.inStock + '</td><td><div class="row-actions">' + deleteBtn + '</div></td></tr>';
    }).join('') || '<tr><td colspan="4">No categories yet. Add one above.</td></tr>';
  }

  function applyPayload(payload) {
    state.products = payload.products || [];
    state.stats = payload.stats || null;
    state.categories = payload.categories || [];
    rememberCatalog(state.products, state.categories);
    renderStats();
    renderTable();
    renderCategories();
  }

  function openModal(product) {
    $('modalEyebrow').textContent = product ? 'Edit listing' : 'New listing';
    $('modalTitle').textContent = product ? 'Edit product' : 'Add product';
    $('productId').value = product ? product.id : '';
    $('productName').value = product ? product.name : '';
    $('productShortName').value = product && product.shortName ? product.shortName : '';
    $('productCollection').value = product && product.collection ? product.collection : '';
    $('productSku').value = product && product.itemCode ? product.itemCode : '';
    $('productPrice').value = product && product.price != null ? product.price : '';
    $('productRating').value = product && product.rating ? product.rating : '';
    $('productReviews').value = product && product.reviews ? product.reviews : '';
    fillCategorySelects(product ? product.cat : '');
    $('productStock').checked = product ? Boolean(product.stock) : true;
    $('productIntro').value = product && product.intro ? product.intro : '';
    $('productHighlights').value = product && Array.isArray(product.highlights) ? product.highlights.join('\n') : '';
    $('productDescription').value = product && product.description ? product.description : '';
    $('productSpecs').value = product && Array.isArray(product.specs) ? product.specs.map(function (row) {
      return row[0] + ' | ' + row[1];
    }).join('\n') : '';
    $('modalMessage').textContent = '';
    gallery = [];
    if (product && Array.isArray(product.images) && product.images.length) {
      gallery = product.images.map(function (image) {
        return { src: image.src, alt: image.alt || product.name };
      });
    } else if (product && product.image) {
      gallery = [{ src: product.image, alt: product.name }];
    }
    renderGallery();
    $('productImages').value = '';
    var modal = $('productModal');
    modal.hidden = false;
    modal.classList.add('is-open');
    modal.classList.remove('hidden');
  }

  function closeModal() {
    var modal = $('productModal');
    modal.hidden = true;
    modal.classList.remove('is-open');
    modal.classList.add('hidden');
  }

  function formPayload(images) {
    return {
      id: $('productId').value ? Number($('productId').value) : undefined,
      name: $('productName').value.trim(),
      shortName: $('productShortName').value.trim(),
      collection: $('productCollection').value.trim(),
      itemCode: $('productSku').value.trim(),
      price: $('productPrice').value === '' ? null : Number($('productPrice').value),
      rating: $('productRating').value,
      reviews: $('productReviews').value,
      cat: $('productCategory').value.trim(),
      intro: $('productIntro').value.trim(),
      highlights: $('productHighlights').value,
      description: $('productDescription').value.trim(),
      specs: $('productSpecs').value,
      images: images,
      image: images && images[0] ? images[0].src : '',
      stock: $('productStock').checked
    };
  }

  function loadDashboard() {
    return request('/api/admin-products').then(function (payload) {
      $('loginView').classList.add('hidden');
      $('dashView').classList.remove('hidden');
      applyPayload(payload);
      setView('overview');
    });
  }

  function showLogin(copy) {
    $('dashView').classList.add('hidden');
    $('loginView').classList.remove('hidden');
    if (copy) $('loginCopy').textContent = copy;
  }

  $('loginForm').addEventListener('submit', function (event) {
    event.preventDefault();
    $('loginMessage').textContent = '';
    request('/api/admin-session', {
      method: 'POST',
      body: JSON.stringify({ password: $('adminPassword').value })
    }).then(function () {
      return loadDashboard();
    }).catch(function (error) {
      $('loginMessage').textContent = error.message;
    });
  });

  $('logoutButton').addEventListener('click', function () {
    request('/api/admin-session', { method: 'DELETE' }).finally(function () {
      showLogin('Signed out. Sign in again to manage the catalog.');
    });
  });

  document.querySelectorAll('.nav-btn').forEach(function (button) {
    button.addEventListener('click', function () { setView(button.dataset.view); });
  });
  $('addProductButton').addEventListener('click', function () {
    setView('products');
    if (!state.categories.length) {
      showToast('Add a category first.');
      setView('categories');
      openCategoryForm();
      return;
    }
    openModal(null);
  });
  $('addCategoryButton').addEventListener('click', function () {
    openCategoryForm();
  });
  $('cancelCategory').addEventListener('click', function () {
    closeCategoryForm();
  });
  $('productSearch').addEventListener('input', renderTable);
  $('categoryFilter').addEventListener('change', renderTable);
  $('stockFilter').addEventListener('change', renderTable);
  $('productImages').addEventListener('change', function (event) {
    addGalleryFiles(event.target.files);
    event.target.value = '';
  });
  $('newCategoryImage').addEventListener('change', function (event) {
    var file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file || !file.type || file.type.indexOf('image/') !== 0) return;
    if (categoryPreviewUrl) URL.revokeObjectURL(categoryPreviewUrl);
    categoryFile = file;
    categoryPreviewUrl = URL.createObjectURL(file);
    renderCategoryPreview();
  });
  $('categoryPicker').addEventListener('click', function (event) {
    if (!event.target.closest('[data-clear-category-image]')) return;
    clearCategoryImage();
  });
  $('imagePicker').addEventListener('click', function (event) {
    var remove = event.target.closest('[data-remove-image]');
    if (!remove) return;
    gallery.splice(Number(remove.getAttribute('data-remove-image')), 1);
    renderGallery();
  });
  $('closeModal').addEventListener('click', closeModal);
  $('cancelModal').addEventListener('click', closeModal);
  $('productModal').addEventListener('click', function (event) {
    if (event.target === $('productModal')) closeModal();
  });

  $('productTable').addEventListener('click', function (event) {
    var stockBtn = event.target.closest('[data-stock]');
    var edit = event.target.closest('[data-edit]');
    var remove = event.target.closest('[data-delete]');
    if (stockBtn) {
      updateStock(stockBtn.getAttribute('data-stock'), stockBtn.getAttribute('data-stock-on') === '1');
      return;
    }
    if (edit) {
      var current = state.products.filter(function (item) {
        return String(item.id) === String(edit.dataset.edit);
      })[0];
      if (current) openModal(current);
    }
    if (remove) {
      var id = Number(remove.dataset.delete);
      var item = state.products.filter(function (product) { return Number(product.id) === id; })[0];
      if (!item || !window.confirm('Delete ' + item.name + '?')) return;
      request('/api/admin-products?id=' + id, { method: 'DELETE' }).then(function (payload) {
        applyPayload(payload);
        showToast('Product deleted.');
      }).catch(function (error) { showToast(error.message); });
    }
  });

  $('outOfStockList').addEventListener('click', function (event) {
    var stockBtn = event.target.closest('[data-stock]');
    var edit = event.target.closest('[data-edit]');
    if (stockBtn) updateStock(stockBtn.getAttribute('data-stock'), stockBtn.getAttribute('data-stock-on') === '1');
    if (edit) {
      var current = state.products.filter(function (item) {
        return String(item.id) === String(edit.dataset.edit);
      })[0];
      if (current) openModal(current);
    }
  });

  $('statGrid').addEventListener('click', function (event) {
    var jump = event.target.closest('[data-jump-oos]');
    if (!jump) return;
    var list = $('outOfStockList');
    if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $('categoryForm').addEventListener('submit', function (event) {
    event.preventDefault();
    $('categoryMessage').textContent = '';
    if (!categoryFile) {
      $('categoryMessage').textContent = 'Add a category image.';
      return;
    }
    var saveBtn = $('categoryForm').querySelector('button[type="submit"]');
    saveBtn.disabled = true;
    uploadImage(categoryFile).then(function (src) {
      return request('/api/admin-categories', {
        method: 'POST',
        body: JSON.stringify({ name: $('newCategoryName').value, image: src })
      });
    }).then(function (payload) {
      applyPayload(payload);
      closeCategoryForm();
      showToast('Category added.');
    }).catch(function (error) {
      $('categoryMessage').textContent = error.message;
    }).then(function () {
      saveBtn.disabled = false;
    });
  });

  $('categoryTable').addEventListener('click', function (event) {
    var remove = event.target.closest('[data-delete-cat]');
    if (!remove) return;
    var name = remove.getAttribute('data-delete-cat');
    if (!window.confirm('Delete category “' + name + '”?')) return;
    request('/api/admin-categories?name=' + encodeURIComponent(name), { method: 'DELETE' }).then(function (payload) {
      applyPayload(payload);
      showToast('Category deleted.');
    }).catch(function (error) { showToast(error.message); });
  });

  $('productForm').addEventListener('submit', function (event) {
    event.preventDefault();
    var editing = Boolean($('productId').value);
    $('modalMessage').textContent = '';
    if (!gallery.length) {
      $('modalMessage').textContent = 'Add at least one product photo.';
      return;
    }
    var saveBtn = $('productForm').querySelector('button[type="submit"]');
    saveBtn.disabled = true;
    uploadGallery().then(function (images) {
      var body = formPayload(images);
      return request('/api/admin-products' + (editing ? '?id=' + body.id : ''), {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(body)
      });
    }).then(function (payload) {
      applyPayload(payload);
      closeModal();
      setView('products');
      showToast(editing ? 'Product updated.' : 'Product added.');
    }).catch(function (error) {
      $('modalMessage').textContent = error.message;
    }).then(function () {
      saveBtn.disabled = false;
    });
  });

  request('/api/admin-session').then(function (session) {
    closeModal();
    if (!session.configured) {
      showLogin();
      return;
    }
    if (session.authenticated) return loadDashboard();
    showLogin();
  }).catch(function () {
    closeModal();
    showLogin('The admin dashboard needs the store API running.');
  });
}());
