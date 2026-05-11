import { Component, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonService } from '../services/common-service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './registration.html',
  styleUrl: './registration.css',
})
export class Registration {

  private router = inject(Router);
  private commonService: CommonService = inject(CommonService);
  lblErrore: boolean = false;

  onRegister(form: any) {
    if (form.invalid) {
      Object.values(form.controls).forEach((control: any) => {
        control.markAsTouched();
      });
      return;
    }

    const user = {
      name: form.value.name,
      username: form.value.email,
      password: form.value.password,
      confirmPassword: form.value.confirmPassword
    };

    this.commonService.doRegister(user).subscribe({
      next: (data: any) => {
        alert("Registrazione effettuata con successo!");
        this.lblErrore = false;
        this.commonService.currentUserEmail = user.username;
        this.router.navigate(['/home']);
      },
      error: (err: any) => {
        console.log(err);
        this.lblErrore = true;
      }
    });
  }
}
