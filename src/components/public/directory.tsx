import LinkCard from "@/components/public/link-card";
import { publicCategories, siteContent } from "@/features/public/content";

const categories = [...publicCategories]
  .sort((a, b) => a.sortOrder - b.sortOrder)
  .map((category) => ({
    ...category,
    links: [...category.links].sort((a, b) => a.sortOrder - b.sortOrder),
  }));

export default function Directory() {
  return (
    <section
      aria-labelledby="directory-title"
      className="directory"
      id="direktori"
    >
      <header className="section-header">
        <p className="eyebrow">{siteContent.directoryEyebrow}</p>
        <h2 className="section-title" id="directory-title">
          {siteContent.directoryTitle}
        </h2>
        <p className="section-description">{siteContent.directoryDescription}</p>
      </header>

      <div className="category-list">
        {categories.map((category) => (
          <section
            aria-labelledby={`category-${category.slug}`}
            className="category"
            key={category.id}
          >
            <div className="category__header">
              <span aria-hidden="true" className="category__index">
                {String(category.sortOrder).padStart(2, "0")}
              </span>
              <h3 className="category__title" id={`category-${category.slug}`}>
                {category.title}
              </h3>
            </div>
            <ul className="card-grid">
              {category.links.map((item) => (
                <li className="card-grid__item" key={item.id}>
                  <LinkCard item={item} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}