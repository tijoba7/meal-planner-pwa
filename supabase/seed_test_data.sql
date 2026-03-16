-- ─── Seed: Test data for social feed ──────────────────────────────────────────
-- Paste this into the Supabase SQL Editor to populate the feed with test posts.
-- Creates 5 test users, 10 recipes, friendships, likes, comments, and ratings.
-- Safe to run multiple times (uses ON CONFLICT / IF NOT EXISTS where possible).
--
-- NOTE: If tijoba7@gmail.com already exists, this script will make all test
-- users friends with that account so recipes appear in the friends feed.

BEGIN;

-- ─── 1. Test users in auth.users ────────────────────────────────────────────
-- The handle_new_user() trigger auto-creates profiles rows.

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000000',
   'a0000001-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'alice@example.com', crypt('TestPass123!', gen_salt('bf')),
   now(), '{"display_name": "Alice Chen"}'::jsonb, now(), now()),

  ('00000000-0000-0000-0000-000000000000',
   'a0000002-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'bob@example.com', crypt('TestPass123!', gen_salt('bf')),
   now(), '{"display_name": "Bob Martinez"}'::jsonb, now(), now()),

  ('00000000-0000-0000-0000-000000000000',
   'a0000003-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'carlos@example.com', crypt('TestPass123!', gen_salt('bf')),
   now(), '{"display_name": "Carlos Silva"}'::jsonb, now(), now()),

  ('00000000-0000-0000-0000-000000000000',
   'a0000004-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
   'diana@example.com', crypt('TestPass123!', gen_salt('bf')),
   now(), '{"display_name": "Diana Park"}'::jsonb, now(), now()),

  ('00000000-0000-0000-0000-000000000000',
   'a0000005-0000-0000-0000-000000000005', 'authenticated', 'authenticated',
   'emma@example.com', crypt('TestPass123!', gen_salt('bf')),
   now(), '{"display_name": "Emma Johnson"}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Enrich profiles ─────────────────────────────────────────────────────

UPDATE public.profiles SET
  bio = 'Home cook and dumpling enthusiast from San Francisco',
  dietary_preferences = ARRAY['vegetarian-friendly', 'asian'],
  avatar_url = 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice'
WHERE id = 'a0000001-0000-0000-0000-000000000001';

UPDATE public.profiles SET
  bio = 'BBQ pitmaster and taco lover. Weekend griller.',
  dietary_preferences = ARRAY['meat-lover', 'mexican'],
  avatar_url = 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob'
WHERE id = 'a0000002-0000-0000-0000-000000000002';

UPDATE public.profiles SET
  bio = 'Brazilian chef exploring Mediterranean flavors',
  dietary_preferences = ARRAY['mediterranean', 'gluten-free'],
  avatar_url = 'https://api.dicebear.com/7.x/avataaars/svg?seed=carlos'
WHERE id = 'a0000003-0000-0000-0000-000000000003';

UPDATE public.profiles SET
  bio = 'Korean food blogger and recipe developer',
  dietary_preferences = ARRAY['korean', 'fermented-foods'],
  avatar_url = 'https://api.dicebear.com/7.x/avataaars/svg?seed=diana'
WHERE id = 'a0000004-0000-0000-0000-000000000004';

UPDATE public.profiles SET
  bio = 'Plant-based baker and pasta maker',
  dietary_preferences = ARRAY['vegan', 'italian'],
  avatar_url = 'https://api.dicebear.com/7.x/avataaars/svg?seed=emma'
WHERE id = 'a0000005-0000-0000-0000-000000000005';

-- ─── 3. Recipes ─────────────────────────────────────────────────────────────
-- Each recipe stores Schema.org Recipe JSON in the data column.

-- Recipe 1: Alice's Spicy Mapo Tofu
INSERT INTO public.recipes_cloud (id, author_id, data, visibility, published_at, created_at) VALUES
('r0000001-0000-0000-0000-000000000001',
 'a0000001-0000-0000-0000-000000000001',
 '{
   "@type": "Recipe",
   "name": "Spicy Mapo Tofu",
   "description": "Authentic Sichuan mapo tofu with silky tofu, ground pork, and a fiery doubanjiang sauce. Pure comfort food.",
   "image": "https://images.unsplash.com/photo-1582452919408-23b1e70b5e0c?w=800",
   "author": "Alice Chen",
   "prepTime": "PT15M",
   "cookTime": "PT20M",
   "totalTime": "PT35M",
   "recipeYield": "4 servings",
   "recipeCategory": "Main Course",
   "recipeCuisine": "Sichuan Chinese",
   "keywords": ["spicy", "tofu", "sichuan", "comfort-food", "quick"],
   "recipeIngredient": [
     {"name": "silken tofu", "amount": 400, "unit": "g"},
     {"name": "ground pork", "amount": 150, "unit": "g"},
     {"name": "doubanjiang (chili bean paste)", "amount": 2, "unit": "tbsp"},
     {"name": "Sichuan peppercorns", "amount": 1, "unit": "tsp"},
     {"name": "garlic, minced", "amount": 3, "unit": "cloves"},
     {"name": "green onions", "amount": 3, "unit": "stalks"},
     {"name": "soy sauce", "amount": 1, "unit": "tbsp"},
     {"name": "sesame oil", "amount": 1, "unit": "tsp"},
     {"name": "cornstarch slurry", "amount": 2, "unit": "tbsp"}
   ],
   "recipeInstructions": [
     {"@type": "HowToStep", "text": "Cut tofu into 2cm cubes and blanch in salted boiling water for 2 minutes. Drain gently."},
     {"@type": "HowToStep", "text": "Heat oil in a wok over high heat. Brown the ground pork, breaking it into small pieces."},
     {"@type": "HowToStep", "text": "Push pork aside, add doubanjiang and garlic. Stir-fry until the oil turns red and fragrant, about 1 minute."},
     {"@type": "HowToStep", "text": "Add 1 cup water and soy sauce. Bring to a simmer."},
     {"@type": "HowToStep", "text": "Gently slide in the tofu cubes. Simmer for 5 minutes without stirring."},
     {"@type": "HowToStep", "text": "Add cornstarch slurry and gently fold. Top with ground Sichuan pepper, sesame oil, and sliced green onions."}
   ]
 }'::jsonb,
 'public', now() - interval '6 days', now() - interval '6 days')
ON CONFLICT (id) DO NOTHING;

