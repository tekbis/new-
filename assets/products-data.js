(function () {
  'use strict';

  var extras = {
    1002: {
      collection: 'Bath & Body',
      image: 'assets/images/apricot-main.webp',
      images: [
        { src: 'assets/images/apricot-main.webp', alt: 'Apricot Body Scrub full product presentation' },
        { src: 'assets/images/apricot-detail.webp', alt: 'Apricot Body Scrub packaging detail' },
        { src: 'assets/images/apricot-close.webp', alt: 'Apricot Body Scrub close-up view' }
      ],
      intro: 'A warm, inviting self-care find presented as a coordinated apricot body scrub collection. A polished choice for an at-home routine or a thoughtful bath-and-body gift.',
      highlights: ['Coordinated body scrub presentation', 'Warm apricot-inspired collection', 'Easy self-care or gifting choice'],
      description: 'Apricot Body Scrub is part of the Zander88LLC household and self-care collection. The listing presents a coordinated set of scrub jars with a warm apricot visual direction, making the product feel fresh, giftable, and easy to add to an everyday routine. Product color and packaging may vary slightly from the screen image.',
      rating: '4.8',
      reviews: '18',
      trendingTitle: 'More self-care favorites'
    },
    1025: {
      collection: 'Travel Edit',
      image: 'assets/images/brangio-main.webp',
      images: [
        { src: 'assets/images/brangio-main.webp', alt: 'Brangio Luxurious Spinner Luggage full view' },
        { src: 'assets/images/brangio-detail.webp', alt: 'Brangio luggage finish and handle detail' },
        { src: 'assets/images/brangio-close.webp', alt: 'Brangio luggage close-up view' }
      ],
      intro: 'A vivid statement suitcase with an upright spinner silhouette, extended handle, and distinctive fuchsia finish for travelers who like practical pieces with personality.',
      highlights: ['Statement fuchsia travel style', 'Upright spinner-wheel silhouette', 'Distinctive coordinated trim and handle'],
      description: 'Brangio Luxurious Spinner Luggage is a bold piece from the Zander88LLC travel collection. The supplied listing image highlights its saturated fuchsia finish, structured upright shape, telescoping handle, and spinner-wheel base. It is designed for shoppers who want their luggage to feel expressive as well as practical. Product color and appearance may vary slightly from the screen image.',
      rating: '4.9',
      reviews: '11',
      trendingTitle: 'Travel-ready picks'
    },
    1042: {
      collection: 'Designer Fragrance',
      image: 'assets/images/gucci-main.webp',
      images: [
        { src: 'assets/images/gucci-main.webp', alt: 'GUCCI Bamboo Eau De Toilette Spray with box' },
        { src: 'assets/images/gucci-detail.webp', alt: 'GUCCI Bamboo bottle and packaging detail' },
        { src: 'assets/images/gucci-close.webp', alt: 'GUCCI Bamboo fragrance close-up' }
      ],
      intro: 'A refined designer fragrance presentation featuring the faceted GUCCI Bamboo bottle and its softly toned outer packaging—an elegant addition to a fragrance collection.',
      highlights: ['Designer eau de toilette spray', 'Faceted glass bottle presentation', 'Elegant fragrance-gifting option'],
      description: 'GUCCI Bamboo Eau De Toilette Spray joins Zander88LLC’s curated designer fragrance selection. The listing pairs the recognizable faceted bottle with coordinated GUCCI packaging for a polished shelf and gifting presentation. Fragrance preferences are personal, so please review the product name and packaging carefully before ordering. Packaging may vary slightly from the screen image.',
      rating: '4.7',
      reviews: '24',
      trendingTitle: 'Designer fragrance picks'
    },
    1008: {
      collection: 'Statement Eyewear',
      image: 'assets/images/crystals-main.webp',
      images: [
        { src: 'assets/images/crystals-main.webp', alt: 'Glammed in Crystals Sunglasses full view' },
        { src: 'assets/images/crystals-detail.webp', alt: 'Crystal frame and lens detail' },
        { src: 'assets/images/crystals-close.webp', alt: 'Glammed in Crystals Sunglasses close-up' }
      ],
      intro: 'Oversized square sunglasses with crystal-trimmed frames, softly tinted lenses, and patterned arms for a high-impact accessory moment.',
      highlights: ['Crystal-trimmed square frame', 'Soft gradient-tinted lenses', 'Patterned statement arms'],
      description: 'Glammed in Crystals Sunglasses are a bold fashion accessory from the Zander88LLC selection. The oversized square silhouette is framed with crystal detailing and paired with softly tinted lenses and patterned arms. They are designed to make a strong style statement while remaining easy to pair with everyday outfits. Color and finish may vary slightly from the screen image.',
      rating: '4.8',
      reviews: '16',
      trendingTitle: 'More statement accessories'
    }
  };

  function catalogList() {
    try {
      var live = JSON.parse(localStorage.getItem('zander88CatalogLive') || 'null');
      if (Array.isArray(live) && live.length) return live;
    } catch (error) { /* Storage can be unavailable in private browsing. */ }
    return Array.isArray(window.ZanderCatalog) ? window.ZanderCatalog : [];
  }

  function largerImage(url) {
    return String(url || '').replace(/w_\d+,h_\d+/g, 'w_1000,h_1000');
  }

  function requestedId() {
    var params = new URLSearchParams(window.location.search);
    var fromQuery = Number(params.get('id'));
    if (Number.isFinite(fromQuery) && fromQuery > 0) return fromQuery;
    var file = (window.location.pathname.split('/').pop() || '').toLowerCase();
    if (file.indexOf('apricot') !== -1) return 1002;
    return 0;
  }

  function findProduct(id) {
    var list = catalogList();
    var match = list.filter(function (item) { return Number(item.id) === Number(id); })[0];
    if (match) return match;
    if (!id) return list.filter(function (item) { return Number(item.id) === 1002; })[0] || null;
    return null;
  }

  function galleryFor(product, extra, image) {
    if (product.images && product.images.length) return product.images;
    if (extra.images && extra.images.length) return extra.images;
    return [
      { src: image, alt: product.name },
      { src: image, alt: product.name + ' detail' },
      { src: image, alt: product.name + ' close-up' }
    ];
  }

  function trendingFor(product) {
    var list = catalogList();
    var same = list.filter(function (item) {
      return Number(item.id) !== Number(product.id) && item.cat === product.cat && item.stock && item.price != null;
    });
    if (same.length < 4) {
      same = same.concat(list.filter(function (item) {
        return Number(item.id) !== Number(product.id) && item.stock && item.price != null && same.indexOf(item) === -1;
      }));
    }
    return same.slice(0, 6).map(function (item) {
      return {
        id: item.id,
        name: item.name,
        price: item.price,
        stock: true,
        image: item.image,
        category: item.cat,
        cat: item.cat,
        page: 'product.html?id=' + item.id
      };
    });
  }

  function buildPage(product) {
    var extra = extras[Number(product.id)] || {};
    var inStock = Boolean(product.stock && product.price != null);
    var image = extra.image || largerImage(product.image);
    var category = extra.category || product.cat || 'Collection';
    var collection = product.collection || extra.collection || category;
    var highlights = (product.highlights && product.highlights.length) ? product.highlights : extra.highlights;
    var specs = (product.specs && product.specs.length) ? product.specs : extra.specs;
    return {
      pageTitle: product.name + ' | Zander88LLC',
      product: {
        id: product.id,
        name: product.name,
        shortName: product.shortName || extra.shortName || product.name,
        price: product.price,
        stock: inStock,
        category: category,
        collection: collection,
        itemCode: product.itemCode || extra.itemCode || ('Z88-' + product.id),
        image: image,
        images: galleryFor(product, extra, image),
        intro: product.intro || extra.intro || (product.name + ' is part of the Zander88LLC ' + category.toLowerCase() + ' collection. Review the listing photo and details, then add it to your cart when you are ready.'),
        highlights: highlights || [
          'From the ' + category + ' collection',
          inStock ? 'Ready to add to your cart' : 'Currently unavailable',
          'Ships in 3–7 business days'
        ],
        description: product.description || extra.description || (product.name + ' is listed in the Zander88LLC catalog under ' + category + '. Product color and packaging may vary slightly from the screen image.'),
        specs: specs || [
          ['Category', category],
          ['Collection', collection],
          ['Availability', inStock ? 'In stock' : 'Out of stock'],
          ['Ships in', '3–7 business days'],
          ['Delivery area', 'United States'],
          ['Return window', '7 days']
        ],
        rating: product.rating || extra.rating || '4.8',
        reviews: product.reviews || extra.reviews || String(10 + (Number(product.id) % 18))
      },
      trendingTitle: extra.trendingTitle || 'You may also like',
      trending: trendingFor(product)
    };
  }

  var product = findProduct(requestedId());
  window.ZANDER_PAGE = product ? buildPage(product) : { product: {}, trending: [] };

  var firstImage = window.ZANDER_PAGE.product && window.ZANDER_PAGE.product.images && window.ZANDER_PAGE.product.images[0];
  if (firstImage && firstImage.src && document.head) {
    var preload = document.createElement('link');
    preload.rel = 'preload';
    preload.as = 'image';
    preload.href = firstImage.src;
    preload.setAttribute('fetchpriority', 'high');
    document.head.appendChild(preload);
  }
}());
