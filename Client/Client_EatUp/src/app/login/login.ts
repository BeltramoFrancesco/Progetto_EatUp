import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {

  @Output() Selected = new EventEmitter<string>();

  onLogin() {
    // torna alla home (app.html)
    this.Selected.emit("home");
  }

  goToRegister() {
    this.Selected.emit("registration");
  }
}