-- Recipe 2: Bob's Smoked Brisket Tacos
INSERT INTO public.recipes_cloud (id, author_id, data, visibility, published_at, created_at) VALUES
('r0000002-0000-0000-0000-000000000002',
 'a0000002-0000-0000-0000-000000000002',
 '{
   "@type": "Recipe",
   "name": "Smoked Brisket Tacos",
   "description": "Low-and-slow smoked brisket, shredded and served in warm tortillas with pickled onions and cilantro-lime crema.",
   "image": "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800",
   "author": "Bob Martinez",
   "prepTime": "PT30M",
   "cookTime": "PT8H",
   "totalTime": "PT8H30M",
   "recipeYield": "12 tacos",
   "recipeCategory": "Main Course",
   "recipeCuisine": "Tex-Mex",
   "keywords": ["bbq", "tacos", "smoked", "brisket", "weekend-project"],
   "recipeIngredient": [
     {"name": "beef brisket", "amount": 2, "unit": "kg"},
     {"name": "BBQ dry rub", "amount": 3, "unit": "tbsp"},
     {"name": "corn tortillas", "amount": 12, "unit": ""},
     {"name": "red onion, thinly sliced", "amount": 1, "unit": ""},
     {"name": "apple cider vinegar", "amount": 0.5, "unit": "cup"},
     {"name": "sour cream", "amount": 0.5, "unit": "cup"},
     {"name": "lime juice", "amount": 2, "unit": "tbsp"},
     {"name": "fresh cilantro", "amount": 0.5, "unit": "cup"}
   ],
   "recipeInstructions": [
     {"@type": "HowToStep", "text": "Generously coat brisket with dry rub. Wrap in plastic and refrigerate overnight."},
     {"@type": "HowToStep", "text": "Set smoker to 110°C (225°F) with oak or mesquite wood. Smoke brisket fat-side up for 8 hours until internal temp reaches 93°C (200°F)."},
     {"@type": "HowToStep", "text": "While smoking, quick-pickle the onions: combine vinegar, sugar, and salt. Soak sliced onions for at least 1 hour."},
     {"@type": "HowToStep", "text": "Make crema: mix sour cream, lime juice, chopped cilantro, salt."},
     {"@type": "HowToStep", "text": "Rest brisket 30 minutes wrapped in butcher paper. Shred against the grain."},
     {"@type": "HowToStep", "text": "Warm tortillas, pile with brisket, pickled onions, crema, and extra cilantro."}
   ]
 }'::jsonb,
 'public', now() - interval '5 days', now() - interval '5 days')
ON CONFLICT (id) DO NOTHING;

-- Recipe 3: Carlos's Mediterranean Shakshuka
INSERT INTO public.recipes_cloud (id, author_id, data, visibility, published_at, created_at) VALUES
('r0000003-0000-0000-0000-000000000003',
 'a0000003-0000-0000-0000-000000000003',
 '{
   "@type": "Recipe",
   "name": "Mediterranean Shakshuka",
   "description": "Eggs poached in a spiced tomato-pepper sauce with crumbled feta. Perfect for brunch or a quick dinner.",
   "image": "https://images.unsplash.com/photo-1590412200988-a436970781fa?w=800",
   "author": "Carlos Silva",
   "prepTime": "PT10M",
   "cookTime": "PT25M",
   "totalTime": "PT35M",
   "recipeYield": "2 servings",
   "recipeCategory": "Breakfast",
   "recipeCuisine": "Mediterranean",
   "keywords": ["eggs", "brunch", "one-pan", "vegetarian", "quick"],
   "recipeIngredient": [
     {"name": "eggs", "amount": 4, "unit": ""},
     {"name": "canned crushed tomatoes", "amount": 400, "unit": "g"},
     {"name": "red bell pepper, diced", "amount": 1, "unit": ""},
     {"name": "onion, diced", "amount": 1, "unit": ""},
     {"name": "garlic, minced", "amount": 2, "unit": "cloves"},
     {"name": "cumin", "amount": 1, "unit": "tsp"},
     {"name": "smoked paprika", "amount": 1, "unit": "tsp"},
     {"name": "feta cheese", "amount": 60, "unit": "g"},
     {"name": "fresh parsley", "amount": 2, "unit": "tbsp"},
     {"name": "crusty bread", "amount": 4, "unit": "slices"}
   ],
   "recipeInstructions": [
     {"@type": "HowToStep", "text": "Heat olive oil in a deep skillet over medium heat. Sauté onion and bell pepper until soft, about 5 minutes."},
     {"@type": "HowToStep", "text": "Add garlic, cumin, and paprika. Cook 1 minute until fragrant."},
     {"@type": "HowToStep", "text": "Pour in crushed tomatoes, season with salt and pepper. Simmer 10 minutes until thickened."},
     {"@type": "HowToStep", "text": "Make 4 wells in the sauce. Crack an egg into each well."},
     {"@type": "HowToStep", "text": "Cover and cook 5-7 minutes until egg whites are set but yolks are still runny."},
     {"@type": "HowToStep", "text": "Crumble feta over top, sprinkle with parsley. Serve with crusty bread for dipping."}
   ]
 }'::jsonb,
 'public', now() - interval '4 days', now() - interval '4 days')
ON CONFLICT (id) DO NOTHING;

-- Recipe 4: Diana's Classic Kimchi Jjigae
INSERT INTO public.recipes_cloud (id, author_id, data, visibility, published_at, created_at) VALUES
('r0000004-0000-0000-0000-000000000004',
 'a0000004-0000-0000-0000-000000000004',
 '{
   "@type": "Recipe",
   "name": "Classic Kimchi Jjigae",
   "description": "Hearty Korean kimchi stew with pork belly, tofu, and well-fermented kimchi. The ultimate Korean comfort soup.",
   "image": "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800",
   "author": "Diana Park",
   "prepTime": "PT10M",
   "cookTime": "PT30M",
   "totalTime": "PT40M",
   "recipeYield": "3 servings",
   "recipeCategory": "Soup",
   "recipeCuisine": "Korean",
   "keywords": ["korean", "stew", "kimchi", "comfort-food", "spicy"],
   "recipeIngredient": [
     {"name": "aged kimchi", "amount": 300, "unit": "g"},
     {"name": "pork belly, sliced", "amount": 200, "unit": "g"},
     {"name": "firm tofu", "amount": 200, "unit": "g"},
     {"name": "gochugaru (red pepper flakes)", "amount": 1, "unit": "tbsp"},
     {"name": "gochujang", "amount": 1, "unit": "tbsp"},
     {"name": "garlic, minced", "amount": 3, "unit": "cloves"},
     {"name": "green onions", "amount": 2, "unit": "stalks"},
     {"name": "sesame oil", "amount": 1, "unit": "tsp"},
     {"name": "steamed rice", "amount": 3, "unit": "bowls"}
   ],
   "recipeInstructions": [
     {"@type": "HowToStep", "text": "Cut kimchi into bite-sized pieces, reserving the juice. Slice pork belly thin."},
     {"@type": "HowToStep", "text": "In a pot, sauté pork belly over medium-high heat until fat renders, about 3 minutes."},
     {"@type": "HowToStep", "text": "Add kimchi and stir-fry for 3 minutes until slightly caramelized."},
     {"@type": "HowToStep", "text": "Add 2 cups water, kimchi juice, gochugaru, gochujang, and garlic. Bring to a boil."},
     {"@type": "HowToStep", "text": "Reduce to medium heat and simmer 20 minutes. Add tofu cubes in the last 5 minutes."},
     {"@type": "HowToStep", "text": "Finish with sesame oil and sliced green onions. Serve bubbling hot with steamed rice."}
   ]
 }'::jsonb,
 'public', now() - interval '3 days', now() - interval '3 days')
