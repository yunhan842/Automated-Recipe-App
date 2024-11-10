import { z } from "zod";
import axios from "axios";
require('dotenv').config();

import {
    defineDAINService,
    ToolConfig,
    ServiceConfig,
    ToolboxConfig,
    ServiceContext,
  } from "@dainprotocol/service-sdk";

const getRecipeConfig: ToolConfig = {
    id: "get-recipe",
    name: "Get Recipe",
    description: "Fetches a recipe by name from TheMealDB API",
    input: z
      .object({
        name: z.string().describe("Recipe name"),
      })
      .describe("Input parameters for the recipe request"),
    output: z
      .object({
        name: z.string().describe("Recipe name"),
        ingredients: z.array(z.string()).describe("List of ingredients"),
        instructions: z.array(z.string()).describe("List of instructions"),
      })
      .describe("Recipe data"),
    pricing: { pricePerUse: 0, currency: "USD" },
    handler: async ({ name }, agentInfo) => {
        console.log('User / Agent ${agentInfo.id} requested recipe for ${name}');
      
        const response = await axios.get(
          `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(name)}`
        );
      
        const recipe = response.data.meals[0]; 
      
        const recipeData = {
          name: recipe.strMeal,
          ingredients: Object.keys(recipe)
            .filter(key => key.startsWith('strIngredient') && recipe[key])
            .map(key => `${recipe[key]} - ${recipe[`strMeasure${key.slice(13)}`]}`),
          instructions: recipe.strInstructions.split('\n').filter(step => step.trim() !== '')
        };
      
        const uiData = {
          type: "card",
          uiData: JSON.stringify({
            title: recipeData.name,
            content: `Ingredients: ${recipeData.ingredients.length}\nSteps: ${recipeData.instructions.length}`
          }),
          children: [
            {
              type: "imageCard",
              uiData: JSON.stringify({
                imageUrl: recipe.strMealThumb,
              })
            },
            {
              type: "table",
              uiData: JSON.stringify({
                columns: [
                  { key: "ingredient", header: "Ingredient", width: "100%" }
                ],
                rows: recipeData.ingredients.map(ingredient => ({ ingredient }))
              })
            }
          ]
        };
      
        return {
          text: 'Found recipe for ${name}. It has ${recipeData.ingredients.length} ingredients and ${recipeData.instructions.length} steps.',
          data: recipeData,
          ui: uiData
        };
    },
};

const suggestRandomRecipeConfig: ToolConfig = {
  id: "suggest-random-recipe",
  name: "Suggest Random Recipe",
  description: "Fetches a random recipe from TheMealDB API. Use this when asked for any random recipe suggestion.",
  input: z.object({}).describe("No input parameters required"),
  output: z
    .object({
      name: z.string().describe("Recipe name"),
      ingredients: z.array(z.string()).describe("List of ingredients"),
      instructions: z.array(z.string()).describe("List of instructions"),
    })
    .describe("Random recipe data"),
  pricing: { pricePerUse: 0, currency: "USD" },
  handler: async (_, agentInfo) => {
      console.log(`User / Agent ${agentInfo.id} requested a random recipe`);
    
      try {
          const response = await axios.get(
            `https://www.themealdb.com/api/json/v1/1/random.php`
          );
        
          const recipe = response.data.meals[0];
        
          if (!recipe) {
              throw new Error("No recipe found");
          }
        
          const recipeData = {
            name: recipe.strMeal,
            ingredients: Object.keys(recipe)
              .filter(key => key.startsWith('strIngredient') && recipe[key])
              .map(key => `${recipe[key]} - ${recipe[`strMeasure${key.slice(13)}`]}`),
            instructions: recipe.strInstructions.split('\n').filter(step => step.trim() !== '')
          };
        
          const uiData = {
            type: "card",
            uiData: JSON.stringify({
              title: recipeData.name,
              content: `Ingredients: ${recipeData.ingredients.length}\nSteps: ${recipeData.instructions.length}`
            }),
            children: [
              {
                type: "imageCard",
                uiData: JSON.stringify({
                  imageUrl: recipe.strMealThumb,
                })
              },
              {
                type: "table",
                uiData: JSON.stringify({
                  columns: [
                    { key: "ingredient", header: "Ingredient", width: "100%" }
                  ],
                  rows: recipeData.ingredients.map(ingredient => ({ ingredient }))
                })
              }
            ]
          };
        
          return {
            text: `Here's a random recipe for ${recipeData.name}. It has ${recipeData.ingredients.length} ingredients and ${recipeData.instructions.length} steps.`,
            data: recipeData,
            ui: uiData
          };
      } catch (error) {
          console.error("Error fetching random recipe:", error);
          return {
              text: "I'm sorry, but I encountered an error while trying to fetch a random recipe. Please try again later.",
              data: null,
              ui: {
                  type: "alert",
                  uiData: JSON.stringify({
                      type: "error",
                      title: "Error",
                      message: "Failed to fetch a random recipe. Please try again."
                  })
              }
          };
      }
  },
};

