import { AfterViewInit, Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonService } from '../services/common-service';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements AfterViewInit {

  @Output() Selected = new EventEmitter<string>();
  private commonService: CommonService = inject(CommonService)
  private router = inject(Router);

  txtUsername: string = 'francy.beltrafamily@gmail.com';
  txtPassword: string = 'admin';
  lblErrore: boolean= false;

  // login with google
  ngAfterViewInit() {
    const checkGoogle = setInterval(() => {
      if (typeof google != 'undefined') {
        clearInterval(checkGoogle);
        this.initGoogle()
      }
    }, 100);
  }

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

  initGoogle() {
    let buttonContainer = document.getElementById("myGoogleDiv")
    buttonContainer!.innerHTML = ""
    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (response: any) => this.loginWithGoogle(response),
    });
    google.accounts.id.renderButton(
      buttonContainer,
      {
        "theme": "outline",
        "size": "large",
        "type": "standard",
        "text": "continue_with",
        "shape": "rectangular",
        "logo_alignment": "center",
      }
    );
  }

  loginWithGoogle(response: any) {
    console.log(response.credential)

    let googleToken = response.credential
    this.commonService.loginWithGoogle(googleToken).subscribe({
      next: (data: any) => {
        this.lblErrore = false;
        this.commonService.currentUserEmail = data?.username ?? null;
        this.router.navigate(['/home'])
      },
      error: (err: any) => {
        if(err.status == 403){
          this.lblErrore = true;
        }else{
          console.log(err);
          alert(err.status + " : " + err.error);
        }
      }
    })
  }

  goToRegister() {
    this.Selected.emit("registration");
  }

  chiudi(){
    this.lblErrore = false;
  }
}
