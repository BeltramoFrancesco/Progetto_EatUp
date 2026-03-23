import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DataStorageService } from './data-storage-services';

@Injectable({
  providedIn: 'root',
})
export class CommonService {
  private dataStorageServices: DataStorageService = inject(DataStorageService);

  doLogin(user:any):Observable<object>{
    return this.dataStorageServices.inviaRichiesta("POST", "/login", user)!;
  }
}