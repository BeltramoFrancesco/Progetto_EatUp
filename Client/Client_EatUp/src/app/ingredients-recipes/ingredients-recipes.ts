import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommonService } from '../services/common-service';

interface GeneratedRecipe {
  titolo: string;
  qualita: number;
  immagine: string;
  ingredienti: string[];
  ingredientiExtra: string[];
  descrizione: string;
}

interface RecipeGroup {
  key: 'soloSelezionati' | 'pochiExtra' | 'daComprare';
  title: string;
  subtitle: string;
  recipes: GeneratedRecipe[];
}

@Component({
  selector: 'app-ingredients-recipes',
  imports: [FormsModule, RouterLink],
  templateUrl: './ingredients-recipes.html',
  styleUrls: ['./ingredients-recipes.css'],
})
export class IngredientsRecipes implements OnInit {
  private commonService = inject(CommonService);
  private readonly foodNotFoundImage = '/foodNotFound.png';

  selectedIngredients: any[] = [];
  categories: any[] = [];
  ingredientSearch = '';
  recipeGroups: RecipeGroup[] = this.emptyRecipeGroups();

  isLoadingIngredients = false;
  isGeneratingRecipes = false;
  errorMessage = '';
  readonly starIndexes = [1, 2, 3, 4, 5];

  get isLoggedIn(): boolean {
    return !!this.commonService.currentUserEmail;
  }

  get selectedIngredientNames(): string[] {
    return this.selectedIngredients.map((ingredient) => this.getIngredientName(ingredient));
  }

  get filteredCategories(): any[] {
    const query = this.normalizeSearch(this.ingredientSearch);

    if (!query) {
      return this.categories;
    }

    return this.categories.filter((category) => this.getVisibleIngredients(category).length > 0);
  }

  get hasIngredientSearchResults(): boolean {
    return this.filteredCategories.length > 0;
  }

  ngOnInit() {
    this.isLoadingIngredients = true;

    this.commonService.getIngredients().subscribe({
      next: (data: any) => {
        this.categories = (data?.categories ?? data ?? []).map((category: any, index: number) => ({
          ...category,
          open: category?.open ?? index === 0,
        }));
        this.isLoadingIngredients = false;
      },
      error: (err: any) => {
        console.error('Failed to load ingredients', err);
        this.categories = [];
        this.errorMessage = 'Non sono riuscito a caricare gli ingredienti.';
        this.isLoadingIngredients = false;
      },
    });
  }

  toggleIngredient(ingredient: any): void {
    const index = this.selectedIngredients.findIndex((selected) => this.sameIngredient(selected, ingredient));

    if (index === -1) {
      this.selectedIngredients.push(ingredient);
    } else {
      this.selectedIngredients.splice(index, 1);
    }
  }

  isSelected(ingredient: any): boolean {
    return this.selectedIngredients.some((selected) => this.sameIngredient(selected, ingredient));
  }

  removeIngredient(ingredient: any): void {
    this.selectedIngredients = this.selectedIngredients.filter((selected) => !this.sameIngredient(selected, ingredient));
  }

  generateRecipes(): void {
    this.errorMessage = '';

    if (this.selectedIngredients.length === 0) {
      this.errorMessage = 'Seleziona almeno un ingrediente prima di cercare ricette.';
      return;
    }

    if (!this.isLoggedIn) {
      this.errorMessage = 'Devi effettuare il login per generare ricette con l AI.';
      return;
    }

    this.isGeneratingRecipes = true;

    this.commonService.generateRecipesFromIngredients(this.selectedIngredientNames).subscribe({
      next: (data: any) => {
        this.recipeGroups = this.normalizeRecipeGroups(data);
        this.isGeneratingRecipes = false;
      },
      error: (err: any) => {
        console.error('Failed to generate recipes', err);
        this.errorMessage = 'Non sono riuscito a generare le ricette. Riprova tra poco.';
        this.isGeneratingRecipes = false;
      },
    });
  }

  onRecipeImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    target.src = this.foodNotFoundImage;
  }

  hasRecipes(): boolean {
    return this.recipeGroups.some((group) => group.recipes.length > 0);
  }

  getIngredientName(ingredient: any): string {
    return ingredient?.nome ?? ingredient?.name ?? String(ingredient);
  }

  getVisibleIngredients(category: any): any[] {
    const ingredients = category?.ingredienti ?? [];
    const query = this.normalizeSearch(this.ingredientSearch);

    if (!query) {
      return ingredients;
    }

    return ingredients.filter((ingredient: any) =>
      this.normalizeSearch(this.getIngredientName(ingredient)).includes(query),
    );
  }

  imageUrl(recipe: GeneratedRecipe): string {
    return recipe.immagine || this.foodNotFoundImage;
  }

  private normalizeRecipeGroups(data: any): RecipeGroup[] {
    const parsedData = typeof data === 'string' ? this.parseJson(data) : data;
    const groups = this.emptyRecipeGroups();

    return groups.map((group) => ({
      ...group,
      recipes: Array.isArray(parsedData?.[group.key])
        ? parsedData[group.key].map((recipe: any) => this.normalizeRecipe(recipe))
        : [],
    }));
  }

  private normalizeRecipe(recipe: any): GeneratedRecipe {
    return {
      titolo: recipe?.titolo ?? recipe?.title ?? 'Ricetta consigliata',
      qualita: Math.max(0, Math.min(5, Number(recipe?.qualita ?? recipe?.quality ?? 0))),
      immagine: recipe?.immagine ?? recipe?.image ?? '',
      ingredienti: Array.isArray(recipe?.ingredienti ?? recipe?.ingredients)
        ? (recipe?.ingredienti ?? recipe?.ingredients).map((ingredient: any) => String(ingredient))
        : [],
      ingredientiExtra: Array.isArray(recipe?.ingredientiExtra ?? recipe?.extraIngredients)
        ? (recipe?.ingredientiExtra ?? recipe?.extraIngredients).map((ingredient: any) => String(ingredient))
        : [],
      descrizione: recipe?.descrizione ?? recipe?.description ?? '',
    };
  }

  private emptyRecipeGroups(): RecipeGroup[] {
    return [
      {
        key: 'soloSelezionati',
        title: 'Solo ingredienti selezionati',
        subtitle: 'Ricette fattibili con quello che hai gia scelto.',
        recipes: [],
      },
      {
        key: 'pochiExtra',
        title: 'Con 2 o 3 ingredienti in piu',
        subtitle: 'Piccole aggiunte per ricette piu complete.',
        recipes: [],
      },
      {
        key: 'daComprare',
        title: 'Da comprare, ma ne vale la pena',
        subtitle: 'Idee piu ambiziose con ingredienti extra mirati.',
        recipes: [],
      },
    ];
  }

  private sameIngredient(first: any, second: any): boolean {
    const firstId = first?.id ?? first?._id ?? this.getIngredientName(first);
    const secondId = second?.id ?? second?._id ?? this.getIngredientName(second);
    return firstId === secondId;
  }

  private parseJson(value: string): any {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }

  private normalizeSearch(value: string): string {
    return value
      .trim()
      .toLocaleLowerCase('it-IT')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

}