ON CONFLICT (id) DO NOTHING;

-- Recipe 5: Emma's Vegan Mushroom Risotto
INSERT INTO public.recipes_cloud (id, author_id, data, visibility, published_at, created_at) VALUES
('r0000005-0000-0000-0000-000000000005',
 'a0000005-0000-0000-0000-000000000005',
 '{
   "@type": "Recipe",
   "name": "Creamy Vegan Mushroom Risotto",
   "description": "Rich and creamy risotto made with mixed wild mushrooms and nutritional yeast. No dairy, all flavor.",
   "image": "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=800",
   "author": "Emma Johnson",
   "prepTime": "PT15M",
   "cookTime": "PT35M",
   "totalTime": "PT50M",
   "recipeYield": "4 servings",
   "recipeCategory": "Main Course",
   "recipeCuisine": "Italian",
   "keywords": ["vegan", "risotto", "mushroom", "italian", "comfort-food"],
   "recipeIngredient": [
     {"name": "arborio rice", "amount": 300, "unit": "g"},
     {"name": "mixed mushrooms (shiitake, oyster, cremini)", "amount": 400, "unit": "g"},
     {"name": "vegetable broth, warm", "amount": 1, "unit": "L"},
     {"name": "dry white wine", "amount": 0.5, "unit": "cup"},
     {"name": "shallots, diced", "amount": 2, "unit": ""},
     {"name": "garlic, minced", "amount": 3, "unit": "cloves"},
     {"name": "nutritional yeast", "amount": 3, "unit": "tbsp"},
     {"name": "olive oil", "amount": 2, "unit": "tbsp"},
     {"name": "fresh thyme", "amount": 4, "unit": "sprigs"},
     {"name": "truffle oil (optional)", "amount": 1, "unit": "tsp"}
   ],
   "recipeInstructions": [
     {"@type": "HowToStep", "text": "Sauté mushrooms in batches in olive oil over high heat until golden. Season with salt, set aside."},
     {"@type": "HowToStep", "text": "In the same pan, cook shallots until translucent. Add garlic and thyme, cook 1 minute."},
     {"@type": "HowToStep", "text": "Add rice and toast 2 minutes until edges are translucent. Deglaze with wine."},
     {"@type": "HowToStep", "text": "Add warm broth one ladle at a time, stirring constantly. Wait until each addition is absorbed before adding the next."},
     {"@type": "HowToStep", "text": "After about 18 minutes (rice should be al dente), fold in mushrooms and nutritional yeast."},
     {"@type": "HowToStep", "text": "Remove from heat, cover 2 minutes. Serve with a drizzle of truffle oil and fresh thyme."}
   ]
 }'::jsonb,
 'public', now() - interval '2 days', now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

-- Recipe 6: Alice's Pork Dumplings (Jiaozi)
INSERT INTO public.recipes_cloud (id, author_id, data, visibility, published_at, created_at) VALUES
('r0000006-0000-0000-0000-000000000006',
 'a0000001-0000-0000-0000-000000000001',
 '{
   "@type": "Recipe",
   "name": "Homemade Pork Dumplings (Jiaozi)",
   "description": "Juicy pork and cabbage dumplings with hand-rolled wrappers. A weekend project that feeds a crowd.",
   "image": "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800",
   "author": "Alice Chen",
   "prepTime": "PT60M",
   "cookTime": "PT15M",
   "totalTime": "PT1H15M",
   "recipeYield": "50 dumplings",
   "recipeCategory": "Appetizer",
   "recipeCuisine": "Chinese",
   "keywords": ["dumplings", "chinese", "pork", "weekend-project", "freezer-friendly"],
   "recipeIngredient": [
     {"name": "ground pork", "amount": 500, "unit": "g"},
     {"name": "napa cabbage, finely chopped", "amount": 300, "unit": "g"},
     {"name": "ginger, grated", "amount": 1, "unit": "tbsp"},
     {"name": "soy sauce", "amount": 2, "unit": "tbsp"},
     {"name": "sesame oil", "amount": 1, "unit": "tbsp"},
     {"name": "all-purpose flour", "amount": 400, "unit": "g"},
     {"name": "boiling water", "amount": 240, "unit": "ml"},
     {"name": "black vinegar", "amount": 3, "unit": "tbsp"},
     {"name": "chili oil", "amount": 1, "unit": "tbsp"}
   ],
   "recipeInstructions": [
     {"@type": "HowToStep", "text": "Make dough: pour boiling water into flour, mix until a shaggy dough forms. Knead 10 minutes until smooth. Rest 30 minutes covered."},
     {"@type": "HowToStep", "text": "Salt cabbage, let sit 10 minutes, then squeeze out excess water."},
     {"@type": "HowToStep", "text": "Mix pork, cabbage, ginger, soy sauce, and sesame oil. Stir in one direction until mixture is sticky."},
     {"@type": "HowToStep", "text": "Roll dough into a log and cut into 50 small pieces. Roll each into a thin circle."},
     {"@type": "HowToStep", "text": "Place 1 tbsp filling in center, fold and pleat into crescent shapes."},
     {"@type": "HowToStep", "text": "Boil in batches: add to boiling water, stir gently. When they float, add 1 cup cold water. Repeat twice. Done when they float the third time."},
     {"@type": "HowToStep", "text": "Serve with black vinegar and chili oil dipping sauce."}
   ]
 }'::jsonb,
 'public', now() - interval '5 days', now() - interval '5 days')
