import LinkCard from "@/components/public/link-card";
import type { PublicCategory } from "@/features/content/types/public-content";
import { fallbackSiteContent } from "@/features/content/fallbacks";

type DirectoryProps = {
  categories: PublicCategory[];
  directoryEyebrow?: string;
  directoryTitle?: string;
  directoryDescription?: string;
};

export default function Directory({ categories, directoryEyebrow, directoryTitle, directoryDescription }: DirectoryProps) {
  return (
    <section aria-labelledby="directory-title" className="directory" id="direktori">
      <header className="section-header">
        <p className="eyebrow">{directoryEyebrow ?? fallbackSiteContent.directoryEyebrow}</p>
        <h2 className="section-title" id="directory-title">{directoryTitle ?? fallbackSiteContent.directoryTitle}</h2>
        <p className="section-description">{directoryDescription ?? fallbackSiteContent.directoryDescription}</p>
      </header>
      {categories.length === 0 ? (
        <p className="section-description">Konten direktori sedang dipersiapkan.</p>
      ) : (
        <div className="category-list">
          {categories.map((category) => (
            <section aria-labelledby={`category-${category.slug}`} className="category" key={category.id}>
              <div className="category__header">
                <span aria-hidden="true" className="category__index">{String(category.sortOrder).padStart(2, "0")}</span>
                <h3 className="category__title" id={`category-${category.slug}`}>{category.title}</h3>
              </div>
              <ul className="card-grid">
                {category.links.map((item) => <li className="card-grid__item" key={item.id}><LinkCard item={item} /></li>)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
