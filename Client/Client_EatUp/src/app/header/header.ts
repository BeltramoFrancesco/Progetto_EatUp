import { NgClass, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from "@angular/router";
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
  isLoggingOut = false;
  private commonService: CommonService = inject(CommonService);
  private router = inject(Router);

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
        this.router.navigate(['/home']);
      },
      error: (err: any) => {
        console.log(err);
        this.commonService.currentUserEmail = null;
        this.isLoggingOut = false;
        this.isCollapsed = true;
        this.router.navigate(['/home']);
      },
    });
  }
}
