/* ==========================================================================
   MUREEH — Participating Restaurants / Digital Menu Experience
   Visual-only module: renders the "Mureeh Plan" restaurant network and a
   professional bilingual menu drawer. No backend, no persistence; data is
   a demo dataset meant to be replaced by real restaurant/menu records.
   ========================================================================== */
(function () {
  "use strict";

  const grid = document.getElementById("restaurantsGrid");
  const filtersWrap = document.getElementById("restoFilters");
  const drawerRoot = document.getElementById("restoDrawerRoot");
  const drawer = document.getElementById("restoDrawer");
  const overlay = document.getElementById("restoDrawerOverlay");
  const closeBtn = document.getElementById("restoDrawerClose");
  const menuContent = document.getElementById("restoMenuContent");
  const animatedScene = document.getElementById("restoMovieCanvas");

  if (!grid || !drawerRoot) return;

  /* ---------------------------------------------------------------------
     DEMO DATA
     Replace / extend with your real participating restaurant records.
     `group` maps to the filters below; `hero` can point to a real photo.
     --------------------------------------------------------------------- */
  const GROUPS = [
    { id: "all" },
    { id: "food" },
    { id: "coffee" },
    { id: "juice" }
  ];

  const RESTAURANTS = [
    {
      id: "layan",
      mark: "LY",
      name: { ar: "مطعم ليان", en: "Layan Restaurant" },
      cuisine: { ar: "مأكولات شرقية", en: "Levantine Kitchen" },
      area: { ar: "رام الله", en: "Ramallah" },
      group: "food",
      rating: "4.9",
      followers: "4.2K",
      identityNo: "MRH-01",
      accent: "#1565C0",
      accent2: "#42A5F5",
      blurb: { ar: "هوية رقمية كاملة مع منيو تفاعلي ونظام طلب متصل بخطة مُريح — من المطبخ إلى جدول الضيوف.", en: "A complete digital identity with an interactive menu and Mureeh-connected ordering — from kitchen to table." },
      hero: "assets/restaurants/layan.jpg",
      menu: [
        {
          cat: { ar: "المشاوي", en: "Grills" },
          items: [
            { name: { ar: "مشاوي ليان المشكّلة", en: "Layan Mixed Grill" }, desc: { ar: "تشكيلة مشاوي فحم بلدي مع خبز طابون وسلطات موسمية.", en: "Charcoal mixed grill with taboon bread and seasonal salads." }, price: "78", badge: { ar: "الأكثر طلباً", en: "Bestseller" } },
            { name: { ar: "كباب بلدي", en: "Local Kebab" }, desc: { ar: "لحم بلدي متبّل بالأعشاب الطازجة على الفحم.", en: "Locally sourced beef marinated with fresh herbs over charcoal." }, price: "54" },
            { name: { ar: "شيش طاووق", en: "Shish Tawook" }, desc: { ar: "قطع دجاج متبّلة بالثوم والليمون ومشوية على الفحم.", en: "Garlic-and-lemon marinated chicken grilled over charcoal." }, price: "46" }
          ]
        },
        {
          cat: { ar: "المقبلات والسلطات", en: "Mezze & Salads" },
          items: [
            { name: { ar: "حمص مسخّن", en: "Warm Hummus" }, desc: { ar: "حمص بالسمن البلدي وحبات الحمص الكاملة وزيت الزيتون.", en: "Hummus with local clarified butter, whole chickpeas and olive oil." }, price: "18", badge: { ar: "يد الصنع", en: "Homemade" } },
            { name: { ar: "تبولة شامية", en: "Levantine Tabbouleh" }, desc: { ar: "بقدونس طازج، برغل ناعم، ليمون وزيت زيتون بكر.", en: "Fresh parsley, fine bulgur, lemon and extra virgin olive oil." }, price: "20" },
            { name: { ar: "مقبلات فاخرة", en: "Chef’s Mezze Board" }, desc: { ar: "تشكيلة ميني للضيافة تجمع أفضل أطباق المطعم.", en: "A sharing mezze board featuring the restaurant’s signature plates." }, price: "42" }
          ]
        }
      ]
    },
    {
      id: "zaid",
      mark: "ZD",
      name: { ar: "كافيه زيد", en: "Zaid Coffee" },
      cuisine: { ar: "قهوة مختصة", en: "Specialty Coffee" },
      area: { ar: "رام الله", en: "Ramallah" },
      group: "coffee",
      rating: "4.8",
      followers: "3.6K",
      identityNo: "MRH-02",
      accent: "#B5652B",
      accent2: "#E6A15E",
      blurb: { ar: "تجربة قهوة مختصة محمّصة محلياً مع منيو بطاقات متغيّرة وأجواء هادئة بتوقيع مُريح.", en: "Locally roasted specialty coffee with a rotating tasting menu and calm Mureeh-signature ambiance." },
      hero: "assets/restaurants/zaid.jpg",
      menu: [
        {
          cat: { ar: "القهوة المختصة", en: "Specialty Coffee" },
          items: [
            { name: { ar: "V60 — أصناف تتغير", en: "V60 — Rotating Selection" }, desc: { ar: "تقطير يدوي من محمصات محلية مع بطاقة أصل المصدر.", en: "Hand-brewed pour-over from local roasters with origin notes." }, price: "22", badge: { ar: "توصية الباريستا", en: "Barista Pick" } },
            { name: { ar: "إسبريسو مضاعف", en: "Double Espresso" }, desc: { ar: "تركيز شديد وحوامض متوازنة من قهوة الموسم.", en: "Intense, balanced acidity from this season’s beans." }, price: "14" },
            { name: { ar: "كورتادو", en: "Cortado" }, desc: { ar: "قهوة وحليب بخار بنسبة متوازنة لإبراز نكهة المصدر.", en: "Balanced coffee and steamed milk that lets the origin show." }, price: "16" }
          ]
        },
        {
          cat: { ar: "الحلويات", en: "Patisserie" },
          items: [
            { name: { ar: "تشيز كيك اللوتس", en: "Lotus Cheesecake" }, desc: { ar: "تشيز كيك كريمي بطبقة بسكويت اللوتس.", en: "Creamy cheesecake on a lotus biscuit base." }, price: "26" },
            { name: { ar: "كرواسان باللوز", en: "Almond Croissant" }, desc: { ar: "كرواسان فرنسي بحشوة كريمة اللوز.", en: "French croissant filled with almond crème." }, price: "18", badge: { ar: "جديد", en: "New" } }
          ]
        }
      ]
    },
    {
      id: "dar",
      mark: "DR",
      name: { ar: "دار المندي", en: "Dar Mandi" },
      cuisine: { ar: "مأكولات يمنية", en: "Yemeni Kitchen" },
      area: { ar: "نابلس", en: "Nablus" },
      group: "food",
      rating: "4.7",
      followers: "2.9K",
      identityNo: "MRH-03",
      accent: "#0D47A1",
      accent2: "#00BCD4",
      blurb: { ar: "مطبخ يمني أصيل بوصفات عائلية، ومشروع رقمي لتسهيل الطلب والكرت الرقمي للمطعم.", en: "Authentic Yemeni kitchen with family recipes, plus digital ordering and a restaurant card." },
      hero: "assets/restaurants/dar.jpg",
      menu: [
        {
          cat: { ar: "الأطباق الرئيسية", en: "Main Course" },
          items: [
            { name: { ar: "مندي لحم", en: "Lamb Mandi" }, desc: { ar: "لحم ضأن بطيء التحمير على الأرز البسمتي مع سلطة حارة.", en: "Slow-raised lamb over basmati rice with spicy salad." }, price: "68", badge: { ar: "طبق التوقيع", en: "Signature" } },
            { name: { ar: "مندي دجاج", en: "Chicken Mandi" }, desc: { ar: "دجاج مشوي على طريقة المندي مع أرز مبهّر.", en: "Mandi-style grilled chicken with spiced rice." }, price: "52" },
            { name: { ar: "سلتة", en: "Saltah" }, desc: { ar: "يخنة يمنية ساخنة مع الطحينة والهيل والصلصة الحارة.", en: "Hot Yemeni stew with tahini, cardamom and spicy salsa." }, price: "38" }
          ]
        },
        {
          cat: { ar: "المشروبات", en: "Beverages" },
          items: [
            { name: { ar: "عصير مانجو طازج", en: "Fresh Mango Juice" }, desc: { ar: "مانجو طبيعي بدون سكر مضاف.", en: "Natural mango juice with no added sugar." }, price: "16" },
            { name: { ar: "قمر الدين", en: "Qamar al-Din" }, desc: { ar: "مشروب مشمش تقليدي مقدّم مثلجاً.", en: "Traditional apricot drink served chilled." }, price: "14" }
          ]
        }
      ]
    },
    {
      id: "sawt",
      mark: "ST",
      name: { ar: "سموذي المدينة", en: "Sawt City Smoothies" },
      cuisine: { ar: "عصائر طازجة", en: "Fresh Juices" },
      area: { ar: "القدس", en: "Jerusalem" },
      group: "juice",
      rating: "4.8",
      followers: "4.5K",
      identityNo: "MRH-04",
      accent: "#00A67E",
      accent2: "#54D6A0",
      blurb: { ar: "عصائر وسموذي مصنوعة أمامك من فواكه موسمية، مع منيو رقمي سريع يعمل على الجوال.", en: "Seasonal juices and smoothies blended in front of you, with a fast mobile-first menu." },
      hero: "assets/restaurants/sawt.jpg",
      menu: [
        {
          cat: { ar: "العصائر الطازجة", en: "Fresh Juices" },
          items: [
            { name: { ar: "عصير برتقال طازج", en: "Fresh Orange Juice" }, desc: { ar: "برتقال محلي عصير طازجاً على الطلب.", en: "Local oranges freshly juiced to order." }, price: "14" },
            { name: { ar: "عصير رمان يافا", en: "Jaffa Pomegranate" }, desc: { ar: "رمان مطحون على الطلب بلا إضافات.", en: "Pomegranate extracted to order with nothing added." }, price: "20", badge: { ar: "موسمي", en: "Seasonal" } },
            { name: { ar: "ليمون بالنعناع", en: "Mint Lemonade" }, desc: { ar: "ليمون طازج مع نعناع وثلج مجروش.", en: "Fresh lemon with mint and crushed ice." }, price: "12" }
          ]
        },
        {
          cat: { ar: "السموذي", en: "Smoothies" },
          items: [
            { name: { ar: "سموذي مانجو", en: "Mango Smoothie" }, desc: { ar: "مانجو، لبن، وعسل جبلي.", en: "Mango, yogurt and mountain honey." }, price: "22" },
            { name: { ar: "سموذي التوت", en: "Berry Smoothie" }, desc: { ar: "توت مجمد، موز، وحليب اللوز.", en: "Frozen berries, banana and almond milk." }, price: "24" }
          ]
        }
      ]
    },
    {
      id: "fakhara",
      mark: "FH",
      name: { ar: "فخارة", en: "Fakhara" },
      cuisine: { ar: "مأكولات فلسطينية", en: "Palestinian Kitchen" },
      area: { ar: "الخليل", en: "Hebron" },
      group: "food",
      rating: "4.9",
      followers: "5.1K",
      identityNo: "MRH-05",
      accent: "#8D2F20",
      accent2: "#D97B4A",
      blurb: { ar: "أطباق تراثية بتقديم عصري، وهوية بصرية تُحاكي الطين والفخار وروح الحارة.", en: "Heritage dishes with a modern presentation and a terra-cotta visual identity." },
      hero: "assets/restaurants/fakhara.jpg",
      menu: [
        {
          cat: { ar: "أطباق تراثية", en: "Heritage Dishes" },
          items: [
            { name: { ar: "مسخن", en: "Musakhan" }, desc: { ar: "دجاج مع البصل المكرمل والسماق وخبز الطابون.", en: "Chicken with caramelized onion, sumac and taboon bread." }, price: "40", badge: { ar: "الأكثر طلباً", en: "Bestseller" } },
            { name: { ar: "مفتول بالدجاج", en: "Maftoul with Chicken" }, desc: { ar: "حبوب مفتول مع دجاج متبّل وخضار بالموسم.", en: "Maftoul pearls with seasoned chicken and seasonal vegetables." }, price: "44" },
            { name: { ar: "كنافة نابلسية", en: "Nablus Kunafa" }, desc: { ar: "كنافة بالجبنة والقطر مبنية على الطريقة النابلسية.", en: "Cheese kunafa with syrup, Nablus style." }, price: "24" }
          ]
        },
        {
          cat: { ar: "ضيافة القهوة", en: "Coffee & Hospitality" },
          items: [
            { name: { ar: "قهوة عربية بالهيل", en: "Arabic Coffee with Cardamom" }, desc: { ar: "قهوة دانة تُقدّم مع التمر البلدي.", en: "Dana coffee served with local dates." }, price: "10" },
            { name: { ar: "شاي بالنعناع", en: "Mint Tea" }, desc: { ar: "شاي أسود بنعناع طازج وسكر على الطلب.", en: "Black tea with fresh mint, sweetened to order." }, price: "8" }
          ]
        }
      ]
    },
    {
      id: "shams",
      mark: "SM",
      name: { ar: "مقهى شمس", en: "Shams Café" },
      cuisine: { ar: "معجنات وحلويات", en: "Bakery & Desserts" },
      area: { ar: "رام الله", en: "Ramallah" },
      group: "coffee",
      rating: "4.7",
      followers: "2.8K",
      identityNo: "MRH-06",
      accent: "#C7942B",
      accent2: "#F2C96B",
      blurb: { ar: "مخبوزات طازجة كل ساعة مع قهوة تركية، وواجهة رقمية دافئة تبرز المنتج اليومي.", en: "Fresh bakes every hour with Turkish coffee and a warm digital storefront." },
      hero: "assets/restaurants/shams.jpg",
      menu: [
        {
          cat: { ar: "المعجنات", en: "Bakery" },
          items: [
            { name: { ar: "معجنات مشكّلة", en: "Mixed Pastry Box" }, desc: { ar: "تشكيلة معجنات صغيرة ساخنة تُقدّم بموسم المكونات.", en: "A warm box of small pastries featuring seasonal ingredients." }, price: "32" },
            { name: { ar: "فطيرة سبانخ", en: "Spinach Pie" }, desc: { ar: "عجينة طازجة بحشوة السبانخ والبصل والسماق.", en: "Fresh dough filled with spinach, onion and sumac." }, price: "9", badge: { ar: "طازج يومياً", en: "Baked Daily" } }
          ]
        },
        {
          cat: { ar: "القهوة والحلويات", en: "Coffee & Sweets" },
          items: [
            { name: { ar: "قهوة تركية", en: "Turkish Coffee" }, desc: { ar: "قهوة تُحضّر على الرمال كما في الحارة القديمة.", en: "Coffee brewed on hot sand, the old-town way." }, price: "10" },
            { name: { ar: "حلى الشومان", en: "Shoman Dessert" }, desc: { ar: "حلوى محلية بالجبنة والسميد مع القطر.", en: "Local semolina and cheese dessert with syrup." }, price: "16" }
          ]
        }
      ]
    }
  ];

  const LABELS = {
    ar: {
      empty: "لا توجد قائمة لعرضها بعد.",
      plan: "خطة مُريح",
      menu: "عرض المنيو",
      powered: "منيو رقمي",
      network: "شبكة مُريح للمطاعم",
      rating: "التقييم",
      followers: "متابعون",
      dishes: "طبق", specials: "مميز",
      currency: "₪",
      close: "إغلاق",
      base: "رقم المطعم",
      served: "المطاعم المشاركة",
      dishes_label: "طبق مدرج",
      filters: "التصنيف",
      cat_all: "الكل",
      cat_food: "مأكولات",
      cat_coffee: "قهوة ومخبوزات",
      cat_juice: "عصائر ومشروبات"
    },
    en: {
      empty: "No menu to display yet.",
      plan: "MUREEH PLAN",
      menu: "Open Menu",
      powered: "DIGITAL MENU",
      network: "MUREEH RESTAURANT NETWORK",
      rating: "RATING",
      followers: "FOLLOWERS",
      dishes: "DIS",
      specials: "SPECIAL",
      currency: "₪",
      close: "Close",
      base: "IDENTITY NO.",
      served: "Participating restaurants",
      dishes_label: "Listed dishes",
      filters: "FILTER",
      cat_all: "All",
      cat_food: "Food",
      cat_coffee: "Coffee & Bakery",
      cat_juice: "Juices & Drinks"
    }
  };

  /* Optional: set a real lightweight HD .mp4 URL/path to replace the
     canvas animation with an actual cinematic video. Leave null to use
     the lightweight animated canvas (the default, video-feel, no download). */
  const VIDEO_BG = null;

  let activeFilter = "all";
  let openRestaurantId = null;

  function getLang() {
    return (window.MureehI18n && window.MureehI18n.getLang()) || "ar";
  }
  function L() { return LABELS[getLang()] || LABELS.ar; }
  function t(obj) {
    const lang = getLang();
    return obj && (obj[lang] !== undefined ? obj[lang] : (obj.ar || obj.en));
  }
  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[m]));
  }

  /* ---------------------------------------------------------------------
     FILTERS
     --------------------------------------------------------------------- */
  function renderFilters() {
    if (!filtersWrap) return;
    const l = L();
    const groupLabel = {
      all: l.cat_all,
      food: l.cat_food,
      coffee: l.cat_coffee,
      juice: l.cat_juice
    };
    filtersWrap.innerHTML = GROUPS.map((g) => `
      <button class="resto-filter${g.id === activeFilter ? " active" : ""}" type="button" data-filter="${g.id}">
        ${escapeHtml(groupLabel[g.id] || g.id)}
      </button>
    `).join("");

    filtersWrap.querySelectorAll("[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeFilter = btn.dataset.filter;
        renderFilters();
        renderCards();
      });
    });
  }

  /* ---------------------------------------------------------------------
     RESTAURANT CARDS
     --------------------------------------------------------------------- */
  function renderCards() {
    if (!grid) return;
    const l = L();
    const list = RESTAURANTS.filter((r) => activeFilter === "all" || r.group === activeFilter);
    if (!list.length) {
      grid.innerHTML = `<div class="resto-empty">${escapeHtml(l.empty)}</div>`;
      return;
    }

    grid.innerHTML = list.map((r) => `
      <article class="resto-card reveal in" data-id="${escapeHtml(r.id)}" style="--accent:${escapeHtml(r.accent)};--accent-2:${escapeHtml(r.accent2)};" tabindex="0" role="button" aria-label="${escapeHtml(t(r.name))} — ${escapeHtml(l.menu)}">
        <div class="resto-card-top">
          <span class="resto-identity-no">${escapeHtml(l.base)} ${escapeHtml(r.identityNo)}</span>
          <span class="resto-live">${escapeHtml(l.plan)}</span>
        </div>
        <div class="resto-card-photo" aria-hidden="true">
          <img src="${escapeHtml(r.hero)}" alt="" loading="lazy">
        </div>
        <div class="resto-card-body">
          <div>
            <div class="resto-mark">${escapeHtml(r.mark)}</div>
            <h4>${escapeHtml(t(r.name))}</h4>
            <div class="resto-cuisine">${escapeHtml(t(r.cuisine))} — ${escapeHtml(t(r.area))}</div>
            <div class="resto-palette" aria-hidden="true">
              <i style="background:${escapeHtml(r.accent)}"></i>
              <i style="background:${escapeHtml(r.accent2)}"></i>
              <i style="background:#F6F3EC"></i>
              <span class="resto-palette-label">Identity System</span>
            </div>
            <p>${escapeHtml(t(r.blurb))}</p>
            <div class="resto-card-meta">
              <span class="rcm">${escapeHtml(l.rating)} <b>${escapeHtml(r.rating)}</b></span>
              <span class="rcm">${escapeHtml(l.followers)} <b>${escapeHtml(r.followers)}</b></span>
              <span class="rcm">${escapeHtml(l.dishes_label)} <b>${r.menu.reduce((n, c) => n + c.items.length, 0)}</b></span>
            </div>
          </div>
        </div>
        <div class="resto-card-footer">
          <span class="open-menu">${escapeHtml(l.menu)}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
          </span>
          <span class="resto-plan-badge">MUREEH+</span>
        </div>
      </article>
    `).join("");

    grid.querySelectorAll(".resto-card").forEach((card) => {
      card.addEventListener("click", () => openMenu(card.dataset.id));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openMenu(card.dataset.id);
        }
      });
    });
  }

  /* ---------------------------------------------------------------------
     MENU DRAWER
     --------------------------------------------------------------------- */
  function renderMenu(r) {
    if (!menuContent) return;
    const l = L();
    const dishCount = r.menu.reduce((n, c) => n + c.items.length, 0);
    const items = r.menu.map((cat) => `
      <section class="resto-menu-cat">
        <div class="resto-menu-cat-head">
          <h4>${escapeHtml(t(cat.cat))}</h4>
          <span>${cat.items.length} ${escapeHtml(l.dishes)}</span>
        </div>
        ${cat.items.map((item) => `
          <article class="resto-menu-item">
            <div>
              <div class="resto-menu-item-title">
                <h5>${escapeHtml(t(item.name))}</h5>
                ${item.badge ? `<span class="item-badge${t(item.badge).slice(0, 4).toLowerCase().includes("new") ? " item-badge-hot" : ""}">${escapeHtml(t(item.badge))}</span>` : ""}
              </div>
              <p>${escapeHtml(t(item.desc))}</p>
            </div>
            <div class="resto-menu-item-price"><span>${escapeHtml(l.currency)}</span>${escapeHtml(item.price)}</div>
          </article>
        `).join("")}
      </section>
    `).join("");

    menuContent.innerHTML = `
      <div class="resto-menu-hero">
        <img src="${escapeHtml(r.hero)}" alt="${escapeHtml(t(r.name))}">
        <div class="resto-menu-hero-content">
          <div class="resto-menu-identity">
            <div class="resto-menu-mark">${escapeHtml(r.mark)}</div>
            <div>
              <h3>${escapeHtml(t(r.name))}</h3>
              <div class="resto-menu-meta">${escapeHtml(t(r.cuisine))} — ${escapeHtml(t(r.area))}</div>
            </div>
          </div>
          <div class="resto-menu-score">
            ${escapeHtml(l.rating)}<b>${escapeHtml(r.rating)}</b>
          </div>
        </div>
      </div>
      <div class="resto-menu-body">
        <div class="resto-menu-powered">
          <span>${escapeHtml(l.powered)}</span><span class="dot-sep">/</span>
          <span>${escapeHtml(l.network)}</span><span class="dot-sep">/</span>
          <span>${escapeHtml(r.identityNo)}</span><span class="dot-sep">/</span>
          <span>${dishCount} ${escapeHtml(l.dishes_label)}</span>
        </div>
        ${items || `<div class="resto-menu-empty">${escapeHtml(l.empty)}</div>`}
      </div>
    `;
  }

  function openMenu(id) {
    const r = RESTAURANTS.find((x) => x.id === id);
    if (!r) return;
    openRestaurantId = id;
    renderMenu(r);
    drawerRoot.classList.add("open");
    document.body.classList.add("nav-open-lock");
    closeBtn.focus();
    requestAnimationFrame(() => drawer.scrollTo({ top: 0, behavior: "auto" }));
  }

  function closeMenu() {
    drawerRoot.classList.remove("open");
    document.body.classList.remove("nav-open-lock");
    openRestaurantId = null;
  }

  closeBtn.addEventListener("click", closeMenu);
  overlay.addEventListener("click", closeMenu);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawerRoot.classList.contains("open")) closeMenu();
  });

  /* ---------------------------------------------------------------------
     CINEMATIC ANIMATED BACKDROP (lightweight video-feel canvas)
     Draws slowly drifting gradient "plates" + fine data-line ribbons.
     Paused when off-screen and disabled for prefers-reduced-motion.
     --------------------------------------------------------------------- */
  let rafId = null;
  let sceneStarted = false;

  function initAnimatedBackdrop() {
    const scene = animatedScene;
    if (VIDEO_BG) {
      const bg = document.querySelector(".resto-bg");
      if (bg && scene) scene.remove();
      if (bg) {
        const video = document.createElement("video");
        video.className = "resto-video";
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.preload = "metadata";
        const source = document.createElement("source");
        source.src = VIDEO_BG;
        source.type = "video/mp4";
        video.appendChild(source);
        bg.appendChild(video);
        video.play().catch(() => {});
      }
      return;
    }
    if (!scene || !scene.getContext) return;
    const ctx = scene.getContext("2d");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let w = 0, h = 0, dpr = 1;
    let t0 = performance.now();
    let visible = true;
    const orbs = [
      { x: 0.12, y: 0.18, r: 0.42, hue: [21, 101, 192], alpha: 0.20, dx: 0.00018, dy: 0.00012 },
      { x: 0.83, y: 0.24, r: 0.34, hue: [0, 188, 212], alpha: 0.13, dx: -0.00014, dy: 0.00016 },
      { x: 0.46, y: 0.86, r: 0.50, hue: [181, 101, 43], alpha: 0.16, dx: 0.00012, dy: -0.00010 }
    ];

    function resize() {
      const rect = scene.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      scene.width = Math.round(w * dpr);
      scene.height = Math.round(h * dpr);
    }

    function draw(now) {
      rafId = requestAnimationFrame(draw);
      if (!visible || !w) return;
      const t = (now - t0) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // drifting radial gradient "plates"
      orbs.forEach((o) => {
        const cx = (o.x + Math.sin(t * 0.18 + o.hue[0]) * 0.045) * w;
        const cy = (o.y + Math.cos(t * 0.16 + o.hue[2]) * 0.055) * h;
        const r = o.r * Math.min(w, h);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(${o.hue[0]},${o.hue[1]},${o.hue[2]},${o.alpha})`);
        g.addColorStop(0.55, `rgba(${o.hue[0]},${o.hue[1]},${o.hue[2]},${o.alpha * 0.28})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      });

      // fine "video frame" data ribbons
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "rgba(66,165,245,0.055)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const baseY = h * (0.16 + i * 0.18);
        const amp = 14 + i * 5;
        const speed = 0.00012 + i * 0.00002;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 10) {
          const y = baseY + Math.sin((x * speed) + t * (0.35 + i * 0.08)) * amp;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();

      // slow scanning dot to sell the "cinematic signal"
      const scanX = ((t * 0.028) % 1.2) * w - 0.1 * w;
      const grad = ctx.createLinearGradient(scanX, 0, scanX + 90, 0);
      grad.addColorStop(0, "rgba(0,188,212,0)");
      grad.addColorStop(0.5, "rgba(0,188,212,0.05)");
      grad.addColorStop(1, "rgba(0,188,212,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(scanX, 0, 90, h);
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { visible = entry.isIntersecting; });
    }, { threshold: 0.05 });
    io.observe(scene);
    resize();
    window.addEventListener("resize", resize);
    if (!sceneStarted) {
      sceneStarted = true;
      rafId = requestAnimationFrame(draw);
    }
  }

  /* ---------------------------------------------------------------------
     INITIALIZE
     --------------------------------------------------------------------- */
  function updateStats() {
    const t = document.getElementById("restoTotalRestaurants");
    const d = document.getElementById("restoTotalDishes");
    const r = document.getElementById("restoTotalRating");
    if (t) t.textContent = String(RESTAURANTS.length).padStart(2, "0");
    if (d) d.textContent = String(RESTAURANTS.reduce((n, x) => n + x.menu.reduce((m, c) => m + c.items.length, 0), 0));
    if (r) {
      const avg = RESTAURANTS.reduce((s, x) => s + parseFloat(x.rating), 0) / RESTAURANTS.length;
      r.textContent = avg.toFixed(1);
    }
  }

  function renderAll() {
    updateStats();
    renderFilters();
    renderCards();
    if (openRestaurantId) {
      const r = RESTAURANTS.find((x) => x.id === openRestaurantId);
      if (r) renderMenu(r);
    }
  }

  document.addEventListener("mureeh:langchange", renderAll);
  initAnimatedBackdrop();
  renderAll();
})();
