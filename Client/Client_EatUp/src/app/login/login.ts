import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonService } from '../services/common-service';
import { Router } from '@angular/router';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {

  @Output() Selected = new EventEmitter<string>();
  private commonService: CommonService = inject(CommonService)
  private router = inject(Router);

  txtUsername: string = 'francy.beltrafamily@gmail.com';
  txtPassword: string = 'admin';
  lblErrore: boolean= false;

  onLogin(form: any) {
  if (form.invalid) {
    Object.values(form.controls).forEach((control: any) => {
      control.markAsTouched();
    });
    return;
  }

  const user = {
    username: form.value.email,
    password: form.value.password
  };

  this.commonService.doLogin(user).subscribe({
    next: (data: any) => {
      alert("Login effettuato con successo!");
      this.lblErrore = false;
      this.commonService.currentUserEmail = user.username;
      this.router.navigate(['/home']);
    },
    error: (err: any) => {
      console.log(err);
      if (err.status === 401) {
        this.lblErrore = true;
      } else {
        alert(`${err.status} : ${err.error}`);
      }
    }
  });
}


  goToRegister() {
    this.Selected.emit("registration");
  }

  chiudi(){
    this.lblErrore = false;
  }
}