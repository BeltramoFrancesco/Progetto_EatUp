import { NgClass, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from "@angular/router";
import { CommonService } from '../services/common-service';

@Component({
  selector: 'app-header',
  imports: [NgClass, NgIf, RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {

  isCollapsed: boolean = true;
  active: string = "home";
  private commonService: CommonService = inject(CommonService);

  get userName(): string {
    return this.commonService.currentUserName;
  }

  get isLoggedIn(): boolean {
    return !!this.commonService.currentUserEmail;
  }
}
