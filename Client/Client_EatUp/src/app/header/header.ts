import { NgClass } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-header',
  imports: [NgClass],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  @Output() Selected = new EventEmitter<string>();

  isCollapsed: boolean = true;
  active: string = "home";

  onClickSelectFeature(feature: string) {
    this.active = feature;
    this.Selected.emit(this.active);
  }
}