ON CONFLICT (id) DO NOTHING;

-- Recipe 7: Bob's Classic Guacamole
INSERT INTO public.recipes_cloud (id, author_id, data, visibility, published_at, created_at) VALUES
('r0000007-0000-0000-0000-000000000007',
 'a0000002-0000-0000-0000-000000000002',
 '{
   "@type": "Recipe",
   "name": "Perfect Guacamole",
   "description": "Simple, chunky guacamole with ripe avocados, lime, and just enough jalapeño. No filler, no nonsense.",
   "image": "https://images.unsplash.com/photo-1600803907087-f56d462fd26b?w=800",
   "author": "Bob Martinez",
   "prepTime": "PT10M",
   "cookTime": "PT0M",
   "totalTime": "PT10M",
   "recipeYield": "4 servings",
   "recipeCategory": "Appetizer",
   "recipeCuisine": "Mexican",
   "keywords": ["avocado", "mexican", "quick", "no-cook", "party"],
   "recipeIngredient": [
     {"name": "ripe avocados", "amount": 3, "unit": ""},
     {"name": "lime juice", "amount": 2, "unit": "tbsp"},
     {"name": "red onion, finely diced", "amount": 0.25, "unit": "cup"},
     {"name": "jalapeño, seeded and minced", "amount": 1, "unit": ""},
     {"name": "fresh cilantro, chopped", "amount": 3, "unit": "tbsp"},
     {"name": "Roma tomato, diced", "amount": 1, "unit": ""},
     {"name": "salt", "amount": 0.5, "unit": "tsp"}
   ],
   "recipeInstructions": [
     {"@type": "HowToStep", "text": "Halve avocados and remove pits. Scoop flesh into a bowl."},
     {"@type": "HowToStep", "text": "Add lime juice and salt. Mash with a fork to desired consistency (I like it chunky)."},
     {"@type": "HowToStep", "text": "Fold in onion, jalapeño, cilantro, and tomato. Taste and adjust salt and lime."},
     {"@type": "HowToStep", "text": "Serve immediately with tortilla chips. Press plastic wrap directly onto surface if storing."}
   ]
 }'::jsonb,
 'public', now() - interval '1 day', now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

-- Recipe 8: Diana's Bibimbap
INSERT INTO public.recipes_cloud (id, author_id, data, visibility, published_at, created_at) VALUES
('r0000008-0000-0000-0000-000000000008',
 'a0000004-0000-0000-0000-000000000004',
 '{
   "@type": "Recipe",
   "name": "Classic Bibimbap",
   "description": "Colorful Korean rice bowl with sautéed vegetables, a fried egg, and spicy gochujang sauce. Mix it all together.",
   "image": "https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=800",
   "author": "Diana Park",
   "prepTime": "PT30M",
   "cookTime": "PT20M",
   "totalTime": "PT50M",
   "recipeYield": "2 servings",
   "recipeCategory": "Main Course",
   "recipeCuisine": "Korean",
   "keywords": ["korean", "rice-bowl", "colorful", "healthy", "bibimbap"],
   "recipeIngredient": [
     {"name": "steamed rice", "amount": 2, "unit": "cups"},
     {"name": "beef bulgogi (thinly sliced)", "amount": 150, "unit": "g"},
     {"name": "spinach, blanched", "amount": 100, "unit": "g"},
     {"name": "bean sprouts", "amount": 100, "unit": "g"},
     {"name": "carrot, julienned", "amount": 1, "unit": ""},
     {"name": "zucchini, sliced", "amount": 0.5, "unit": ""},
     {"name": "eggs", "amount": 2, "unit": ""},
     {"name": "gochujang", "amount": 2, "unit": "tbsp"},
     {"name": "sesame oil", "amount": 2, "unit": "tsp"},
     {"name": "sesame seeds", "amount": 1, "unit": "tsp"}
   ],
   "recipeInstructions": [
     {"@type": "HowToStep", "text": "Season and sauté each vegetable separately with a little sesame oil and salt. Keep colors vibrant."},
     {"@type": "HowToStep", "text": "Marinate beef in soy sauce, sesame oil, garlic, sugar for 15 minutes. Sear over high heat."},
     {"@type": "HowToStep", "text": "Fry eggs sunny-side up in a non-stick pan."},
     {"@type": "HowToStep", "text": "Place hot rice in bowls. Arrange vegetables and beef in sections around the rice."},
     {"@type": "HowToStep", "text": "Top with fried egg, a generous dollop of gochujang, and sesame seeds."},
     {"@type": "HowToStep", "text": "Mix everything together at the table before eating. The sizzling sound is half the experience."}
   ]
 }'::jsonb,
 'public', now() - interval '2 days', now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

-- Recipe 9: Emma's Sourdough Focaccia
INSERT INTO public.recipes_cloud (id, author_id, data, visibility, published_at, created_at) VALUES
('r0000009-0000-0000-0000-000000000009',
 'a0000005-0000-0000-0000-000000000005',
 '{
   "@type": "Recipe",
   "name": "Sourdough Focaccia Art",
   "description": "Crispy, olive-oil-rich focaccia made with sourdough discard. Decorated with vegetables for edible garden art.",
   "image": "https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=800",
   "author": "Emma Johnson",
   "prepTime": "PT20M",
   "cookTime": "PT25M",
   "totalTime": "PT8H45M",
   "recipeYield": "1 large focaccia",
   "recipeCategory": "Bread",
   "recipeCuisine": "Italian",
   "keywords": ["bread", "sourdough", "focaccia", "baking", "art"],
   "recipeIngredient": [
     {"name": "bread flour", "amount": 500, "unit": "g"},
     {"name": "sourdough discard", "amount": 200, "unit": "g"},
     {"name": "warm water", "amount": 350, "unit": "ml"},
     {"name": "olive oil", "amount": 80, "unit": "ml"},
     {"name": "salt", "amount": 10, "unit": "g"},
     {"name": "cherry tomatoes, halved", "amount": 10, "unit": ""},
     {"name": "olives", "amount": 15, "unit": ""},
     {"name": "fresh rosemary", "amount": 4, "unit": "sprigs"},
     {"name": "flaky sea salt", "amount": 1, "unit": "tsp"}
   ],
   "recipeInstructions": [
     {"@type": "HowToStep", "text": "Mix flour, discard, water, and salt. Fold dough every 30 minutes for 2 hours (4 folds total)."},
     {"@type": "HowToStep", "text": "Coat a sheet pan generously with olive oil. Transfer dough and spread to edges."},
     {"@type": "HowToStep", "text": "Cover and cold-proof in fridge 8-12 hours (overnight)."},
     {"@type": "HowToStep", "text": "Remove from fridge 1 hour before baking. Preheat oven to 220°C (425°F)."},
     {"@type": "HowToStep", "text": "Dimple the dough with oiled fingers. Arrange tomatoes, olives, and rosemary in a garden pattern. Drizzle with olive oil and flaky salt."},
     {"@type": "HowToStep", "text": "Bake 22-25 minutes until deep golden. Cool 10 minutes before slicing."}
   ]
 }'::jsonb,
 'public', now() - interval '1 day', now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

