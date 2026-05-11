import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { DataStorageService } from './data-storage-services';

@Injectable({
  providedIn: 'root',
})
export class CommonService {
  private dataStorageServices: DataStorageService = inject(DataStorageService);
  public ingredients:any = {}
  public currentUserEmail: string | null = null;

  get currentUserName(): string {
    if (!this.currentUserEmail) {
      return '';
    }
    return this.currentUserEmail.split('@')[0];
  }

  doLogin(user:any):Observable<object>{
    return this.dataStorageServices.inviaRichiesta("POST", "/login", user)!;
  }

  doRegister(user:any):Observable<object>{
    return this.dataStorageServices.inviaRichiesta("POST", "/register", user)!;
  }

  getIngredients(): Observable<any> {
    const obs = this.dataStorageServices.inviaRichiesta('GET', '/getIngredients')!
      .pipe(tap((data: any) => {
        this.ingredients = data;
      }));
    return obs;
  }

  generateWeekProgram(preferences: any): Observable<any> {
    return this.dataStorageServices.inviaRichiesta('POST', '/generateWeekProgram', preferences)!;
  }

  generateRecipesFromIngredients(ingredients: string[]): Observable<any> {
    return this.dataStorageServices.inviaRichiesta('POST', '/generateRecipesFromIngredients', { ingredients })!;
  }
}
