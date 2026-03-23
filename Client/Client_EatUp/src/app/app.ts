import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from "./header/header";
import { Registration } from "./registration/registration";
import { Login } from "./login/login";
import { WeekProgram } from "./week-program/week-program";
import { IngredientsRecipes } from "./ingredients-recipes/ingredients-recipes";
import { Home } from "./home/home";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Registration, Login, WeekProgram, IngredientsRecipes, Home],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  active: string = "home";

  onNavigate(feature: string) {
    this.active = feature;
  }
}