-- Recipe 10: Carlos's Brazilian Pão de Queijo
INSERT INTO public.recipes_cloud (id, author_id, data, visibility, published_at, created_at) VALUES
('r0000010-0000-0000-0000-000000000010',
 'a0000003-0000-0000-0000-000000000003',
 '{
   "@type": "Recipe",
   "name": "Brazilian Pão de Queijo",
   "description": "Chewy, cheesy Brazilian cheese bread rolls. Naturally gluten-free and impossibly addictive.",
   "image": "https://images.unsplash.com/photo-1619221882220-947b3d3c8861?w=800",
   "author": "Carlos Silva",
   "prepTime": "PT15M",
   "cookTime": "PT25M",
   "totalTime": "PT40M",
   "recipeYield": "20 rolls",
   "recipeCategory": "Bread",
   "recipeCuisine": "Brazilian",
   "keywords": ["gluten-free", "cheese", "brazilian", "snack", "easy"],
   "recipeIngredient": [
     {"name": "tapioca flour (polvilho azedo)", "amount": 500, "unit": "g"},
     {"name": "whole milk", "amount": 240, "unit": "ml"},
     {"name": "vegetable oil", "amount": 80, "unit": "ml"},
     {"name": "eggs", "amount": 2, "unit": ""},
     {"name": "Parmesan cheese, grated", "amount": 150, "unit": "g"},
     {"name": "mozzarella, shredded", "amount": 100, "unit": "g"},
     {"name": "salt", "amount": 1, "unit": "tsp"}
   ],
   "recipeInstructions": [
     {"@type": "HowToStep", "text": "Preheat oven to 200°C (400°F). Line a baking sheet with parchment."},
     {"@type": "HowToStep", "text": "Heat milk, oil, and salt until just boiling. Pour over tapioca flour and mix until smooth."},
     {"@type": "HowToStep", "text": "Let cool slightly, then beat in eggs one at a time until fully incorporated."},
     {"@type": "HowToStep", "text": "Fold in both cheeses. Dough will be sticky and soft."},
     {"@type": "HowToStep", "text": "With oiled hands, roll into golf-ball-sized balls. Place 2cm apart on baking sheet."},
     {"@type": "HowToStep", "text": "Bake 20-25 minutes until puffed and golden. Best served warm."}
   ]
 }'::jsonb,
 'public', now() - interval '12 hours', now() - interval '12 hours')
ON CONFLICT (id) DO NOTHING;

-- ─── 4. Friendships (all accepted) ──────────────────────────────────────────
-- Everyone is friends with each other for maximum feed visibility.

INSERT INTO public.friendships (requester_id, addressee_id, status, responded_at) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'a0000002-0000-0000-0000-000000000002', 'accepted', now()),
  ('a0000001-0000-0000-0000-000000000001', 'a0000003-0000-0000-0000-000000000003', 'accepted', now()),
  ('a0000001-0000-0000-0000-000000000001', 'a0000004-0000-0000-0000-000000000004', 'accepted', now()),
  ('a0000001-0000-0000-0000-000000000001', 'a0000005-0000-0000-0000-000000000005', 'accepted', now()),
  ('a0000002-0000-0000-0000-000000000002', 'a0000003-0000-0000-0000-000000000003', 'accepted', now()),
  ('a0000002-0000-0000-0000-000000000002', 'a0000004-0000-0000-0000-000000000004', 'accepted', now()),
  ('a0000003-0000-0000-0000-000000000003', 'a0000005-0000-0000-0000-000000000005', 'accepted', now()),
  ('a0000004-0000-0000-0000-000000000004', 'a0000005-0000-0000-0000-000000000005', 'accepted', now())
ON CONFLICT ON CONSTRAINT friendships_unique_pair DO NOTHING;

-- ─── 5. Reactions (likes and bookmarks) ─────────────────────────────────────

