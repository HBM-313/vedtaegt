import { Helmet } from "react-helmet-async";

interface PageSeoProps {
  title: string;
  description: string;
  /** Relativ sti, fx "/login". Bruges til canonical og og:url. */
  path: string;
  ogType?: "website" | "article";
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const SITE_URL = "https://vedtaegt.lovable.app";

/**
 * Per-route metadata. Sætter <title>, <meta description>, canonical og og:* tags.
 * Brug på offentlige routes for unik metadata og social preview.
 */
const PageSeo = ({
  title,
  description,
  path,
  ogType = "website",
  noindex = false,
  jsonLd,
}: PageSeoProps) => {
  const url = `${SITE_URL}${path}`;
  const ldArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={ogType} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}
      {ldArray.map((ld, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(ld)}
        </script>
      ))}
    </Helmet>
  );
};

export default PageSeo;
