const BRAND_LOGO_DIRECTORY = 'systems/cyberpunk-blue/assets/logo';
const EXTENSION_PREFERENCE = ['.svg', '.webp', '.png', '.jpg', '.jpeg', '.gif', '.avif'];

let brandLogoCachePromise = null;

export function normalizeBrandName(name = '') {
  // NFC-normalize so an accented brand (e.g. "Rostović") keys identically
  // whether the source uses precomposed or combining-mark form.
  return `${name}`.normalize('NFC').trim().replace(/\s+/g, '-').toLowerCase();
}

function getExtensionPriority(path) {
  const lowerPath = `${path}`.toLowerCase();
  const extension = EXTENSION_PREFERENCE.find((entry) => lowerPath.endsWith(entry)) ?? '';
  const priority = EXTENSION_PREFERENCE.indexOf(extension);
  return priority >= 0 ? priority : Number.MAX_SAFE_INTEGER;
}

async function buildBrandLogoCache() {
  const cache = new Map();

  try {
    const result = await foundry.applications.apps.FilePicker.implementation.browse('data', BRAND_LOGO_DIRECTORY);
    const files = result?.files ?? [];

    for (const path of files) {
      const filename = `${path}`.split('/').at(-1) ?? '';
      // FilePicker.browse percent-encodes non-ASCII characters in the paths it
      // returns (e.g. "Rostović.svg" → "Rostovi%C4%87.svg"), so decode before
      // deriving the lookup key. The original (encoded) path stays the cached
      // value — it is valid as-is for an <img src>. Decoding is a no-op for the
      // ASCII filenames that make up every other logo.
      let decodedFilename = filename;
      try {
        decodedFilename = decodeURIComponent(filename);
      } catch (_error) {
        // Malformed percent-encoding — fall back to the raw filename.
      }
      const basename = decodedFilename.replace(/\.[^.]+$/, '');
      const normalized = normalizeBrandName(basename);
      if (!normalized) {
        continue;
      }

      const existing = cache.get(normalized);
      if (!existing || getExtensionPriority(path) < getExtensionPriority(existing)) {
        cache.set(normalized, path);
      }
    }
  } catch (_error) {
    return cache;
  }

  return cache;
}

async function ensureBrandLogoCache() {
  brandLogoCachePromise ??= buildBrandLogoCache();
  return brandLogoCachePromise;
}

export async function getBrandLogoPath(name = '') {
  const normalized = normalizeBrandName(name);
  if (!normalized) {
    return null;
  }

  const cache = await ensureBrandLogoCache();
  return cache.get(normalized) ?? null;
}