INSERT INTO public.reactions (user_id, recipe_id, type) VALUES
  -- Mapo Tofu: liked by Bob, Diana, Emma; bookmarked by Diana
  ('a0000002-0000-0000-0000-000000000002', 'r0000001-0000-0000-0000-000000000001', 'like'),
  ('a0000004-0000-0000-0000-000000000004', 'r0000001-0000-0000-0000-000000000001', 'like'),
  ('a0000005-0000-0000-0000-000000000005', 'r0000001-0000-0000-0000-000000000001', 'like'),
  ('a0000004-0000-0000-0000-000000000004', 'r0000001-0000-0000-0000-000000000001', 'bookmark'),
  -- Brisket Tacos: liked by everyone else
  ('a0000001-0000-0000-0000-000000000001', 'r0000002-0000-0000-0000-000000000002', 'like'),
  ('a0000003-0000-0000-0000-000000000003', 'r0000002-0000-0000-0000-000000000002', 'like'),
  ('a0000004-0000-0000-0000-000000000004', 'r0000002-0000-0000-0000-000000000002', 'like'),
  ('a0000005-0000-0000-0000-000000000005', 'r0000002-0000-0000-0000-000000000002', 'like'),
  ('a0000001-0000-0000-0000-000000000001', 'r0000002-0000-0000-0000-000000000002', 'bookmark'),
  -- Shakshuka: liked by Alice, Bob
  ('a0000001-0000-0000-0000-000000000001', 'r0000003-0000-0000-0000-000000000003', 'like'),
  ('a0000002-0000-0000-0000-000000000002', 'r0000003-0000-0000-0000-000000000003', 'like'),
  -- Kimchi Jjigae: liked by Alice, Carlos, Emma; bookmarked by Alice
  ('a0000001-0000-0000-0000-000000000001', 'r0000004-0000-0000-0000-000000000004', 'like'),
  ('a0000003-0000-0000-0000-000000000003', 'r0000004-0000-0000-0000-000000000004', 'like'),
  ('a0000005-0000-0000-0000-000000000005', 'r0000004-0000-0000-0000-000000000004', 'like'),
  ('a0000001-0000-0000-0000-000000000001', 'r0000004-0000-0000-0000-000000000004', 'bookmark'),
  -- Mushroom Risotto: liked by Bob, Carlos, Diana
  ('a0000002-0000-0000-0000-000000000002', 'r0000005-0000-0000-0000-000000000005', 'like'),
  ('a0000003-0000-0000-0000-000000000003', 'r0000005-0000-0000-0000-000000000005', 'like'),
  ('a0000004-0000-0000-0000-000000000004', 'r0000005-0000-0000-0000-000000000005', 'like'),
  ('a0000003-0000-0000-0000-000000000003', 'r0000005-0000-0000-0000-000000000005', 'bookmark'),
  -- Dumplings: liked by Bob, Carlos, Emma
  ('a0000002-0000-0000-0000-000000000002', 'r0000006-0000-0000-0000-000000000006', 'like'),
  ('a0000003-0000-0000-0000-000000000003', 'r0000006-0000-0000-0000-000000000006', 'like'),
  ('a0000005-0000-0000-0000-000000000005', 'r0000006-0000-0000-0000-000000000006', 'like'),
  -- Guacamole: liked by everyone
  ('a0000001-0000-0000-0000-000000000001', 'r0000007-0000-0000-0000-000000000007', 'like'),
  ('a0000003-0000-0000-0000-000000000003', 'r0000007-0000-0000-0000-000000000007', 'like'),
  ('a0000004-0000-0000-0000-000000000004', 'r0000007-0000-0000-0000-000000000007', 'like'),
  ('a0000005-0000-0000-0000-000000000005', 'r0000007-0000-0000-0000-000000000007', 'like'),
  -- Bibimbap: liked by Alice, Emma; bookmarked by Emma
  ('a0000001-0000-0000-0000-000000000001', 'r0000008-0000-0000-0000-000000000008', 'like'),
  ('a0000005-0000-0000-0000-000000000005', 'r0000008-0000-0000-0000-000000000008', 'like'),
  ('a0000005-0000-0000-0000-000000000005', 'r0000008-0000-0000-0000-000000000008', 'bookmark'),
  -- Focaccia: liked by Alice, Carlos, Diana
  ('a0000001-0000-0000-0000-000000000001', 'r0000009-0000-0000-0000-000000000009', 'like'),
  ('a0000003-0000-0000-0000-000000000003', 'r0000009-0000-0000-0000-000000000009', 'like'),
  ('a0000004-0000-0000-0000-000000000004', 'r0000009-0000-0000-0000-000000000009', 'like'),
  -- Pão de Queijo: liked by Alice, Bob, Diana, Emma
  ('a0000001-0000-0000-0000-000000000001', 'r0000010-0000-0000-0000-000000000010', 'like'),
  ('a0000002-0000-0000-0000-000000000002', 'r0000010-0000-0000-0000-000000000010', 'like'),
  ('a0000004-0000-0000-0000-000000000004', 'r0000010-0000-0000-0000-000000000010', 'like'),
  ('a0000005-0000-0000-0000-000000000005', 'r0000010-0000-0000-0000-000000000010', 'like')
ON CONFLICT ON CONSTRAINT reactions_unique_per_type DO NOTHING;

-- ─── 6. Ratings ─────────────────────────────────────────────────────────────

INSERT INTO public.ratings (user_id, recipe_id, score) VALUES
  -- Mapo Tofu: avg ~4.3
  ('a0000002-0000-0000-0000-000000000002', 'r0000001-0000-0000-0000-000000000001', 5),
  ('a0000004-0000-0000-0000-000000000004', 'r0000001-0000-0000-0000-000000000001', 4),
  ('a0000005-0000-0000-0000-000000000005', 'r0000001-0000-0000-0000-000000000001', 4),
  -- Brisket Tacos: avg 4.75
  ('a0000001-0000-0000-0000-000000000001', 'r0000002-0000-0000-0000-000000000002', 5),
  ('a0000003-0000-0000-0000-000000000003', 'r0000002-0000-0000-0000-000000000002', 5),
  ('a0000004-0000-0000-0000-000000000004', 'r0000002-0000-0000-0000-000000000002', 4),
  ('a0000005-0000-0000-0000-000000000005', 'r0000002-0000-0000-0000-000000000002', 5),
  -- Shakshuka: avg 4.0
  ('a0000001-0000-0000-0000-000000000001', 'r0000003-0000-0000-0000-000000000003', 4),
  ('a0000002-0000-0000-0000-000000000002', 'r0000003-0000-0000-0000-000000000003', 4),
  -- Kimchi Jjigae: avg 4.7
  ('a0000001-0000-0000-0000-000000000001', 'r0000004-0000-0000-0000-000000000004', 5),
  ('a0000003-0000-0000-0000-000000000003', 'r0000004-0000-0000-0000-000000000004', 5),
  ('a0000005-0000-0000-0000-000000000005', 'r0000004-0000-0000-0000-000000000004', 4),
  -- Mushroom Risotto: avg 4.3
  ('a0000002-0000-0000-0000-000000000002', 'r0000005-0000-0000-0000-000000000005', 5),
  ('a0000003-0000-0000-0000-000000000003', 'r0000005-0000-0000-0000-000000000005', 4),
  ('a0000004-0000-0000-0000-000000000004', 'r0000005-0000-0000-0000-000000000005', 4),
  -- Dumplings: avg 5.0
  ('a0000002-0000-0000-0000-000000000002', 'r0000006-0000-0000-0000-000000000006', 5),
  ('a0000003-0000-0000-0000-000000000003', 'r0000006-0000-0000-0000-000000000006', 5),
  ('a0000005-0000-0000-0000-000000000005', 'r0000006-0000-0000-0000-000000000006', 5),
  -- Guacamole: avg 4.5
  ('a0000001-0000-0000-0000-000000000001', 'r0000007-0000-0000-0000-000000000007', 5),
  ('a0000003-0000-0000-0000-000000000003', 'r0000007-0000-0000-0000-000000000007', 4),
  ('a0000004-0000-0000-0000-000000000004', 'r0000007-0000-0000-0000-000000000007', 5),
  ('a0000005-0000-0000-0000-000000000005', 'r0000007-0000-0000-0000-000000000007', 4),
  -- Bibimbap: avg 5.0
  ('a0000001-0000-0000-0000-000000000001', 'r0000008-0000-0000-0000-000000000008', 5),
  ('a0000005-0000-0000-0000-000000000005', 'r0000008-0000-0000-0000-000000000008', 5),
  -- Pão de Queijo: avg 4.5
  ('a0000001-0000-0000-0000-000000000001', 'r0000010-0000-0000-0000-000000000010', 5),
  ('a0000002-0000-0000-0000-000000000002', 'r0000010-0000-0000-0000-000000000010', 4),
  ('a0000004-0000-0000-0000-000000000004', 'r0000010-0000-0000-0000-000000000010', 5),
  ('a0000005-0000-0000-0000-000000000005', 'r0000010-0000-0000-0000-000000000010', 4)
