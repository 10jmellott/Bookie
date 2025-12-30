const CACHE_KEY_PREFIX = 'bookie_icon_cache_';
const CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 1 month in ms

async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 5000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

function getCacheKey(url) {
    return CACHE_KEY_PREFIX + encodeURIComponent(url);
}

function setCache(url, iconUrl) {
    const cacheData = {
        iconUrl,
        timestamp: Date.now()
    };
    localStorage.setItem(getCacheKey(url), JSON.stringify(cacheData));
}

function getCache(url) {
    const cache = localStorage.getItem(getCacheKey(url));
    if (!cache) return null;
    try {
        const { iconUrl, timestamp } = JSON.parse(cache);
        if (Date.now() - timestamp < CACHE_DURATION) {
            return iconUrl;
        }
    } catch (e) { }
    return null;
}

async function getMetaIcon(doc) {
    const rels = ['icon', 'shortcut icon', 'apple-touch-icon', 'apple-touch-icon-precomposed'];
    for (const rel of rels) {
        const link = doc.querySelector(`link[rel="${rel}"]`);
        if (link && link.href) return link.href;
    }
    return null;
}

async function getManifestIcon(doc, baseUrl) {
    const manifestLink = doc.querySelector('link[rel="manifest"]');
    if (!manifestLink || !manifestLink.href) return null;
    try {
        const manifestUrl = new URL(manifestLink.href, baseUrl).href;
        const resp = await fetchWithTimeout(manifestUrl);
        if (!resp.ok) return null;
        const manifest = await resp.json();
        if (manifest.icons && manifest.icons.length) {
            // Prefer largest icon
            const sorted = manifest.icons.sort((a, b) => (b.sizes || '').localeCompare(a.sizes || ''));
            const iconSrc = sorted[0].src;
            return new URL(iconSrc, manifestUrl).href;
        }
    } catch (e) { }
    return null;
}

async function getFavicon(baseUrl) {
    try {
        const faviconUrl = new URL('/favicon.ico', baseUrl).href;
        const resp = await fetchWithTimeout(faviconUrl);
        if (resp.ok) return faviconUrl;
    } catch (e) { }
    return null;
}

export async function loadIcon(url) {
    const cached = getCache(url);
    if (cached) return cached;

    try {
        const resp = await fetchWithTimeout(url);
        if (!resp.ok) throw new Error('Failed to fetch page');
        const html = await resp.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Try meta link
        let iconUrl = await getMetaIcon(doc);
        if (iconUrl) iconUrl = new URL(iconUrl, url).href;

        // Try manifest
        if (!iconUrl) iconUrl = await getManifestIcon(doc, url);

        // Try favicon
        if (!iconUrl) iconUrl = await getFavicon(url);

        if (iconUrl) {
            setCache(url, iconUrl);
            return iconUrl;
        }
    } catch (e) { }

    return null;
}
