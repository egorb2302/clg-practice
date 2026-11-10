import type { Db } from "./db";

type DemoProduct = {
  slug: string;
  code: string;
  title: string;
  position: "front" | "rear" | "kit";
  material: string;
  vehicles: string[];
  variants: { vehicle: string; title: string; price: number | null; available?: boolean }[];
};

const demo: DemoProduct[] = [
  {
    slug: "jac-t9-front-tube",
    code: "DEMO-T9-F1",
    title: "Защита переднего бампера, труба 63 мм",
    position: "front",
    material: "aisi304",
    vehicles: ["jac-t9"],
    variants: [
      { vehicle: "jac-t9", title: "Без защиты картера", price: 4_590_000 },
      { vehicle: "jac-t9", title: "С защитой картера", price: 5_890_000 },
    ],
  },
  {
    slug: "jac-t9-rear-corners",
    code: "DEMO-T9-R1",
    title: "Защита заднего бампера, уголки",
    position: "rear",
    material: "aisi304",
    vehicles: ["jac-t9"],
    variants: [{ vehicle: "jac-t9", title: "Уголки 63 мм", price: 3_290_000 }],
  },
  {
    slug: "jac-t9-kit-black",
    code: "DEMO-T9-K1",
    title: "Комплект защиты, чёрный металл",
    position: "kit",
    material: "powder",
    vehicles: ["jac-t9"],
    variants: [{ vehicle: "jac-t9", title: "Перед + зад", price: null }],
  },
  {
    slug: "haval-h3-front-double",
    code: "DEMO-H3-F1",
    title: "Защита переднего бампера, двойная труба",
    position: "front",
    material: "aisi304",
    vehicles: ["haval-h3"],
    variants: [
      { vehicle: "haval-h3", title: "Двойная труба 63/51 мм", price: 5_190_000 },
      { vehicle: "haval-h3", title: "Двойная труба с декором", price: 5_990_000, available: false },
    ],
  },
  {
    slug: "haval-h3-rear-tube",
    code: "DEMO-H3-R1",
    title: "Защита заднего бампера, труба 63 мм",
    position: "rear",
    material: "powder",
    vehicles: ["haval-h3"],
    variants: [{ vehicle: "haval-h3", title: "Труба 63 мм", price: 2_790_000 }],
  },
  {
    slug: "universal-steps",
    code: "DEMO-U-S1",
    title: "Комплект порогов-труб",
    position: "kit",
    material: "aisi304",
    vehicles: ["jac-t9", "haval-h3"],
    variants: [
      { vehicle: "jac-t9", title: "Пороги для JAC T9", price: 6_490_000 },
      { vehicle: "haval-h3", title: "Пороги для Haval H3", price: 6_190_000 },
    ],
  },
];

export async function seed(db: Db) {
  await db`
    insert into delivery_methods (code, label, sort) values
      ('pickup', 'Самовывоз', 1), ('shipping', 'Доставка транспортной компанией', 2), ('install', 'Установка у нас', 3)
    on conflict (code) do nothing`;
  await db`
    insert into materials (code, label) values
      ('aisi304', 'Нержавеющая сталь AISI 304, полировка'), ('powder', 'Чёрный металл, порошковое покрытие')
    on conflict (code) do nothing`;
  await db`
    insert into vehicle_models (slug, make, model, sort) values ('jac-t9', 'JAC', 'T9', 1), ('haval-h3', 'Haval', 'H3', 2)
    on conflict (slug) do nothing`;
  await db`
    insert into site_settings (key, value) values ('contacts', ${db.json({
      phone: "+7 900 000-00-00 (тест)",
      email: "hello@armorix.test",
      hours: "по будням с 9:00 до 18:00 (тест)",
    })})
    on conflict (key) do nothing`;

  const vehicles = new Map(
    (await db<{ id: string; slug: string }[]>`select id, slug from vehicle_models`).map((v) => [v.slug, v.id]),
  );
  for (const p of demo) {
    const [row] = await db<{ id: string }[]>`
      insert into products (slug, code, title, position, description, composition, material, installation, status, published_at)
      values (${p.slug}, ${p.code}, ${p.title}, ${p.position},
        ${"Демонстрационная позиция для стенда. Реальные характеристики подтвердит менеджер."},
        ${["Основная труба", "Кронштейны", "Крепёж"]}, ${p.material},
        ${"Монтаж в штатные точки, без сверления (демо)."}, 'published', now())
      on conflict (slug) do nothing returning id`;
    if (!row) continue;
    for (const slug of p.vehicles) {
      await db`insert into compatibilities (product_id, vehicle_model_id) values (${row.id}, ${vehicles.get(slug)!})`;
    }
    for (const [i, v] of p.variants.entries()) {
      await db`
        insert into variants (product_id, vehicle_model_id, title, price_kopecks, available, sort)
        values (${row.id}, ${vehicles.get(v.vehicle)!}, ${v.title}, ${v.price}, ${v.available ?? true}, ${i})`;
    }
  }
}