ON CONFLICT ON CONSTRAINT ratings_unique_per_user DO NOTHING;

-- ─── 7. Comments ────────────────────────────────────────────────────────────

INSERT INTO public.comments (id, user_id, recipe_id, body, created_at) VALUES
  -- Comments on Mapo Tofu
  ('c0000001-0000-0000-0000-000000000001',
   'a0000002-0000-0000-0000-000000000002',
   'r0000001-0000-0000-0000-000000000001',
   'Made this last night and it was incredible. The Sichuan peppercorns really make it.',
   now() - interval '5 days'),

  ('c0000002-0000-0000-0000-000000000002',
   'a0000004-0000-0000-0000-000000000004',
   'r0000001-0000-0000-0000-000000000001',
   'Love the tip about blanching the tofu first. Keeps it from breaking apart in the sauce.',
   now() - interval '4 days'),

  -- Reply to Bob's comment
  ('c0000003-0000-0000-0000-000000000003',
   'a0000001-0000-0000-0000-000000000001',
   'r0000001-0000-0000-0000-000000000001',
   'Right? Fresh Sichuan peppercorns are key — the pre-ground ones lose that numbing quality fast.',
   now() - interval '4 days 12 hours'),

  -- Comments on Brisket Tacos
  ('c0000004-0000-0000-0000-000000000004',
   'a0000003-0000-0000-0000-000000000003',
   'r0000002-0000-0000-0000-000000000002',
   '8 hours is a commitment but so worth it. The pickled onions are a game changer.',
   now() - interval '4 days'),

  ('c0000005-0000-0000-0000-000000000005',
   'a0000005-0000-0000-0000-000000000005',
   'r0000002-0000-0000-0000-000000000002',
   'Any tips for doing this in the oven? No smoker access.',
   now() - interval '3 days'),

  ('c0000006-0000-0000-0000-000000000006',
   'a0000002-0000-0000-0000-000000000002',
   'r0000002-0000-0000-0000-000000000002',
   'You can do 135°C in the oven wrapped in foil with a few wood chips in a pan. Not the same but still great.',
   now() - interval '2 days 18 hours'),

  -- Comments on Kimchi Jjigae
  ('c0000007-0000-0000-0000-000000000007',
   'a0000001-0000-0000-0000-000000000001',
   'r0000004-0000-0000-0000-000000000004',
   'This is my go-to cold weather recipe now. So warming and comforting.',
   now() - interval '2 days'),

  ('c0000008-0000-0000-0000-000000000008',
   'a0000003-0000-0000-0000-000000000003',
   'r0000004-0000-0000-0000-000000000004',
   'How fermented does the kimchi need to be? I have some that is about 2 weeks old.',
   now() - interval '1 day 18 hours'),

  ('c0000009-0000-0000-0000-000000000009',
   'a0000004-0000-0000-0000-000000000004',
   'r0000004-0000-0000-0000-000000000004',
   'The more sour the better for jjigae! 2 weeks is fine but 3-4 weeks is ideal. The acidity really drives the stew.',
   now() - interval '1 day 12 hours'),

  -- Comments on Mushroom Risotto
  ('c0000010-0000-0000-0000-000000000010',
   'a0000004-0000-0000-0000-000000000004',
   'r0000005-0000-0000-0000-000000000005',
   'Never would have guessed this was vegan. The nutritional yeast gives it that cheesy depth.',
   now() - interval '1 day'),

  -- Comments on Guacamole
  ('c0000011-0000-0000-0000-000000000011',
   'a0000001-0000-0000-0000-000000000001',
   'r0000007-0000-0000-0000-000000000007',
   'Simple and perfect. Please never put peas in guacamole.',
   now() - interval '18 hours'),

  ('c0000012-0000-0000-0000-000000000012',
   'a0000002-0000-0000-0000-000000000002',
   'r0000007-0000-0000-0000-000000000007',
   'Exactly. Avocado, lime, salt, onion, jalapeño. That is the law.',
   now() - interval '16 hours'),

  -- Comments on Dumplings
  ('c0000013-0000-0000-0000-000000000013',
   'a0000005-0000-0000-0000-000000000005',
   'r0000006-0000-0000-0000-000000000006',
   'Made these with my kids this weekend — they loved the folding part! We froze half for later.',
   now() - interval '4 days'),

  -- Comments on Focaccia
  ('c0000014-0000-0000-0000-000000000014',
   'a0000003-0000-0000-0000-000000000003',
   'r0000009-0000-0000-0000-000000000009',
   'The overnight cold proof makes such a difference. Mine came out with huge bubbles.',
   now() - interval '20 hours'),

  -- Comments on Pão de Queijo
  ('c0000015-0000-0000-0000-000000000015',
   'a0000001-0000-0000-0000-000000000001',
   'r0000010-0000-0000-0000-000000000010',
   'Where do you get polvilho azedo? Can I use regular tapioca starch?',
   now() - interval '10 hours'),

  ('c0000016-0000-0000-0000-000000000016',
   'a0000003-0000-0000-0000-000000000003',
   'r0000010-0000-0000-0000-000000000010',
   'Regular tapioca starch works but the sour variety (polvilho azedo) gives the authentic tangy flavor. Check Brazilian grocery stores or online.',
   now() - interval '8 hours')
ON CONFLICT (id) DO NOTHING;

-- Set parent_comment_id for threaded replies
UPDATE public.comments SET parent_comment_id = 'c0000001-0000-0000-0000-000000000001'
WHERE id = 'c0000003-0000-0000-0000-000000000003';

UPDATE public.comments SET parent_comment_id = 'c0000005-0000-0000-0000-000000000005'
WHERE id = 'c0000006-0000-0000-0000-000000000006';

