import { Component, OnInit, inject } from '@angular/core';
import { CommonService } from '../services/common-service';

@Component({
  selector: 'app-ingredients-recipes',
  templateUrl: './ingredients-recipes.html',
  styleUrls: ['./ingredients-recipes.css'],
})
export class IngredientsRecipes implements OnInit {

  private commonService = inject(CommonService);

  selectedIngredients: any[] = [];
  categories: any[] = [];

  ngOnInit(){
    this.commonService.getIngredients().subscribe({
      next: (data: any) => {
        // if backend returns grouped categories, adapt accordingly
        this.categories = data?.categories ?? data ?? [];
        console.log(data)
      },
      error: (err: any) => {
        console.error('Failed to load ingredients', err);
        this.categories = [];
      }
    });
  }

  toggleIngredient(ingredient: any): void {
    const index = this.selectedIngredients.indexOf(ingredient);
    if(index==-1){
      this.selectedIngredients.push(ingredient)
    }else{
      this.selectedIngredients.splice(index,1)
    }
    console.log(this.selectedIngredients)
  }
}