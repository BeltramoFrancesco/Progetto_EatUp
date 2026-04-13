import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { DataStorageService } from './data-storage-services';

@Injectable({
  providedIn: 'root',
})
export class CommonService {
  private dataStorageServices: DataStorageService = inject(DataStorageService);
  public ingredients:any = {}

  
  doLogin(user:any):Observable<object>{
    return this.dataStorageServices.inviaRichiesta("POST", "/login", user)!;
  }

  getIngredients(): Observable<any> {
    const obs = this.dataStorageServices.inviaRichiesta('GET', '/getIngredients')!
      .pipe(tap((data: any) => {
        this.ingredients = data;
      }));
    return obs;
  }
}