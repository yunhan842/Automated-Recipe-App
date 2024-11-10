import { z } from "zod";
import axios from "axios";
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.kroger' });


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
          })
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

const OAUTH2_BASE_URL = process.env.OAUTH2_BASE_URL;
const API_BASE_URL = process.env.API_BASE_URL;
const KROGER_CLIENT_ID = process.env.KROGER_CLIENT_ID;
const KROGER_CLIENT_SECRET = process.env.KROGER_CLIENT_SECRET;

namespace querystring {
  export function stringify(obj: any): string {
    return Object.keys(obj)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`)
      .join("&");
  }
}

let cachedAccessToken: string | null = null;

const krogerAuthConfig: ToolConfig = {
  id: "kroger-auth",
  name: "Kroger API Authentication",
  description: "Authenticates with the Kroger API to obtain an access token",
  input: z.object({}).describe("No input parameters required"),
  output: z.object({
    accessToken: z.string().describe("Access token for Kroger API"),
  }).describe("Kroger API access token"),
  pricing: { pricePerUse: 0, currency: "USD" },
  handler: async (_, agentInfo) => {
    console.log(`User / Agent ${agentInfo.id} requested Kroger API access token`);

    try {
      const response = await axios.post(
        `${OAUTH2_BASE_URL}/token`,
        querystring.stringify({
          grant_type: 'client_credentials',
          scope: 'product.compact',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(
              `${process.env.KROGER_CLIENT_ID}:${process.env.KROGER_CLIENT_SECRET}`
            ).toString('base64')}`,
          },
        }
      );

      cachedAccessToken = response.data.access_token;

      return {
        text: "Successfully obtained access token for Kroger API.",
        data: { accessToken: cachedAccessToken },
        ui: {
          type: "alert",
          uiData: JSON.stringify({
            type: "success",
            title: "Success",
            message: "Access token obtained successfully."
          })
        }
      };
    } catch (error) {
      console.error("Error fetching Kroger access token:", error);
      return {
        text: "I'm sorry, but I encountered an error while trying to fetch the Kroger access token. Please try again later.",
        data: null,
        ui: {
          type: "alert",
          uiData: JSON.stringify({
            type: "error",
            title: "Error",
            message: "Failed to fetch Kroger access token. Please try again."
          })
        }
      };
    }
  },
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
  tools: [getRecipeConfig, suggestRandomRecipeConfig, filterRecipesConfig, krogerAuthConfig],
});

dainService.startNode({ port: 2022 }).then(() => {
  console.log("Recipe DAIN Service is running on port 2022");
});
