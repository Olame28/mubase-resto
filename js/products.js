/* MUBASE POS - Catalogue officiel MUBASE Coffee et Restaurant
 * Prix officiels : ne pas inventer. Les articles "prix à définir"
 * restent bloqués (active=false) jusqu'à configuration par le gérant.
 * Les accompagnements à 0 USD sont marqués free=true (inclus/gratuits).
 */
(function () {
  'use strict';
  window.MUBASE = window.MUBASE || {};

  var P = {};

  // Liste ordonnée des catégories affichées en onglets
  P.CATEGORIES = [
    'Shawarmas', 'Sandwichs', 'Omelettes', 'Burgers', 'Pizzas',
    'Salades', 'Nos plats', "Snack's", 'Accompagnements', 'Autres',
    'Cafés chauds', 'Thés et infusions', 'Détox',
    'Jus naturels', 'Jus en bouteille', 'Mojito', 'Milkshake', 'Crème'
  ];

  // Catalogue officiel. priceUSD en dollars, priceFC en francs congolais.
  // Les articles à prix fixe FC (Samboussa, Shisha, Eau) utilisent priceFC.
  var CATALOG = [
    // SHAWARMAS
    { name: 'Shawarma poulet', cat: 'Shawarmas', usd: 4 },
    { name: 'Shawarma boeuf', cat: 'Shawarmas', usd: 4 },
    // SANDWICHS
    { name: 'Sandwich poulet', cat: 'Sandwichs', usd: 5 },
    { name: 'Sandwich boeuf', cat: 'Sandwichs', usd: 5 },
    { name: 'Sandwich végétarien', cat: 'Sandwichs', usd: 4 },
    { name: 'Club sandwich', cat: 'Sandwichs', usd: 7 },
    // OMELETTES
    { name: 'Omelette nature', cat: 'Omelettes', usd: 2 },
    { name: 'Spanish omelette', cat: 'Omelettes', usd: 3 },
    { name: 'Omelette spécial', cat: 'Omelettes', usd: 5 },
    // BURGERS
    { name: 'Boeuf burger', cat: 'Burgers', usd: 6 },
    { name: 'Chiken burger', cat: 'Burgers', usd: 6 },
    { name: 'Mubase burger (boeuf, fromage, laitue, tomate, oignon)', cat: 'Burgers', usd: 6 },
    // PIZZAS
    { name: 'Pizza poulet', cat: 'Pizzas', usd: 10 },
    { name: 'Pizza hawaienne', cat: 'Pizzas', usd: 10 },
    { name: 'Pizza 4 saisons', cat: 'Pizzas', usd: 12 },
    // SALADES
    { name: 'Salade verte', cat: 'Salades', usd: 4 },
    { name: 'Salade au poulet & mangue', cat: 'Salades', usd: 6 },
    // NOS PLATS
    { name: 'Poulet mayo', cat: 'Nos plats', usd: 10 },
    { name: 'Poisson grillé', cat: 'Nos plats', usd: 8 },
    { name: 'Poulet', cat: 'Nos plats', usd: 6 },
    // SNACK'S
    { name: 'Samboussa (3pc)', cat: "Snack's", fc: 5000 },
    { name: 'Croquet monsieur', cat: "Snack's", usd: 5 },
    { name: 'Assiette composé (sambaza, fromage, saucis)', cat: "Snack's", undefined: true },
    { name: 'Spaghetti bolognaise', cat: "Snack's", undefined: true },
    // ACCOMPAGNEMENTS (gratuits / inclus)
    { name: 'Riz', cat: 'Accompagnements', usd: 0, free: true },
    { name: 'Fritte pomme de terre', cat: 'Accompagnements', usd: 0, free: true },
    { name: 'Fritte banane plantain', cat: 'Accompagnements', usd: 0, free: true },
    { name: 'Foufou blanc', cat: 'Accompagnements', usd: 0, free: true },
    // AUTRES
    { name: 'Shisha', cat: 'Autres', fc: 10000 },
    { name: 'Eau minérale', cat: 'Autres', fc: 2000 },
    // CAFÉS CHAUDS
    { name: 'Espresso', cat: 'Cafés chauds', usd: 1.5 },
    { name: 'Espresso compana', cat: 'Cafés chauds', usd: 2.5 },
    { name: 'Café noir', cat: 'Cafés chauds', usd: 2 },
    { name: 'Americano', cat: 'Cafés chauds', usd: 2 },
    { name: 'Café au lait', cat: 'Cafés chauds', usd: 3 },
    { name: 'Café latte', cat: 'Cafés chauds', usd: 3 },
    { name: 'Cappuccino', cat: 'Cafés chauds', usd: 3 },
    { name: 'Caramel macchiato', cat: 'Cafés chauds', usd: 3.5 },
    { name: 'Nutella latte', cat: 'Cafés chauds', usd: 3.5 },
    { name: 'Café mocha', cat: 'Cafés chauds', usd: 3.5 },
    // THÉS ET INFUSIONS
    { name: 'Masala Tea', cat: 'Thés et infusions', usd: 2 },
    { name: 'Infusion menthe-citron', cat: 'Thés et infusions', usd: 2.5 },
    { name: 'Infusion (ginger, citron, clous de girofle, haj)', cat: 'Thés et infusions', usd: 3 },
    { name: 'Dawa Tea', cat: 'Thés et infusions', usd: 3 },
    { name: 'African Tea', cat: 'Thés et infusions', usd: 3 },
    { name: 'Thé noir', cat: 'Thés et infusions', usd: 2 },
    { name: 'Green Tea', cat: 'Thés et infusions', usd: 2 },
    // DÉTOX
    { name: 'Energie rouge (betterave, ananas, ginger)', cat: 'Détox', usd: 5 },
    { name: 'Herbal green détox (mangue, ananas, carotte, concombre, citron, pomme verte, épinard...)', cat: 'Détox', usd: 5 },
    { name: 'Fraîcheur verte (concombre, céleri, pomme verte)', cat: 'Détox', usd: 5 },
    // JUS NATURELS
    { name: "Jus d'orange", cat: 'Jus naturels', usd: 3 },
    { name: 'Jus de pastèque', cat: 'Jus naturels', usd: 2.5 },
    { name: "Jus d'ananas", cat: 'Jus naturels', usd: 2.5 },
    { name: 'Jus de marakuja', cat: 'Jus naturels', usd: 3.5 },
    { name: 'Jus de mangue', cat: 'Jus naturels', usd: 3 },
    { name: 'Jus de prune', cat: 'Jus naturels', usd: 2.5 },
    { name: 'Jus de fraise', cat: 'Jus naturels', usd: 3.5 },
    { name: 'Cocktail de fruits', cat: 'Jus naturels', usd: 4 },
    // JUS EN BOUTEILLE / SOFT
    { name: 'Iced Afia', cat: 'Jus en bouteille', usd: 2 },
    { name: 'Fanta', cat: 'Jus en bouteille', usd: 1 },
    // MOJITO
    { name: 'Lemon menthe mojito', cat: 'Mojito', usd: 3 },
    { name: 'Strewberry mojito', cat: 'Mojito', usd: 3 },
    { name: 'Passion mojito', cat: 'Mojito', usd: 3 },
    { name: 'Pina collada', cat: 'Mojito', usd: 4 },
    // MILKSHAKE
    { name: 'Vanilla shake', cat: 'Milkshake', usd: 4 },
    { name: 'Strewberry shake', cat: 'Milkshake', usd: 4 },
    { name: 'Chocolat shake', cat: 'Milkshake', usd: 4 },
    // CRÈME
    { name: 'Vanilla ice cream', cat: 'Crème', usd: 1 },
    { name: 'Chocolat ice cream', cat: 'Crème', usd: 1 },
    { name: 'Strewberry ice cream', cat: 'Crème', usd: 1 }
  ];

  P.CATALOG = CATALOG;

  // Identifiant stable d'un produit = index dans le catalogue + nom
  P.productId = function (item) {
    return 'p' + P.CATALOG.indexOf(item);
  };

  // Convertit une entrée catalogue en objet produit stocké
  P.toProduct = function (item, index) {
    var p = {
      id: 'p' + index,
      name: item.name,
      category: item.cat,
      active: !item.undefined,
      free: !!item.free,
      note: item.undefined ? 'Prix à définir' : ''
    };
    if (item.usd !== undefined) p.priceUSD = item.usd;
    if (item.fc !== undefined) p.priceFC = item.fc;
    return p;
  };

  // Initialise le catalogue si la base est vide.
  // Ne touche JAMAIS au catalogue si des produits existent déjà
  // (les modifications du gérant sont préservées).
  P.seedIfEmpty = function () {
    return MUBASE.DB.getProducts().then(function (existing) {
      if (existing && existing.length > 0) return false;
      var products = CATALOG.map(P.toProduct);
      return Promise.all(products.map(function (p) {
        return MUBASE.DB.saveProduct(p);
      })).then(function () { return true; });
    });
  };

  // Paramètres par défaut
  P.DEFAULT_SETTINGS = {
    rate: 2800,
    rounding: 100,
    serverName: ''
  };

  MUBASE.Products = P;
})();