const filterRecipesConfig: ToolConfig = {
  id: "filter-recipes",
  name: "Filter Recipes",
  description: "Filters recipes by main ingredient, category, or area. Use this when asked to find recipes with specific ingredients, from a certain cuisine, or of a particular category.",
  input: z.object({
    filterType: z.enum(["ingredient", "category", "area"]).describe("Type of filter to apply"),
    filterValue: z.string().describe("Value to filter by (e.g., 'chicken', 'Seafood', 'Italian')")
  }).describe("Input parameters for recipe filtering"),
  output: z.array(z.object({
    id: z.string(),
    name: z.string(),
    thumbnail: z.string()
  })).describe("List of filtered recipes"),
  pricing: { pricePerUse: 0, currency: "USD" },
  handler: async ({ filterType, filterValue }, agentInfo) => {
    console.log(`User / Agent ${agentInfo.id} filtered recipes by ${filterType}: ${filterValue}`);

    let endpoint;
    switch (filterType) {
      case "ingredient":
        endpoint = `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(filterValue)}`;
        break;
      case "category":
        endpoint = `https://www.themealdb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(filterValue)}`;
        break;
      case "area":
        endpoint = `https://www.themealdb.com/api/json/v1/1/filter.php?a=${encodeURIComponent(filterValue)}`;
        break;
      default:
        return {
          text: `Invalid filter type: ${filterType}. Please use 'ingredient', 'category', or 'area'.`,
          data: [],
          ui: {
            type: "alert",
            uiData: JSON.stringify({
              type: "error",
              title: "Invalid Filter",
              message: "Please specify a valid filter type: ingredient, category, or area."
            })
          }
        };
    }

    try {
      const response = await axios.get(endpoint);
      const recipes = response.data.meals || [];
  
      const filteredRecipes = recipes.map((recipe: any) => ({
        id: recipe.idMeal,
        name: recipe.strMeal,
        thumbnail: recipe.strMealThumb
      }));
  
      const uiData = {
        type: "card",
        uiData: JSON.stringify({
          title: `Recipes filtered by ${filterType}: ${filterValue}`,
          content: `Found ${filteredRecipes.length} recipes.`
        }),
        children: [
          {
            type: "table",
            uiData: JSON.stringify({
              columns: [
                { key: "name", header: "Recipe Name", width: "70%" },
                { key: "thumbnail", header: "Image", width: "30%", type: "image" }
              ],
              rows: filteredRecipes.map(recipe => ({
                name: recipe.name,
                thumbnail: recipe.thumbnail
              }))
            })
          }
        ]
      };
  
      return {
        text: `Found ${filteredRecipes.length} recipes filtered by ${filterType}: ${filterValue}.`,
        data: filteredRecipes,
        ui: uiData
      };
    } catch (error) {
      console.error("Error filtering recipes:", error);
      return {
        text: "An error occurred while filtering recipes. Please try again.",
        data: [],
        ui: {
          type: "alert",
          uiData: JSON.stringify({
            type: "error",
            title: "Error",
            message: "Failed to filter recipes. Please try again."
          })
        }
      };
    }
  },
};

const googleMapsGroceryStoresConfig: ToolConfig = {
  id: "google-maps-grocery-stores",
  name: "Find Grocery Stores with Delivery",
  description: "Finds grocery stores near a location that may offer delivery using the Google Maps API.",
  input: z.object({
    location: z.string().describe("Location to search for grocery stores")
  }).describe("Input parameters for finding grocery stores"),
  output: z.array(z.object({
    name: z.string(),
    address: z.string(),
    rating: z.number().nullable(),
    openNow: z.boolean().nullable(),
  })).describe("List of grocery stores near the location that may be big brands"),
  pricing: { pricePerUse: 0, currency: "USD" },
  handler: async ({ location }, agentInfo) => {
    console.log(`User / Agent ${agentInfo.id} requested grocery stores near ${location}`);

    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=grocery+store+near+${encodeURIComponent(location)}&key=${process.env.GOOGLE_MAPS_API_KEY}`
      );

      const stores = response.data.results || [];

      // Define known brand names to filter big brands
      const brandNames = ["Walmart", "Target", "Whole Foods", "Kroger", "Safeway", "Costco", "Trader Joe's", "Sam's Club", "Aldi", "Albertsons", "Publix", "H-E-B", "Sprouts"];

      const groceryStores = stores
        .map((store: any) => {
          const isBigBrand = brandNames.some(brand => store.name.includes(brand));

          return {
            name: store.name,
            address: store.formatted_address,
            rating: store.rating || null,
            openNow: store.opening_hours ? store.opening_hours.open_now : null,
            isBigBrand
          };
        })
        .filter(store => store.isBigBrand); // Filter by big brand only

      const uiData = {
        type: "card",
        uiData: JSON.stringify({
          title: `Grocery stores near ${location}`,
          content: `Found ${groceryStores.length} big brand grocery stores.`
        }),
        children: [
          {
            type: "table",
            uiData: JSON.stringify({
              columns: [
                { key: "name", header: "Store Name", width: "40%" },
                { key: "address", header: "Address", width: "40%" },
                { key: "openNow", header: "Open Now", width: "20%" }
              ],
              rows: groceryStores.map(store => ({
                name: store.name,
                address: store.address,
                openNow: store.openNow ? "Yes" : "No"
              }))
            })
          }
        ]
      };

      return {
        text: `Found ${groceryStores.length} big brand grocery stores near ${location}.`,
        data: groceryStores,
        ui: uiData
      };
    } catch (error) {
      console.error("Error finding grocery stores:", error);
    }
  }
};

const dainService = defineDAINService({
  metadata: {
    title: "Recipe Service",
    description:
      "A DAIN service that provides recipes, ingredients, and instructions for various dishes. It can fetch specific recipes, suggest random recipes, and filter recipes by ingredient, category, or cuisine.",
    version: "1.0.0",
    author: "Your Name",
    tags: ["recipe", "ingredient", "cuisine", "food"],
  },
  identity: {
    apiKey: process.env.DAIN_API_KEY,
  },
  tools: [getRecipeConfig, suggestRandomRecipeConfig, filterRecipesConfig, googleMapsGroceryStoresConfig],
});

dainService.startNode({ port: 2022 }).then(() => {
  console.log("Recipe DAIN Service is running on port 2022");
});
