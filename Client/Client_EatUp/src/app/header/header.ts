import { NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from "@angular/router";
import { CommonService } from '../services/common-service';

@Component({
  selector: 'app-header',
  imports: [NgIf, RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {

  isCollapsed: boolean = true;
  isLoggingOut = false;
  private commonService: CommonService = inject(CommonService);

  get userName(): string {
    return this.commonService.currentUserName;
  }

  get isLoggedIn(): boolean {
    return !!this.commonService.currentUserEmail;
  }

  logout(): void {
    if (this.isLoggingOut) {
      return;
    }

    this.isLoggingOut = true;

    this.commonService.doLogout().subscribe({
      next: () => {
        this.isLoggingOut = false;
        this.isCollapsed = true;
        window.location.reload();
      },
      error: (err: any) => {
        console.log(err);
        this.commonService.currentUserEmail = null;
        this.isLoggingOut = false;
        this.isCollapsed = true;
        window.location.reload();
      },
    });
  }
}
