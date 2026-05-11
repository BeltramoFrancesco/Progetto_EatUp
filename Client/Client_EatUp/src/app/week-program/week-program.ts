import { Component, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommonService } from '../services/common-service';

type MealKey = 'colazione' | 'pranzo' | 'merenda' | 'cena';

interface WeekDayProgram {
  giorno: string;
  colazione?: string;
  pranzo?: string;
  merenda?: string;
  cena?: string;
}

@Component({
  selector: 'app-week-program',
  imports: [FormsModule, RouterLink],
  templateUrl: './week-program.html',
  styleUrl: './week-program.css',
})
export class WeekProgram {
  private commonService = inject(CommonService);

  calorie: number | null = null;
  proteine: number | null = null;
  carboidrati: number | null = null;
  grassi: number | null = null;
  fibre: number | null = null;
  preferenze = '';
  intolleranze = '';

  isLoading = false;
  errorMessage = '';
  weekProgram: WeekDayProgram[] = [];

  readonly meals: { key: MealKey; label: string }[] = [
    { key: 'colazione', label: 'Colazione' },
    { key: 'pranzo', label: 'Pranzo' },
    { key: 'merenda', label: 'Merenda' },
    { key: 'cena', label: 'Cena' },
  ];

  get isLoggedIn(): boolean {
    return !!this.commonService.currentUserEmail;
  }

  onSubmit(form: NgForm): void {
    this.errorMessage = '';

    if (form.invalid || !this.calorie || this.calorie <= 0) {
      Object.values(form.controls).forEach((control) => control.markAsTouched());
      return;
    }

    const payload = {
      calorie: this.calorie,
      proteine: this.proteine,
      carboidrati: this.carboidrati,
      grassi: this.grassi,
      fibre: this.fibre,
      preferenze: this.preferenze.trim(),
      intolleranze: this.intolleranze.trim(),
      formatoRisposta: {
        days: [
          {
            giorno: 'Lunedi',
            colazione: 'Nome piatto e porzione',
            pranzo: 'Nome piatto e porzione',
            merenda: 'Nome piatto e porzione',
            cena: 'Nome piatto e porzione',
          },
        ],
      },
    };

    this.isLoading = true;

    this.commonService.generateWeekProgram(payload).subscribe({
      next: (data: any) => {
        this.weekProgram = this.normalizeProgram(data);
        this.isLoading = false;

        if (this.weekProgram.length === 0) {
          this.errorMessage = 'La risposta ricevuta non contiene un programma settimanale valido.';
        }
      },
      error: (err: any) => {
        console.error('Failed to generate week program', err);
        this.errorMessage = 'Non sono riuscito a generare il programma. Riprova tra poco.';
        this.isLoading = false;
      },
    });
  }

  private normalizeProgram(data: any): WeekDayProgram[] {
    const parsedData = typeof data === 'string' ? this.parseJson(data) : data;
    const source =
      parsedData?.days ??
      parsedData?.weekProgram ??
      parsedData?.programma ??
      parsedData?.program ??
      parsedData;

    if (!Array.isArray(source)) {
      return [];
    }

    return source.map((day: any, index: number) => ({
      giorno: day?.giorno ?? day?.day ?? this.defaultDayName(index),
      colazione: this.mealText(day?.colazione ?? day?.breakfast),
      pranzo: this.mealText(day?.pranzo ?? day?.lunch),
      merenda: this.mealText(day?.merenda ?? day?.snack),
      cena: this.mealText(day?.cena ?? day?.dinner),
    }));
  }

  private parseJson(value: string): any {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }

  private mealText(meal: any): string {
    if (!meal) {
      return '';
    }

    if (typeof meal === 'string') {
      return meal;
    }

    const name = meal.nome ?? meal.name ?? meal.piatto ?? meal.title;
    const portion = meal.porzione ?? meal.portion ?? meal.quantita ?? meal.quantity;
    const calories = meal.calorie ?? meal.kcal;
    const details = [portion, calories ? `${calories} kcal` : ''].filter(Boolean).join(' - ');

    return [name, details].filter(Boolean).join(' | ') || JSON.stringify(meal);
  }

  private defaultDayName(index: number): string {
    return ['Lunedi', 'Martedi', 'Mercoledi', 'Giovedi', 'Venerdi', 'Sabato', 'Domenica'][index] ?? `Giorno ${index + 1}`;
  }
}
