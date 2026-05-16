import { Component, OnInit, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommonService } from '../services/common-service';

type MealKey = 'colazione' | 'pranzo' | 'merenda' | 'cena';

interface WeekDayProgram {
  giorno: string;
  date?: string;
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
export class WeekProgram implements OnInit {
  private commonService = inject(CommonService);

  calorie: number | null = null;
  proteine: number | null = null;
  carboidrati: number | null = null;
  grassi: number | null = null;
  fibre: number | null = null;
  preferenze = '';
  intolleranze = '';

  isLoading = false;
  isLoadingSavedProgram = false;
  errorMessage = '';
  weekProgram: WeekDayProgram[] = [];
  startDate = '';
  endDate = '';

  readonly meals: { key: MealKey; label: string }[] = [
    { key: 'colazione', label: 'Colazione' },
    { key: 'pranzo', label: 'Pranzo' },
    { key: 'merenda', label: 'Merenda' },
    { key: 'cena', label: 'Cena' },
  ];

  get isLoggedIn(): boolean {
    return !!this.commonService.currentUserEmail;
  }

  get todayProgram(): WeekDayProgram | undefined {
    return this.weekProgram.find((day) => day.date === this.todayIsoDate());
  }

  get hasWeekProgram(): boolean {
    return this.weekProgram.length > 0;
  }

  ngOnInit(): void {
    if (!this.isLoggedIn) {
      return;
    }

    this.loadSavedWeekProgram();
  }

  loadSavedWeekProgram(): void {
    this.isLoadingSavedProgram = true;

    this.commonService.getWeekProgram().subscribe({
      next: (data: any) => {
        this.applyWeekProgram(data);
        this.populatePreferences(data?.preferences);
        this.isLoadingSavedProgram = false;
      },
      error: (err: any) => {
        console.error('Failed to load saved week program', err);
        this.isLoadingSavedProgram = false;
      },
    });
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
        this.applyWeekProgram(data);
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

  private applyWeekProgram(data: any): void {
    const parsedData = typeof data === 'string' ? this.parseJson(data) : data;
    this.weekProgram = this.normalizeProgram(parsedData);
    this.startDate = parsedData?.startDate ?? this.weekProgram[0]?.date ?? '';
    this.endDate = parsedData?.endDate ?? this.weekProgram[this.weekProgram.length - 1]?.date ?? '';
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
      date: day?.date ?? day?.data ?? '',
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

  private populatePreferences(preferences: any): void {
    if (!preferences) {
      return;
    }

    this.calorie = preferences.calorie ?? this.calorie;
    this.proteine = preferences.proteine ?? this.proteine;
    this.carboidrati = preferences.carboidrati ?? this.carboidrati;
    this.grassi = preferences.grassi ?? this.grassi;
    this.fibre = preferences.fibre ?? this.fibre;
    this.preferenze = preferences.preferenze ?? this.preferenze;
    this.intolleranze = preferences.intolleranze ?? this.intolleranze;
  }

  private todayIsoDate(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
