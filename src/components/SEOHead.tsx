import { useEffect } from 'react';

interface SEOHeadProps {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  keywords?: string;
  canonical?: string;
  noIndex?: boolean;
  jsonLd?: Record<string, any>;
}

export function SEOHead({
  title,
  description,
  ogTitle,
  ogDescription,
  ogImage,
  keywords,
  canonical,
  noIndex = false,
  jsonLd,
}: SEOHeadProps) {
  useEffect(() => {
    // Title
    if (title) document.title = title;

    // Helper to set/remove meta tags
    const setMeta = (attr: string, key: string, content?: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (content) {
        if (!el) {
          el = document.createElement('meta');
          el.setAttribute(attr, key);
          document.head.appendChild(el);
        }
        el.setAttribute('content', content);
      }
    };

    if (description) setMeta('name', 'description', description);
    if (keywords) setMeta('name', 'keywords', keywords);

    // Robots
    setMeta('name', 'robots', noIndex ? 'noindex,nofollow' : 'index,follow');

    // OpenGraph
    if (ogTitle || title) setMeta('property', 'og:title', ogTitle || title);
    if (ogDescription || description) setMeta('property', 'og:description', ogDescription || description);
    if (ogImage) setMeta('property', 'og:image', ogImage);

    // Twitter
    if (ogTitle || title) setMeta('name', 'twitter:title', ogTitle || title);
    if (ogDescription || description) setMeta('name', 'twitter:description', ogDescription || description);
    if (ogImage) setMeta('name', 'twitter:image', ogImage);

    // Canonical
    let linkEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonical) {
      if (!linkEl) {
        linkEl = document.createElement('link');
        linkEl.setAttribute('rel', 'canonical');
        document.head.appendChild(linkEl);
      }
      linkEl.setAttribute('href', canonical);
    }

    // JSON-LD
    const jsonLdId = 'seo-jsonld';
    let scriptEl = document.getElementById(jsonLdId) as HTMLScriptElement | null;
    if (jsonLd) {
      if (!scriptEl) {
        scriptEl = document.createElement('script');
        scriptEl.id = jsonLdId;
        scriptEl.type = 'application/ld+json';
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = JSON.stringify(jsonLd);
    }

    return () => {
      // Cleanup JSON-LD on unmount
      const el = document.getElementById(jsonLdId);
      if (el) el.remove();
    };
  }, [title, description, ogTitle, ogDescription, ogImage, keywords, canonical, noIndex, jsonLd]);

  return null;
}

export function buildLocalBusinessJsonLd(company: {
  name?: string;
  address?: string;
  address_number?: string;
  district?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  phone?: string;
  whatsapp?: string;
  average_rating?: number;
  review_count?: number;
  slug?: string;
}) {
  const baseUrl = window.location.origin;
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: company.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: [company.address, company.address_number].filter(Boolean).join(', '),
      addressLocality: company.city,
      addressRegion: company.state,
      postalCode: company.postal_code,
      addressCountry: 'BR',
    },
    telephone: company.phone || company.whatsapp,
    url: `${baseUrl}/barbearia/${company.slug}`,
    ...(company.average_rating && company.review_count ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: company.average_rating,
        reviewCount: company.review_count,
        bestRating: 5,
        worstRating: 1,
      },
    } : {}),
  };
}
