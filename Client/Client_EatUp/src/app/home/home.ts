import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonService } from '../services/common-service';

type MealKey = 'colazione' | 'pranzo' | 'merenda' | 'cena';

interface TodayProgram {
  giorno: string;
  date?: string;
  colazione?: string;
  pranzo?: string;
  merenda?: string;
  cena?: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  private commonService = inject(CommonService);

  todayProgram: TodayProgram | null = null;
  readonly meals: { key: MealKey; label: string }[] = [
    { key: 'colazione', label: 'Colazione' },
    { key: 'pranzo', label: 'Pranzo' },
    { key: 'merenda', label: 'Merenda' },
    { key: 'cena', label: 'Cena' },
  ];

  features = [
    {
      title: 'Ingredienti smart',
      description: 'Seleziona quello che hai gia in cucina e lascia che EatUp trovi idee utili.',
    },
    {
      title: 'Ricette con AI',
      description: 'Ottieni ricette divise tra immediate, con pochi extra e da spesa mirata.',
    },
    {
      title: 'Programma settimanale',
      description: 'Genera colazione, pranzo, merenda e cena partendo dai tuoi obiettivi.',
    },
  ];

  ngOnInit(): void {
    if (!this.commonService.currentUserEmail) {
      return;
    }

    this.commonService.getWeekProgram().subscribe({
      next: (data: any) => {
        const days = Array.isArray(data?.days) ? data.days : [];
        this.todayProgram = days.find((day: any) => day?.date === this.todayIsoDate()) ?? null;
      },
      error: (err: any) => {
        console.error('Failed to load today program', err);
        this.todayProgram = null;
      },
    });
  }

  private todayIsoDate(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
