Zander88LLC complete storefront source

Upload this folder with index.html at its root to Netlify. No build command is required.
Includes checkout.html and a separate about.html page, editable HTML/CSS/JavaScript, logo, hero and higher-resolution category images, plus the complete public Zander88LLC catalog (158 product listings captured September 15, 2026).
Travel/Luggage is a dedicated department for the four rolling suitcase listings. The handbag department retains the tote and satchel.
Product listing photos are loaded from the original store's public Wix CDN, rather than bundled in this ZIP, so an internet connection and continued availability of those URLs are required.
Catalog prices and stock are a dated snapshot; they do not automatically synchronize with the original store. Refresh assets/catalog-data.js as inventory changes.
Fonts use system sans-serif and Georgia; no external font download is required.
Checkout charges through Stripe or PayPal using Vercel functions in /api. Add STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY, plus PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, and PAYPAL_ENV (sandbox or live) in the Vercel project environment.
The catalog admin is at /admin.html. Add ADMIN_PASSWORD (8+ characters) to enable sign-in, then add, edit, or delete products. The storefront and checkout use that live catalog. Locally run `node server.js` and open http://localhost:8787/admin.html.