UPDATE public.comments SET parent_comment_id = 'c0000008-0000-0000-0000-000000000008'
WHERE id = 'c0000009-0000-0000-0000-000000000009';

UPDATE public.comments SET parent_comment_id = 'c0000015-0000-0000-0000-000000000015'
WHERE id = 'c0000016-0000-0000-0000-000000000016';

-- ─── 8. Connect board user (tijoba7@gmail.com) if they exist ────────────────
-- Makes the board user friends with all test users so their feed is populated.

DO $$
DECLARE
  board_uid uuid;
BEGIN
  SELECT id INTO board_uid FROM auth.users WHERE email = 'tijoba7@gmail.com';

  IF board_uid IS NOT NULL THEN
    -- Friend with all 5 test users
    INSERT INTO public.friendships (requester_id, addressee_id, status, responded_at) VALUES
      (board_uid, 'a0000001-0000-0000-0000-000000000001', 'accepted', now()),
      (board_uid, 'a0000002-0000-0000-0000-000000000002', 'accepted', now()),
      (board_uid, 'a0000003-0000-0000-0000-000000000003', 'accepted', now()),
      (board_uid, 'a0000004-0000-0000-0000-000000000004', 'accepted', now()),
      (board_uid, 'a0000005-0000-0000-0000-000000000005', 'accepted', now())
    ON CONFLICT ON CONSTRAINT friendships_unique_pair DO NOTHING;

    RAISE NOTICE 'Board user (%) connected as friend with all test users.', board_uid;
  ELSE
    RAISE NOTICE 'Board user tijoba7@gmail.com not found. Sign up first, then re-run this script to connect.';
  END IF;
END;
$$;

-- ─── 9. Create a test group ─────────────────────────────────────────────────

INSERT INTO public.groups (id, name, description, created_by) VALUES
  ('g0000001-0000-0000-0000-000000000001',
   'Weeknight Winners',
   'Quick recipes for busy weeknights — 30 minutes or less',
   'a0000001-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.group_members (group_id, user_id, role) VALUES
  ('g0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'admin'),
  ('g0000001-0000-0000-0000-000000000001', 'a0000002-0000-0000-0000-000000000002', 'member'),
  ('g0000001-0000-0000-0000-000000000001', 'a0000004-0000-0000-0000-000000000004', 'member')
ON CONFLICT DO NOTHING;

INSERT INTO public.group_recipes (group_id, recipe_id, added_by) VALUES
  ('g0000001-0000-0000-0000-000000000001', 'r0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001'),
  ('g0000001-0000-0000-0000-000000000001', 'r0000003-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000001'),
  ('g0000001-0000-0000-0000-000000000001', 'r0000007-0000-0000-0000-000000000007', 'a0000002-0000-0000-0000-000000000002')
ON CONFLICT ON CONSTRAINT group_recipes_unique DO NOTHING;

-- ─── 10. Reposts ────────────────────────────────────────────────────────────
-- Users reposting each other's recipes with optional captions and photos.

INSERT INTO public.reposts (id, user_id, recipe_id, caption, created_at) VALUES
  -- Bob reposts Alice's Mapo Tofu
  ('rp000001-0000-0000-0000-000000000001',
   'a0000002-0000-0000-0000-000000000002',
   'r0000001-0000-0000-0000-000000000001',
   'Made this last night and it blew my mind. The Sichuan peppercorn numbing is addictive.',
   now() - interval '4 days'),

  -- Emma reposts Bob's Brisket Tacos
  ('rp000002-0000-0000-0000-000000000002',
   'a0000005-0000-0000-0000-000000000005',
   'r0000002-0000-0000-0000-000000000002',
   'Weekend project goals. Did it in the oven and it was still amazing.',
   now() - interval '3 days'),

  -- Diana reposts Carlos's Shakshuka
  ('rp000003-0000-0000-0000-000000000003',
   'a0000004-0000-0000-0000-000000000004',
   'r0000003-0000-0000-0000-000000000003',
   'My new go-to Sunday brunch. So easy and impressive.',
   now() - interval '2 days'),

  -- Alice reposts Diana's Bibimbap
  ('rp000004-0000-0000-0000-000000000004',
   'a0000001-0000-0000-0000-000000000001',
   'r0000008-0000-0000-0000-000000000008',
   NULL,
   now() - interval '1 day'),

  -- Carlos reposts Emma's Focaccia
  ('rp000005-0000-0000-0000-000000000005',
   'a0000003-0000-0000-0000-000000000003',
   'r0000009-0000-0000-0000-000000000009',
   'The overnight cold proof trick is game changing. Crispy pillowy perfection.',
   now() - interval '18 hours')
ON CONFLICT ON CONSTRAINT reposts_unique_per_user DO NOTHING;

-- ─── 11. Stories ────────────────────────────────────────────────────────────
-- Ephemeral 24h stories (only recent ones will show as active).

INSERT INTO public.stories (id, user_id, media_url, caption, linked_recipe_id, expires_at) VALUES
  -- Alice posted a story about her dumplings (still active)
  ('s0000001-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000001',
   'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=600',
   'Dumpling Sunday! 50 dumplings in, 50 more to go.',
   'r0000006-0000-0000-0000-000000000006',
   now() + interval '18 hours'),

  -- Bob posted a story of his smoker setup (still active)
  ('s0000002-0000-0000-0000-000000000002',
   'a0000002-0000-0000-0000-000000000002',
   'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=600',
   'Brisket day. 8 hours to go.',
   NULL,
   now() + interval '12 hours'),

  -- Diana posted about her kimchi fermentation (still active)
  ('s0000003-0000-0000-0000-000000000003',
   'a0000004-0000-0000-0000-000000000004',
   'https://images.unsplash.com/photo-1583224964978-2257b960c3d3?w=600',
   'Week 3 fermentation check. This batch is going to be perfect for jjigae.',
   'r0000004-0000-0000-0000-000000000004',
   now() + interval '6 hours')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ─── Summary ────────────────────────────────────────────────────────────────
-- Created:
--   5 test users (alice, bob, carlos, diana, emma) — password: TestPass123!
--   10 recipes across 6 cuisines (all public)
--   8 friendships (everyone connected)
--   34 reactions (likes + bookmarks)
--   27 ratings (avg scores 4.0-5.0)
--   16 comments with threaded replies
--   1 group ("Weeknight Winners") with 3 members and 3 shared recipes
--   5 reposts with captions
--   3 active stories (expire within 6-18 hours)
--   Board user auto-friended if they exist
