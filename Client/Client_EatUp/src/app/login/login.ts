import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonService } from '../services/common-service';


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
  public loginOk:boolean = false

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
      this.loginOk = true;
      alert("Login effettuato con successo!");
      this.lblErrore = false;
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