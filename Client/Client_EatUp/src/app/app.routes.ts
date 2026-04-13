import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Registration } from './registration/registration';
import { Login } from './login/login';
import { WeekProgram } from './week-program/week-program';
import { IngredientsRecipes } from './ingredients-recipes/ingredients-recipes';

export const routes: Routes = [
    { 
        path: '',
        redirectTo: '/home',
        pathMatch: 'full'
    },
    {
        path: 'home',
        component: Home
    },
    {
        path: 'registration',
        component: Registration
    },
    {
        path: 'login',
        component: Login
    },
    {
        path: 'week-program',
        component: WeekProgram
    },
    {
        path: 'ingredients-recipes',
        component: IngredientsRecipes
    }
];
